export const WORD_LIMIT = 100;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
