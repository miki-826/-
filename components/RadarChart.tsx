"use client";

interface Axis {
  label: string;
  value: number;
}

export default function RadarChart({
  data,
  size = 300,
}: {
  data: Axis[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 46;
  const n = data.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (i: number, r: number) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const valuePts = data.map((d, i) => point(i, (d.value / 100) * radius));
  const polygon = valuePts.map((p) => p.join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2de2ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff3df0" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {rings.map((ring, ri) => (
        <polygon
          key={ri}
          points={data
            .map((_, i) => point(i, radius * ring).join(","))
            .join(" ")}
          fill="none"
          stroke="rgba(45,226,255,0.18)"
          strokeWidth={1}
        />
      ))}

      {data.map((_, i) => {
        const [x, y] = point(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(45,226,255,0.18)"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={polygon}
        fill="url(#radarFill)"
        stroke="#2de2ff"
        strokeWidth={2}
        style={{
          filter: "drop-shadow(0 0 8px rgba(45,226,255,0.8))",
        }}
      />

      {valuePts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={3.5}
          fill="#fff"
          stroke="#ff3df0"
          strokeWidth={1.5}
        />
      ))}

      {data.map((d, i) => {
        const [x, y] = point(i, radius + 26);
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize={11}
            fontWeight={700}
            fill="#eaf6ff"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
