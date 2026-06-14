"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 波形アニメーション。activeかつlevelに応じてバーが動く。
 * levelが未指定の場合は擬似アニメーション。
 */
export default function WaveVisualizer({
  active,
  level,
  bars = 28,
}: {
  active: boolean;
  level?: number;
  bars?: number;
}) {
  const [heights, setHeights] = useState<number[]>(() =>
    Array(bars).fill(10)
  );
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      tRef.current += 0.18;
      const amp = active ? (level !== undefined ? 8 + level * 52 : 30) : 6;
      setHeights((prev) =>
        prev.map((_, i) => {
          const wave =
            Math.sin(tRef.current + i * 0.5) * 0.5 +
            Math.sin(tRef.current * 1.7 + i) * 0.5;
          const jitter = active ? Math.random() * 0.4 + 0.6 : 0.4;
          return Math.max(6, 12 + (wave + 1) * amp * 0.5 * jitter);
        })
      );
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, level]);

  return (
    <div className="wave">
      {heights.map((h, i) => (
        <div className="bar" key={i} style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}
