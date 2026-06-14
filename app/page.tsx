"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NeonButton from "@/components/NeonButton";
import ScoreDigits from "@/components/ScoreDigits";
import RadarChart from "@/components/RadarChart";
import WaveVisualizer from "@/components/WaveVisualizer";
import Waveform from "@/components/Waveform";
import { pickRandomChallenge } from "@/lib/challenges";
import { scoreLocally } from "@/lib/scoring";
import { sound } from "@/lib/sound";
import { AudioCapture } from "@/lib/speech";
import { playSampleVoice, stopSample } from "@/lib/tts";
import { saveScore, topRanking } from "@/lib/ranking";
import type {
  AudioFeatures,
  Challenge,
  RankingEntry,
  ScoreResult,
} from "@/lib/types";

type Screen =
  | "title"
  | "howto"
  | "challenge"
  | "record"
  | "analyzing"
  | "result"
  | "ranking";

const BG: Record<Screen, string> = {
  title: "/images/bg2.png",
  howto: "/images/bg2.png",
  challenge: "/images/bg1.png",
  record: "/images/bg1.png",
  analyzing: "/images/bg1.png",
  result: "/images/bg-stage.png",
  ranking: "/images/bg2.png",
};

const ANALYZE_LINES = [
  "音声波形を読み込み中...",
  "発話量・無音区間を解析中...",
  "話速を計測中...",
  "音量変化から抑揚を解析中...",
  "キャラクター再現度を推定中...",
  "総合スコアを算出中...",
];

