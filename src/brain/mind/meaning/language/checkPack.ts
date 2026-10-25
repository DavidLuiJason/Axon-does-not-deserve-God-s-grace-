import { numberToWords } from '../../../../tools/engines/numbers/numberToWords';
import { parseRoman, toRoman } from '../../../../tools/engines/numbers/romanNumeral';
import type { LanguagePack, PackProblem } from './types';

export function checkPack(pack: LanguagePack): PackProblem[] {
  const problems: PackProblem[] = [];
  const add = (code: string, detail: string): void => { problems.push({ code, detail }); };
  const safe = (code: string, detail: string, test: () => boolean): void => {
    try { if (!test()) add(code, detail); } catch { add(code, `${detail} (threw)`); }
  };

  try {
    if (!pack || typeof pack !== 'object') return [{ code: 'pack', detail: 'pack must be an object' }];
    safe('id', 'id must be a non-empty string', () => typeof pack.id === 'string' && pack.id.trim().length > 0);
    safe('alphabet', 'alphabet must be lower-case, sorted, unique, and contain at least two letters', () => {
      if (typeof pack.alphabet !== 'string' || pack.alphabet.length < 2) return false;
      for (let i = 0; i < pack.alphabet.length; i += 1) {
        const code = pack.alphabet.charCodeAt(i);
        if (code < 97 || code > 122) return false;
        if (i > 0 && pack.alphabet.charCodeAt(i - 1) >= code) return false;
      }
      return true;
    });
    safe('digits', 'digits must be exactly 0123456789', () => pack.digits === '0123456789');
    safe('vowels', 'vowel letters must be unique members of the alphabet', () => {
      if (typeof pack.vowelLetters !== 'string') return false;
      for (let i = 0; i < pack.vowelLetters.length; i += 1) {
        const ch = pack.vowelLetters[i]!;
        if (!pack.alphabet.includes(ch) || pack.vowelLetters.indexOf(ch) !== i) return false;
      }
      return true;
    });
    safe('either', 'either letters must be unique alphabet members and disjoint from vowels', () => {
      if (typeof pack.eitherLetters !== 'string') return false;
      for (let i = 0; i < pack.eitherLetters.length; i += 1) {
        const ch = pack.eitherLetters[i]!;
        if (!pack.alphabet.includes(ch) || pack.eitherLetters.indexOf(ch) !== i || pack.vowelLetters.includes(ch)) return false;
      }
      return true;
    });

    const alphabet = typeof pack.alphabet === 'string' ? pack.alphabet : '';
    for (let i = 0; i < alphabet.length; i += 1) {
      const ch = alphabet[i]!;
      const upper = ch.toUpperCase();
      safe('letterAt', `letterAt(${i}) must return ${ch}`, () => pack.letterAt(i) === ch);
      safe('position', `position must locate ${ch} and ${upper}`, () => pack.position(ch) === i && pack.position(upper) === i);
      safe('upper', `upper(${ch}) must return ${upper}`, () => pack.upper(ch) === upper && pack.upper(upper) === upper);
      safe('lower', `lower(${upper}) must return ${ch}`, () => pack.lower(upper) === ch && pack.lower(ch) === ch);
      const expectedAfter = i + 1 < alphabet.length ? alphabet[i + 1]! : null;
      const expectedBefore = i > 0 ? alphabet[i - 1]! : null;
      safe('after', `after(${ch}) must follow alphabet order`, () => pack.after(ch) === expectedAfter && pack.after(upper) === (expectedAfter === null ? null : expectedAfter.toUpperCase()));
      safe('before', `before(${ch}) must follow alphabet order`, () => pack.before(ch) === expectedBefore && pack.before(upper) === (expectedBefore === null ? null : expectedBefore.toUpperCase()));
      const expectedRole = pack.vowelLetters.includes(ch) ? 'vowel' : pack.eitherLetters.includes(ch) ? 'either' : 'consonant';
      safe('roleOfLetter', `roleOfLetter must classify ${ch}`, () => pack.roleOfLetter(ch) === expectedRole && pack.roleOfLetter(upper) === expectedRole);
    }
    safe('letterAt', 'letterAt must reject invalid positions', () => pack.letterAt(-1) === null && pack.letterAt(alphabet.length) === null && pack.letterAt(1.5) === null && pack.letterAt(Number.NaN) === null);
    safe('letterInput', 'letter functions must reject non-letters', () => pack.position('') === -1 && pack.position('ab') === -1 && pack.upper('1') === null && pack.lower(' ') === null && pack.after('é') === null && pack.before('😀') === null);
    safe('roles', 'roleOfLetter must reject non-letters', () => pack.roleOfLetter('') === null && pack.roleOfLetter('ab') === null && pack.roleOfLetter('1') === null);
    safe('roleInWord', 'roleInWord must reject non-letters and invalid indices', () => pack.roleInWord('a1b', 1) === null && pack.roleInWord('abc', -1) === null && pack.roleInWord('abc', 3) === null && pack.roleInWord('abc', 1.5) === null);
    safe('invalidLetters', 'letter functions must give null or -1 for anything that is not exactly one alphabet letter', () => { for (const bad of ['', 'ab', '1', ' ', '\u00e9', '\ud83d\ude00', '\uff41', '\u0000']) { if (pack.upper(bad) !== null || pack.lower(bad) !== null || pack.position(bad) !== -1 || pack.after(bad) !== null || pack.before(bad) !== null || pack.roleOfLetter(bad) !== null) return false; } return true; });
    safe('idForm', 'id must be 2 to 3 lower-case letters', () => typeof pack.id === 'string' && pack.id.length >= 2 && pack.id.length <= 3 && [...pack.id].every((c) => c >= 'a' && c <= 'z'));

    for (let i = 0; i < (typeof pack.digits === 'string' ? pack.digits.length : 0); i += 1) {
      const ch = pack.digits[i]!;
      safe('digitValue', `digitValue(${ch}) must equal ${i}`, () => pack.digitValue(ch) === i);
    }
    safe('digitValue', 'digitValue must reject other scripts and malformed input', () => pack.digitValue('a') === -1 && pack.digitValue('12') === -1 && pack.digitValue('٣') === -1);

    const ordinalCases: Array<[number, string | null]> = [[0, 'th'], [1, 'st'], [2, 'nd'], [3, 'rd'], [4, 'th'], [11, 'th'], [12, 'th'], [13, 'th'], [21, 'st'], [101, 'st'], [111, 'th'], [112, 'th'], [113, 'th'], [Number.MAX_SAFE_INTEGER, 'st'], [-1, null], [1.5, null], [Number.NaN, null], [Infinity, null], [2 ** 53, null]];
    for (const [n, expected] of ordinalCases) safe('ordinalSuffix', `ordinalSuffix(${n}) must equal ${expected}`, () => pack.ordinalSuffix(n) === expected);
    safe('ordinalSuffix', 'ordinalSuffix must follow the rule for 0 to 2100 and the teens of every hundred', () => { for (let n = 0; n <= 2100; n += 1) { const h = n % 100; const o = n % 10; const want = h >= 11 && h <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'; if (pack.ordinalSuffix(n) !== want) return false; } return true; });

    const zeroWords = numberToWords('0');
    const twentyOneWords = numberToWords('21');
    safe('numberWords', 'numberWords must use shared number-word engine results', () => pack.numberWords(0) === (zeroWords.ok ? zeroWords.words : null) && pack.numberWords(21) === (twentyOneWords.ok ? twentyOneWords.words : null));
    safe('numberWords', 'numberWords must reject negative and invalid numeric values', () => pack.numberWords(-1) === null && pack.numberWords(1.5) === null && pack.numberWords(Number.NaN) === null && pack.numberWords(Infinity) === null);

    const romanFour = toRoman(4);
    safe('romanOf', 'romanOf must use canonical Roman engine output', () => pack.romanOf(4) === (romanFour.ok ? romanFour.text : null) && pack.romanOf(4) !== 'IIII');
    safe('romanValue', 'romanValue must use canonical Roman engine parsing', () => {
      const four = parseRoman('IV');
      return pack.romanValue('IV') === (four.ok ? four.value : null) && pack.romanValue('IIII') === null;
    });
    safe('romanRange', 'Roman numeral functions must reject zero and 4000', () => pack.romanOf(0) === null && pack.romanOf(4000) === null && pack.romanValue('') === null && pack.romanValue('IIII') === null);
    safe('romanRoundTrip', 'Roman numeral engine round trips must hold', () => {
      for (let n = 1; n <= 3999; n += 1) {
        const expected = toRoman(n);
        if (!expected.ok || pack.romanOf(n) !== expected.text || pack.romanValue(expected.text) !== n) return false;
      }
      return true;
    });

    if (pack.id === 'en') {
      safe('englishY', 'English y must be consonant at word start and before vowels, otherwise vowel', () =>
        pack.roleInWord('yes', 0) === 'consonant' && pack.roleInWord('beyond', 2) === 'consonant' && pack.roleInWord('gym', 1) === 'vowel');
      safe('englishGrammar', 'English grammar predicates must match the approved closed sets', () =>
        pack.grammar.isCoordinator('and') && pack.grammar.isDeterminer('the') && pack.grammar.isPreposition('on') && pack.grammar.isQuestionWord('what') &&
        !pack.grammar.isCoordinator('banana') && !pack.grammar.isDeterminer('banana') && !pack.grammar.isPreposition('banana') && !pack.grammar.isQuestionWord('banana'));
    } else {
      safe('grammar', 'grammar predicates must exist and return booleans', () => {
        const g = pack.grammar;
        return typeof g.isCoordinator('') === 'boolean' && typeof g.isDeterminer('') === 'boolean' && typeof g.isPreposition('') === 'boolean' && typeof g.isQuestionWord('') === 'boolean';
      });
      safe('roleInWord', 'roleInWord must return null for an invalid index', () => pack.roleInWord('', 0) === null);
    }
  } catch (error) {
    add('checker', `checker caught an unexpected error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  return problems;
}
