import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { verifyOutcome } from '../src/brain/mind/verify/verify.ts';

const cases = JSON.parse(readFileSync('tests/fixtures/verifyCases.json', 'utf8')) as Array<{id:string;input:unknown;expected:unknown}>;
let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
for (const item of cases) {
  let actual: unknown;
  try { actual = verifyOutcome(item.input as never); }
  catch { actual = '__THREW__'; }
  let equal = false;
  try { deepStrictEqual(actual, item.expected); equal = true; } catch {}
  check(equal, item.id);
}
console.log(`verify: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
