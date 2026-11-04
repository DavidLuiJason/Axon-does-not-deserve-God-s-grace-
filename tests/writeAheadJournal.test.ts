import {
  beginStep,
  finishJob,
  finishStep,
  parseJournal,
  planResume,
  runJob,
  serializeJournal,
  startJob,
  type Journal,
} from '../src/journal/writeAheadJournal';

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
function success<T>(result: { ok: boolean; value?: T; message?: string }): asserts result is { ok: true; value: T } {
  check(result.ok === true, result.message ?? 'expected success');
}

let empty: Journal = Object.freeze([]);
const started = startJob(empty, 'j1', ['a', 'b', 'c']);
success(started);
equal(started.value.length, 1, 'start entry');
const complete = runJob(started.value, 'j1', (step, outputs) => `${step}:${outputs.join('|')}`);
success(complete);
equal(complete.value.journal.length, 8, 'full journal has eight entries');
deepEqual(complete.value.executed, ['a', 'b', 'c'], 'uninterrupted execution order');
const plan = planResume(complete.value.journal, 'j1');
success(plan);
deepEqual(plan.value.completed, [
  { step: 'a', output: 'a:' },
  { step: 'b', output: 'b:a:' },
  { step: 'c', output: 'c:a:|b:a:' },
], 'known outputs');
check(plan.value.finished && plan.value.next === null && !plan.value.retry, 'completed plan is finished');

const expectedExecuted: string[][] = [[], ['a', 'b', 'c'], ['a', 'b', 'c'], ['b', 'c'], ['b', 'c'], ['c'], ['c'], [], []];
for (let prefix = 1; prefix <= 8; prefix += 1) {
  const partial = complete.value.journal.slice(0, prefix) as Journal;
  const serialized = serializeJournal(partial);
  success(serialized);
  check(serialized.value.endsWith('\n'), `crash prefix ${prefix} serialization has final newline`);
  const parsed = parseJournal(serialized.value);
  success(parsed);
  const resumed = runJob(parsed.value.journal, 'j1', (step, outputs) => `${step}:${outputs.join('|')}`);
  success(resumed);
  deepEqual(resumed.value.executed, expectedExecuted[prefix], `crash prefix ${prefix} execution`);
  const beforeResume = planResume(parsed.value.journal, 'j1');
  success(beforeResume);
  equal(beforeResume.value.retry, prefix === 2 || prefix === 4 || prefix === 6, `crash prefix ${prefix} retry flag`);
  const finalPlan = planResume(resumed.value.journal, 'j1');
  success(finalPlan);
  deepEqual(finalPlan.value.completed, plan.value.completed, `crash prefix ${prefix} outputs`);
  check(finalPlan.value.finished, `crash prefix ${prefix} finishes job`);
}
const prefixFive = serializeJournal(complete.value.journal.slice(0, 5) as Journal);
success(prefixFive);
const torn = parseJournal(`${prefixFive.value}{"seq":6,"jobId":"j1","kind":"beg`);
success(torn);
check(torn.value.tornTail, 'damaged final line is marked torn');
const afterTorn = runJob(torn.value.journal, 'j1', (step, outputs) => `${step}:${outputs.join('|')}`);
success(afterTorn);
deepEqual(afterTorn.value.executed, ['c'], 'torn tail resumes from first unfinished step');

const failedBegin = beginStep(started.value, 'j1');
success(failedBegin);
const failedRun = runJob(failedBegin.value, 'j1', () => { throw new Error('disk busy'); });
check(failedRun.ok === false && failedRun.error === 'step-failed', 'executor failure returns typed error');
if (!failedRun.ok) {
  equal(failedRun.journal.length, 3, 'failed execution retains retry begin record');
  equal(failedRun.journal[2]?.kind, 'begin', 'last journal entry is still begin after failure');
  const failedPlan = planResume(failedRun.journal, 'j1');
  success(failedPlan);
  check(failedPlan.value.retry, 'failed execution is marked for retry');
}

const damagedEarlier = parseJournal('{broken\n{"seq":2,"jobId":"j1","kind":"begin","step":"a"}\n');
check(damagedEarlier.ok === false && damagedEarlier.error === 'damaged-journal', 'damaged earlier line is rejected');
const sequenceGap = parseJournal('{"seq":2,"jobId":"j1","kind":"start","steps":["a"]}\n');
check(sequenceGap.ok === false && sequenceGap.error === 'damaged-journal', 'sequence gap is rejected');
const doneWithoutBegin = parseJournal('{"seq":1,"jobId":"j1","kind":"start","steps":["a"]}\n{"seq":2,"jobId":"j1","kind":"done","step":"a","output":"x"}\n');
check(doneWithoutBegin.ok === false && doneWithoutBegin.error === 'damaged-journal', 'done without begin is rejected');

check(startJob(empty, 'j1', ['a']).ok, 'start valid job');
check(startJob(started.value, 'j1', ['a']).ok === false, 'start rejects duplicate job id');
check(beginStep(empty, 'j1').ok === false, 'begin rejects unknown job');
check(finishStep(started.value, 'j1', 'x').ok === false, 'finish step rejects missing begin');
check(finishJob(started.value, 'j1').ok === false, 'finish job rejects incomplete job');
check(planResume(empty, 'j1').ok === false, 'resume plan rejects unknown job');
check(runJob(started.value, 'j1', null as unknown as (step: string, outputs: string[]) => string).ok === false, 'run rejects invalid executor');
check(serializeJournal([{ seq: 2, jobId: 'x', kind: 'start', steps: ['a'] }] as unknown as Journal).ok === false, 'serialize rejects bad journal');
check(parseJournal(null as unknown as string).ok === false, 'parse rejects non-string input');
check(Object.isFrozen(complete.value.journal) && Object.isFrozen(complete.value.journal[0]), 'journal output is frozen');
// Director additions (Batch 3 verification): an end entry before every step is done is damage.
{
  const early = parseJournal('{"seq":1,"jobId":"j","kind":"start","steps":["a"]}\n{"seq":2,"jobId":"j","kind":"end"}\n');
  if (early.ok || early.error !== 'damaged-journal') throw new Error('an end entry before every step is done must be refused');
}
console.log(`PASS writeAheadJournal: ${checks} checks; eight-entry journal, all crash prefixes, retry, torn tail, failure retention, validation`);
