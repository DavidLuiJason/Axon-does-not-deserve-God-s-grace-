/**
 * SHAPERS (Director 471, ROUND-ALL): for a tool whose arguments are NOT plain slots (a percentage needs its mode and a values record built from
 * the numbers and the little words between them), a shaper reads the typed values and the words of the clause and returns the arguments itself.
 * PURE and STRUCTURAL: it uses the positions of values and single words from closed frozen records (no phrase lists, no regular expressions, FL13).
 * It returns null whenever the clause does not have exactly one of its known shapes, and then the ordinary binder rules apply (and ask).
 * `strong` says the SHAPE itself is proof that the person asked for this tool (a percent value, of, a number): it lifts a value-only evidence.
 */
import type { BindInput, BindValue, BindWord } from './argumentBinder';

export interface Shaped { readonly args: Readonly<Record<string, unknown>>; readonly strong: boolean }
export type Shaper = (input: BindInput) => Shaped | null;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const word = (set: Readonly<Record<string, true>>, norm: string): boolean => Object.prototype.hasOwnProperty.call(set, norm);
function numbersOf(input: BindInput): BindValue[] {
  return (Array.isArray(input.values) ? input.values : []).filter((v) => !!v && (v.kind === 'number' || v.kind === 'percent') && isNum(v.value) && v.error === undefined)
    .slice().sort((a, b) => a.start - b.start);
}
function wordsOf(input: BindInput): BindWord[] { return (Array.isArray(input.words) ? input.words : []).filter((w) => !!w && typeof w.norm === 'string').slice().sort((a, b) => a.start - b.start); }
const between = (words: readonly BindWord[], from: number, to: number, set: Readonly<Record<string, true>>): boolean => words.some((w) => w.start >= from && w.end <= to && word(set, w.norm.toLowerCase()));
const before = (words: readonly BindWord[], at: number, set: Readonly<Record<string, true>>): boolean => words.some((w) => w.end <= at && word(set, w.norm.toLowerCase()));
const after = (words: readonly BindWord[], at: number, set: Readonly<Record<string, true>>): boolean => words.some((w) => w.start >= at && word(set, w.norm.toLowerCase()));
const only = (norm: string): Readonly<Record<string, true>> => Object.freeze({ [norm]: true } as Record<string, true>);

const OF = only('of'); const WHAT = only('what'); const FROM = only('from'); const TO = only('to'); const BY = only('by'); const IS = only('is'); const OFF = only('off');
const CHANGE: Readonly<Record<string, true>> = Object.freeze({ change: true });
const PERCENT_WORD: Readonly<Record<string, true>> = Object.freeze({ percent: true, percentage: true });
const UP: Readonly<Record<string, true>> = Object.freeze({ increase: true, raise: true, add: true });
const DOWN: Readonly<Record<string, true>> = Object.freeze({ decrease: true, reduce: true, subtract: true, take: true });

/** Percentage Helper: the five engine modes, each by its own structure of values and words. */
export const percentageShaper: Shaper = (input) => {
  const nums = numbersOf(input); const words = wordsOf(input);
  const out = (mode: string, values: Record<string, number>): Shaped => ({ args: { mode, values }, strong: true });
  if (nums.length !== 2) return null;
  const [a, b] = nums as [BindValue, BindValue];
  const av = a.value as number; const bv = b.value as number;
  // 15% of 80, 12 percent of 50  ->  percent-of
  if (a.kind === 'percent' && b.kind === 'number' && between(words, a.end, b.start, OF) && !after(words, b.end, WHAT)) return out('percent-of', { x: av, y: bv });
  // 15 is 30% of what  ->  percent-of-what (x percent, y the part)
  if (a.kind === 'number' && b.kind === 'percent' && after(words, b.end, OF) && after(words, b.end, WHAT)) return out('percent-of-what', { x: bv, y: av });
  // what percent is 20 of 80, 20 is what percent of 80  ->  what-percent
  if (a.kind === 'number' && b.kind === 'number' && before(words, b.start, WHAT) && (before(words, b.start, PERCENT_WORD) || between(words, a.end, b.start, PERCENT_WORD))) {
    if (between(words, a.end, b.start, OF)) return out('what-percent', { x: av, y: bv });
    if (before(words, a.start, OF) && between(words, a.end, b.start, IS)) return out('what-percent', { x: bv, y: av });
  }
  // percent change from 50 to 75  ->  change
  if (a.kind === 'number' && b.kind === 'number' && after(words, 0, CHANGE) && before(words, a.start, FROM) && between(words, a.end, b.start, TO)) return out('change', { a: av, b: bv });
  // increase 200 by 15%, decrease 200 by 15%  ->  adjust
  if (a.kind === 'number' && b.kind === 'percent' && between(words, a.end, b.start, BY)) {
    if (before(words, a.start, UP) && !before(words, a.start, DOWN)) return out('adjust', { x: bv, y: av });
    if (before(words, a.start, DOWN) && !before(words, a.start, UP)) return out('adjust', { x: -bv, y: av });
  }
  // add 15% to 200, take 10% off 80, subtract 10% from 80  ->  adjust
  if (a.kind === 'percent' && b.kind === 'number') {
    if (before(words, a.start, UP) && !before(words, a.start, DOWN) && between(words, a.end, b.start, TO)) return out('adjust', { x: av, y: bv });
    if (before(words, a.start, DOWN) && !before(words, a.start, UP) && (between(words, a.end, b.start, OFF) || between(words, a.end, b.start, FROM))) return out('adjust', { x: -av, y: bv });
  }
  return null;
};

export const SHAPERS: Readonly<Record<string, Shaper>> = Object.freeze({
  'percentage-helper': percentageShaper,
});
