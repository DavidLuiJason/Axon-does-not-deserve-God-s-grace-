import { writeCsv, parseCsv } from '../data/csv';

export const TABLE_LIMITS = Object.freeze({ maxBoxes: 5000, maxTextLength: 500, maxRows: 500, maxColumns: 50 });
export type WordBox = { text: string; x: number; y: number; w: number; h: number; confidence?: number };
export type TableOptions = { minConfidence?: number; rowOverlap?: number; cellGapFactor?: number };
export type TableErrorCode = 'invalid-input' | 'too-many-boxes' | 'too-few-boxes' | 'not-a-table';
export type TableError = { ok: false; error: TableErrorCode; message: string };
export type TableResult = { ok: true; rows: string[][]; columns: number; uncertain: { row: number; column: number }[]; warnings: string[] } | TableError;
export type TextResult = { ok: true; text: string } | { ok: false; error: string; message: string };
export const PICTURE_TO_TABLE_DESCRIPTOR = {
  toolId: 'picture-to-table',
  displayName: 'Picture to Table',
  purpose: 'Rebuild a table from word positions and save it as CSV or Markdown; reading the words from a picture is not built yet.',
  examples: ['Rebuild a table from supplied word positions and export CSV.', 'Turn positioned word boxes into a Markdown table while marking low-confidence cells.'],
  inputs: [
    { name: 'wordBoxes', kind: 'text' as const, prompt: 'Word boxes with text and pixel coordinates, width, height, and optional confidence.' },
    { name: 'minConfidence', kind: 'text' as const, prompt: 'Optional confidence threshold from 0 to 1.' },
    { name: 'format', kind: 'choice' as const, choices: ['CSV', 'Markdown'] },
  ],
} as const;

