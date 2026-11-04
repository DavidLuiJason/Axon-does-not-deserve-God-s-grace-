export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type Interval95 = { readonly low: number; readonly high: number };
export type ChanceDescription =
  | { readonly basis: 'no measured basis'; readonly statement: string }
  | { readonly basis: string; readonly percent: number; readonly interval95: Interval95; readonly statement: string };
export type CalibrationReport = {
  readonly n: number;
  readonly brier: number;
  readonly baselineBrier: number;
  readonly beatsBaseline: boolean;
  readonly statement: string;
};

function failure<T = never>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false, error, message });
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validMinCases(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round4(value: number): string {
  return value.toFixed(4);
}

export function describeChance(correct: number, checked: number, minCases = 10): EngineResult<ChanceDescription> {
  if (!validCount(correct) || !validCount(checked) || correct > checked) {
    return failure('invalid-counts', 'correct and checked must be non-negative safe integers, with correct no greater than checked.');
  }
  if (!validMinCases(minCases)) return failure('invalid-min-cases', 'minCases must be a positive safe integer.');
  if (checked < minCases) {
    return Object.freeze({ ok: true, value: Object.freeze({
      basis: 'no measured basis',
      statement: `no measured basis (only ${checked} checked cases)`,
    }) });
  }

  const z = 1.96;
  const n = checked;
  const proportion = correct / n;
  const zSquared = z * z;
  const denominator = 1 + zSquared / n;
  const center = (proportion + zSquared / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((proportion * (1 - proportion)) / n + zSquared / (4 * n * n))) / denominator;
  const interval95 = Object.freeze({
    low: round3(Math.max(0, center - margin)),
    high: round3(Math.min(1, center + margin)),
  });
  const percent = Math.round(proportion * 100);
  return Object.freeze({ ok: true, value: Object.freeze({
    basis: `${correct} of ${checked} checked cases`,
    percent,
    interval95,
    statement: `${percent}% from ${checked} checked cases (${correct} correct)`,
  }) });
}

function validatePairs(probabilities: unknown, outcomes: unknown): EngineResult<{ probabilities: readonly number[]; outcomes: readonly number[] }> {
  if (!Array.isArray(probabilities) || !Array.isArray(outcomes)) return failure('invalid-arrays', 'Probabilities and outcomes must be arrays.');
  if (probabilities.length < 1 || probabilities.length > 100_000) return failure('invalid-length', 'Arrays must contain 1 to 100,000 paired items.');
  if (probabilities.length !== outcomes.length) return failure('length-mismatch', 'Probabilities and outcomes must have the same length.');
  const checkedProbabilities: number[] = [];
  const checkedOutcomes: number[] = [];
  for (let index = 0; index < probabilities.length; index += 1) {
    const probability: unknown = probabilities[index];
    const outcome: unknown = outcomes[index];
    if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) {
      return failure('invalid-probability', `Probability ${index} must be finite and between zero and one.`);
    }
    if (outcome !== 0 && outcome !== 1) return failure('invalid-outcome', `Outcome ${index} must be zero or one.`);
    checkedProbabilities.push(probability);
    checkedOutcomes.push(outcome);
  }
  return Object.freeze({ ok: true, value: Object.freeze({
    probabilities: Object.freeze(checkedProbabilities),
    outcomes: Object.freeze(checkedOutcomes),
  }) });
}

function calculateBrier(probabilities: readonly number[], outcomes: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    const difference = probabilities[index]! - outcomes[index]!;
    total += difference * difference;
  }
  return total / probabilities.length;
}

export function brierScore(probabilities: number[], outcomes: number[]): EngineResult<number> {
  const pairs = validatePairs(probabilities, outcomes);
  if (!pairs.ok) return failure(pairs.error, pairs.message);
  return Object.freeze({ ok: true, value: calculateBrier(pairs.value.probabilities, pairs.value.outcomes) });
}

export function calibrationReport(probabilities: number[], outcomes: number[], minCases = 10): EngineResult<CalibrationReport> {
  const pairs = validatePairs(probabilities, outcomes);
  if (!pairs.ok) return failure(pairs.error, pairs.message);
  if (!validMinCases(minCases)) return failure('invalid-min-cases', 'minCases must be a positive safe integer.');

  const n = pairs.value.outcomes.length;
  const brier = calculateBrier(pairs.value.probabilities, pairs.value.outcomes);
  let outcomeTotal = 0;
  for (const outcome of pairs.value.outcomes) outcomeTotal += outcome;
  const plainRate = outcomeTotal / n;
  const baselineProbabilities = new Array<number>(n).fill(plainRate);
  const baselineBrier = calculateBrier(baselineProbabilities, pairs.value.outcomes);
  const beatsBaseline = brier < baselineBrier;
  let statement = 'no measured basis';
  if (n >= minCases) {
    statement = beatsBaseline
      ? `beats the plain rate: Brier ${round4(brier)} against ${round4(baselineBrier)} over ${n} cases`
      : 'no better than the plain rate';
  }
  return Object.freeze({ ok: true, value: Object.freeze({ n, brier, baselineBrier, beatsBaseline, statement }) });
}
