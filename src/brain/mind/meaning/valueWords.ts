/**
 * Closed word sets for value reading (B03B1).
 * The ONLY file in this job allowed to hold word lists (like closedSets.ts).
 * APPROVED groups are owner-approved grammar; PROPOSED groups need owner approval before merge.
 * status: 'approved' | 'proposed'
 */

/** APPROVED: cardinal number words (zero–nineteen, tens, scales). Grammar of counting, not open vocabulary. */
export const CARDINAL_WORDS: ReadonlyMap<string, number> = new Map([
  ['zero', 0],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
  ['hundred', 100],
  ['thousand', 1000],
  ['million', 1_000_000],
]);

/** APPROVED: ordinal words first–tenth. */
export const ORDINAL_WORDS: ReadonlyMap<string, number> = new Map([
  ['first', 1],
  ['second', 2],
  ['third', 3],
  ['fourth', 4],
  ['fifth', 5],
  ['sixth', 6],
  ['seventh', 7],
  ['eighth', 8],
  ['ninth', 9],
  ['tenth', 10],
]);

/** APPROVED: half (fraction used in durations and numbers). */
export const HALF_WORD = 'half';

/** PROPOSED: sign words. Closed polarity markers for numbers. status: proposed */
export const SIGN_WORDS: ReadonlySet<string> = new Set(['minus', 'negative']);

/** PROPOSED: percent words. status: proposed */
export const PERCENT_WORDS: ReadonlySet<string> = new Set(['percent', 'per', 'cent']);

/** PROPOSED: clock words for times of day. status: proposed */
export const CLOCK_WORDS: ReadonlySet<string> = new Set([
  'quarter',
  'past',
  'to',
  'noon',
  'midnight',
  'am',
  'pm',
  "o'clock",
]);

/** PROPOSED: relative calendar words. status: proposed */
export const RELATIVE_DAY_WORDS: ReadonlyMap<string, number> = new Map([
  ['today', 0],
  ['tomorrow', 1],
  ['yesterday', -1],
]);

/** PROPOSED: weekday names (Sunday=0 … Saturday=6, matching dateCalc weekday). status: proposed */
export const WEEKDAY_WORDS: ReadonlyMap<string, number> = new Map([
  ['sunday', 0],
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
]);

/** PROPOSED: month names and three-letter abbreviations (1–12). status: proposed */
export const MONTH_WORDS: ReadonlyMap<string, number> = new Map([
  ['january', 1],
  ['jan', 1],
  ['february', 2],
  ['feb', 2],
  ['march', 3],
  ['mar', 3],
  ['april', 4],
  ['apr', 4],
  ['may', 5],
  ['june', 6],
  ['jun', 6],
  ['july', 7],
  ['jul', 7],
  ['august', 8],
  ['aug', 8],
  ['september', 9],
  ['sep', 9],
  ['sept', 9],
  ['october', 10],
  ['oct', 10],
  ['november', 11],
  ['nov', 11],
  ['december', 12],
  ['dec', 12],
]);

export const VALUE_WORDS_STATUS = {
  CARDINAL_WORDS: 'approved' as const,
  ORDINAL_WORDS: 'approved' as const,
  HALF_WORD: 'approved' as const,
  SIGN_WORDS: 'proposed' as const,
  PERCENT_WORDS: 'proposed' as const,
  CLOCK_WORDS: 'proposed' as const,
  RELATIVE_DAY_WORDS: 'proposed' as const,
  WEEKDAY_WORDS: 'proposed' as const,
  MONTH_WORDS: 'proposed' as const,
};
