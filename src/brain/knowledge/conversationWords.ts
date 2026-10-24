/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The ONE small file of conversation words that the English dictionary does not carry (owner decision,
 * 2026-10-23, "Option A": greeting and thanks come from dictionary meanings plus this file).
 *
 * Rules for this file (checked by tests/meaningA.test.ts):
 * - A word may be listed only when the dictionary has a GAP for it: either no entry at all
 *   (`dictionary: 'absent'`) or its entries do not carry the greeting or thanks meaning
 *   (`dictionary: 'other-meaning'`). The test looks every word up in the real dictionary and fails if the claim
 *   is false, so a word the dictionary already knows can never be added here by mistake.
 * - Every word carries the reason it is here.
 * - `status: 'proposed'` means the Director proposes it and the owner has not yet confirmed it. The owner reads
 *   this list and says which words to keep. Words from My Dictionary count too (a later job).
 * - This is knowledge data, not brain logic: the brain asks `conversationActOf(word)` and holds no word list (FL13).
 */
export type ConversationAct = 'greet' | 'thanks';

export interface ConversationWord {
  word: string;
  act: ConversationAct;
  dictionary: 'absent' | 'other-meaning';
  reason: string;
  status: 'proposed' | 'confirmed';
}

export const CONVERSATION_WORDS: readonly ConversationWord[] = [
  { word: 'hey', act: 'greet', dictionary: 'absent', reason: 'everyday greeting; the dictionary has no entry for it', status: 'proposed' },
  { word: 'heya', act: 'greet', dictionary: 'absent', reason: 'spoken variant of hey; no dictionary entry', status: 'proposed' },
  { word: 'hiya', act: 'greet', dictionary: 'absent', reason: 'spoken variant of hi; no dictionary entry', status: 'proposed' },
  { word: 'yo', act: 'greet', dictionary: 'absent', reason: 'informal greeting; no dictionary entry', status: 'proposed' },
  { word: 'thx', act: 'thanks', dictionary: 'absent', reason: 'texting form of thanks; no dictionary entry', status: 'proposed' },
  { word: 'thanx', act: 'thanks', dictionary: 'absent', reason: 'spelling variant of thanks; no dictionary entry', status: 'proposed' },
  { word: 'thankyou', act: 'thanks', dictionary: 'absent', reason: 'written without the space; no dictionary entry', status: 'proposed' },
  { word: 'ty', act: 'thanks', dictionary: 'absent', reason: 'texting form of thank you; no dictionary entry', status: 'proposed' },
  { word: 'cheers', act: 'thanks', dictionary: 'other-meaning', reason: 'used as thanks in everyday speech; the dictionary only gives it the meaning of a shout of approval', status: 'proposed' },
];

const BY_WORD: ReadonlyMap<string, ConversationWord> = new Map(CONVERSATION_WORDS.map((item) => [item.word, item]));

/** The act a conversation word stands for, or null. The word must already be lower case. */
export function conversationActOf(word: string): ConversationAct | null {
  return BY_WORD.get(word)?.act ?? null;
}
