import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OpenAI TTS でお手本ボイスを生成して mp3 を返す。
 * OPENAI_API_KEY（サーバー側環境変数）が無い場合は 503 を返し、
 * クライアントはブラウザの読み上げにフォールバックする。
 */
// 明らかに無効・未設定のプレースホルダー値
const PLACEHOLDER_KEYS = new Set([
  "your_openai_api_key",
  "ollama",
  "sk-xxx",
  "changeme",
]);

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || PLACEHOLDER_KEYS.has(apiKey)) {
    // 未設定/プレースホルダー: クライアントはブラウザ音声へフォールバック
    return Response.json({ error: "no_key" }, { status: 503 });
  }

  let body: {
    text?: string;
    voice?: string;
    speed?: number;
    instructions?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const text = (body.text ?? "").toString().trim().slice(0, 400);
  if (!text) {
    return Response.json({ error: "no_text" }, { status: 400 });
  }

  const allowedVoices = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
  ];
  const voice =
    typeof body.voice === "string" && allowedVoices.includes(body.voice)
      ? body.voice
      : "alloy";
  const speed = Math.max(0.5, Math.min(2, Number(body.speed) || 1));
  const instructions =
    typeof body.instructions === "string"
      ? body.instructions.slice(0, 400)
      : undefined;
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: "mp3",
        speed,
        ...(instructions ? { instructions } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: "openai_error", status: res.status, detail: detail.slice(0, 300) },
        { status: 502 }
      );
    }

    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
