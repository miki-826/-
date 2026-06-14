"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NeonButton from "@/components/NeonButton";
import ScoreDigits from "@/components/ScoreDigits";
import RadarChart from "@/components/RadarChart";
import WaveVisualizer from "@/components/WaveVisualizer";
import { pickRandomChallenge } from "@/lib/challenges";
import { scoreLocally } from "@/lib/scoring";
import { sound } from "@/lib/sound";
import {
  AudioCapture,
  cancelSpeak,
  isSpeechRecognitionSupported,
  speak,
  startRecognition,
  type RecognitionHandle,
} from "@/lib/speech";
import { loadRanking, saveScore, topRanking } from "@/lib/ranking";
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
  "文字起こしを照合中...",
  "話速を計測中...",
  "音量変化から抑揚を解析中...",
  "キャラクター再現度を推定中...",
  "総合スコアを算出中...",
];

function styleToProsody(voiceStyle: string): { rate: number; pitch: number } {
  let rate = 1;
  let pitch = 1;
  if (/早口/.test(voiceStyle)) rate += 0.25;
  if (/ゆっくり|落ち着/.test(voiceStyle)) rate -= 0.25;
  if (/弱々|消えそう|眠/.test(voiceStyle)) rate -= 0.1;
  if (/低い|威圧/.test(voiceStyle)) pitch -= 0.3;
  if (/高い|テンション高|興奮/.test(voiceStyle)) pitch += 0.25;
  if (/震/.test(voiceStyle)) pitch += 0.1;
  return {
    rate: Math.max(0.6, Math.min(1.6, rate)),
    pitch: Math.max(0.5, Math.min(1.8, pitch)),
  };
}

export default function Game() {
  const [screen, setScreen] = useState<Screen>("title");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [recState, setRecState] = useState<"idle" | "recording" | "recorded">(
    "idle"
  );
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [manualText, setManualText] = useState("");
  const [features, setFeatures] = useState<AudioFeatures | null>(null);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [muted, setMuted] = useState(false);
  const [recSupported, setRecSupported] = useState(true);
  const [micError, setMicError] = useState(false);
  const [started, setStarted] = useState(false);

  const captureRef = useRef<AudioCapture | null>(null);
  const recognitionRef = useRef<RecognitionHandle | null>(null);

  useEffect(() => {
    setRecSupported(isSpeechRecognitionSupported());
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
    setTranscript("");
    setManualText("");
    setFeatures(null);
    setRecordUrl(null);
    setResult(null);
    setSavedId(null);
    setRecState("idle");
  }, []);

  // ===== お手本再生 =====
  const playSample = () => {
    if (!challenge || speaking) return;
    const { rate, pitch } = styleToProsody(challenge.voiceStyle);
    setSpeaking(true);
    speak(challenge.script, {
      rate,
      pitch,
      onstart: () => setSpeaking(true),
      onend: () => setSpeaking(false),
    });
  };

  // ===== 録音 =====
  const startRecording = async () => {
    if (!challenge) return;
    cancelSpeak();
    setSpeaking(false);
    setMicError(false);
    setTranscript("");
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
    if (recSupported) {
      recognitionRef.current = startRecognition(
        (text) => setTranscript(text),
        () => {}
      );
    }
  };

  const stopRecording = async () => {
    const cap = captureRef.current;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    sound.playSfx("record-stop");
    if (!cap) {
      setRecState("recorded");
      return;
    }
    const { features: f, url } = await cap.stop();
    setFeatures(f);
    setRecordUrl(url);
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
    const finalTranscript = (recSupported && transcript ? transcript : manualText).trim();
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
        const r = scoreLocally(challenge, finalTranscript, f);
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
  const register = () => {
    if (!challenge || !result) return;
    const entry = saveScore(playerName, result, challenge);
    setSavedId(entry.id);
    setRanking(topRanking(10));
    sound.playSfx("success");
    go("ranking");
  };

  const openRanking = () => {
    setRanking(topRanking(10));
    go("ranking");
  };

  const toggleMute = () => {
    setMuted(sound.toggleMute());
  };

  const retry = () => {
    cancelSpeak();
    newChallenge();
    go("challenge");
    sound.playSfx("whoosh");
  };

  const backTitle = () => {
    cancelSpeak();
    captureRef.current?.dispose();
    go("title");
  };

  return (
    <div
      className="app-root"
      style={{ backgroundImage: `url(${BG[screen]})` }}
    >
      <button className="bgm-toggle" onClick={toggleMute} title="BGM切り替え">
        {muted ? "🔇" : "🔊"}
      </button>

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
        />
      )}

      {screen === "howto" && <HowtoScreen onBack={() => go("title")} recSupported={recSupported} />}

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
          transcript={transcript}
          manualText={manualText}
          setManualText={setManualText}
          recSupported={recSupported}
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
}: {
  onStart: () => void;
  onRanking: () => void;
  onHowto: () => void;
}) {
  return (
    <div className="screen">
      <img className="title-hero" src="/images/title.png" alt="ドッペルマスター" />
      <p className="subcopy">
        AIの声を聞いて、
        <br />
        もう一人の声を演じろ。
      </p>
      <div className="stack" style={{ alignItems: "center", marginTop: 6 }}>
        <NeonButton variant="cyan" onClick={onStart} sfx="start">
          スタート
        </NeonButton>
        <NeonButton variant="purple" onClick={onRanking}>
          ランキング
        </NeonButton>
        <NeonButton variant="cyan2" onClick={onHowto}>
          遊び方
        </NeonButton>
      </div>
    </div>
  );
}

function HowtoScreen({
  onBack,
  recSupported,
}: {
  onBack: () => void;
  recSupported: boolean;
}) {
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
        {!recSupported && (
          <p className="note" style={{ marginTop: 12, borderColor: "#ff3df0" }}>
            お使いのブラウザは音声認識に対応していません。Chrome推奨です。
            未対応の場合は、録音後にテキスト入力で採点できます。
          </p>
        )}
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
  transcript,
  manualText,
  setManualText,
  recSupported,
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
  transcript: string;
  manualText: string;
  setManualText: (s: string) => void;
  recSupported: boolean;
  micError: boolean;
  onPlaySample: () => void;
  onStart: () => void;
  onStop: () => void;
  onPlayOwn: () => void;
  onScore: () => void;
  onBack: () => void;
}) {
  const ready = recState === "recorded" || micError;
  const needManual = ready && (!recSupported || !transcript.trim());
  const canScore = ready && (transcript.trim() !== "" || manualText.trim() !== "");

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
        {micError && (
          <p className="note" style={{ borderColor: "#ff3df0", marginTop: 10 }}>
            マイクを使用できませんでした。下のテキスト入力で採点に進めます。
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

          {recSupported && transcript.trim() && (
            <div className="full">
              <p className="hint">認識結果：</p>
              <div className="transcript-box">{transcript}</div>
            </div>
          )}

          {needManual && (
            <div className="full gap8">
              <p className="note">
                {recSupported
                  ? "音声認識に失敗しました。読んだ内容をテキストで入力してください。"
                  : "このブラウザは音声認識に未対応です。読んだ内容を入力してください。"}
              </p>
              <input
                className="text-input"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={challenge.script}
              />
            </div>
          )}

          <NeonButton variant="cyan" onClick={onScore} disabled={!canScore}>
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
  playerName,
  setPlayerName,
  saved,
  onRegister,
  onRetry,
  onRanking,
}: {
  challenge: Challenge;
  result: ScoreResult;
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
