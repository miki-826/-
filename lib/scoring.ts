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

export function intonationScore(features: AudioFeatures): number {
  // 音量変化が大きいほど抑揚があるとみなす（MVP簡易版）
  const variance = features.volumeVariance ?? 0;
  const raw = (variance / 0.35) * 100;
  return clamp(raw, 5, 100);
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
  // セリフが合っていて、ある程度の音量と抑揚があれば感情も乗っていると推定
  const energy = clamp((features.averageVolume / 0.55) * 100, 0, 100);
  const expr = intonationScore(features);
  const base = scriptMatch * 0.35 + energy * 0.35 + expr * 0.3;
  const lowEmotion = /疲労|眠気|落ち着き|余韻/.test(challenge.emotion);
  // 低テンション系のお題は音量控えめでも減点しすぎない
  const adjusted = lowEmotion ? base * 0.6 + (100 - energy) * 0.4 : base;
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
    { key: "script", label: "セリフの再現", val: r.scriptMatch },
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
    improvement = "セリフをもう少しはっきり読むと一致度が上がります。";
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

/**
 * ローカル採点。OpenAI APIキー不要で動作するMVP実装。
 */
export function scoreLocally(
  challenge: Challenge,
  userTranscript: string,
  features: AudioFeatures
): ScoreResult {
  const scriptMatch = scriptSimilarity(challenge.script, userTranscript);
  const speedMatch = speedScore(challenge.targetDuration, features.duration);
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
