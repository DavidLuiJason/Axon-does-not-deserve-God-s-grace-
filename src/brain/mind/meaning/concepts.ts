/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03A concept anchors: the dictionary's own synset ids for the greeting and thanks meanings.
 *
 * HOW EACH ID WAS DERIVED (MEASURED in public/dictionary/en with the project's Dictionary class, never remembered):
 * every noun sense whose gloss mentions greeting, salutation, gratitude or thanks was listed together with its
 * hypernym links (`Dictionary.relations`). Kept: the spoken expressions whose hypernym is `greeting`/`salutation`
 * (or whose gloss says "to say hello") and the expressions whose hypernym is `thanks`. Dropped: greeting cards,
 * gestures and acts (card, salute, pax, hail, welcome), and the verb "thank" (an imperative "thank him" is a
 * command, not an act of thanking). tests/meaningA.test.ts re-checks every id against the real dictionary.
 */

/** Spoken greetings: hello, hi, howdy, hullo (06645018); good morning (06645178); good afternoon (06645314);
 *  good evening (80042148); ciao, aloha (06644428); greeting, salutation as a plural expression (06642524). */
export const GREETING_IDS: readonly string[] = [
  'oewn-06645018-n', 'oewn-06645178-n', 'oewn-06645314-n', 'oewn-80042148-n', 'oewn-06644428-n', 'oewn-06642524-n',
];

/** Spoken thanks: thanks (07243631), thank you (07243905). */
export const THANKS_IDS: readonly string[] = ['oewn-07243631-n', 'oewn-07243905-n'];

const GREETING_SET: ReadonlySet<string> = new Set(GREETING_IDS);
const THANKS_SET: ReadonlySet<string> = new Set(THANKS_IDS);

export type AnchorAct = 'greet' | 'thanks';

/**
 * Which anchor concept a word's synset ids reach, and how completely: `full` is true when the word's FIRST listed
 * sense is that concept ("hello", "thanks"). The dictionary lists a word's most common sense first, so a word
 * whose first sense is something else ("morning" is first a time of day) is still read as a greeting when it
 * stands alone, but with lower confidence.
 */
export function anchorOfIds(ids: readonly string[] | undefined): { act: AnchorAct; full: boolean } | null {
  if (!ids || ids.length === 0) return null;
  const greet = ids.filter((id) => GREETING_SET.has(id)).length;
  const thanks = ids.filter((id) => THANKS_SET.has(id)).length;
  if (greet === 0 && thanks === 0) return null;
  const first = ids[0]!;
  if (greet >= thanks) return { act: 'greet', full: GREETING_SET.has(first) };
  return { act: 'thanks', full: THANKS_SET.has(first) };
}
