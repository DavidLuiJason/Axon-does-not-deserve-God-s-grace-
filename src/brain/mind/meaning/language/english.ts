import { isCoordinator, isDeterminer, isPreposition, isQuestionWord } from '../closedSets';
import { numberToWords } from '../../../../tools/engines/numbers/numberToWords';
import { parseRoman, toRoman } from '../../../../tools/engines/numbers/romanNumeral';
import type { LanguagePack, LetterRole, WordRole } from './types';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const VOWELS = 'aeiou';
const EITHER = 'y';

function indexOfLetter(letter: unknown): number {
  if (typeof letter !== 'string' || letter.length !== 1) return -1;
  const code = letter.charCodeAt(0);
  if (code >= 97 && code <= 122) return code - 97;
  if (code >= 65 && code <= 90) return code - 65;
  return -1;
}

function roleOfLetter(ch: string): LetterRole | null {
  const pos = indexOfLetter(ch);
  if (pos < 0) return null;
  const lower = ALPHABET[pos]!;
  if (VOWELS.includes(lower)) return 'vowel';
  if (EITHER.includes(lower)) return 'either';
  return 'consonant';
}

function roleInWord(word: string, index: number): WordRole | null {
  if (typeof word !== 'string' || !Number.isInteger(index) || index < 0 || index >= word.length) return null;
  const ch = word[index]!;
  const role = roleOfLetter(ch);
  if (role === null) return null;
  if (role !== 'either') return role;
  if (index === 0) return 'consonant';
  const next = word[index + 1];
  if (next !== undefined && VOWELS.includes(next.toLowerCase())) return 'consonant';
  return 'vowel';
}

export function buildEnglishPack(): LanguagePack {
  return {
    id: 'en',
    alphabet: ALPHABET,
    digits: DIGITS,
    vowelLetters: VOWELS,
    eitherLetters: EITHER,
    upper(letter: string): string | null {
      const pos = indexOfLetter(letter);
      return pos < 0 ? null : ALPHABET[pos]!.toUpperCase();
    },
    lower(letter: string): string | null {
      const pos = indexOfLetter(letter);
      return pos < 0 ? null : ALPHABET[pos]!;
    },
    position(letter: string): number {
      return indexOfLetter(letter);
    },
    letterAt(position: number): string | null {
      return typeof position === 'number' && Number.isInteger(position) && position >= 0 && position < ALPHABET.length
        ? ALPHABET[position]!
        : null;
    },
    after(letter: string): string | null {
      const pos = indexOfLetter(letter);
      if (pos < 0 || pos === ALPHABET.length - 1) return null;
      const next = ALPHABET[pos + 1]!;
      return letter === letter.toUpperCase() ? next.toUpperCase() : next;
    },
    before(letter: string): string | null {
      const pos = indexOfLetter(letter);
      if (pos <= 0) return null;
      const prev = ALPHABET[pos - 1]!;
      return letter === letter.toUpperCase() ? prev.toUpperCase() : prev;
    },
    roleOfLetter,
    roleInWord,
    digitValue(ch: string): number {
      if (typeof ch !== 'string' || ch.length !== 1) return -1;
      const code = ch.charCodeAt(0);
      return code >= 48 && code <= 57 ? code - 48 : -1;
    },
    ordinalSuffix(n: number): string | null {
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) return null;
      const lastTwo = n % 100;
      if (lastTwo >= 11 && lastTwo <= 13) return 'th';
      const last = n % 10;
      if (last === 1) return 'st';
      if (last === 2) return 'nd';
      if (last === 3) return 'rd';
      return 'th';
    },
    numberWords(n: number): string | null {
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) return null;
      const result = numberToWords(String(n));
      return result.ok ? result.words : null;
    },
    romanOf(n: number): string | null {
      if (typeof n !== 'number' || !Number.isInteger(n)) return null;
      const result = toRoman(n);
      return result.ok ? result.text : null;
    },
    romanValue(text: string): number | null {
      if (typeof text !== 'string') return null;
      const result = parseRoman(text);
      return result.ok ? result.value : null;
    },
    grammar: { isCoordinator, isDeterminer, isPreposition, isQuestionWord },
  };
}
