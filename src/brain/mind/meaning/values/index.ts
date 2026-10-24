/**
 * B03B1 Values: the assembler. DIRECTOR-OWNED: builders never edit this file.
 * extractValues finds every value inside the LANGUAGE segments of a message and computes it by tested code.
 * It never reads the real clock and never touches the dictionary. The four readers are in sibling files.
 */
import { UNITS } from '../../../../tools/engines/numbers/unitConvert';
import { daysInMonth } from '../../../../tools/engines/time/dateCalc';
import type { Segment } from '../../types';
import { VALUES_LIMITS } from './types';
import type { Clock, ExtractOptions, ExtractedValue, ScanContext, TextRange, ValuesOutcome } from './types';
import { readNumbers } from './numbers';
import { readQuantities } from './quantities';
import { readDatesTimes } from './datetimes';
import { readRoman } from './roman';

export { VALUES_LIMITS } from './types';
export type { Clock, ExtractedValue, ValuesOutcome, ExtractOptions } from './types';
export { lookupUnitWord } from './quantities';

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

function clockProblem(clock: Clock): string | null {
  if (!clock || typeof clock !== 'object') return 'the clock is missing';
  const { year, month, day, hour, minute } = clock;
  if (![year, month, day, hour, minute].every(isInt)) return 'every clock field must be a whole number';
  if (year < 1 || year > 9999 || month < 1 || month > 12) return 'year or month is out of range';
  if (day < 1 || day > daysInMonth(year, month)) return 'day is out of range for that month';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return 'hour or minute is out of range';
  return null;
}

function languageRanges(segments: Segment[], length: number): TextRange[] {
  const ranges: TextRange[] = [];
  for (const s of segments) {
    if (!s || s.kind !== 'language' || !isInt(s.start) || !isInt(s.end)) continue;
    const start = Math.max(0, s.start);
    const end = Math.min(length, s.end);
    if (end > start) ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

/** Sorted by start; when two values overlap the more confident one stays (then the longer). */
function resolveOverlaps(values: ExtractedValue[]): ExtractedValue[] {
  const sorted = [...values].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: ExtractedValue[] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (!last || v.start >= last.end) { out.push(v); continue; }
    const vBetter = v.confidence > last.confidence || (v.confidence === last.confidence && v.end - v.start > last.end - last.start);
    if (vBetter) out[out.length - 1] = v;
  }
  return out;
}

export function extractValues(text: string, segments: Segment[], clock: Clock, options?: ExtractOptions): ValuesOutcome {
  if (typeof text !== 'string' || !Array.isArray(segments)) return { ok: false, error: 'invalid-input', message: 'text must be a string and segments a list' };
  if (text.length > VALUES_LIMITS.maxCharacters) return { ok: false, error: 'too-long', message: `text is longer than ${VALUES_LIMITS.maxCharacters} characters` };
  const problem = clockProblem(clock);
  if (problem) return { ok: false, error: 'invalid-clock', message: problem };
  const ctx: ScanContext = { text, ranges: languageRanges(segments, text.length), clock, units: options?.units ?? UNITS };
  if (ctx.ranges.length === 0) return { ok: true, values: [] };
  let found = readNumbers(ctx, []);
  found = readQuantities(ctx, found);
  found = readDatesTimes(ctx, found);
  found = [...found, ...readRoman(ctx, found)];
  return { ok: true, values: resolveOverlaps(found) };
}
