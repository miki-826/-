import type { RankingEntry, ScoreResult, Challenge } from "./types";

const KEY = "doppel-master-ranking";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

function sortRanking(list: RankingEntry[]): RankingEntry[] {
  return [...list].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.createdAt - a.createdAt;
  });
}

/* ===== localStorage（既定。Supabase未設定でも動く） ===== */
function loadLocal(): RankingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? sortRanking(JSON.parse(raw) as RankingEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(entry: RankingEntry) {
  const list = loadLocal();
  list.push(entry);
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(sortRanking(list).slice(0, 100))
    );
  } catch {
    /* noop */
  }
}

/* ===== Supabase REST（環境変数があれば使用） ===== */
async function fetchSupabaseTop(limit: number): Promise<RankingEntry[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/scores` +
    `?select=*&order=total_score.desc&order=created_at.desc&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error("supabase fetch failed");
  const rows = (await res.json()) as any[];
  return rows.map((r) => ({
    id: r.id,
    playerName: r.player_name,
    scriptMatch: r.script_match,
    emotionMatch: r.emotion_match,
    speedMatch: r.speed_match,
    intonationMatch: r.intonation_match,
    characterMatch: r.character_match,
    totalScore: r.total_score,
    title: r.title,
    goodPoint: r.good_point ?? "",
    improvement: r.improvement ?? "",
    comment: r.comment ?? "",
    characterName: r.character_name,
    script: r.script,
    voiceStyle: r.voice_style,
    difficulty: r.difficulty,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

async function insertSupabase(
  playerName: string,
  result: ScoreResult,
  challenge: Challenge
) {
  const url = `${SUPABASE_URL}/rest/v1/scores`;
  await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      player_name: playerName.slice(0, 20) || "guest",
      total_score: result.totalScore,
      script_match: result.scriptMatch,
      emotion_match: result.emotionMatch,
      speed_match: result.speedMatch,
      intonation_match: result.intonationMatch,
      character_match: result.characterMatch,
      title: result.title,
      character_name: challenge.character,
      script: challenge.script,
      voice_style: challenge.voiceStyle,
      difficulty: challenge.difficulty,
    }),
  });
}

/* ===== 公開API ===== */
function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

export async function saveScore(
  playerName: string,
  result: ScoreResult,
  challenge: Challenge
): Promise<RankingEntry> {
  const entry: RankingEntry = {
    id: newId(),
    playerName: playerName.slice(0, 20) || "guest",
    ...result,
    characterName: challenge.character,
    script: challenge.script,
    voiceStyle: challenge.voiceStyle,
    difficulty: challenge.difficulty,
    createdAt: Date.now(),
  };
  if (useSupabase) {
    try {
      await insertSupabase(entry.playerName, result, challenge);
    } catch {
      saveLocal(entry); // 失敗時はローカルに退避
    }
  } else {
    saveLocal(entry);
  }
  return entry;
}

export async function topRanking(limit = 10): Promise<RankingEntry[]> {
  if (useSupabase) {
    try {
      return await fetchSupabaseTop(limit);
    } catch {
      return loadLocal().slice(0, limit);
    }
  }
  return loadLocal().slice(0, limit);
}
