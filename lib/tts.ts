import { cancelSpeak, speak } from "./speech";

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
const sampleCache = new Map<string, Blob>();

/** お手本ボイスを停止する（OpenAI音声・ブラウザ音声の両方） */
export function stopSample() {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  cancelSpeak();
}

function pickVoice(voiceStyle: string, emotion: string): string {
  const s = voiceStyle + emotion;
  if (/低い|威圧|魔王|渋/.test(s)) return "onyx";
  if (/高い|興奮|テンション高|明る/.test(s)) return "shimmer";
  if (/優し|穏やか|落ち着|眠|余韻/.test(s)) return "nova";
  if (/弱々|不安|震|泣/.test(s)) return "fable";
  return "alloy";
}

function styleToSpeed(voiceStyle: string): number {
  let speed = 1;
  if (/早口/.test(voiceStyle)) speed += 0.2;
  if (/ゆっくり|落ち着/.test(voiceStyle)) speed -= 0.2;
  return Math.max(0.6, Math.min(1.6, speed));
}

function styleToPitch(voiceStyle: string): number {
  let pitch = 1;
  if (/低い|威圧/.test(voiceStyle)) pitch -= 0.3;
  if (/高い|テンション高|興奮/.test(voiceStyle)) pitch += 0.25;
  if (/震/.test(voiceStyle)) pitch += 0.1;
  return Math.max(0.5, Math.min(1.8, pitch));
}

function sampleKey(
  text: string,
  character: string,
  emotion: string,
  voiceStyle: string,
  voice: string,
  speed: number
): string {
  return JSON.stringify({ text, character, emotion, voiceStyle, voice, speed });
}

async function playBlob(
  blob: Blob,
  opts: Pick<SampleOpts, "onduration" | "onstart" | "onend">,
  fallback: () => void
) {
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (currentAudio === audio) currentAudio = null;
    if (currentUrl === url) {
      URL.revokeObjectURL(url);
      currentUrl = null;
    }
    opts.onend?.();
  };
  audio.onended = finish;
  audio.onerror = finish;
  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      opts.onduration?.(Math.round(audio.duration * 10) / 10);
    }
  };

  opts.onstart?.();
  try {
    await audio.play();
  } catch {
    audio.onended = null;
    audio.onerror = null;
    if (currentAudio === audio) currentAudio = null;
    if (currentUrl === url) {
      URL.revokeObjectURL(url);
      currentUrl = null;
    }
    fallback();
  }
}

export interface SampleOpts {
  character?: string;
  emotion?: string;
  voiceStyle?: string;
  onduration?: (duration: number) => void;
  onstart?: () => void;
  onend?: () => void;
}

/**
 * お手本ボイスを再生する。
 * まず OpenAI TTS（/api/tts）を試し、キー未設定や失敗時はブラウザ読み上げに自動フォールバック。
 */
export async function playSampleVoice(text: string, opts: SampleOpts = {}) {
  stopSample();
  const voiceStyle = opts.voiceStyle ?? "";
  const emotion = opts.emotion ?? "";
  const character = opts.character ?? "";
  const speed = styleToSpeed(voiceStyle);
  const pitch = styleToPitch(voiceStyle);
  const voice = pickVoice(voiceStyle, emotion);
  const key = sampleKey(text, character, emotion, voiceStyle, voice, speed);

  const fallback = () =>
    speak(text, {
      rate: speed,
      pitch,
      onstart: opts.onstart,
      onend: opts.onend,
    });

  const cached = sampleCache.get(key);
  if (cached) {
    await playBlob(cached, opts, fallback);
    return;
  }

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice,
        speed,
        instructions:
          `あなたは「${character || "キャラクター"}」です。` +
          `感情は「${emotion || "ふつう"}」、話し方は「${voiceStyle || "自然な感じ"}」。` +
          `そのキャラクターになりきって、自然な日本語の声で読み上げてください。`,
      }),
    });

    if (!res.ok) {
      if (res.status !== 503) {
        console.warn(
          "[ドッペルマスター] OpenAI TTSに失敗したためブラウザ音声で再生します（HTTP " +
            res.status +
            "）。OPENAI_API_KEY を確認してください。"
        );
      }
      fallback();
      return;
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      fallback();
      return;
    }

    sampleCache.set(key, blob);
    await playBlob(blob, opts, fallback);
  } catch (e) {
    console.warn(
      "[ドッペルマスター] TTSの取得に失敗したためブラウザ音声で再生します。",
      e
    );
    fallback();
  }
}
