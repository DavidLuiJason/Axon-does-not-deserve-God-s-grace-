import { forecast } from '../src/forecast/forecaster';

let checks = 0;
function check(condition: unknown, label: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(Object.is(actual, expected), `${label}: expected ${String(expected)}, received ${String(actual)}`);
}
function success<T>(result: { ok: boolean; value?: T; message?: string }): asserts result is { ok: true; value: T } {
  check(result.ok === true, result.message ?? 'expected success');
}

const alternating = ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b'];
const alt = forecast(alternating);
success(alt);
equal(alt.value.predictor, 'markov1', 'alternating selector');
equal(alt.value.hits, 20, 'alternating hits');
equal(alt.value.evaluated, 20, 'alternating evaluations');
equal(alt.value.baselineHits, 0, 'alternating baseline');
equal(alt.value.prediction, 'a', 'alternating prediction');
equal(alt.value.abstain, false, 'alternating is not abstained');
equal(alt.value.stated, '20 hits in 20 checks', 'stated text is count-only');

const constant = ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'];
const same = forecast(constant);
success(same);
check(same.value.abstain && same.value.reason === 'does-not-beat-baseline', 'constant sequence abstains');
equal(same.value.hits, 20, 'constant predictor hits');
equal(same.value.baselineHits, 20, 'constant baseline hits');

const short = forecast(['a', 'b', 'a', 'b', 'a']);
success(short);
check(short.value.abstain && short.value.reason === 'too-little-history', 'short sequence abstains');
equal(short.value.evaluated, 4, 'short evaluation count');

const cycle = ['a', 'a', 'b', 'a', 'a', 'b', 'a', 'a', 'b', 'a', 'a', 'b', 'a', 'a', 'b', 'a', 'a', 'b', 'a', 'a', 'b'];
const cyc = forecast(cycle);
success(cyc);
equal(cyc.value.predictor, 'frequency', 'three-symbol known answer selector');
equal(cyc.value.hits, 13, 'three-symbol known answer hits');
equal(cyc.value.baselineHits, 7, 'three-symbol baseline');
equal(cyc.value.prediction, 'a', 'three-symbol prediction');
check(!cyc.value.abstain, 'three-symbol pattern is selected');

const tied = forecast(constant, { evalWindow: 20, minEvaluations: 1 });
success(tied);
equal(tied.value.predictor, 'frequency', 'selector tie order starts with frequency');
check(forecast([], {}).ok === false, 'empty history returns typed error');
check(forecast(['a', ''], {}).ok === false, 'empty symbol returns typed error');
check(forecast(['a'], { evalWindow: 0 }).ok === false, 'bad eval window returns typed error');
check(forecast(['a'], { minEvaluations: 10_001 }).ok === false, 'bad minimum returns typed error');
check(forecast(new Array(10_001).fill('a')).ok === false, 'history size is bounded');
// Director regression (Batch 3 verification): a tie goes to the symbol SEEN FIRST, never to the one that reached the top count first.
// Hand-counted on a,b,b,a,a,b,a,b,a (8 checks): persistence 2 hits; frequency 3 (ties go to 'a', first seen); markov1 3; frequency wins the tie by declared order.
{
  const tied = forecast('abbaababa'.split(''), { minEvaluations: 1 });
  if (!tied.ok) throw new Error('tie-break case must succeed');
  const v = tied.value;
  if (v.predictor !== 'frequency' || v.hits !== 3 || v.evaluated !== 8 || v.baselineHits !== 2 || v.prediction !== 'a' || v.abstain) throw new Error('tie goes to the symbol seen first: ' + JSON.stringify(v));
}
// Director additions (hand-counted; each fails on the matching breakage).
{
  const run = (h: string): { predictor: string; prediction: string | null; hits: number; baselineHits: number; evaluated: number; abstain: boolean; reason: string } => {
    const r = forecast(h.split(''), { minEvaluations: 1 });
    if (!r.ok) throw new Error('case must succeed: ' + h);
    return r.value;
  };
  // c,a,a,b,a,a: persistence 2 hits; recency 3 (ties go to the symbol seen LATEST); frequency 2; markov1 1 -> recency wins, predicts 'a'.
  const tie = run('caabaa');
  if (tie.predictor !== 'recency' || tie.hits !== 3 || tie.baselineHits !== 2 || tie.prediction !== 'a') throw new Error('recency tie goes to the latest symbol: ' + JSON.stringify(tie));
  // c,b,b,a,b,a: persistence 1; recency 2 (window of the LAST FIVE: b,b,a,b,a has three b); frequency 1; markov1 0 -> recency, 'b' (a window of four would say 'a').
  const win = run('cbbaba');
  if (win.predictor !== 'recency' || win.hits !== 2 || win.baselineHits !== 1 || win.prediction !== 'b') throw new Error('recency looks at the last five: ' + JSON.stringify(win));
  // exactly minEvaluations checks is enough: 11 symbols give 10 checks with the default minimum of 10.
  const edge = forecast('abababababa'.split(''));
  if (!edge.ok || edge.value.evaluated !== 10 || edge.value.abstain || edge.value.reason !== 'ok') throw new Error('evaluated equal to minEvaluations must not abstain');
}
console.log(`PASS forecaster: ${checks} checks; walk-forward selection, hand-counted answers, tie order, baseline abstention, typed errors`);
