/**
 * B03B0 RUNNER (Director-owned; do not change). Usage: node run.mjs tests/languageKitRunner.test.ts
 * Proves the English pack (language/english.ts: buildEnglishPack) and the pack checker (language/checkPack.ts: checkPack).
 */
import { buildEnglishPack } from '../src/brain/mind/meaning/language/english';
import { checkPack } from '../src/brain/mind/meaning/language/checkPack';
import type { LanguagePack } from '../src/brain/mind/meaning/language/types';
import { numberToWords } from '../src/tools/engines/numbers/numberToWords';
import { parseRoman, toRoman } from '../src/tools/engines/numbers/romanNumeral';

let checks = 0;
const fails: string[] = [];
function eq(actual: unknown, expected: unknown, label: string): void {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fails.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
const p: LanguagePack = buildEnglishPack();

// 1. facts
eq(p.id, 'en', 'id'); eq(p.alphabet, 'abcdefghijklmnopqrstuvwxyz', 'alphabet'); eq(p.digits, '0123456789', 'digits');
eq([...p.vowelLetters].sort().join(''), 'aeiou', 'vowelLetters'); eq(p.eitherLetters, 'y', 'eitherLetters');

// 2. letters
for (let i = 0; i < 26; i += 1) {
  const lo = String.fromCharCode(97 + i); const up = lo.toUpperCase();
  eq(p.letterAt(i), lo, `letterAt ${i}`); eq(p.position(lo), i, `position ${lo}`); eq(p.position(up), i, `position ${up}`);
  eq(p.upper(lo), up, `upper ${lo}`); eq(p.lower(up), lo, `lower ${up}`); eq(p.upper(up), up, `upper of upper ${up}`); eq(p.lower(lo), lo, `lower of lower ${lo}`);
  eq(p.after(lo), i < 25 ? String.fromCharCode(98 + i) : null, `after ${lo}`);
  eq(p.after(up), i < 25 ? String.fromCharCode(66 + i) : null, `after ${up}`);
  eq(p.before(lo), i > 0 ? String.fromCharCode(96 + i) : null, `before ${lo}`);
  eq(p.before(up), i > 0 ? String.fromCharCode(64 + i) : null, `before ${up}`);
}
for (const bad of ['', 'ab', '1', ' ', 'é', 'ß', '😀', '\u0000', 'A ', 'ａ']) {
  eq(p.position(bad), -1, `position bad ${JSON.stringify(bad)}`); eq(p.upper(bad), null, `upper bad ${JSON.stringify(bad)}`);
  eq(p.lower(bad), null, `lower bad ${JSON.stringify(bad)}`); eq(p.after(bad), null, `after bad ${JSON.stringify(bad)}`);
  eq(p.before(bad), null, `before bad ${JSON.stringify(bad)}`); eq(p.roleOfLetter(bad), null, `role bad ${JSON.stringify(bad)}`);
}
for (const bad of [-1, 26, 1.5, Number.NaN, Infinity, 2 ** 40]) eq(p.letterAt(bad), null, `letterAt ${bad}`);

// 3. roles
for (let i = 0; i < 26; i += 1) {
  const lo = String.fromCharCode(97 + i); const want = 'aeiou'.includes(lo) ? 'vowel' : lo === 'y' ? 'either' : 'consonant';
  eq(p.roleOfLetter(lo), want, `role ${lo}`); eq(p.roleOfLetter(lo.toUpperCase()), want, `role ${lo.toUpperCase()}`);
}
const words: Array<[string, number, string | null]> = [
  ['yes', 0, 'consonant'], ['yes', 1, 'vowel'], ['yes', 2, 'consonant'], ['gym', 1, 'vowel'], ['rhythm', 2, 'vowel'], ['say', 2, 'vowel'],
  ['beyond', 2, 'consonant'], ['happy', 4, 'vowel'], ['Yellow', 0, 'consonant'], ['YOU', 0, 'consonant'], ['my', 1, 'vowel'], ['yy', 0, 'consonant'],
  ['yy', 1, 'vowel'], ['queue', 0, 'consonant'], ['queue', 1, 'vowel'], ['a1b', 1, null], ['abc', 3, null], ['abc', -1, null], ['abc', 1.5, null], ['', 0, null],
];
for (const [w, i, want] of words) eq(p.roleInWord(w, i), want, `roleInWord ${w}[${i}]`);

// 4. digits
for (let d = 0; d < 10; d += 1) eq(p.digitValue(String(d)), d, `digit ${d}`);
for (const bad of ['a', '', '12', '٣', '²', ' ', '😀']) eq(p.digitValue(bad), -1, `digit bad ${JSON.stringify(bad)}`);

// 5. ordinal suffix by rule
const suf: Array<[number, string | null]> = [[0, 'th'], [1, 'st'], [2, 'nd'], [3, 'rd'], [4, 'th'], [9, 'th'], [10, 'th'], [11, 'th'], [12, 'th'], [13, 'th'], [14, 'th'],
  [20, 'th'], [21, 'st'], [22, 'nd'], [23, 'rd'], [24, 'th'], [100, 'th'], [101, 'st'], [102, 'nd'], [103, 'rd'], [111, 'th'], [112, 'th'], [113, 'th'], [121, 'st'],
  [1000, 'th'], [1011, 'th'], [1012, 'th'], [1013, 'th'], [1021, 'st'], [-1, null], [1.5, null], [Number.NaN, null], [Infinity, null], [2 ** 53, null], [Number.MAX_SAFE_INTEGER, 'st']];
for (const [n, want] of suf) eq(p.ordinalSuffix(n), want, `ordinal ${n}`);
for (let n = 0; n <= 3000; n += 1) {
  const m100 = n % 100; const m10 = n % 10;
  const want = m100 >= 11 && m100 <= 13 ? 'th' : m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th';
  eq(p.ordinalSuffix(n), want, `ordinal sweep ${n}`);
}

// 6. number words: same as the shared engine, never a second copy
for (let n = 0; n <= 20000; n += 1) {
  const r = numberToWords(String(n)); eq(p.numberWords(n), r.ok ? r.words : null, `words ${n}`);
}
for (const n of [99999, 100000, 123456789, 999999999999, 1e15, 1e21]) { const r = numberToWords(String(n)); eq(p.numberWords(n), r.ok ? r.words : null, `words big ${n}`); }
for (const bad of [-1, 1.5, Number.NaN, Infinity]) eq(p.numberWords(bad), null, `words bad ${bad}`);
eq(p.numberWords(0), 'zero', 'words zero'); eq(p.numberWords(21), 'twenty-one', 'words 21'); eq(p.numberWords(100), 'one hundred', 'words 100');

// 7. Roman: same as the shared engine
for (let n = 1; n <= 3999; n += 1) {
  const r = toRoman(n); eq(p.romanOf(n), r.ok ? r.text : null, `romanOf ${n}`);
  if (r.ok) eq(p.romanValue(r.text), n, `romanValue ${r.text}`);
}
for (const bad of [0, -5, 4000, 1.5, Number.NaN]) eq(p.romanOf(bad), null, `romanOf bad ${bad}`);
for (const s of ['IIII', 'IC', 'VX', 'MMMM', '', 'abc', 'XIIII', ' X', 'iv', 'Iv']) { const r = parseRoman(s); eq(p.romanValue(s), r.ok ? r.value : null, `romanValue ${JSON.stringify(s)}`); }

// 8. grammar words come from closedSets
for (const w of ['and', 'or', 'but']) eq(p.grammar.isCoordinator(w), true, `coordinator ${w}`);
for (const w of ['the', 'a', 'this']) eq(p.grammar.isDeterminer(w), true, `determiner ${w}`);
for (const w of ['on', 'in', 'with']) eq(p.grammar.isPreposition(w), true, `preposition ${w}`);
for (const w of ['what', 'when', 'who']) eq(p.grammar.isQuestionWord(w), true, `question ${w}`);
for (const w of ['banana', 'serendipity', '']) { eq([p.grammar.isCoordinator(w), p.grammar.isDeterminer(w), p.grammar.isPreposition(w), p.grammar.isQuestionWord(w)], [false, false, false, false], `not grammar ${w}`); }

// 9. the checker: the real pack passes; broken packs are caught (mutation tests)
eq(checkPack(p), [], 'checkPack of the English pack');
const mutants: Record<string, LanguagePack> = {
  shortAlphabet: { ...p, alphabet: 'abcdefghijklmnopqrstuvwxy' }, repeatedLetter: { ...p, alphabet: 'aabcdefghijklmnopqrstuvwxy' },
  upperAlphabet: { ...p, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }, shuffledAlphabet: { ...p, alphabet: 'bacdefghijklmnopqrstuvwxyz' },
  badDigits: { ...p, digits: '0123456789a' }, shuffledDigits: { ...p, digits: '1023456789' },
  strayVowel: { ...p, vowelLetters: 'aeiou1' }, vowelNotInAlphabet: { ...p, vowelLetters: 'aeiouä' }, overlap: { ...p, eitherLetters: 'ya' }, emptyId: { ...p, id: '' },
  brokenAfter: { ...p, after: (l: string) => (l === 'a' ? 'c' : p.after(l)) }, brokenBeforeEdge: { ...p, before: (l: string) => (l === 'a' ? 'z' : p.before(l)) },
  brokenPosition: { ...p, position: (l: string) => (l === 'z' ? 24 : p.position(l)) }, brokenUpper: { ...p, upper: (l: string) => (l === 'q' ? 'q' : p.upper(l)) },
  brokenOrdinal: { ...p, ordinalSuffix: (n: number) => (n === 11 ? 'st' : p.ordinalSuffix(n)) }, brokenOrdinal2: { ...p, ordinalSuffix: (n: number) => (n === 112 ? 'nd' : p.ordinalSuffix(n)) },
  brokenWords: { ...p, numberWords: (n: number) => (n === 0 ? null : p.numberWords(n)) }, brokenRoman: { ...p, romanOf: (n: number) => (n === 4 ? 'IIII' : p.romanOf(n)) },
  brokenRole: { ...p, roleOfLetter: (c: string) => (c === 'e' ? 'consonant' : p.roleOfLetter(c)) }, brokenY: { ...p, roleInWord: (w: string, i: number) => (w === 'yes' && i === 0 ? 'vowel' : p.roleInWord(w, i)) },
  brokenDigit: { ...p, digitValue: (c: string) => (c === '7' ? 8 : p.digitValue(c)) }, throwing: { ...p, letterAt: () => { throw new Error('boom'); } },
  noGrammar: { ...p, grammar: { ...p.grammar, isDeterminer: () => false } },
};
for (const [name, m] of Object.entries(mutants)) { checks += 1; let got: unknown[] = []; try { got = checkPack(m); } catch { got = ['threw']; } if (!Array.isArray(got) || got.length === 0) fails.push(`mutant NOT caught: ${name}`); }

// 10. hostile input never throws, and speed
const hostile: unknown[] = ['', 'a'.repeat(100000), '😀😀', '\u0000', 'ａ', undefined, null, {}, [], 1e308, -0, '\ud800'];
for (const fn of ['upper', 'lower', 'position', 'after', 'before', 'roleOfLetter', 'digitValue', 'ordinalSuffix', 'numberWords', 'romanOf', 'romanValue'] as const) {
  for (const h of hostile) { checks += 1; try { (p[fn] as (x: unknown) => unknown)(h); } catch (e) { fails.push(`${fn} threw on ${String(h).slice(0, 12)}: ${(e as Error).message}`); } }
}
for (const h of hostile) { checks += 1; try { p.roleInWord(h as string, 0); p.letterAt(h as number); } catch (e) { fails.push(`roleInWord/letterAt threw: ${(e as Error).message}`); } }
const t0 = Date.now(); for (let i = 0; i < 100000; i += 1) { p.roleInWord('rhythm', i % 6); p.ordinalSuffix(i); p.after('m'); p.position('Q'); }
const ms = Date.now() - t0; checks += 1; if (ms > 1000) fails.push(`speed: ${ms} ms for 100000 rounds (limit 1000)`);

console.log(`languageKitRunner: ${checks} checks, ${fails.length} failures, speed ${ms} ms`);
if (fails.length) { console.log(fails.slice(0, 40).join('\n')); process.exit(1); }
console.log('LANGUAGE KIT RUNNER OK');
