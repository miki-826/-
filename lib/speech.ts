import type { AudioFeatures } from "./types";

export function speak(
  text: string,
  opts: { rate?: number; pitch?: number; onend?: () => void; onstart?: () => void } = {}
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onstart?.();
    setTimeout(() => opts.onend?.(), 1200);
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  const voices = window.speechSynthesis.getVoices();
  const ja = voices.find((v) => v.lang.startsWith("ja"));
  if (ja) u.voice = ja;
  u.onstart = () => opts.onstart?.();
  u.onend = () => opts.onend?.();
  u.onerror = () => opts.onend?.();
  window.speechSynthesis.speak(u);
}

export function cancelSpeak() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

export interface RecognitionHandle {
  stop: () => void;
}

export function startRecognition(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: () => void
): RecognitionHandle | null {
  const SR =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "ja-JP";
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = "";
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim += t;
    }
    onResult(finalText + interim, false);
  };
  rec.onerror = () => onError?.();
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
  };
}

/**
 * 録音とリアルタイム音量解析をまとめて行う。
 * MediaRecorderで録音し、Web Audio APIで音量特徴量を取得する。
 */
export class AudioCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private samples: number[] = [];
  private silentFrames = 0;
  private totalFrames = 0;
  private startTime = 0;
  private blobUrl: string | null = null;

  onLevel: ((level: number) => void) | null = null;

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.chunks = [];
    this.samples = [];
    this.silentFrames = 0;
    this.totalFrames = 0;
    this.recorder = new MediaRecorder(stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startTime = performance.now();

    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AC();
    this.audioCtx = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    this.analyser = analyser;
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      this.samples.push(rms);
      this.totalFrames++;
      if (rms < 0.02) this.silentFrames++;
      this.onLevel?.(Math.min(1, rms * 3));
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  /** 録音全体の音量サンプルを指定点数にダウンサンプルした波形 */
  private buildWaveform(points = 80): number[] {
    if (this.samples.length === 0) return Array(points).fill(0);
    const peak = Math.max(0.05, ...this.samples);
    const out: number[] = [];
    const bucket = this.samples.length / points;
    for (let i = 0; i < points; i++) {
      const start = Math.floor(i * bucket);
      const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
      let max = 0;
      for (let j = start; j < end && j < this.samples.length; j++) {
        if (this.samples[j] > max) max = this.samples[j];
      }
      out.push(Math.min(1, max / peak));
    }
    return out;
  }

  async stop(): Promise<{
    features: AudioFeatures;
    url: string;
    waveform: number[];
  }> {
    const duration = (performance.now() - this.startTime) / 1000;
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const blob: Blob = await new Promise((resolve) => {
      if (!this.recorder) {
        resolve(new Blob());
        return;
      }
      this.recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
      };
      this.recorder.stop();
    });

    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close().catch(() => {});

    const avg =
      this.samples.length > 0
        ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length
        : 0;
    const variance =
      this.samples.length > 0
        ? Math.sqrt(
            this.samples.reduce((a, b) => a + (b - avg) ** 2, 0) /
              this.samples.length
          )
        : 0;
    const silenceRatio =
      this.totalFrames > 0 ? this.silentFrames / this.totalFrames : 0;

    this.blobUrl = URL.createObjectURL(blob);

    const features: AudioFeatures = {
      duration: Math.round(duration * 10) / 10,
      averageVolume: Math.round(avg * 100) / 100,
      volumeVariance: Math.round(variance * 100) / 100,
      silenceRatio: Math.round(silenceRatio * 100) / 100,
    };
    return { features, url: this.blobUrl, waveform: this.buildWaveform() };
  }

  dispose() {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
