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
import { sortWordsOf } from './sortOptionWords';

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

/**
 * Owner decision (delegated, 2026-11-03): "sort in reverse" means DESCENDING. The word `reverse` flips the lines only when no sorting verb stands beside it ("reverse the lines").
 * The sorting verbs are a closed set of structure words (FL13), read from the message OUTSIDE the person's own quoted text.
 */
export const SORT_VERB_WORDS: Readonly<Record<string, true>> = Object.freeze({ sort: true, sorted: true, sorting: true, arrange: true, order: true, alphabetize: true, alphabetise: true });

export function readSortReverse(args: Readonly<Record<string, unknown>>, message: string): Readonly<Record<string, unknown>> {
  if (args.mode !== 'reverse' && !(typeof args.mode === 'string' && args.mode.toLowerCase() === 'reverse')) return args;
  const text = typeof args.text === 'string' ? args.text : '';
  const outside = text === '' ? message : message.split(text).join(' ');
  const hasVerb = sortWordsOf(outside).some((word) => Object.prototype.hasOwnProperty.call(SORT_VERB_WORDS, word));
  return hasVerb ? { ...args, mode: 'descending' } : args;
}
