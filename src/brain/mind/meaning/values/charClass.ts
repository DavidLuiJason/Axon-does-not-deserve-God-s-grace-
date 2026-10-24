/** Director-owned character helpers (no regular expressions anywhere under src/brain/mind). */
export const isDigit = (c: string): boolean => c.length === 1 && c >= '0' && c <= '9';
export const isLower = (c: string): boolean => c.length === 1 && c >= 'a' && c <= 'z';
export const isUpper = (c: string): boolean => c.length === 1 && c >= 'A' && c <= 'Z';
export const isLetter = (c: string): boolean => isLower(c) || isUpper(c);
export const isSpace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
/** End (exclusive) of the language range that contains position i, or -1 when i is not inside language text. */
export function rangeEndAt(ranges: ReadonlyArray<{ start: number; end: number }>, i: number): number {
  for (const r of ranges) if (i >= r.start && i < r.end) return r.end;
  return -1;
}
