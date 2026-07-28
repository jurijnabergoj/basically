export type ShareData = {
  topic: string;
  score: number;
  verdict: string;
};

// URL-safe base64 encode/decode that works in both the browser and Node.
// This is the entire "persistence" layer: a shared result lives only in its URL.

function toBase64Url(bytes: string): string {
  const b64 = btoa(bytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

export function encodeShare(data: ShareData): string {
  const json = JSON.stringify({
    topic: data.topic,
    score: data.score,
    verdict: data.verdict,
  });
  // encodeURIComponent + unescape lets btoa handle any UTF-8 characters.
  return toBase64Url(unescape(encodeURIComponent(json)));
}

export function decodeShare(encoded: string): ShareData | null {
  try {
    const json = decodeURIComponent(escape(fromBase64Url(encoded)));
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.topic === "string" &&
      typeof parsed.score === "number" &&
      typeof parsed.verdict === "string"
    ) {
      return {
        topic: parsed.topic,
        score: Math.max(1, Math.min(100, Math.round(parsed.score))),
        verdict: parsed.verdict,
      };
    }
    return null;
  } catch {
    return null;
  }
}
