/** A window of an ordered list that slides from the start (tier 1) to the end (tier 15). Lists shorter than four are returned whole. */
export function tierWindow<T>(ordered: readonly T[], t: number): T[] {
  const n = ordered.length;
  if (n < 4) return [...ordered];
  const w = Math.max(3, Math.ceil(n / 2));
  const tier = Math.max(1, Math.min(15, t));
  const start = Math.round(((tier - 1) / 14) * (n - w));
  return ordered.slice(start, start + w);
}
