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
  const score = Math.max(0, Math.round(value));
  return (
    <div className={`score-digits${mini ? " mini" : ""}`}>
      <span className="score-number">{score}</span>
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}
