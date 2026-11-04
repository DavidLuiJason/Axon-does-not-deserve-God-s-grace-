/**
 * AUTO-WIRE part 2: the ONE add-only merge used by every shared registry that reads a generated file (src/generated/wired*.ts).
 * HAND WINS: a generated entry whose id is already wired by hand is dropped and recorded in GENERATED_CLASHES, never silently
 * replacing the hand entry and never crashing the app. tests/wireGenerated.test.ts fails while GENERATED_CLASHES is not empty.
 */
export const GENERATED_CLASHES: string[] = [];

export function addOnlyList<T>(hand: readonly T[], generated: readonly T[], idOf: (item: T) => string, label: string, sink: string[] = GENERATED_CLASHES): T[] {
  const seen = new Set<string>(hand.map(idOf));
  const kept: T[] = [];
  for (const item of generated) {
    const id = idOf(item);
    if (seen.has(id)) { sink.push(`${label}: ${id}`); continue; }
    seen.add(id);
    kept.push(item);
  }
  return [...hand, ...kept];
}

export function addOnlyRecord<V>(hand: Readonly<Record<string, V>>, generated: Readonly<Record<string, V>>, label: string, sink: string[] = GENERATED_CLASHES): Record<string, V> {
  const out: Record<string, V> = { ...hand };
  for (const id of Object.keys(generated)) {
    if (Object.prototype.hasOwnProperty.call(hand, id)) { sink.push(`${label}: ${id}`); continue; }
    out[id] = generated[id];
  }
  return out;
}

/** Schema rows are text lines `tool | ...`; the tool id is the first column. */
export function addOnlyRows(handText: string, rows: readonly string[], label: string, sink: string[] = GENERATED_CLASHES): string {
  const idOf = (row: string): string => row.split('|')[0].trim();
  const seen = new Set<string>(handText.split('\n').filter((r) => r.trim() !== '').map(idOf));
  let text = handText;
  for (const row of rows) {
    const id = idOf(row);
    if (seen.has(id)) { sink.push(`${label}: ${id}`); continue; }
    seen.add(id);
    text += `\n${row}`;
  }
  return text;
}
