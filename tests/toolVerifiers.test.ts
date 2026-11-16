import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { verifyToolReply, quotedText, recount, base64NoPad } from '../src/safety/toolVerifiers.ts';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
for (const c of JSON.parse(readFileSync('tests/fixtures/toolVerifierCases.json', 'utf8')) as Array<{ id: string; input: any; expected: unknown }>) {
  let actual: unknown;
  try { actual = verifyToolReply(c.input); } catch { actual = '__THREW__'; }
  check(same(actual, c.expected), c.id);
}
for (const c of JSON.parse(readFileSync('tests/fixtures/quotedTextCases.json', 'utf8')) as Array<{ id: string; message: string; expected: unknown }>) check(same(quotedText(c.message), c.expected), c.id);

// Independent oracles on random text: the counting formulas written the way the project's own counter writes them, and Node's own base64.
let seed = 5;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const alphabet = ['a', 'B', 'z', 'é', 'ö', '日', '😀', ' ', ' ', '\t', '\n', '\r', '\r\n', '1', '.', '-', "'", '\u00a0', '\u2003'];
for (let i = 0; i < 4000; i++) {
  let s = '';
  const len = Math.floor(rnd() * 14);
  for (let k = 0; k < len; k++) s += alphabet[Math.floor(rnd() * alphabet.length)];
  const chars = Array.from(s);
  const trimmed = s.trim();
  const withoutFinalBreak = s.replace(/(?:\r\n|\r|\n)$/, '');
  const lines = s === '' ? 0 : withoutFinalBreak === '' ? 1 : withoutFinalBreak.split(/\r\n|\r|\n/).length;
  const expected = { words: trimmed === '' ? 0 : trimmed.split(/\s+/u).length, characters: chars.length, noSpaces: chars.filter((c) => !/\s/u.test(c)).length, letters: chars.filter((c) => /\p{L}/u.test(c)).length, lines };
  check(same(recount(s), expected), 'recount-' + i);
  check(base64NoPad(s) === Buffer.from(s, 'utf8').toString('base64').replace(/=+$/, ''), 'base64-' + i);
}
console.log(`toolVerifiers: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
