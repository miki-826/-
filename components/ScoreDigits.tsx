"use client";

export default function ScoreDigits({
  value,
  mini = false,
  suffix = "点",
}: {
  value: number;
  mini?: boolean;
  suffix?: string | null;
}) {
  const digits = String(Math.max(0, Math.round(value))).split("");
  return (
    <div className={`score-digits${mini ? " mini" : ""}`}>
      {digits.map((d, i) => (
        <img
          key={i}
          src={`/images/numbers/${d}.png`}
          alt={d}
          style={{ animationDelay: `${i * 0.08}s` }}
        />
      ))}
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}
