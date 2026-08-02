import { ImageResponse } from "next/og";
import { decodeShare } from "@/lib/share";

export const runtime = "nodejs";

// Modern reference palette (matches the app): white ground, wiki-blue accent,
// score band tinted by semantic color.
const INK = "#1b1d21";
const MUTED = "#5b6068";
const FAINT = "#8a9099";
const ACCENT = "#3366cc";
const BORDER = "#dcdfe4";

function color(score: number): string {
  if (score >= 70) return "#16a34a"; // green-600
  if (score >= 40) return "#d97706"; // amber-600
  return "#dc2626"; // red-600
}

function band(score: number): string {
  if (score >= 85) return "Nailed it";
  if (score >= 70) return "Pretty solid";
  if (score >= 50) return "Kinda shaky";
  if (score >= 30) return "Rough";
  return "Oof";
}

function Wordmark() {
  return (
    <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: INK }}>
      basically
      <span style={{ color: ACCENT }}>…</span>
    </div>
  );
}

// The default card shown when someone shares the home page (no result attached).
function homeCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          borderTop: `12px solid ${ACCENT}`,
          padding: "72px",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <Wordmark />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 68,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.15,
          }}
        >
          <div style={{ display: "flex" }}>Do you actually know</div>
          <div style={{ display: "flex" }}>how things work?</div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: MUTED, marginTop: 24 }}>
            Explain an everyday thing in 100 words. Get graded 1–100.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: FAINT }}>
          Think you know more than you do?
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const d = searchParams.get("d");
  const share = d ? decodeShare(d) : null;
  if (!share) return homeCard();

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
          backgroundColor: "#ffffff",
          borderTop: `12px solid ${ACCENT}`,
          padding: "72px",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <Wordmark />

        <div style={{ display: "flex", alignItems: "center", gap: "48px" }}>
          {/* Flat, bordered score box with a left accent edge (matches the app). */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 240,
              height: 240,
              borderRadius: 16,
              border: `2px solid ${BORDER}`,
              borderLeft: `12px solid ${ACCENT}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: MUTED, letterSpacing: 2 }}>
              SCORE
            </div>
            <div style={{ display: "flex", fontSize: 130, fontWeight: 800, color: INK, lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: FAINT }}>out of 100</div>
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
                color: INK,
                lineHeight: 1.25,
                marginTop: 12,
              }}
            >
              explaining “{topic}”
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: FAINT }}>
          Think you can do better?
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
