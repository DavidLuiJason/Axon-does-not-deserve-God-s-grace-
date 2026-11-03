/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE9-3: the CLOSED SET of words that name something Sort Lines does NOT do through the lane: an OPTION the lane does not fill, or an ORDER outside the owner's mode words (FL13: one named file per group).
 * Used ONLY by the Sort Lines lane guard, to YIELD: a message that asks for duplicates, blank lines, case, or an order the mode words do not cover must never be
 * answered as if it had not (measured, LIVE9-2b: "sort ... and remove duplicates" would have ignored the duplicates; measured LIVE9-3 with the switch ON: "z to a", "backwards", "numerically" and "naturally" were answered A to Z).
 * It adds nothing a person can say to make AXON act: a word here can only make AXON ask or use another path. PROPOSED 2026-11-03; changing it is one line here plus the pin in tests/liveSortLines.test.ts.
 * Word on the left (lowercase), engine option on the right.
 */
export const SORT_OPTION_WORDS: Readonly<Record<string, 'removeDuplicates' | 'ignoreBlankLines' | 'ignoreCase' | 'otherOrder'>> = Object.freeze({
  duplicate: 'removeDuplicates', duplicates: 'removeDuplicates', dedupe: 'removeDuplicates', unique: 'removeDuplicates', repeated: 'removeDuplicates',
  blank: 'ignoreBlankLines', empty: 'ignoreBlankLines',
  ignore: 'ignoreCase', ignoring: 'ignoreCase', insensitive: 'ignoreCase', insensitively: 'ignoreCase',
  numerically: 'otherOrder', numeric: 'otherOrder', numerical: 'otherOrder', backwards: 'otherOrder', backward: 'otherOrder', reversed: 'otherOrder', naturally: 'otherOrder', z: 'otherOrder',
});

/** Lowercase letter-runs of a message (plain character test, no pattern literal). */
export function sortWordsOf(message: string): string[] {
  const words: string[] = []; let current = '';
  for (const ch of message.toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || ch === '-') current += ch;
    else { if (current !== '') words.push(current); current = ''; }
  }
  if (current !== '') words.push(current);
  return words;
}
