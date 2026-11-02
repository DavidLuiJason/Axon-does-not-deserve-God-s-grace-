/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE9-2: the CLOSED SET of mode words for Sort Lines (FL13: one named file per approved group).
 * PROPOSED 2026-11-02 in docs/LIVE9_DESIGN.md section 2; the owner's yes is WAITING (the owner said "give me the next one" and has not answered the words).
 * Nothing goes live on it: the Sort Lines switch stays OFF until LIVE9-3. Changing a word later is one line here plus the pin in tests/sortModeWords.test.ts.
 * Word on the left (what a person says, lowercase), engine mode on the right (what `sortLines` takes). "numerically" and "a to z" are NOT in the set.
 */
import { SORT_LINE_MODES } from '../engines/text/sortLines';

export const SORT_MODE_WORDS: Readonly<Record<string, (typeof SORT_LINE_MODES)[number]>> = Object.freeze({
  ascending: 'ascending', alphabetical: 'ascending', alphabetically: 'ascending',
  descending: 'descending',
  length: 'by-length',
  natural: 'natural',
  reverse: 'reverse',
  shuffle: 'shuffle', random: 'shuffle', randomize: 'shuffle',
});

/** The choice words the binder may fill: the closed set above (the binder compares ignoring capitals). */
export const SORT_MODE_CHOICES: readonly string[] = Object.freeze(Object.keys(SORT_MODE_WORDS));

/** Folds what the binder filled (or what the screen sends) to the engine mode. An engine mode passes through; an unknown word is returned unchanged so the runner refuses it. */
export function foldSortMode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if ((SORT_LINE_MODES as readonly string[]).includes(value)) return value;
  const folded = Object.prototype.hasOwnProperty.call(SORT_MODE_WORDS, value.toLowerCase()) ? SORT_MODE_WORDS[value.toLowerCase()] : undefined;
  return folded ?? value;
}