export default function Game() {
  const [screen, setScreen] = useState<Screen>("title");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [recState, setRecState] = useState<"idle" | "recording" | "recorded">(
    "idle"
  );
  const [level, setLevel] = useState(0);
  const [features, setFeatures] = useState<AudioFeatures | null>(null);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [micError, setMicError] = useState(false);
  const [started, setStarted] = useState(false);

  const captureRef = useRef<AudioCapture | null>(null);

  useEffect(() => {
    // 音声リスト読み込みを促す
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // 画面とビジー状態に応じてBGMを制御（お手本再生中・録音中は停止）
  useEffect(() => {
    if (!started) return;
    const busy = speaking || recState === "recording";
    if (busy) {
      sound.stopBgm();
    } else if (screen === "analyzing" || screen === "result") {
      sound.playBgm("scoring");
    } else {
      sound.playBgm("title");
    }
  }, [screen, speaking, recState, started]);

  const go = useCallback((s: Screen) => {
    setScreen(s);
  }, []);

  const handleStart = () => {
    setStarted(true);
    sound.playBgm("title");
    newChallenge();
    go("challenge");
  };

  const newChallenge = useCallback(() => {
    setChallenge((prev) => pickRandomChallenge(prev ?? undefined));
    setFeatures(null);
    setRecordUrl(null);
    setWaveform([]);
    setResult(null);
    setSavedId(null);
    setMicError(false);
    setRecState("idle");
  }, []);

  // ===== お手本再生 =====
  const playSample = () => {
    if (!challenge || speaking) return;
    setSpeaking(true);
    playSampleVoice(challenge.script, {
      character: challenge.character,
      emotion: challenge.emotion,
      voiceStyle: challenge.voiceStyle,
      onend: () => setSpeaking(false),
    });
  };

  // ===== 録音 =====
  const startRecording = async () => {
    if (!challenge) return;
    stopSample();
    setSpeaking(false);
    setMicError(false);
    const cap = new AudioCapture();
    cap.onLevel = (l) => setLevel(l);
    try {
      await cap.start();
    } catch {
      setMicError(true);
      return;
    }
    captureRef.current = cap;
    sound.playSfx("record-start");
    setRecState("recording");
  };

  const stopRecording = async () => {
    const cap = captureRef.current;
    sound.playSfx("record-stop");
    if (!cap) {
      setRecState("recorded");
      return;
    }
    const { features: f, url, waveform: wf } = await cap.stop();
    setFeatures(f);
    setRecordUrl(url);
    setWaveform(wf);
    setLevel(0);
    setRecState("recorded");
  };

  const playOwnVoice = () => {
    if (!recordUrl) return;
    const a = new Audio(recordUrl);
    a.play().catch(() => {});
  };

  // ===== 採点 =====
  const runScoring = () => {
    if (!challenge) return;
    const f: AudioFeatures =
      features ?? {
        duration: challenge.targetDuration,
        averageVolume: 0.4,
        volumeVariance: 0.15,
        silenceRatio: 0.2,
      };
    setAnalyzeStep(0);
    go("analyzing");
    sound.playSfx("analyze");

    let step = 0;
    const timer = setInterval(() => {
      step++;
      setAnalyzeStep(step);
      if (step >= ANALYZE_LINES.length) {
        clearInterval(timer);
        const r = scoreLocally(challenge, f);
        setResult(r);
        setTimeout(() => {
          go("result");
          if (r.totalScore >= 90) sound.playSfx("highscore", 0.8);
          else if (r.totalScore >= 50) sound.playSfx("success", 0.7);
          else sound.playSfx("error", 0.6);
        }, 450);
      }
    }, 520);
  };

  // ===== ランキング =====
  const register = async () => {
    if (!challenge || !result) return;
    sound.playSfx("success");
    const entry = await saveScore(playerName, result, challenge);
    setSavedId(entry.id);
    setRanking(await topRanking(10));
    go("ranking");
  };

  const openRanking = async () => {
    go("ranking");
    setRanking(await topRanking(10));
  };

  const toggleMute = () => {
    setMuted(sound.toggleMute());
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    sound.setMaster(v);
    setMuted(v <= 0);
  };

  const retry = () => {
    stopSample();
    newChallenge();
    go("challenge");
    sound.playSfx("whoosh");
  };

  const backTitle = () => {
    stopSample();
    captureRef.current?.dispose();
    go("title");
  };

  return (
    <div
      className="app-root"
      style={{
        backgroundImage: screen === "title" ? "none" : `url(${BG[screen]})`,
      }}
    >
      {screen !== "title" && (
      <div className="sound-ctrl">
        <button className="bgm-toggle" onClick={toggleMute} title="ミュート切り替え">
          {muted || volume <= 0 ? "🔇" : "🔊"}
        </button>
        <input
          className="vol-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(parseFloat(e.target.value))}
          title="音量"
          aria-label="音量"
        />
      </div>
      )}

      {screen === "title" && (
        <TitleScreen
          onStart={handleStart}
          onRanking={() => {
            setStarted(true);
            sound.playBgm("title");
            openRanking();
          }}
          onHowto={() => {
            setStarted(true);
            sound.playBgm("title");
            go("howto");
          }}
          onSound={toggleMute}
        />
      )}

      {screen === "howto" && <HowtoScreen onBack={() => go("title")} />}

      {screen === "challenge" && challenge && (
        <ChallengeScreen
          challenge={challenge}
          speaking={speaking}
          onPlaySample={playSample}
          onRegen={() => {
            newChallenge();
            sound.playSfx("whoosh");
          }}
          onNext={() => go("record")}
          onBack={backTitle}
        />
      )}

      {screen === "record" && challenge && (
        <RecordScreen
          challenge={challenge}
          speaking={speaking}
          recState={recState}
          level={level}
          waveform={waveform}
          micError={micError}
          onPlaySample={playSample}
          onStart={startRecording}
          onStop={stopRecording}
          onPlayOwn={playOwnVoice}
          onScore={runScoring}
          onBack={() => go("challenge")}
        />
      )}

      {screen === "analyzing" && (
        <AnalyzingScreen step={analyzeStep} />
      )}

      {screen === "result" && challenge && result && (
        <ResultScreen
          challenge={challenge}
          result={result}
          waveform={waveform}
          playerName={playerName}
          setPlayerName={setPlayerName}
          saved={savedId !== null}
          onRegister={register}
          onRetry={retry}
          onRanking={openRanking}
        />
      )}

      {screen === "ranking" && (
        <RankingScreen
          ranking={ranking}
          meId={savedId}
          onBack={() => go("title")}
          onPlay={() => {
            if (!started) setStarted(true);
            newChallenge();
            go("challenge");
          }}
        />
      )}
    </div>
  );
}

/* ===================== Screens ===================== */

function TitleScreen({
  onStart,
  onRanking,
  onHowto,
  onSound,
}: {
  onStart: () => void;
  onRanking: () => void;
  onHowto: () => void;
  onSound: () => void;
}) {
  return (
    <div className="title-screen">
      <div className="title-stage" aria-label="DOPPEL MASTER">
        <img
          className="title-screen-image"
          src="/images/title-screen.png"
          alt="DOPPEL MASTER"
        />
        <button
          className="title-hotspot title-hotspot-sound"
          aria-label="sound"
          onClick={onSound}
        />
        <button
          className="title-hotspot title-hotspot-start"
          aria-label="start"
          onClick={onStart}
        />
        <button
          className="title-hotspot title-hotspot-ranking"
          aria-label="ranking"
          onClick={onRanking}
        />
        <button
          className="title-hotspot title-hotspot-howto"
          aria-label="howto"
          onClick={onHowto}
        />
        {false && (
        <div className="title-menu">
          <NeonButton variant="cyan" onClick={onStart} sfx="start" fluid>
            スタート
          </NeonButton>
          <NeonButton variant="purple" onClick={onRanking} fluid>
            ランキング
          </NeonButton>
          <NeonButton variant="cyan2" onClick={onHowto} fluid>
            遊び方
          </NeonButton>
        </div>
        )}
      </div>
    </div>
  );
}

function HowtoScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <h1 className="screen-heading">遊び方</h1>
      <div className="panel">
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: "1.02rem" }}>
          <li>AIのお手本ボイスを聞く</li>
          <li>同じセリフをできるだけ似せて読む</li>
          <li>AIが声マネ度を採点</li>
          <li>レーダーチャートで結果を確認</li>
          <li>高得点ならランキング入り！</li>
        </ol>
      </div>
      <div className="panel">
        <p className="note">
          このアプリは声マネ採点ゲームです。
          <br />
          他人の声を無断で録音・使用しないでください。
          <br />
          録音データは採点のためだけに使用し、ブラウザ内で破棄されます（保存されません）。
        </p>
        <p className="note" style={{ marginTop: 12 }}>
          採点は録音した声の波形（長さ・音量・抑揚）をもとに行います。文字起こしは行いません。
          マイクの使用を許可してください（Chrome推奨）。
        </p>
      </div>
      <NeonButton variant="purple" onClick={onBack}>
        タイトルへ
      </NeonButton>
    </div>
  );
}

