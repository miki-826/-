import type { RankingEntry, ScoreResult, Challenge } from "./types";

const KEY = "doppel-master-ranking";

export function loadRanking(): RankingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RankingEntry[];
    return sortRanking(list);
  } catch {
    return [];
  }
}

function sortRanking(list: RankingEntry[]): RankingEntry[] {
  return [...list].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.createdAt - a.createdAt;
  });
}

export function saveScore(
  playerName: string,
  result: ScoreResult,
  challenge: Challenge
): RankingEntry {
  const entry: RankingEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2),
    playerName: playerName.slice(0, 20) || "guest",
    ...result,
    characterName: challenge.character,
    script: challenge.script,
    voiceStyle: challenge.voiceStyle,
    difficulty: challenge.difficulty,
    createdAt: Date.now(),
  };
  const list = loadRanking();
  list.push(entry);
  const sorted = sortRanking(list).slice(0, 100);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sorted));
  } catch {
    /* noop */
  }
  return entry;
}

export function topRanking(limit = 10): RankingEntry[] {
  return loadRanking().slice(0, limit);
}
