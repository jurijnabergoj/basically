export function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e"; // green-500, readable on light + dark
  if (score >= 40) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

export function scoreBand(score: number): string {
  if (score >= 85) return "Nailed it";
  if (score >= 70) return "Pretty solid";
  if (score >= 50) return "Kinda shaky";
  if (score >= 30) return "Rough";
  return "Oof";
}

// A flat, reference-style score readout: a bordered box with a left accent edge,
// a big tabular number, and the band tinted by score. Replaces the old dial.
export function ScoreBox({
  score,
  label = "Score",
  size = "md",
}: {
  score: number;
  label?: string;
  size?: "md" | "sm";
}) {
  const num = size === "sm" ? "text-4xl" : "text-5xl";
  return (
    <div className="inline-flex min-w-[152px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] text-center">
      <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`px-4 ${num} font-bold leading-tight tabular-nums text-[var(--text)]`}>
        {score}
      </div>
      <div className="px-4 pb-3 text-[11px] text-[var(--text-faint)]">out of 100</div>
      <div
        className="border-t border-[var(--border)] px-4 py-2 text-sm font-semibold"
        style={{ color: scoreColor(score) }}
      >
        {scoreBand(score)}
      </div>
    </div>
  );
}