function ChallengeScreen({
  challenge,
  speaking,
  onPlaySample,
  onRegen,
  onNext,
  onBack,
}: {
  challenge: Challenge;
  speaking: boolean;
  onPlaySample: () => void;
  onRegen: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="screen">
      <h1 className="screen-heading">お題</h1>
      <div className="panel">
        <div className="kv">
          <span className="k">キャラ</span>
          <span className="v">{challenge.character}</span>
          <span className="k">感情</span>
          <span className="v">{challenge.emotion}</span>
          <span className="k">話し方</span>
          <span className="v">{challenge.voiceStyle}</span>
          <span className="k">難易度</span>
          <span className="v">
            <span className={`badge ${challenge.difficulty}`}>
              {challenge.difficulty}
            </span>
          </span>
        </div>
        <hr style={{ border: "none", borderTop: "1px solid rgba(45,226,255,0.2)", margin: "16px 0" }} />
        <p className="script-line">「{challenge.script}」</p>
        <WaveVisualizer active={speaking} />
      </div>

      <div className="btn-row">
        <NeonButton variant="cyan" onClick={onPlaySample} disabled={speaking}>
          {speaking ? "再生中..." : "お手本を聞く"}
        </NeonButton>
        <NeonButton variant="purple2" onClick={onRegen} small>
          別のお題
        </NeonButton>
      </div>
      <NeonButton variant="cyan2" onClick={onNext}>
        録音へ進む
      </NeonButton>
      <button className="muted" style={{ background: "none", border: "none", textDecoration: "underline" }} onClick={onBack}>
        タイトルへ戻る
      </button>
    </div>
  );
}

function RecordScreen({
  challenge,
  speaking,
  recState,
  level,
  waveform,
  micError,
  onPlaySample,
  onStart,
  onStop,
  onPlayOwn,
  onScore,
  onBack,
}: {
  challenge: Challenge;
  speaking: boolean;
  recState: "idle" | "recording" | "recorded";
  level: number;
  waveform: number[];
  micError: boolean;
  onPlaySample: () => void;
  onStart: () => void;
  onStop: () => void;
  onPlayOwn: () => void;
  onScore: () => void;
  onBack: () => void;
}) {
  const ready = recState === "recorded" || micError;

  return (
    <div className="screen">
      <h1 className="screen-heading">録音</h1>
      <div className="panel">
        <p className="hint center">お手本を真似して読んでください</p>
        <p className="script-line">「{challenge.script}」</p>
        <WaveVisualizer active={recState === "recording" || speaking} level={recState === "recording" ? level : undefined} />
        {recState === "recording" && (
          <div className="rec-status">
            <span className="rec-dot" /> 録音中...
          </div>
        )}
        {recState === "recorded" && waveform.length > 0 && (
          <div className="full" style={{ marginTop: 8 }}>
            <p className="wave-label">録音した声の波形</p>
            <Waveform data={waveform} height={80} />
          </div>
        )}
        {micError && (
          <p className="note" style={{ borderColor: "#ff3df0", marginTop: 10 }}>
            マイクを使用できませんでした。マイクを許可するか、このまま採点に進めます。
          </p>
        )}
      </div>

      <div className="btn-row">
        <NeonButton variant="cyan2" onClick={onPlaySample} small disabled={speaking || recState === "recording"}>
          お手本
        </NeonButton>
        {recState !== "recording" ? (
          <NeonButton variant="cyan" onClick={onStart} sfx={null} disabled={speaking}>
            {recState === "recorded" ? "録り直す" : "録音開始"}
          </NeonButton>
        ) : (
          <NeonButton variant="purple" onClick={onStop} sfx={null}>
            録音停止
          </NeonButton>
        )}
      </div>

      {ready && (
        <div className="stack" style={{ alignItems: "center" }}>
          {recState === "recorded" && (
            <NeonButton variant="purple2" onClick={onPlayOwn} small>
              自分の声を聞く
            </NeonButton>
          )}

          <NeonButton variant="cyan" onClick={onScore}>
            採点する
          </NeonButton>
        </div>
      )}

      <button className="muted" style={{ background: "none", border: "none", textDecoration: "underline" }} onClick={onBack}>
        お題に戻る
      </button>
    </div>
  );
}

