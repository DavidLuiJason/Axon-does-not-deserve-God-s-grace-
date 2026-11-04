import { combineSigns, type Rule } from '../src/knowledge/signCombiner';

let checks = 0;
function check(condition: unknown, label: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(Object.is(actual, expected), `${label}: expected ${String(expected)}, received ${String(actual)}`);
}
function deepEqual(actual: unknown, expected: unknown, label: string): void {
  equal(JSON.stringify(actual), JSON.stringify(expected), label);
}
function ok<T>(result: { ok: boolean; value?: T; message?: string }): asserts result is { ok: true; value: T } {
  check(result.ok === true, result.message ?? 'expected success');
}

const rules: Rule[] = [
  { id: 'R1', ifAll: ['fever', 'cough'], concludes: 'flu', weight: 2, baseRate: 0.6 },
  { id: 'R2', ifAll: ['fever'], concludes: 'infection', weight: 1 },
  { id: 'R3', ifAll: ['cough'], concludes: 'flu', weight: 1 },
  { id: 'R4', ifAll: ['rash', 'fever'], concludes: 'measles', weight: 3, baseRate: 0.1 },
];

const a = combineSigns(['cough', 'fever', 'cough'], rules);
ok(a);
deepEqual(a.value.conclusions, [
  { conclusion: 'flu', score: 3, label: 'INFERRED', signsUsed: ['cough', 'fever'], rulesUsed: ['R1', 'R3'], chance: 0.6, basis: 'base rate 0.6 from rule R1' },
  { conclusion: 'infection', score: 1, label: 'INFERRED', signsUsed: ['fever'], rulesUsed: ['R2'], chance: null, basis: 'no measured basis' },
], 'known answer a conclusions');
deepEqual(a.value.nearMisses, [{ ruleId: 'R4', missingSign: 'rash', concludes: 'measles' }], 'known answer a near misses');

const b = combineSigns(['fever', 'rash'], rules);
ok(b);
deepEqual(b.value.conclusions, [
  { conclusion: 'measles', score: 3, label: 'INFERRED', signsUsed: ['fever', 'rash'], rulesUsed: ['R4'], chance: 0.1, basis: 'base rate 0.1 from rule R4' },
  { conclusion: 'infection', score: 1, label: 'INFERRED', signsUsed: ['fever'], rulesUsed: ['R2'], chance: null, basis: 'no measured basis' },
], 'known answer b ranking');
const empty = combineSigns([], rules);
ok(empty);
deepEqual(empty.value, { conclusions: [], nearMisses: [{ ruleId: 'R2', missingSign: 'fever', concludes: 'infection' }, { ruleId: 'R3', missingSign: 'cough', concludes: 'flu' }], reason: 'no-rule-matched' }, 'known answer c');
const reordered = combineSigns(['fever', 'cough'], rules);
ok(reordered);
deepEqual(reordered.value, a.value, 'known answer d order invariance');

const basisTie = combineSigns(['x', 'y'], [
  { id: 'R2', ifAll: ['x', 'y'], concludes: 'same', weight: 2, baseRate: 0.2 },
  { id: 'R1', ifAll: ['x', 'y'], concludes: 'same', weight: 2, baseRate: 0.8 },
  { id: 'R0', ifAll: ['x'], concludes: 'same', weight: 3, baseRate: 0.1 },
]);
ok(basisTie);
equal(basisTie.value.conclusions[0]?.chance, 0.8, 'basis tie uses smaller id after sign-count and weight');
equal(basisTie.value.conclusions[0]?.basis, 'base rate 0.8 from rule R1', 'basis source is explicit');
const weightTie = combineSigns(['x'], [
  { id: 'A', ifAll: ['x'], concludes: 'weight', weight: 2, baseRate: 0.2 },
  { id: 'Z', ifAll: ['x'], concludes: 'weight', weight: 3, baseRate: 0.9 },
]);
ok(weightTie);
equal(weightTie.value.conclusions[0]?.chance, 0.9, 'basis tie uses higher weight before smaller id');
const rankTie = combineSigns(['x'], [
  { id: 'z', ifAll: ['x'], concludes: 'zeta', weight: 1 },
  { id: 'a', ifAll: ['x'], concludes: 'alpha', weight: 1 },
]);
ok(rankTie);
deepEqual(rankTie.value.conclusions.map((item) => item.conclusion), ['alpha', 'zeta'], 'equal scores use code-unit conclusion order');

for (const invalid of [
  combineSigns(['fever'], [{ id: 'x', ifAll: ['fever'], concludes: 'x', weight: 1 }, { id: 'x', ifAll: ['cough'], concludes: 'y', weight: 1 }]),
  combineSigns(['fever'], [{ id: 'x', ifAll: ['fever'], concludes: 'x', weight: 0 }]),
  combineSigns(['fever'], [{ id: 'x', ifAll: ['fever'], concludes: 'x', weight: Number.NaN }]),
  combineSigns(['fever'], [{ id: 'x', ifAll: ['fever'], concludes: 'x', weight: 1, baseRate: 1.5 }]),
  combineSigns([], []),
]) check(invalid.ok === false, 'bad rule input returns a typed error');

const frozen = combineSigns(['x'], [{ id: 'a', ifAll: ['x'], concludes: 'y', weight: 1 }]);
ok(frozen);
check(Object.isFrozen(frozen.value) && Object.isFrozen(frozen.value.conclusions) && Object.isFrozen(frozen.value.conclusions[0]), 'result is frozen');
console.log(`PASS signCombiner: ${checks} checks; scoring, near-misses, ranking, ordering, basis, typed errors, frozen result`);
