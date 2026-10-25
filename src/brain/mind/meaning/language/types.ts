/**
 * B03B0 LANGUAGE KIT: the CONTRACT every language pack must fill (written by the Director; do not change it).
 * A pack is a bundle of grammar facts and small rule functions. It holds NO vocabulary (FL13): the alphabet, digits and vowel
 * letters are closed grammar, kept as single strings. English is the first pack; a new language starts from the same shape.
 */
export type LetterRole = 'vowel' | 'consonant' | 'either';
export type WordRole = 'vowel' | 'consonant';

export interface GrammarWords {
  isCoordinator(word: string): boolean;
  isDeterminer(word: string): boolean;
  isPreposition(word: string): boolean;
  isQuestionWord(word: string): boolean;
}

export interface LanguagePack {
  readonly id: string;            // short language id, e.g. 'en'
  readonly alphabet: string;      // lower-case letters in alphabetical order, ONE string, no repeats
  readonly digits: string;        // the ten digits in order, ONE string
  readonly vowelLetters: string;  // letters that are always vowels (subset of alphabet)
  readonly eitherLetters: string; // letters that can be a vowel or a consonant (subset of alphabet, disjoint from vowelLetters)

  upper(letter: string): string | null;        // 'a' -> 'A'; null when the input is not exactly one alphabet letter
  lower(letter: string): string | null;
  position(letter: string): number;            // 0-based place in the alphabet, either case; -1 when not one alphabet letter
  letterAt(position: number): string | null;   // lower-case letter at that place; null when out of range or not an integer
  after(letter: string): string | null;        // next letter, SAME case as the input; null for the last letter or a non-letter
  before(letter: string): string | null;
  roleOfLetter(ch: string): LetterRole | null; // null when not an alphabet letter
  roleInWord(word: string, index: number): WordRole | null; // role of the letter at index in that word; null when not a letter or out of range
  digitValue(ch: string): number;              // 0..9, or -1 when not one of this pack's digits
  ordinalSuffix(n: number): string | null;     // 1 -> 'st', 2 -> 'nd', 3 -> 'rd', 11 -> 'th'; null unless n is a non-negative safe integer
  numberWords(n: number): string | null;       // through the shared engine numberToWords; null when invalid, negative, fractional or too large
  romanOf(n: number): string | null;           // through the shared engine romanNumeral (1..3999 only)
  romanValue(text: string): number | null;     // through the shared engine; canonical numerals only
  readonly grammar: GrammarWords;              // from closedSets.ts
}

export interface PackProblem { code: string; detail: string; }
