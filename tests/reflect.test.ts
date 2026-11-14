import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { reflect } from '../src/brain/mind/reflect/reflect.ts';

type Case = { id: string; input: unknown; expected: unknown };
const cases = JSON.parse(readFileSync('tests/fixtures/reflectCases.json', 'utf8')) as Case[];
let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
const shape = (r: any) => (r.ok === false ? { ok: false, error: r.error } : r);
for (const c of cases) {
  let actual: unknown;
  try { actual = shape(reflect(c.input)); } catch { actual = '__THREW__'; }
  check(same(actual, c.expected), c.id);
}
// Invariants on random records (seeded, repeatable).
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
for (let i = 0; i < 3000; i++) {
  const rec = {
    taskId: 't' + i, goal: pick(['Count', 'Sort ', ' Hash']),
    status: pick(['SUCCESS', 'FAILED', 'ABANDONED']),
    steps: Array.from({ length: Math.floor(rnd() * 4) }, () => ({ toolId: pick(['a', 'b', 'c']), ok: rnd() < 0.6, verified: rnd() < 0.5, assumption: 'x' })),
    wrongAssumptions: Array.from({ length: Math.floor(rnd() * 3) }, () => pick(['p', ' q ', ''])),
    ownerCorrections: Array.from({ length: Math.floor(rnd() * 3) }, () => pick(['likes short', '', ' tone '])),
    memoryAllowed: rnd() < 0.5,
  };
  const r = reflect(rec);
  check(r.ok === true, 'inv-ok-' + i);
  if (!r.ok) continue;
  const v = r.value;
  check(v.candidates.every((c) => c.stage === 'CANDIDATE'), 'inv-stage-' + i);
  check(v.candidates.filter((c) => c.kind === 'MISTAKE').every((c) => c.needsRegressionTest), 'inv-mistake-test-' + i);
  check(v.candidates.every((c) => c.text.length <= 500 && c.source === 'task:t' + i), 'inv-text-source-' + i);
  check(new Set(v.candidates.map((c) => c.kind + '|' + c.text)).size === v.candidates.length, 'inv-no-dupes-' + i);
  if (!rec.memoryAllowed) check(!v.candidates.some((c) => c.kind === 'PREFERENCE'), 'inv-no-pref-when-not-allowed-' + i);
  if (v.completed) check(rec.status === 'SUCCESS' && rec.steps.length > 0 && rec.steps.every((s) => s.ok && s.verified), 'inv-completed-means-verified-' + i);
  check(same(reflect(rec), r), 'inv-deterministic-' + i);
}
console.log(`reflect: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
