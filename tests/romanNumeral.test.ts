/**
 * B03B1d: shared Roman numeral engine. Round trip over 1..3999, an independent Python-made table, an exhaustive
 * check of every string of 1 to 5 Roman letters against that table, and hostile input.
 */
import { readFileSync } from 'node:fs';
import { parseRoman, toRoman } from '../src/tools/engines/numbers/romanNumeral';

let checks = 0;
function assert(cond: unknown, msg: string): asserts cond {
  checks++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const table = JSON.parse(readFileSync(new URL('./fixtures/roman-1-3999.json', import.meta.url), 'utf8')) as string[];
assert(table.length === 3999, 'fixture has 3999 entries');
const canonical = new Map<string, number>();

for (let n = 1; n <= 3999; n++) {
  const r = toRoman(n);
  assert(r.ok && r.text === table[n - 1], `toRoman(${n}) matches the independent table`);
  const p = parseRoman(table[n - 1]!);
  assert(p.ok && p.value === n, `parseRoman(${table[n - 1]}) is ${n}`);
  canonical.set(table[n - 1]!, n);
}

// Exhaustive: every string of 1..5 letters from the seven letters is accepted exactly when it is in the table.
const letters = ['I', 'V', 'X', 'L', 'C', 'D', 'M'];
let accepted = 0;
let level: string[] = [''];
for (let len = 1; len <= 5; len++) {
  const next: string[] = [];
  for (const prefix of level) for (const l of letters) {
    const s = prefix + l;
    next.push(s);
    const p = parseRoman(s);
    const want = canonical.get(s);
    if (want === undefined) assert(!p.ok, `${s} must be rejected`);
    else { assert(p.ok && p.value === want, `${s} must be ${want}`); accepted++; }
  }
  level = next;
}
assert(accepted === table.filter(t => t.length <= 5).length, 'accepted count equals the table entries of 5 letters or fewer');

// Named cases and hostile input.
for (const bad of ['IIII', 'IC', 'VX', 'IIX', 'MMMM', 'mix', 'xiv', ' XIV', 'XIV ', 'X V', '', ' ', 'ABC', 'XIV\n', 'ⅩⅣ']) assert(!parseRoman(bad).ok, `reject "${bad}"`);
for (const bad of [0, -1, 4000, 1.5, NaN, Infinity]) assert(!toRoman(bad).ok, `toRoman rejects ${bad}`);
for (const bad of [null, undefined, 14, {}, []] as unknown[]) assert(!parseRoman(bad as string).ok, 'parseRoman rejects a non-string');
for (const bad of [null, undefined, '14', {}, []] as unknown[]) assert(!toRoman(bad as number).ok, 'toRoman rejects a non-number');
assert(!parseRoman('M'.repeat(100000)).ok, 'huge input is rejected without a loop');
const x = parseRoman('XIV'); assert(x.ok && x.value === 14, 'XIV is 14');
const e = parseRoman('MMMM'); assert(!e.ok && e.error === 'out-of-range', 'MMMM is out-of-range');

console.log(`romanNumeral.test.ts: ${checks} checks passed (${accepted} canonical strings of 1-5 letters accepted)`);
