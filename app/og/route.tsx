import { ImageResponse } from "next/og";
import { decodeShare } from "@/lib/share";

export const runtime = "nodejs";

function color(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

function band(score: number): string {
  if (score >= 85) return "Nailed it";
  if (score >= 70) return "Pretty solid";
  if (score >= 50) return "Kinda shaky";
  if (score >= 30) return "Rough";
  return "Oof";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const share = decodeShare(searchParams.get("d") ?? "");

  const score = share?.score ?? 0;
  const topic = share?.topic ?? "how something works";
  const accent = color(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0b0b0c",
          backgroundImage:
            "radial-gradient(60% 60% at 50% -10%, rgba(96,165,250,0.16), transparent 70%)",
          padding: "72px",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            color: "#f5f5f5",
          }}
        >
          basically
          <span style={{ color: "#60a5fa" }}>…</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "48px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 260,
              height: 260,
              borderRadius: 260,
              border: `16px solid ${accent}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", fontSize: 120, fontWeight: 800, color: accent, lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#71717a" }}>/ 100</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: accent }}>
              {band(score)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 40,
                fontWeight: 600,
                color: "#e5e5e5",
                lineHeight: 1.25,
                marginTop: 12,
              }}
            >
              explaining “{topic}”
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#8a8a8f" }}>
          Think you can do better?
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