type Cell = { text: string; left: number; right: number; top: number; bottom: number; boxes: WordBox[]; rowIndex: number; uncertain: boolean };
type RowBand = { boxes: WordBox[]; top: number; bottom: number; center: number; cells: Cell[] };
function fail(error: TableErrorCode, message: string): TableError { return { ok: false, error, message }; }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function median(values: number[]): number { if (!values.length) return 0; const a = [...values].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function overlap(a0: number, a1: number, b0: number, b1: number): number { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
function validateOptions(options: unknown): { ok: true; value: Required<TableOptions> } | TableError {
  if (options !== undefined && !isRecord(options)) return fail('invalid-input', 'Options must be an object.');
  const o = (options ?? {}) as Record<string, unknown>;
  const minConfidence = o.minConfidence === undefined ? 0.6 : o.minConfidence;
  const rowOverlap = o.rowOverlap === undefined ? 0.5 : o.rowOverlap;
  const cellGapFactor = o.cellGapFactor === undefined ? 1.5 : o.cellGapFactor;
  if (typeof minConfidence !== 'number' || !Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1 || typeof rowOverlap !== 'number' || !Number.isFinite(rowOverlap) || rowOverlap < 0 || rowOverlap > 1 || typeof cellGapFactor !== 'number' || !Number.isFinite(cellGapFactor) || cellGapFactor < 0) return fail('invalid-input', 'Options must use minConfidence and rowOverlap in 0..1 and a finite non-negative cellGapFactor.');
  for (const k of Object.keys(o)) if (!['minConfidence', 'rowOverlap', 'cellGapFactor'].includes(k)) return fail('invalid-input', `Unknown option '${k}'.`);
  return { ok: true, value: { minConfidence, rowOverlap, cellGapFactor } };
}
function makeCells(row: RowBand, rowIndex: number, gapLimit: number, minConfidence: number): Cell[] {
  const ordered = [...row.boxes].sort((a, b) => a.x - b.x || a.y - b.y);
  const cells: Cell[] = [];
  for (const b of ordered) {
    const last = cells[cells.length - 1];
    if (last && Math.max(0, b.x - last.right) <= gapLimit) {
      last.text += ` ${b.text.trim()}`; last.right = Math.max(last.right, b.x + b.w); last.top = Math.min(last.top, b.y); last.bottom = Math.max(last.bottom, b.y + b.h); last.boxes.push(b); last.uncertain ||= b.confidence !== undefined && b.confidence < minConfidence;
    } else cells.push({ text: b.text.trim(), left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h, boxes: [b], rowIndex, uncertain: b.confidence !== undefined && b.confidence < minConfidence });
  }
  return cells;
}
// Learn where cells end from the gaps actually present: small gaps are spaces between words, big gaps are column gutters.
// An explicit cellGapFactor from the caller is always respected; otherwise the largest jump in the sorted gaps decides.
function chooseGapLimit(bands: RowBand[], medHeight: number, fallback: number, explicit: boolean): { limit: number; ambiguous: boolean } {
  if (explicit) return { limit: fallback, ambiguous: false };
  const gaps: number[] = [];
  for (const r of bands) { const o = [...r.boxes].sort((a, b) => a.x - b.x); let right = -Infinity; o.forEach((b, i) => { if (i > 0) gaps.push(Math.max(0, b.x - right)); right = Math.max(right, b.x + b.w); }); }
  if (gaps.length === 0) return { limit: fallback, ambiguous: false };
  gaps.sort((a, b) => a - b);
  const eps = 0.1 * medHeight; let bestRatio = 0, bestK = -1;
  for (let k = 0; k + 1 < gaps.length; k++) { if (gaps[k] > 0.8 * medHeight) break; const ratio = (gaps[k + 1] + eps) / (gaps[k] + eps); if (ratio > bestRatio) { bestRatio = ratio; bestK = k; } }
  if (bestK >= 0 && bestRatio >= 2.2) return { limit: Math.min(fallback, (gaps[bestK] + gaps[bestK + 1]) / 2), ambiguous: false };
  if (gaps[0] > 0.5 * medHeight) return { limit: Math.min(fallback, gaps[0] / 2), ambiguous: false }; // no word spacing found: every gap is a gutter
  return { limit: fallback, ambiguous: gaps.some(g => g > 0.7 * medHeight && g <= fallback) };
}
function detectAlignmentUncertainty(rows: RowBand[], medianHeight: number): boolean {
  for (const row of rows) {
    const centers = row.boxes.map(b => b.y + b.h / 2);
    if (centers.length > 1 && Math.max(...centers) - Math.min(...centers) > medianHeight * 0.1) return true;
  }
  for (let i = 1; i < rows.length; i++) if (rows[i].center - rows[i - 1].center < medianHeight * 1.5) return true;
  return false;
}
function detectTilt(rows: RowBand[]): boolean {
  const angles: number[] = [];
  for (const row of rows) {
    const ordered = [...row.boxes].sort((a, b) => a.x - b.x);
    if (ordered.length < 2) continue;
    const left = ordered[0], right = ordered[ordered.length - 1];
    const width = (right.x + right.w) - left.x;
    if (width <= 0) continue;
    const leftCenter = left.y + left.h / 2, rightCenter = right.y + right.h / 2;
    angles.push(Math.atan(Math.abs(rightCenter - leftCenter) / width) * 180 / Math.PI);
  }
  return median(angles) > 2;
}

export function boxesToTable(boxes: unknown, options?: TableOptions): TableResult {
  if (!Array.isArray(boxes)) return fail('invalid-input', 'Word boxes must be an array.');
  if (boxes.length > TABLE_LIMITS.maxBoxes) return fail('too-many-boxes', `At most ${TABLE_LIMITS.maxBoxes} word boxes are accepted.`);
  const opt = validateOptions(options); if (opt.ok === false) return opt;
  const valid: WordBox[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const v = boxes[i];
    if (!isRecord(v) || typeof v.text !== 'string' || !v.text.trim() || v.text.length > TABLE_LIMITS.maxTextLength || !['x', 'y', 'w', 'h'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k])) || (v.w as number) <= 0 || (v.h as number) <= 0 || (v.confidence !== undefined && (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1))) return fail('invalid-input', `Invalid word box at index ${i}: text, finite coordinates, positive size, and optional confidence in 0..1 are required.`);
    valid.push({ text: v.text, x: v.x as number, y: v.y as number, w: v.w as number, h: v.h as number, ...(v.confidence === undefined ? {} : { confidence: v.confidence as number }) });
  }
  if (valid.length < 4) return fail('too-few-boxes', 'At least four word boxes are required to reconstruct a table.');
  const ordered = [...valid].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
  const bands: RowBand[] = [];
  for (const b of ordered) {
    const top = b.y, bottom = b.y + b.h;
    let chosen: RowBand | undefined;
    for (let i = bands.length - 1; i >= 0; i--) {
      const r = bands[i];
      if ((b.y + b.h / 2) < r.top - (r.bottom - r.top) || (b.y + b.h / 2) > r.bottom + b.h) continue;
      if (overlap(top, bottom, r.top, r.bottom) >= opt.value.rowOverlap * Math.min(b.h, (r.bottom - r.top))) { chosen = r; break; }
    }
    if (chosen) { chosen.boxes.push(b); chosen.top = Math.min(chosen.top, top); chosen.bottom = Math.max(chosen.bottom, bottom); chosen.center = median(chosen.boxes.map(q => q.y + q.h / 2)); }
    else bands.push({ boxes: [b], top, bottom, center: b.y + b.h / 2, cells: [] });
  }
  bands.sort((a, b) => a.center - b.center || Math.min(...a.boxes.map(q => q.x)) - Math.min(...b.boxes.map(q => q.x)));
  if (bands.length > TABLE_LIMITS.maxRows) return fail('not-a-table', `Reconstruction exceeds the ${TABLE_LIMITS.maxRows}-row limit.`);
  const medHeight = median(valid.map(b => b.h));
  const gapChoice = chooseGapLimit(bands, medHeight, opt.value.cellGapFactor * medHeight, isRecord(options) && options.cellGapFactor !== undefined);
  bands.forEach((r, i) => { r.cells = makeCells(r, i, gapChoice.limit, opt.value.minConfidence); });
  const cells = bands.flatMap(r => r.cells).sort((a, b) => a.left - b.left || b.right - a.right || a.rowIndex - b.rowIndex);
  const columns: { left: number; right: number; cells: Cell[] }[] = [];
  for (const c of cells) {
    const choices = columns.map((col, index) => ({ col, index, amount: overlap(c.left, c.right, col.left, col.right) / Math.max(Number.EPSILON, c.right - c.left) })).filter(x => x.amount >= 0.5).sort((a, b) => b.amount - a.amount || a.index - b.index);
    const match = choices[0];
    if (match) { match.col.cells.push(c); match.col.left = Math.min(match.col.left, c.left); match.col.right = Math.max(match.col.right, c.right); }
    else columns.push({ left: c.left, right: c.right, cells: [c] });
  }
  columns.sort((a, b) => a.left - b.left || a.right - b.right);
  if (columns.length > TABLE_LIMITS.maxColumns) return fail('not-a-table', `Reconstruction exceeds the ${TABLE_LIMITS.maxColumns}-column limit.`);
  const output = bands.map(() => Array<string>(columns.length).fill(''));
  const uncertain: { row: number; column: number }[] = [], warnings: string[] = [];
  for (let ri = 0; ri < bands.length; ri++) {
    const rowCells = [...bands[ri].cells].sort((a, b) => a.left - b.left);
    let previous = -1;
    for (const c of rowCells) {
      const candidates = columns.map((col, index) => ({ index, ratio: overlap(c.left, c.right, col.left, col.right) / Math.max(Number.EPSILON, c.right - c.left) })).filter(v => v.ratio >= 0.5 && v.index >= previous).sort((a, b) => b.ratio - a.ratio || a.index - b.index);
      let ci = candidates[0]?.index ?? -1;
      if (ci < 0 || ci <= previous && output[ri][ci] !== '') {
        const next = columns.findIndex((_, idx) => idx > previous && output[ri][idx] === '');
        if (next >= 0) ci = next;
        else if (previous >= 0) { output[ri][previous] += ` ${c.text}`; warnings.push(`Row ${ri + 1}: two cells could not be assigned to distinct ordered columns; their text was joined.`); continue; }
        else ci = 0;
      }
      if (output[ri][ci] !== '') { output[ri][ci] += ` ${c.text}`; warnings.push(`Row ${ri + 1}: two cells could not be assigned to distinct ordered columns; their text was joined.`); }
      else output[ri][ci] = c.text;
      previous = ci;
      if (c.uncertain) uncertain.push({ row: ri, column: ci });
    }
  }
  if (gapChoice.ambiguous) warnings.push('Some words sit close together; neighbouring columns may have been merged. Review the table.');
  if (detectTilt(bands)) warnings.push('The picture looks tilted; the table was not rotated.');
  if (detectAlignmentUncertainty(bands, medHeight)) warnings.push('Some word boxes have uncertain row alignment; review the reconstructed table.');
  if (bands.length < 2 || columns.length < 2) return fail('not-a-table', 'The supplied boxes do not form a table with at least two rows and two columns.');
  return { ok: true, rows: output, columns: columns.length, uncertain, warnings: [...new Set(warnings)] };
}
export function tableToCsv(rows: unknown): TextResult {
  if (!Array.isArray(rows)) return fail('invalid-input', 'Rows must be an array of arrays.');
  if (rows.some(r => !Array.isArray(r) || r.some(v => typeof v !== 'string'))) return fail('invalid-input', 'Every table cell must be text.');
  const result = writeCsv(rows as string[][], { delimiter: ',', header: false });
  if (result.ok === false) return { ok: false, error: result.error, message: result.message };
  const parsed = parseCsv(result.text, { delimiter: ',', header: false });
  if (parsed.ok === false) return { ok: false, error: parsed.error, message: `CSV writer output could not be parsed: ${parsed.message}` };
  return { ok: true, text: result.text };
}
export function tableToMarkdown(rows: unknown): TextResult {
  if (!Array.isArray(rows) || rows.length === 0) return fail('invalid-input', 'Markdown export needs at least one non-empty row.');
  if (rows.some(r => !Array.isArray(r) || r.some(v => typeof v !== 'string'))) return fail('invalid-input', 'Every table cell must be text.');
  const input = rows as string[][], width = Math.max(0, ...input.map(r => r.length));
  if (width === 0) return fail('invalid-input', 'Markdown export needs at least one column.');
  if (input.length > TABLE_LIMITS.maxRows || width > TABLE_LIMITS.maxColumns) return fail('not-a-table', 'Markdown table exceeds the supported row or column limit.');
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|'));
  const line = (r: string[]) => `| ${r.join(' | ')} |`;
  return { ok: true, text: [line(pad(input[0])), line(Array(width).fill('---')), ...input.slice(1).map(r => line(pad(r)))].join('\n') };
}
