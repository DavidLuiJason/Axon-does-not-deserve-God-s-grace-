/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03B3a LANGUAGE CHECK: does this message read as English? AXON reads English only, so it must not pretend to understand
 * anything else, and it must not wrongly refuse English with names, typos or Nigerian Pidgin mixed in (owner decision 2026-10-25:
 * never claim "English only" unless the message is clearly another script or almost every word is unknown).
 * Pure, no word lists: it uses (1) the script of each letter, by Unicode ranges (structure, not vocabulary), (2) the dictionary's own
 * verdict per word (`Token.knowledge`) and (3) the closed grammar words the Meaning stage already has. It gives a reading, never a reply:
 * answering with it belongs to the Response stage.
 */
import type { Analysis } from '../types';
import { isGrammarWord, normalizeWord } from './closedSets';
import { LINK_WORDS } from './structure/linkWords';

/** The closed link words (if, because, when ...) of B03B2a are English grammar words too. */
const LINK_SET = new Set(Object.values(LINK_WORDS).join(' ').split(' '));

export type LanguageVerdict = 'english' | 'mixed' | 'not-english' | 'other-script' | 'unclear' | 'no-words';
export interface LanguageReading {
  verdict: LanguageVerdict;
  /** Latin-script words that were checked against the dictionary. */
  words: number;
  /** Share (0 to 1) of those words that are English: in the dictionary or a closed grammar word. */
  englishShare: number;
  /** Words the dictionary does not know, in message order, at most `MAX_UNKNOWN`. AXON can name them instead of guessing. */
  unknownWords: string[];
  nonLatinLetters: number;
  latinLetters: number;
  reason: string;
}

export const LANGUAGE_RULES = { minWordsForClaim: 3, englishAtLeast: 0.5, notEnglishAtMost: 0.2, maxUnknown: 8 } as const;

type Script = 'latin' | 'other' | 'none';
/** The script of one character by code point. Combining marks (accents such as in Yoruba) and everything that is not a letter are 'none'. */
function scriptOf(cp: number): Script {
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return 'latin';
  if (cp === 0xaa || cp === 0xba) return 'latin';
  if (cp >= 0xc0 && cp <= 0x24f) return cp === 0xd7 || cp === 0xf7 ? 'none' : 'latin';
  if (cp >= 0x1e00 && cp <= 0x1eff) return 'latin';
  // 0x2b0 to 0x36f (modifier letters and combining accents, as in Yoruba) fall through to 'none' on purpose.
  if (cp >= 0x370 && cp <= 0x1dff) return 'other';
  if (cp >= 0x1f00 && cp <= 0x1fff) return 'other';
  if (cp >= 0x3040 && cp <= 0x30ff) return 'other';
  if ((cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff)) return 'other';
  if (cp >= 0xac00 && cp <= 0xd7af) return 'other';
  return 'none';
}

function hasLetter(surface: string): boolean {
  for (const ch of surface) if (scriptOf(ch.codePointAt(0)!) !== 'none') return true;
  return false;
}

export function readLanguage(analysis: Analysis): LanguageReading {
  let latinLetters = 0;
  let otherLetters = 0;
  for (const segment of analysis.segments) {
    if (segment.kind !== 'language') continue;
    for (const ch of segment.text) {
      const script = scriptOf(ch.codePointAt(0)!);
      if (script === 'latin') latinLetters += 1; else if (script === 'other') otherLetters += 1;
    }
  }
  const base = { words: 0, englishShare: 0, unknownWords: [] as string[], nonLatinLetters: otherLetters, latinLetters };
  if (latinLetters + otherLetters === 0) return { verdict: 'no-words', ...base, reason: 'no letters to read' };
  if (otherLetters > latinLetters) return { verdict: 'other-script', ...base, reason: 'most letters are not in the Latin alphabet' };

  let checked = 0; let english = 0; let unchecked = 0;
  const unknownWords: string[] = [];
  for (const token of analysis.tokens) {
    if (!hasLetter(token.surface) || scriptOf(token.surface.codePointAt(0)!) === 'other') continue;
    if (token.knowledge === 'not-checked' || token.knowledge === undefined) { unchecked += 1; continue; }
    checked += 1;
    if (token.knowledge === 'known' || isGrammarWord(normalizeWord(token.surface)) || LINK_SET.has(normalizeWord(token.surface))) english += 1;
    else if (unknownWords.length < LANGUAGE_RULES.maxUnknown) unknownWords.push(token.surface);
  }
  const share = checked === 0 ? 0 : english / checked;
  const fill = { ...base, words: checked, englishShare: Math.round(share * 1000) / 1000, unknownWords };
  if (checked === 0) return { verdict: unchecked > 0 ? 'unclear' : 'no-words', ...fill, reason: unchecked > 0 ? 'the words were not checked against the dictionary' : 'no words to read' };
  if (checked < LANGUAGE_RULES.minWordsForClaim) {
    return english > 0 ? { verdict: 'english', ...fill, reason: 'a short message with an English word' } : { verdict: 'unclear', ...fill, reason: 'too short to tell: one or two words the dictionary does not know (a name, a typo or another language)' };
  }
  if (share >= LANGUAGE_RULES.englishAtLeast) return { verdict: 'english', ...fill, reason: 'most words are English' };
  if (share <= LANGUAGE_RULES.notEnglishAtMost) return { verdict: 'not-english', ...fill, reason: 'almost every word is unknown to the English dictionary' };
  return { verdict: 'mixed', ...fill, reason: 'some words are English and some are not: read as English with unknown words, never refused' };
}
