"use client";

/**
 * 録音済み音声の波形（音量サンプル）を静的に表示する。
 */
export default function Waveform({
  data,
  height = 72,
  color = "linear-gradient(180deg, var(--cyan), var(--magenta))",
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  const bars = data.length > 0 ? data : Array(60).fill(0.04);
  return (
    <div className="waveform" style={{ height }}>
      {bars.map((v, i) => {
        const h = Math.max(3, v * height);
        return (
          <div
            key={i}
            className="wf-bar"
            style={{ height: `${h}px`, background: color }}
          />
        );
      })}
    </div>
  );
}