function AnalyzingScreen({ step }: { step: number }) {
  return (
    <div className="screen">
      <h1 className="screen-heading">採点中...</h1>
      <div className="spinner-ring" />
      <div className="panel">
        <div className="analyze-log">
          {ANALYZE_LINES.slice(0, step + 1).map((line, i) => (
            <div key={i} className={i < step ? "done" : ""}>
              {i < step ? "✓ " : "> "}
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  challenge,
  result,
  waveform,
  playerName,
  setPlayerName,
  saved,
  onRegister,
  onRetry,
  onRanking,
}: {
  challenge: Challenge;
  result: ScoreResult;
  waveform: number[];
  playerName: string;
  setPlayerName: (s: string) => void;
  saved: boolean;
  onRegister: () => void;
  onRetry: () => void;
  onRanking: () => void;
}) {
  const radar = [
    { label: "セリフ", value: result.scriptMatch },
    { label: "感情", value: result.emotionMatch },
    { label: "話速", value: result.speedMatch },
    { label: "抑揚", value: result.intonationMatch },
    { label: "キャラ", value: result.characterMatch },
  ];
  return (
    <div className="screen">
      <h1 className="screen-heading">結果</h1>
      <ScoreDigits value={result.totalScore} />
      <p className="rank-title">{result.title}</p>

      {waveform.length > 0 && (
        <div className="panel">
          <p className="wave-label">あなたの声の波形</p>
          <Waveform data={waveform} height={88} />
        </div>
      )}

      <div className="panel">
        <div className="radar-wrap">
          <RadarChart data={radar} size={300} />
        </div>
      </div>

      <div className="panel">
        <h2>AIコメント</h2>
        <p className="comment">{result.comment}</p>
        <div className="good-bad">
          <div className="item good">◎ {result.goodPoint}</div>
          <div className="item bad">△ {result.improvement}</div>
        </div>
      </div>

      {!saved ? (
        <div className="panel gap8">
          <h2>ランキング登録</h2>
          <input
            className="text-input"
            value={playerName}
            maxLength={20}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="プレイヤー名（20文字以内）"
          />
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <NeonButton variant="cyan" onClick={onRegister}>
              ランキングに登録
            </NeonButton>
          </div>
        </div>
      ) : (
        <p className="center muted">ランキングに登録しました！</p>
      )}

      <div className="btn-row">
        <NeonButton variant="purple" onClick={onRetry} small>
          もう一度
        </NeonButton>
        <NeonButton variant="purple2" onClick={onRanking} small>
          ランキング
        </NeonButton>
      </div>
    </div>
  );
}

function RankingScreen({
  ranking,
  meId,
  onBack,
  onPlay,
}: {
  ranking: RankingEntry[];
  meId: string | null;
  onBack: () => void;
  onPlay: () => void;
}) {
  return (
    <div className="screen">
      <h1 className="screen-heading">RANKING</h1>
      <div className="panel">
        {ranking.length === 0 ? (
          <p className="center muted">まだ記録がありません。最初の声マネ王になろう！</p>
        ) : (
          <table className="rank-table">
            <thead>
              <tr>
                <th>順位</th>
                <th>プレイヤー</th>
                <th>称号</th>
                <th style={{ textAlign: "right" }}>スコア</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.id} className={r.id === meId ? "me" : ""}>
                  <td className="pos">{i + 1}</td>
                  <td>{r.playerName}</td>
                  <td className="muted" style={{ fontSize: "0.82rem" }}>
                    {r.title}
                  </td>
                  <td className="score">
                    <div className="score-mini-row" style={{ justifyContent: "flex-end" }}>
                      <ScoreDigits value={r.totalScore} mini suffix={null} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="btn-row">
        <NeonButton variant="cyan" onClick={onPlay} small>
          プレイする
        </NeonButton>
        <NeonButton variant="purple" onClick={onBack} small>
          タイトルへ
        </NeonButton>
      </div>
    </div>
  );
}
