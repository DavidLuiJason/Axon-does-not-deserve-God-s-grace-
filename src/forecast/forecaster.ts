export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type PredictorName = 'frequency' | 'markov1' | 'recency';
export type ForecastOptions = { readonly evalWindow?: number; readonly minEvaluations?: number };
export type ForecastValue = {
  readonly abstain: boolean;
  readonly prediction: string | null;
  readonly predictor: PredictorName;
  readonly hits: number;
  readonly evaluated: number;
  readonly baselineHits: number;
  readonly reason: 'too-little-history' | 'does-not-beat-baseline' | 'ok';
  readonly stated: string;
};

function failure<T = never>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false, error, message });
}

/** Most frequent key; a tie goes to the key seen FIRST (Map keeps first-insertion order). */
function firstSeenMax(counts: ReadonlyMap<string, number>): string | null {
  let selected: string | null = null;
  let best = 0;
  for (const [symbol, count] of counts) {
    if (count > best) {
      best = count;
      selected = symbol;
    }
  }
  return selected;
}

function frequencyPrediction(prefix: readonly string[]): string | null {
  if (prefix.length === 0) return null;
  const counts = new Map<string, number>();
  for (const symbol of prefix) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  return firstSeenMax(counts);
}

function markovOnePrediction(prefix: readonly string[]): string | null {
  if (prefix.length < 2) return null;
  const last = prefix[prefix.length - 1]!;
  const counts = new Map<string, number>();
  for (let index = 0; index < prefix.length - 1; index += 1) {
    if (prefix[index] !== last) continue;
    const next = prefix[index + 1]!;
    counts.set(next, (counts.get(next) ?? 0) + 1);
  }
  return firstSeenMax(counts);
}

function recencyPrediction(prefix: readonly string[]): string | null {
  if (prefix.length === 0) return null;
  const start = Math.max(0, prefix.length - 5);
  const counts = new Map<string, number>();
  const latest = new Map<string, number>();
  for (let index = start; index < prefix.length; index += 1) {
    const symbol = prefix[index]!;
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    latest.set(symbol, index);
  }
  let selected: string | null = null;
  let best = -1;
  let bestLatest = -1;
  for (const [symbol, count] of counts) {
    const lastSeen = latest.get(symbol)!;
    if (count > best || (count === best && lastSeen > bestLatest)) {
      selected = symbol;
      best = count;
      bestLatest = lastSeen;
    }
  }
  return selected;
}

function predict(name: PredictorName, prefix: readonly string[]): string | null {
  if (name === 'frequency') return frequencyPrediction(prefix);
  if (name === 'markov1') return markovOnePrediction(prefix);
  return recencyPrediction(prefix);
}

export function forecast(history: string[], options?: ForecastOptions): EngineResult<ForecastValue> {
  if (!Array.isArray(history) || history.length > 10_000) return failure('invalid-history', 'History must contain zero to 10,000 symbols.');
  if (history.length === 0) return failure('empty-history', 'At least one history symbol is required to forecast.');
  const normalized: string[] = [];
  for (let index = 0; index < history.length; index += 1) {
    const raw = history[index];
    if (typeof raw !== 'string' || raw.trim().length === 0) return failure('invalid-symbol', `History symbol ${index} must be a non-empty string.`);
    normalized.push(raw.trim());
  }

  let evalWindow = 20;
  let minEvaluations = 10;
  if (options !== undefined) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) return failure('invalid-options', 'Options must be an object.');
    if (options.evalWindow !== undefined) {
      if (!Number.isInteger(options.evalWindow) || options.evalWindow < 1 || options.evalWindow > 10_000) {
        return failure('invalid-eval-window', 'evalWindow must be an integer from one to 10,000.');
      }
      evalWindow = options.evalWindow;
    }
    if (options.minEvaluations !== undefined) {
      if (!Number.isInteger(options.minEvaluations) || options.minEvaluations < 1 || options.minEvaluations > 10_000) {
        return failure('invalid-min-evaluations', 'minEvaluations must be an integer from one to 10,000.');
      }
      minEvaluations = options.minEvaluations;
    }
  }

  const names: PredictorName[] = ['frequency', 'markov1', 'recency'];
  const hits: Record<PredictorName, number> = { frequency: 0, markov1: 0, recency: 0 };
  let baselineHits = 0;
  const start = Math.max(1, normalized.length - evalWindow);
  let evaluated = 0;
  for (let index = start; index < normalized.length; index += 1) {
    const prefix = normalized.slice(0, index);
    const actual = normalized[index]!;
    evaluated += 1;
    if (prefix[prefix.length - 1] === actual) baselineHits += 1;
    for (const name of names) {
      if (predict(name, prefix) === actual) hits[name] += 1;
    }
  }

  let selected: PredictorName = 'frequency';
  for (const name of ['markov1', 'recency'] as const) {
    if (hits[name] > hits[selected]) selected = name;
  }
  const selectedHits = hits[selected];
  let abstain = false;
  let reason: ForecastValue['reason'] = 'ok';
  let prediction: string | null = predict(selected, normalized);
  if (evaluated < minEvaluations) {
    abstain = true;
    reason = 'too-little-history';
    prediction = null;
  } else if (selectedHits <= baselineHits) {
    abstain = true;
    reason = 'does-not-beat-baseline';
    prediction = null;
  }

  const value: ForecastValue = Object.freeze({
    abstain,
    prediction,
    predictor: selected,
    hits: selectedHits,
    evaluated,
    baselineHits,
    reason,
    stated: `${selectedHits} hits in ${evaluated} checks`,
  });
  return Object.freeze({ ok: true, value });
}
