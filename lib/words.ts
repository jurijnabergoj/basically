export const WORD_LIMIT = 100;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Trim text down to at most `limit` words, preserving what fits. Used to salvage
// a partly-written answer on timeout without tripping the over-limit rejection.
export function capWords(text: string, limit = WORD_LIMIT): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text.trim();
  return words.slice(0, limit).join(" ");
}
