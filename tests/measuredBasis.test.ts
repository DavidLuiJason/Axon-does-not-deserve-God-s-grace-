import { brierScore, calibrationReport, describeChance } from '../src/knowledge/measuredBasis';

let checks = 0;
function check(condition: unknown, label: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(Object.is(actual, expected), `${label}: expected ${String(expected)}, received ${String(actual)}`);
}
function near(actual: number, expected: number, tolerance: number, label: string): void {
  check(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
}
function success<T>(result: { ok: boolean; value?: T; message?: string }): asserts result is { ok: true; value: T } {
  check(result.ok === true, result.message ?? 'expected success');
}

const chance = describeChance(15, 20);
success(chance);
if ('percent' in chance.value) {
  equal(chance.value.percent, 75, '75 percent');
  near(chance.value.interval95.low, 0.531, 0.000001, 'Wilson low for 15/20');
  near(chance.value.interval95.high, 0.888, 0.000001, 'Wilson high for 15/20');
  equal(chance.value.statement, '75% from 20 checked cases (15 correct)', 'chance statement');
} else check(false, '15/20 has measured basis');
const smallChance = describeChance(3, 4);
success(smallChance);
deepNoPercent(smallChance.value);
equal(smallChance.value.statement, 'no measured basis (only 4 checked cases)', 'small sample statement');
const perfect = describeChance(10, 10);
success(perfect);
if ('percent' in perfect.value) {
  equal(perfect.value.percent, 100, 'perfect percent');
  near(perfect.value.interval95.low, 0.722, 0.000001, 'Wilson low for 10/10');
  equal(perfect.value.interval95.high, 1, 'Wilson high for 10/10');
} else check(false, '10/10 has measured basis');

const sampleScore = brierScore([0.9, 0.2, 0.5], [1, 0, 1]);
success(sampleScore);
near(sampleScore.value, 0.1, 1e-9, 'three-case Brier score');
const p = [0.9, 0.8, 0.7, 0.2, 0.1, 0.8, 0.3, 0.6, 0.9, 0.2, 0.7, 0.1];
const o = [1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0];
const good = calibrationReport(p, o);
success(good);
near(good.value.brier, 0.0525, 1e-9, 'known calibration Brier');
near(good.value.baselineBrier, 0.243056, 1e-6, 'known plain-rate baseline');
check(good.value.beatsBaseline, 'calibration beats baseline');
equal(good.value.statement, 'beats the plain rate: Brier 0.0525 against 0.2431 over 12 cases', 'calibration statement');
const half = calibrationReport(new Array<number>(12).fill(0.5), o);
success(half);
near(half.value.brier, 0.25, 1e-9, 'half-rate Brier');
check(!half.value.beatsBaseline, 'half-rate does not beat plain-rate baseline');
equal(half.value.statement, 'no better than the plain rate', 'non-improving statement');
const inverted = calibrationReport([0.1, 0.2, 0.3, 0.9, 0.8, 0.2, 0.7, 0.4, 0.1, 0.8, 0.3, 0.9], o);
success(inverted);
near(inverted.value.brier, 0.6358, 1e-4, 'inverted Brier');
check(!inverted.value.beatsBaseline, 'inverted probabilities do not beat baseline');
const tooFew = calibrationReport([0.9, 0.2, 0.5], [1, 0, 1]);
success(tooFew);
equal(tooFew.value.n, 3, 'short calibration case count');
equal(tooFew.value.statement, 'no measured basis', 'short calibration has no basis');

check(describeChance(5, 4).ok === false, 'describeChance rejects correct greater than checked');
check(describeChance(1, 1, 0).ok === false, 'describeChance rejects bad minimum');
check(brierScore([0.2], [0, 1]).ok === false, 'brierScore rejects length mismatch');
check(brierScore([1.2], [1]).ok === false, 'brierScore rejects probability outside range');
check(brierScore([0.5], [2]).ok === false, 'brierScore rejects non-binary outcome');
check(calibrationReport([0.2, 0.3], [1]).ok === false, 'calibrationReport rejects length mismatch');
check(calibrationReport([0.2], [1], 0).ok === false, 'calibrationReport rejects bad minimum');
check(Object.isFrozen(good.value), 'calibration output is frozen');
// Director additions: percent is ROUNDED, not cut (2 of 3 is 66.67, so 67; 1 of 6 is 16.67, so 17).
{
  const two = describeChance(2, 3, 1);
  const one = describeChance(1, 6, 1);
  if (!two.ok || !('percent' in two.value) || two.value.percent !== 67 || !one.ok || !('percent' in one.value) || one.value.percent !== 17) throw new Error('percent must be rounded to the nearest whole number');
}
console.log(`PASS measuredBasis: ${checks} checks; Wilson intervals, no-basis threshold, Brier, baseline comparison, typed errors`);

function deepNoPercent(value: object): void {
  check(!('percent' in value), 'no percent field below minimum sample count');
}
