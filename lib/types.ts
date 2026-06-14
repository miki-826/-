export type Difficulty = "EASY" | "NORMAL" | "HARD";

export interface Challenge {
  character: string;
  script: string;
  emotion: string;
  voiceStyle: string;
  difficulty: Difficulty;
  targetDuration: number;
}

export interface AudioFeatures {
  duration: number;
  averageVolume: number;
  volumeVariance: number;
  silenceRatio: number;
}

export interface ScoreResult {
  scriptMatch: number;
  emotionMatch: number;
  speedMatch: number;
  intonationMatch: number;
  characterMatch: number;
  totalScore: number;
  title: string;
  goodPoint: string;
  improvement: string;
  comment: string;
}

export interface RankingEntry extends ScoreResult {
  id: string;
  playerName: string;
  characterName: string;
  script: string;
  voiceStyle: string;
  difficulty: Difficulty;
  createdAt: number;
}
