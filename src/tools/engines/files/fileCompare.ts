import { textCompare, TEXT_COMPARE_LIMITS } from '../text/textCompare';

export const FILE_COMPARE_LIMITS = Object.freeze({ maxBytes: 200 * 1024 * 1024, maxPixels: 24_000_000, maxRanges: 1000 });
export type EngineErrorCode = 'invalid-input' | 'too-large' | 'cancelled' | 'reader-failed' | 'invalid-image';
export type EngineError = { ok: false; error: EngineErrorCode; message: string };
export type ByteRange = { start: number; end: number; length: number };
export type ByteCompareResult = { ok: true; identical: boolean; sizeA: number; sizeB: number; firstDifference: number | null; differingBytes: number; percent: number; ranges: ByteRange[]; moreRanges: number; tail: { side: 'a' | 'b'; start: number; length: number } | null; cancelled?: boolean };
export type Reader = { size: number; read(offset: number, length: number): Promise<Uint8Array> };
export type CompareOptions = { chunkSize?: number; onProgress?: (compared: number, total: number) => void; shouldCancel?: () => boolean; stopAtFirst?: boolean };
export const FILE_COMPARE_DESCRIPTOR = { toolId: 'file-compare', displayName: 'File Compare', purpose: 'Compare file bytes, text lines, or decoded image pixels and report differences.', examples: ['Compare two files byte for byte.', 'Show which text lines changed.', 'Highlight changed pixels in two decoded pictures.'], inputs: [{ name: 'fileA', kind: 'file' as const }, { name: 'fileB', kind: 'file' as const }, { name: 'mode', kind: 'choice' as const, choices: ['bytes', 'text', 'pixels'] }] };
function fail(error: EngineErrorCode, message: string): EngineError { return { ok: false, error, message }; }
function validBytes(v: unknown): v is Uint8Array { return v instanceof Uint8Array; }
export function compareBytes(a: Uint8Array, b: Uint8Array, options: { stopAtFirst?: boolean } = {}): ByteCompareResult | EngineError {
  if (!validBytes(a) || !validBytes(b)) return fail('invalid-input', 'Both inputs must be byte arrays.');
  if (a.length > FILE_COMPARE_LIMITS.maxBytes || b.length > FILE_COMPARE_LIMITS.maxBytes) return fail('too-large', 'Each file is limited to 200 MB.');
  const ranges: ByteRange[] = []; let moreRanges = 0, differingBytes = 0, firstDifference: number | null = null;
  const common = Math.min(a.length, b.length); let open: ByteRange | null = null;
  for (let i = 0; i < common; i++) {
    if (a[i] !== b[i]) {
      differingBytes++; if (firstDifference === null) firstDifference = i;
      if (options.stopAtFirst) return { ok: true, identical: false, sizeA: a.length, sizeB: b.length, firstDifference, differingBytes: 1, percent: 100 * (1 / Math.max(a.length, b.length, 1)), ranges: [{ start: i, end: i, length: 1 }], moreRanges: 0, tail: a.length === b.length ? null : { side: a.length > b.length ? 'a' : 'b', start: common, length: Math.abs(a.length - b.length) } };
      if (!open) open = { start: i, end: i, length: 1 }; else { open.end = i; open.length++; }
    } else if (open) { if (ranges.length < FILE_COMPARE_LIMITS.maxRanges) ranges.push(open); else moreRanges++; open = null; }
  }
  if (open) { if (ranges.length < FILE_COMPARE_LIMITS.maxRanges) ranges.push(open); else moreRanges++; }
  const tailLength = Math.abs(a.length - b.length); if (tailLength) { differingBytes += tailLength; if (firstDifference === null) firstDifference = common; }
  const tail = tailLength ? { side: a.length > b.length ? 'a' as const : 'b' as const, start: common, length: tailLength } : null;
  return { ok: true, identical: differingBytes === 0, sizeA: a.length, sizeB: b.length, firstDifference, differingBytes, percent: 100 * differingBytes / Math.max(a.length, b.length, 1), ranges, moreRanges, tail };
}
export async function compareStreams(readerA: Reader, readerB: Reader, options: CompareOptions = {}): Promise<ByteCompareResult | EngineError> {
  if (!readerA || !readerB || !Number.isSafeInteger(readerA.size) || !Number.isSafeInteger(readerB.size) || readerA.size < 0 || readerB.size < 0 || typeof readerA.read !== 'function' || typeof readerB.read !== 'function') return fail('invalid-input', 'Readers must have non-negative safe sizes and a read function.');
  if (readerA.size > FILE_COMPARE_LIMITS.maxBytes || readerB.size > FILE_COMPARE_LIMITS.maxBytes) return fail('too-large', 'Each file is limited to 200 MB.');
  const chunkSize = options.chunkSize ?? 65536; if (!Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 1024 * 1024) return fail('invalid-input', 'Chunk size must be from 1 byte to 1 MB.');
  const ranges: ByteRange[] = []; let moreRanges = 0, differingBytes = 0, firstDifference: number | null = null, open: ByteRange | null = null;
  const common = Math.min(readerA.size, readerB.size); let compared = 0;
  try {
    for (let offset = 0; offset < common; offset += chunkSize) {
      if (options.shouldCancel?.()) return fail('cancelled', 'Comparison was cancelled.');
      const length = Math.min(chunkSize, common - offset), [a, b] = await Promise.all([readerA.read(offset, length), readerB.read(offset, length)]);
      if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== length || b.length !== length) return fail('reader-failed', 'A reader returned an invalid chunk.');
      for (let j = 0; j < length; j++) { const i = offset + j; if (a[j] !== b[j]) { differingBytes++; if (firstDifference === null) firstDifference = i; if (options.stopAtFirst) return { ok: true, identical: false, sizeA: readerA.size, sizeB: readerB.size, firstDifference, differingBytes: 1, percent: 100 / Math.max(readerA.size, readerB.size, 1), ranges: [{ start: i, end: i, length: 1 }], moreRanges: 0, tail: readerA.size === readerB.size ? null : { side: readerA.size > readerB.size ? 'a' : 'b', start: common, length: Math.abs(readerA.size - readerB.size) } }; if (!open) open = { start: i, end: i, length: 1 }; else { open.end = i; open.length++; } } else if (open) { if (ranges.length < FILE_COMPARE_LIMITS.maxRanges) ranges.push(open); else moreRanges++; open = null; } }
      compared += length; options.onProgress?.(compared, Math.max(readerA.size, readerB.size));
    }
  } catch { return fail('reader-failed', 'A file reader failed while reading data.'); }
  if (open) { if (ranges.length < FILE_COMPARE_LIMITS.maxRanges) ranges.push(open); else moreRanges++; }
  const tailLength = Math.abs(readerA.size - readerB.size); if (tailLength) { const longer = readerA.size > readerB.size ? readerA : readerB; try { for (let offset = common; offset < longer.size; offset += chunkSize) { if (options.shouldCancel?.()) return fail('cancelled', 'Comparison was cancelled.'); const length = Math.min(chunkSize, longer.size - offset), tailChunk = await longer.read(offset, length); if (!(tailChunk instanceof Uint8Array) || tailChunk.length !== length) return fail('reader-failed', 'A reader returned an invalid tail chunk.'); compared += length; options.onProgress?.(compared, Math.max(readerA.size, readerB.size)); } } catch { return fail('reader-failed', 'A file reader failed while reading the longer file tail.'); } differingBytes += tailLength; if (firstDifference === null) firstDifference = common; }
  return { ok: true, identical: differingBytes === 0, sizeA: readerA.size, sizeB: readerB.size, firstDifference, differingBytes, percent: 100 * differingBytes / Math.max(readerA.size, readerB.size, 1), ranges, moreRanges, tail: tailLength ? { side: readerA.size > readerB.size ? 'a' : 'b', start: common, length: tailLength } : null };
}
export type HexRow = { offset: number; hexA: string[]; hexB: string[]; different: boolean[] };
export function hexContext(a: Uint8Array, b: Uint8Array, start: number, length: number, context = 16): HexRow[] | EngineError {
  if (!validBytes(a) || !validBytes(b) || !Number.isSafeInteger(start) || !Number.isSafeInteger(length) || !Number.isSafeInteger(context) || start < 0 || length < 0 || context < 0 || context > 256) return fail('invalid-input', 'Invalid hex-view range.');
  if (a.length > FILE_COMPARE_LIMITS.maxBytes || b.length > FILE_COMPARE_LIMITS.maxBytes) return fail('too-large', 'Each file is limited to 200 MB.');
  const from = Math.max(0, start - context), to = Math.min(Math.max(a.length, b.length), start + length + context); const rows: HexRow[] = [];
  for (let off = from; off < to; off += 16) { const hexA: string[] = [], hexB: string[] = [], different: boolean[] = []; for (let i = off; i < Math.min(off + 16, to); i++) { hexA.push(i < a.length ? a[i].toString(16).padStart(2, '0') : '--'); hexB.push(i < b.length ? b[i].toString(16).padStart(2, '0') : '--'); different.push(i >= a.length || i >= b.length || a[i] !== b[i]); } rows.push({ offset: off, hexA, hexB, different }); }
  return rows;
}
export type TextPosition = { line: number; column: number };
export type TextDifference = { type: 'add' | 'remove' | 'change'; textA: string; textB: string; positionA: TextPosition; positionB: TextPosition };
export type TextCompareExtended = { ok: true; identical: boolean; differences: TextDifference[]; addedLines: number; removedLines: number; changedLines: number } | EngineError;
export function compareText(textA: string, textB: string): TextCompareExtended {
  if (typeof textA !== 'string' || typeof textB !== 'string') return fail('invalid-input', 'Both inputs must be text.');
  if (textA.length + textB.length > TEXT_COMPARE_LIMITS.maxCharacters) return fail('too-large', 'Text exceeds the existing text comparison limit.');
  const base = textCompare(textA, textB, 'line'); if (!base.ok) return fail(base.error === 'too-large' ? 'too-large' : 'invalid-input', 'Text comparison could not be completed.');
  const splitLines = (t: string): string[] => t.match(/[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$/gu) ?? [];
  const stripEol = (t: string): string => t.replace(/[\r\n]+$/u, '');
  const differences: TextDifference[] = []; let ai = 0, bi = 0, addedLines = 0, removedLines = 0, changedLines = 0;
  // A "block" is a run of removed and added lines between two stretches of equal lines. Line k of the removed part is paired
  // with line k of the added part as a changed line; leftovers are plain removals or additions. Positions are 1-based lines.
  let rem: string[] = [], add: string[] = [], remStart = 0, addStart = 0;
  const flush = (): void => {
    if (!rem.length && !add.length) return;
    const n = Math.min(rem.length, add.length);
    for (let k = 0; k < n; k++) {
      const x = stripEol(rem[k]), y = stripEol(add[k]); let column = 1;
      while (column <= x.length && column <= y.length && x[column - 1] === y[column - 1]) column++;
      differences.push({ type: 'change', textA: rem[k], textB: add[k], positionA: { line: remStart + k + 1, column }, positionB: { line: addStart + k + 1, column } }); changedLines++;
    }
    for (let k = n; k < rem.length; k++) { differences.push({ type: 'remove', textA: rem[k], textB: '', positionA: { line: remStart + k + 1, column: 1 }, positionB: { line: addStart + n + 1, column: 1 } }); removedLines++; }
    for (let k = n; k < add.length; k++) { differences.push({ type: 'add', textA: '', textB: add[k], positionA: { line: remStart + n + 1, column: 1 }, positionB: { line: addStart + k + 1, column: 1 } }); addedLines++; }
    rem = []; add = [];
  };
  for (const part of base.differences) {
    if (part.type === 'same') { flush(); const n = splitLines(part.text).length; ai += n; bi += n; continue; }
    if (!rem.length && !add.length) { remStart = ai; addStart = bi; }
    const ls = splitLines(part.text);
    if (part.type === 'remove') { rem.push(...ls); ai += ls.length; } else { add.push(...ls); bi += ls.length; }
  }
  flush();
  return { ok: true, identical: differences.length === 0, differences, addedLines, removedLines, changedLines };
}
export type PixelImage = { width: number; height: number; data: Uint8ClampedArray };
export type PixelCompareResult = { ok: true; dimensionsMatch: boolean; sizeA: { width: number; height: number }; sizeB: { width: number; height: number }; differingPixels: number; boundingBox: { x: number; y: number; width: number; height: number } | null; diffMask: Uint8Array };
export function comparePixels(a: PixelImage, b: PixelImage, options: { tolerance?: number } = {}): PixelCompareResult | EngineError {
  const validDimensions = (im: PixelImage) => im && Number.isSafeInteger(im.width) && Number.isSafeInteger(im.height) && im.width > 0 && im.height > 0;
  if (!validDimensions(a) || !validDimensions(b)) return fail('invalid-image', 'Images must have positive integer dimensions.');
  if (a.width * a.height > FILE_COMPARE_LIMITS.maxPixels || b.width * b.height > FILE_COMPARE_LIMITS.maxPixels || Math.max(a.width, b.width) * Math.max(a.height, b.height) > FILE_COMPARE_LIMITS.maxPixels) return fail('too-large', 'Pixel comparison is limited to a 24-megapixel difference canvas.');
  if (!(a.data instanceof Uint8ClampedArray) || a.data.length !== a.width * a.height * 4 || !(b.data instanceof Uint8ClampedArray) || b.data.length !== b.width * b.height * 4) return fail('invalid-image', 'Image data must contain exactly four RGBA bytes per pixel.');
  const tolerance = options.tolerance ?? 0; if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 255) return fail('invalid-input', 'Pixel tolerance must be from 0 to 255.');
  const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height), mask = new Uint8Array(width * height); let count = 0, minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let diff = x >= a.width || y >= a.height || x >= b.width || y >= b.height; if (!diff) { const ia = (y * a.width + x) * 4, ib = (y * b.width + x) * 4; for (let c = 0; c < 4; c++) if (Math.abs(a.data[ia + c] - b.data[ib + c]) > tolerance) { diff = true; break; } } if (diff) { mask[y * width + x] = 1; count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); } }
  return { ok: true, dimensionsMatch: a.width === b.width && a.height === b.height, sizeA: { width: a.width, height: a.height }, sizeB: { width: b.width, height: b.height }, differingPixels: count, boundingBox: count ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null, diffMask: mask };
}
export function overlay(image: PixelImage, diffMask: Uint8Array): Uint8ClampedArray | EngineError {
  if (!image || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width <= 0 || image.height <= 0 || image.width * image.height > FILE_COMPARE_LIMITS.maxPixels || !(image.data instanceof Uint8ClampedArray) || image.data.length !== image.width * image.height * 4 || !(diffMask instanceof Uint8Array) || diffMask.length !== image.width * image.height) return fail('invalid-image', 'Image and difference mask dimensions do not match or exceed limits.');
  const out = new Uint8ClampedArray(image.data); for (let i = 0; i < diffMask.length; i++) if (diffMask[i]) { const p = i * 4; out[p] = 255; out[p + 1] = 0; out[p + 2] = 0; out[p + 3] = 255; } return out;
}
