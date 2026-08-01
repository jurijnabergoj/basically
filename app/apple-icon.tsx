import { ImageResponse } from "next/og";

// Renders the home-screen icon for iOS ("add to home screen") — the same blue
// ellipsis mark as the browser-tab favicon, generated as a PNG at build time.
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          background: "#0b0b0c",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ width: 26, height: 26, borderRadius: 26, background: "#60a5fa" }}
          />
        ))}
      </div>
    ),
    { ...size },
  );
}
