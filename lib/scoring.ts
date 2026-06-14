import type { AudioFeatures, Challenge, ScoreResult } from "./types";

const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, Math.round(n)));

function normalize(s: string): string {
  return s
    .replace(/[。、，．,.!！?？「」\s]/g, "")
    .replace(/[ぁ-ん]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60)
    )
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] =
        a[i - 1] === b[j - 1]
          ? prev
          : Math.min(prev, dp[i], dp[i - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[m];
}

export function scriptSimilarity(target: string, user: string): number {
  const a = normalize(target);
  const b = normalize(user);
  if (!b) return 0;
  if (!a) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return clamp((1 - dist / maxLen) * 100);
}

export function speedScore(target: number, actual: number): number {
  return clamp(100 - Math.abs(target - actual) * 15);
}

function pitchHeightScore(features: AudioFeatures): number {
  const pitch = features.pitchAverage ?? 0;
  if (!pitch) return 45;
  const lowPenalty = Math.max(0, 90 - pitch) * 0.9;
  const highPenalty = Math.max(0, pitch - 360) * 0.55;
  return clamp(100 - lowPenalty - highPenalty, 35, 100);
}

export function intonationScore(features: AudioFeatures): number {
  const variance = features.volumeVariance ?? 0;
  const dynamicRange = features.volumeDynamicRange ?? variance;
  const waveformMotion = features.waveformMotion ?? 0;
  const pitchRange = features.pitchRange ?? 0;
  const pitchVariation = features.pitchVariation ?? 0;

  const volumeExpression = clamp(
    (variance / 0.12) * 40 +
      (dynamicRange / 0.22) * 40 +
      (waveformMotion / 0.035) * 20
  );
  const pitchExpression = clamp(
    (pitchRange / 7) * 65 + (pitchVariation / 4.2) * 35
  );
  const pitchHeight = pitchHeightScore(features);
  const continuity = clamp((1 - features.silenceRatio) * 100);

  return clamp(
    volumeExpression * 0.34 +
      pitchExpression * 0.34 +
      pitchHeight * 0.18 +
      continuity * 0.14,
    5,
    100
  );
}

const TITLES: { min: number; title: string }[] = [
  { min: 95, title: "完全ドッペルマスター" },
  { min: 90, title: "声マネの支配者" },
  { min: 80, title: "かなり似てる演者" },
  { min: 70, title: "雰囲気コピー職人" },
  { min: 60, title: "惜しい声マネ師" },
  { min: 50, title: "方向性は合ってる人" },
  { min: 0, title: "別人格爆誕" },
];

export function titleForScore(score: number): string {
  return TITLES.find((t) => score >= t.min)!.title;
}

function emotionScoreLocal(
  features: AudioFeatures,
  challenge: Challenge,
  scriptMatch: number
): number {
  const peak = features.volumePeak ?? features.averageVolume;
  const measuredEnergy = clamp(
    ((features.averageVolume * 0.55 + peak * 0.45) / 0.12) * 100
  );
  const prosody = intonationScore(features);
  const pitchHeight = pitchHeightScore(features);
  const newBase =
    scriptMatch * 0.24 +
    measuredEnergy * 0.24 +
    prosody * 0.36 +
    pitchHeight * 0.16;
  const lowEmotion = /疲労|眠気|落ち着き|余韻/.test(challenge.emotion);
  const adjusted = lowEmotion
    ? newBase * 0.72 + (100 - measuredEnergy) * 0.28
    : newBase;
  return clamp(adjusted);
}

function characterScoreLocal(
  scriptMatch: number,
  emotionMatch: number,
  speedMatch: number,
  intonation: number
): number {
  return clamp(
    scriptMatch * 0.3 +
      emotionMatch * 0.3 +
      speedMatch * 0.2 +
      intonation * 0.2
  );
}

function buildComment(
  challenge: Challenge,
  r: Omit<ScoreResult, "comment" | "goodPoint" | "improvement" | "title">,
  features: AudioFeatures
): { goodPoint: string; improvement: string; comment: string } {
  const parts: { key: string; label: string; val: number }[] = [
    { key: "script", label: "セリフの長さ・発話量", val: r.scriptMatch },
    { key: "emotion", label: `「${challenge.emotion}」の表現`, val: r.emotionMatch },
    { key: "speed", label: "話す速さ", val: r.speedMatch },
    { key: "into", label: "声の抑揚", val: r.intonationMatch },
    { key: "char", label: `${challenge.character}らしさ`, val: r.characterMatch },
  ];
  const best = [...parts].sort((a, b) => b.val - a.val)[0];
  const worst = [...parts].sort((a, b) => a.val - b.val)[0];

  const goodPoint = `${best.label}がかなり近かったです。`;

  let improvement: string;
  if (worst.key === "speed") {
    improvement =
      features.duration > challenge.targetDuration
        ? "お手本より少しゆっくりでした。次はテンポを上げてみましょう。"
        : "お手本より少し早口でした。次はもう少し間をとると似ます。";
  } else if (worst.key === "into") {
    improvement = "声の上がり下がりをもう少し大きくつけると、さらに似ます。";
  } else if (worst.key === "script") {
    improvement =
      features.silenceRatio > 0.4
        ? "無音が多めでした。セリフをしっかり最後まで読むと上がります。"
        : "発話量がお手本と少しズレていました。長さを合わせてみましょう。";
  } else if (worst.key === "emotion") {
    improvement = `「${challenge.emotion}」の感情をもう一歩のせてみましょう。`;
  } else {
    improvement = `${challenge.character}になりきると、さらに化けます。`;
  }

  const comment =
    r.totalScore >= 80
      ? "全体的に再現度が高く、キャラクターの雰囲気もよく出ていました。"
      : r.totalScore >= 60
        ? "方向性はばっちりです。あと少しの作り込みでぐっと似ます。"
        : "雰囲気は掴めています。お手本をもう一度聞いてリトライしてみましょう。";

  return { goodPoint, improvement, comment };
}

/** 発話量（無音率と話速）からセリフ再現度を推定する（文字起こし不要） */
function speechMatchFromAudio(
  features: AudioFeatures,
  speedMatch: number
): number {
  const voiceActivity = clamp((1 - features.silenceRatio) * 100);
  const articulation = clamp(((features.waveformMotion ?? 0) / 0.035) * 100);
  return clamp(voiceActivity * 0.45 + speedMatch * 0.35 + articulation * 0.2);
}

/**
 * ローカル採点。OpenAI APIキー不要・文字起こし不要で動作するMVP実装。
 * 録音した音声の特徴量（長さ・音量波形・抑揚・ピッチ・無音率）だけで採点する。
 */
export function scoreLocally(
  challenge: Challenge,
  features: AudioFeatures
): ScoreResult {
  const speedMatch = speedScore(challenge.targetDuration, features.duration);
  const scriptMatch = speechMatchFromAudio(features, speedMatch);
  const intonationMatch = intonationScore(features);
  const emotionMatch = emotionScoreLocal(features, challenge, scriptMatch);
  const characterMatch = characterScoreLocal(
    scriptMatch,
    emotionMatch,
    speedMatch,
    intonationMatch
  );
  const totalScore = clamp(
    scriptMatch * 0.3 +
      emotionMatch * 0.2 +
      speedMatch * 0.15 +
      intonationMatch * 0.15 +
      characterMatch * 0.2
  );
  const title = titleForScore(totalScore);
  const { goodPoint, improvement, comment } = buildComment(
    challenge,
    {
      scriptMatch,
      emotionMatch,
      speedMatch,
      intonationMatch,
      characterMatch,
      totalScore,
    },
    features
  );

  return {
    scriptMatch,
    emotionMatch,
    speedMatch,
    intonationMatch,
    characterMatch,
    totalScore,
    title,
    goodPoint,
    improvement,
    comment,
  };
}
