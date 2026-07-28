export function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e"; // green-500 — readable on light + dark
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

export function ScoreDial({ score, size = 150 }: { score: number; size?: number }) {
  const stroke = size * 0.085;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = circumference * pct;
  const color = scoreColor(score);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={stroke}
        style={{ stroke: "var(--dial-track)" }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy - size * 0.02}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.28}
        fontWeight={700}
        fill={color}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + size * 0.2}
        textAnchor="middle"
        fontSize={size * 0.1}
        style={{ fill: "var(--text-faint)" }}
      >
        / 100
      </text>
    </svg>
  );
}
