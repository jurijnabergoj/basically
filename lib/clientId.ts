"use client";

// Stable per-browser identity. Not a secret; it only distinguishes the two
// players within a lobby. Stored in a cookie so it survives reloads.
const COOKIE = "bsly_cid";

export function getClientId(): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (match) {
    const value = match.slice(COOKIE.length + 1);
    if (value) return value;
  }

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
  return id;
}
