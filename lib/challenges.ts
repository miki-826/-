import type { Challenge } from "./types";

export const fallbackChallenges: Challenge[] = [
  {
    character: "疲れ切ったコンビニ店員",
    script: "ありがとうございました。またお越しくださいませ。",
    emotion: "疲労",
    voiceStyle: "テンション低め、語尾が消えそう、少し早口",
    difficulty: "NORMAL",
    targetDuration: 4.5,
  },
  {
    character: "魔王みたいな上司",
    script: "この資料、明日の朝までに頼むぞ。",
    emotion: "圧力",
    voiceStyle: "低い声、ゆっくり、威圧感がある",
    difficulty: "HARD",
    targetDuration: 4.0,
  },
  {
    character: "泣きそうなAIロボット",
    script: "僕は、まだここにいてもいいの？",
    emotion: "不安",
    voiceStyle: "弱々しい、語尾が震える、少し間を空ける",
    difficulty: "NORMAL",
    targetDuration: 4.2,
  },
  {
    character: "テンション高いゲーム実況者",
    script: "ここでまさかの大逆転だー！",
    emotion: "興奮",
    voiceStyle: "大きな声、早口、語尾を伸ばす",
    difficulty: "EASY",
    targetDuration: 3.2,
  },
  {
    character: "寝起きのニュースキャスター",
    script: "本日の天気は、全国的に晴れとなるでしょう。",
    emotion: "眠気",
    voiceStyle: "落ち着いた声、少し眠そう、一定のテンポ",
    difficulty: "NORMAL",
    targetDuration: 5.0,
  },
  {
    character: "告白に失敗した高校生",
    script: "ごめん、今の、聞かなかったことにして。",
    emotion: "照れ・後悔",
    voiceStyle: "早口、声が小さい、語尾が消える",
    difficulty: "NORMAL",
    targetDuration: 4.0,
  },
  {
    character: "深夜のラジオパーソナリティ",
    script: "さて、そろそろお別れの時間です。おやすみなさい。",
    emotion: "落ち着き・余韻",
    voiceStyle: "低く滑らか、ゆっくり、甘い声",
    difficulty: "HARD",
    targetDuration: 5.2,
  },
  {
    character: "戦いに勝った勇者",
    script: "これで世界は救われた。みんな、よく戦ってくれた。",
    emotion: "達成感",
    voiceStyle: "力強い、堂々とした、ゆったり",
    difficulty: "NORMAL",
    targetDuration: 5.0,
  },
];

export function pickRandomChallenge(prev?: Challenge): Challenge {
  if (fallbackChallenges.length === 1) return fallbackChallenges[0];
  let next = fallbackChallenges[Math.floor(Math.random() * fallbackChallenges.length)];
  while (prev && next.script === prev.script) {
    next = fallbackChallenges[Math.floor(Math.random() * fallbackChallenges.length)];
  }
  return next;
}
