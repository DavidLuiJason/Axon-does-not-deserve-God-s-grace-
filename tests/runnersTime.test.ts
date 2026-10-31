import { TIME_RUNNERS } from '../src/tools/runners/timeRunners';
import type { RunnerArgs, RunnerDeps, RunnerOutcome, ToolRunner } from '../src/tools/runners/runnerTypes';
import * as timer from '../src/tools/engines/time/timer';
import * as stopwatch from '../src/tools/engines/time/stopwatch';
import * as dates from '../src/tools/engines/time/dateCalc';
import * as tally from '../src/tools/engines/time/tally';

let checks = 0;
let cases = 0;
function check(condition: unknown, name: string): void {
  if (!condition) throw new Error(`FAILED: ${name}`);
  checks++;
}
function equal(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
function runner(id: string): ToolRunner {
  const found = TIME_RUNNERS.find((item) => item.toolId === id);
  if (!found) throw new Error(`Missing runner ${id}`);
  return found;
}
type Direct = { result: unknown; state?: unknown };
async function measuredCase(
  id: string,
  name: string,
  argsValue: Record<string, unknown>,
  depsValue: RunnerDeps,
  direct: () => Direct,
  replyIncludes: string[] = [],
): Promise<void> {
  cases++;
  const args = deepFreeze(argsValue);
  const deps = deepFreeze(depsValue);
  const argsBefore = JSON.stringify(args), depsBefore = JSON.stringify(deps);
  const expected = direct();
  const first = await runner(id).run(args as RunnerArgs, deps);
  const second = await runner(id).run(args as RunnerArgs, deps);
  check(first.ok, `${name}: succeeds`);
  if (!first.ok) return;
  check(equal(first.result, expected.result), `${name}: result equals direct engine result`);
  check(equal(first.state, expected.state), `${name}: returned state equals direct engine state`);
  check(first.reply.length <= 2000 && first.reply.length > 0, `${name}: reply is present and within limit`);
  check(replyIncludes.every((part) => first.reply.includes(part)), `${name}: reply includes ${replyIncludes.join(', ')}`);
  check(equal(first, second), `${name}: repeat call is identical`);
  check(argsBefore === JSON.stringify(args) && depsBefore === JSON.stringify(deps), `${name}: frozen inputs remain unchanged`);
}
function directEngine<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`Direct engine unexpectedly refused: ${result.error}`);
  return result.value;
}
async function failure(id: string, name: string, args: unknown, deps: RunnerDeps, kind: string, slot?: string): Promise<void> {
  const outcome = await runner(id).run(args as RunnerArgs, deps);
  check(!outcome.ok && outcome.kind === kind && (slot === undefined || outcome.slot === slot), `${name}: ${kind}${slot ? ` on ${slot}` : ''}`);
}

async function main(): Promise<void> {
  check(equal(TIME_RUNNERS.map((r) => r.toolId), ['timer', 'stopwatch', 'date-calculator', 'tally-counter']), 'runner order and catalog ids are exact');

  // TIMER: each expected result is obtained from the engine directly with hand-written arguments.
  await measuredCase('timer', 'timer start 1', { operation: 'start', durationMs: 90000 }, { now: 1000, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.startTimer(90000, 1000)); return { result, state: result }; }, ['running', '1 minute', '30 seconds']);
  await measuredCase('timer', 'timer start 2 with now override', { operation: 'start', durationMs: 61000, now: 5000 }, { now: 9000, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.startTimer(61000, 5000)); return { result, state: result }; }, ['running', '1 minute', '1 second']);
  await measuredCase('timer', 'timer zero duration', { operation: 'start', durationMs: 0 }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.startTimer(0, 0)); return { result, state: result }; }, ['finished', '0 seconds']);
  await measuredCase('timer', 'timer tick', { operation: 'tick' }, { now: 4000, state: directEngine(timer.startTimer(10000, 1000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.tickTimer(directEngine(timer.startTimer(10000, 1000)), 4000)); return { result, state: result.state }; }, ['running', '7 seconds']);
  await measuredCase('timer', 'timer pause', { operation: 'pause' }, { now: 3000, state: directEngine(timer.startTimer(10000, 1000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 3000)); return { result, state: result }; }, ['paused', '8 seconds']);
  await measuredCase('timer', 'timer resume', { operation: 'resume' }, { now: 5000, state: directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 3000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.resumeTimer(directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 3000)), 5000)); return { result, state: result }; }, ['running', '8 seconds']);
  await measuredCase('timer', 'timer reset', { operation: 'reset' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => { const result = timer.resetTimer(); return { result, state: result }; }, ['idle']);
  await measuredCase('timer', 'timer tick finished', { operation: 'tick' }, { now: 11000, state: directEngine(timer.startTimer(10000, 1000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.tickTimer(directEngine(timer.startTimer(10000, 1000)), 11000)); return { result, state: result.state }; }, ['finished', '0 seconds']);
  await measuredCase('timer', 'timer pause with supplied now', { operation: 'pause', now: 6000 }, { now: 3000, state: directEngine(timer.startTimer(10000, 1000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 6000)); return { result, state: result }; }, ['paused', '5 seconds']);
  await measuredCase('timer', 'timer resume zero remainder', { operation: 'resume' }, { now: 10000, state: { status: 'paused', durationMs: 1000, remainingMs: 0, startedAt: 1000, deadlineAt: null, pausedAt: 1500 } as timer.TimerState, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.resumeTimer({ status: 'paused', durationMs: 1000, remainingMs: 0, startedAt: 1000, deadlineAt: null, pausedAt: 1500 }, 10000)); return { result, state: result }; }, ['finished']);
  await measuredCase('timer', 'timer tick paused state', { operation: 'tick' }, { now: 9000, state: directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 2000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.tickTimer(directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 2000)), 9000)); return { result, state: result.state }; }, ['paused']);
  await measuredCase('timer', 'timer starts from injected time', { operation: 'start', durationMs: 3600000 }, { now: 123456, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(timer.startTimer(3600000, 123456)); return { result, state: result }; }, ['1 hour', '0 minutes', '0 seconds']);

  // STOPWATCH.
  await measuredCase('stopwatch', 'stopwatch start 1', { operation: 'start' }, { now: 100, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.startStopwatch(100)); return { result, state: result }; }, ['running', '0 seconds', 'Lap count: 0']);
  await measuredCase('stopwatch', 'stopwatch start with override', { operation: 'start', now: 900 }, { now: 100, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.startStopwatch(900)); return { result, state: result }; }, ['running']);
  await measuredCase('stopwatch', 'stopwatch tick', { operation: 'tick' }, { now: 2100, state: directEngine(stopwatch.startStopwatch(100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.tickStopwatch(directEngine(stopwatch.startStopwatch(100)), 2100)); return { result, state: result }; }, ['2 seconds']);
  await measuredCase('stopwatch', 'stopwatch pause', { operation: 'pause' }, { now: 3100, state: directEngine(stopwatch.startStopwatch(100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)); return { result, state: result }; }, ['paused', '3 seconds']);
  await measuredCase('stopwatch', 'stopwatch resume', { operation: 'resume' }, { now: 5000, state: directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.resumeStopwatch(directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)), 5000)); return { result, state: result }; }, ['running', '3 seconds']);
  await measuredCase('stopwatch', 'stopwatch lap 1', { operation: 'lap' }, { now: 2100, state: directEngine(stopwatch.startStopwatch(100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.lapStopwatch(directEngine(stopwatch.startStopwatch(100)), 2100)); return { result, state: result }; }, ['Lap count: 1', 'Last lap:', '2 seconds']);
  await measuredCase('stopwatch', 'stopwatch reset', { operation: 'reset' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => { const result = stopwatch.resetStopwatch(); return { result, state: result }; }, ['idle', 'Lap count: 0']);
  await measuredCase('stopwatch', 'stopwatch second lap split', { operation: 'lap' }, { now: 6100, state: directEngine(stopwatch.lapStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.lapStopwatch(directEngine(stopwatch.lapStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)), 6100)); return { result, state: result }; }, ['Lap count: 2', 'Last lap:', '3 seconds']);
  await measuredCase('stopwatch', 'stopwatch tick paused', { operation: 'tick' }, { now: 9000, state: directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 1100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.tickStopwatch(directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 1100)), 9000)); return { result, state: result }; }, ['paused']);
  await measuredCase('stopwatch', 'stopwatch pause after elapsed', { operation: 'pause', now: 5000 }, { now: 2000, state: directEngine(stopwatch.startStopwatch(100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 5000)); return { result, state: result }; }, ['4 seconds']);
  await measuredCase('stopwatch', 'stopwatch resume and lap', { operation: 'lap' }, { now: 8000, state: directEngine(stopwatch.resumeStopwatch(directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)), 5000)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.lapStopwatch(directEngine(stopwatch.resumeStopwatch(directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)), 5000)), 8000)); return { result, state: result }; }, ['Lap count: 1']);
  await measuredCase('stopwatch', 'stopwatch long elapsed hours', { operation: 'tick' }, { now: 3600100, state: directEngine(stopwatch.startStopwatch(100)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(stopwatch.tickStopwatch(directEngine(stopwatch.startStopwatch(100)), 3600100)); return { result, state: result }; }, ['1 hour']);

  // DATE CALCULATOR.
  await measuredCase('date-calculator', 'date add days', { operation: 'add', date: '2024-01-31', amount: 1, unit: 'days' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.addDate('2024-01-31', 1, 'days')) }), ['February 1, 2024']);
  await measuredCase('date-calculator', 'date add month clamp', { operation: 'add', date: '2024-01-31', amount: 1, unit: 'months' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.addDate('2024-01-31', 1, 'months')) }), ['February 29, 2024']);
  await measuredCase('date-calculator', 'date add year', { operation: 'add', date: '2024-02-29', amount: 1, unit: 'years' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.addDate('2024-02-29', 1, 'years')) }), ['February 28, 2025']);
  await measuredCase('date-calculator', 'date add negative days', { operation: 'add', date: '2025-01-01', amount: -1, unit: 'days' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.addDate('2025-01-01', -1, 'days')) }), ['December 31, 2024']);
  await measuredCase('date-calculator', 'date difference', { operation: 'difference', date: '2024-01-01', otherDate: '2025-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.differenceDates('2024-01-01', '2025-01-01')) }), ['366 days', '1 years']);
  await measuredCase('date-calculator', 'date reverse difference', { operation: 'difference', date: '2025-01-01', otherDate: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.differenceDates('2025-01-01', '2024-01-01')) }), ['-366 days']);
  await measuredCase('date-calculator', 'date weekday', { operation: 'weekday', date: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.weekday('2024-01-01')) }), ['Monday']);
  await measuredCase('date-calculator', 'date day of year leap', { operation: 'day-of-year', date: '2024-12-31' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.dayOfYear('2024-12-31')) }), ['day 366']);
  await measuredCase('date-calculator', 'date ISO week', { operation: 'iso-week', date: '2021-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.isoWeekNumber('2021-01-01')) }), ['ISO week 53']);
  await measuredCase('date-calculator', 'date count weekdays', { operation: 'count-weekdays', date: '2024-01-01', otherDate: '2024-01-07' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.countWeekdays('2024-01-01', '2024-01-07')) }), ['5 weekdays']);
  await measuredCase('date-calculator', 'date count reverse weekdays', { operation: 'count-weekdays', date: '2024-01-07', otherDate: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.countWeekdays('2024-01-07', '2024-01-01')) }), ['-5 weekdays']);
  await measuredCase('date-calculator', 'date same day difference', { operation: 'difference', date: '2000-02-29', otherDate: '2000-02-29' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.differenceDates('2000-02-29', '2000-02-29')) }), ['0 days']);
  await measuredCase('date-calculator', 'date ordinary weekday', { operation: 'weekday', date: '2026-10-31' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.weekday('2026-10-31')) }), ['Saturday']);
  await measuredCase('date-calculator', 'date day of year', { operation: 'day-of-year', date: '2025-03-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => ({ result: directEngine(dates.dayOfYear('2025-03-01')) }), ['day 60']);

  // TALLY COUNTER.
  await measuredCase('tally-counter', 'tally add empty', { operation: 'add', name: 'visitors' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.addCounter(tally.createTally(), 'visitors')); return { result, state: result }; }, ['visitors', '0']);
  await measuredCase('tally-counter', 'tally add step and bounds', { operation: 'add', name: 'scores', step: 5, min: 2, max: 20 }, { now: 0, randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.addCounter(tally.createTally(), 'scores', 5, 2, 20)); return { result, state: result }; }, ['scores', '2']);
  await measuredCase('tally-counter', 'tally increment', { operation: 'increment', name: 'visitors' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'visitors', 2)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.changeTally(directEngine(tally.addCounter(tally.createTally(), 'visitors', 2)), 'visitors', 1)); return { result, state: result }; }, ['visitors', '2']);
  await measuredCase('tally-counter', 'tally decrement', { operation: 'decrement', name: 'visitors' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'visitors', 3)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.changeTally(directEngine(tally.addCounter(tally.createTally(), 'visitors', 3)), 'visitors', -1)); return { result, state: result }; }, ['visitors', '-3']);
  await measuredCase('tally-counter', 'tally set', { operation: 'set', name: 'visitors', value: 42 }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'visitors')), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 42)); return { result, state: result }; }, ['visitors', '42']);
  await measuredCase('tally-counter', 'tally reset named', { operation: 'reset', name: 'visitors' }, { now: 0, state: directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.resetTally(directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)), 'visitors')); return { result, state: result }; }, ['visitors', '0']);
  await measuredCase('tally-counter', 'tally reset all', { operation: 'reset' }, { now: 0, state: directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.resetTally(directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)))); return { result, state: result }; }, ['All counters']);
  await measuredCase('tally-counter', 'tally undo value', { operation: 'undo' }, { now: 0, state: directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.undoTally(directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)))); return { result, state: result }; }, ['visitors', '0']);
  await measuredCase('tally-counter', 'tally undo add', { operation: 'undo' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'new counter')), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.undoTally(directEngine(tally.addCounter(tally.createTally(), 'new counter')))); return { result, state: result }; }, ['last change has been undone', 'No counters remain']);
  await measuredCase('tally-counter', 'tally clamp max', { operation: 'increment', name: 'visitors' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'visitors', 1, 0, 1)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.changeTally(directEngine(tally.addCounter(tally.createTally(), 'visitors', 1, 0, 1)), 'visitors', 1)); return { result, state: result }; }, ['visitors', '1']);
  await measuredCase('tally-counter', 'tally custom step', { operation: 'increment', name: 'items' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'items', 4)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.changeTally(directEngine(tally.addCounter(tally.createTally(), 'items', 4)), 'items', 1)); return { result, state: result }; }, ['items', '4']);
  await measuredCase('tally-counter', 'tally set bounded', { operation: 'set', name: 'items', value: 99 }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'items', 1, 0, 10)), randomBelow: () => 0, random01: () => 0 }, () => { const result = directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'items', 1, 0, 10)), 'items', 99)); return { result, state: result }; }, ['items', '10']);

  // Independent literal pins (derived by calendar arithmetic / elapsed-time arithmetic, not by the runner mapping).
  check(directEngine(timer.startTimer(90000, 1000)).remainingMs === 90000, 'literal pin: a new 90-second timer has 90000 ms remaining');
  check(directEngine(timer.startTimer(61000, 5000)).deadlineAt === 66000, 'literal pin: 5000 + 61000 ms is 66000');
  check(directEngine(timer.startTimer(0, 0)).status === 'finished', 'literal pin: zero-duration timer is finished immediately');
  check(directEngine(timer.tickTimer(directEngine(timer.startTimer(10000, 1000)), 4000)).remainingMs === 7000, 'literal pin: 10 seconds less 3 elapsed seconds leaves 7 seconds');
  check(directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 3000)).remainingMs === 8000, 'literal pin: pausing after 2 seconds leaves 8 seconds');
  check(directEngine(timer.resumeTimer(directEngine(timer.pauseTimer(directEngine(timer.startTimer(10000, 1000)), 3000)), 5000)).deadlineAt === 13000, 'literal pin: resume at 5000 with 8000 ms leaves deadline 13000');
  check(timer.resetTimer().status === 'idle', 'literal pin: timer reset returns idle');
  check(directEngine(timer.tickTimer(directEngine(timer.startTimer(10000, 1000)), 11000)).state.status === 'finished', 'literal pin: tick at deadline finishes timer');
  check(directEngine(stopwatch.tickStopwatch(directEngine(stopwatch.startStopwatch(100)), 2100)).elapsedMs === 2000, 'literal pin: stopwatch elapsed is 2000 ms');
  check(directEngine(stopwatch.pauseStopwatch(directEngine(stopwatch.startStopwatch(100)), 3100)).elapsedMs === 3000, 'literal pin: stopwatch pause captures 3000 ms');
  check(directEngine(stopwatch.lapStopwatch(directEngine(stopwatch.startStopwatch(100)), 2100)).laps[0].splitMs === 2000, 'literal pin: first lap split is 2000 ms');
  check(stopwatch.resetStopwatch().status === 'idle', 'literal pin: stopwatch reset returns idle');
  check(directEngine(dates.addDate('2024-01-31', 1, 'days')) === '2024-02-01', 'literal pin: 31 January 2024 plus one day is 1 February');
  check(directEngine(dates.addDate('2024-01-31', 1, 'months')) === '2024-02-29', 'literal pin: month addition clamps to leap-day February 29');
  check(directEngine(dates.addDate('2024-02-29', 1, 'years')) === '2025-02-28', 'literal pin: one year after leap day clamps to 28 February');
  check(directEngine(dates.differenceDates('2024-01-01', '2025-01-01')).totalDays === 366, 'literal pin: leap-year span has 366 days');
  check(directEngine(dates.weekday('2024-01-01')) === 1, 'literal pin: 1 January 2024 is ISO weekday 1');
  check(directEngine(dates.dayOfYear('2024-12-31')) === 366, 'literal pin: leap-year final date is day 366');
  check(directEngine(dates.isoWeekNumber('2021-01-01')) === 53, 'literal pin: 1 January 2021 belongs to ISO week 53');
  check(directEngine(dates.countWeekdays('2024-01-01', '2024-01-07')) === 5, 'literal pin: Monday through Sunday contains five weekdays');
  check(directEngine(tally.addCounter(tally.createTally(), 'visitors')).counters.visitors.value === 0, 'literal pin: new tally begins at zero');
  check(directEngine(tally.changeTally(directEngine(tally.addCounter(tally.createTally(), 'visitors', 2)), 'visitors', 1)).counters.visitors.value === 2, 'literal pin: increment by step two produces value two');
  check(directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 42)).counters.visitors.value === 42, 'literal pin: set operation stores 42');
  check(directEngine(tally.resetTally(directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)), 'visitors')).counters.visitors.value === 0, 'literal pin: reset returns an unbounded tally to zero');
  check(directEngine(tally.undoTally(directEngine(tally.setTallyValue(directEngine(tally.addCounter(tally.createTally(), 'visitors')), 'visitors', 7)))).counters.visitors.value === 0, 'literal pin: undo restores the previous zero value');

  check(cases >= 50, 'at least 50 independent direct-engine cases executed');

  // Full state sequences: direct engine and runner are compared at every transition, with JSON persistence between steps.
  let timerState = undefined as unknown;
  const timerSteps: Array<{ args: Record<string, unknown>; now: number; direct: (state: timer.TimerState | undefined, now: number) => { result: unknown; state: timer.TimerState } }> = [
    { args: { operation: 'start', durationMs: 10000 }, now: 1000, direct: (_s, n) => { const state = directEngine(timer.startTimer(10000, n)); return { result: state, state }; } },
    { args: { operation: 'tick' }, now: 3000, direct: (s, n) => { const r = directEngine(timer.tickTimer(s!, n)); return { result: r, state: r.state }; } },
    { args: { operation: 'pause' }, now: 4000, direct: (s, n) => { const state = directEngine(timer.pauseTimer(s!, n)); return { result: state, state }; } },
    { args: { operation: 'resume' }, now: 5000, direct: (s, n) => { const state = directEngine(timer.resumeTimer(s!, n)); return { result: state, state }; } },
    { args: { operation: 'tick' }, now: 15000, direct: (s, n) => { const r = directEngine(timer.tickTimer(s!, n)); return { result: r, state: r.state }; } },
    { args: { operation: 'reset' }, now: 16000, direct: (_s, _n) => { const state = timer.resetTimer(); return { result: state, state }; } },
  ];
  let directTimerState: timer.TimerState | undefined;
  for (let i = 0; i < timerSteps.length; i++) {
    const step = timerSteps[i], expected = step.direct(directTimerState, step.now);
    const frozenArgs = deepFreeze(step.args);
    const stepDeps = deepFreeze({ now: step.now, state: timerState, randomBelow: () => 0, random01: () => 0 });
    const out = await runner('timer').run(frozenArgs as RunnerArgs, stepDeps);
    const repeat = await runner('timer').run(frozenArgs as RunnerArgs, stepDeps);
    check(out.ok && equal(out.result, expected.result) && equal(out.state, expected.state), `timer full state sequence step ${i + 1}`);
    check(equal(out, repeat), `timer state sequence step ${i + 1} repeats exactly`);
    timerState = JSON.parse(JSON.stringify(out.ok ? out.state : null));
    directTimerState = JSON.parse(JSON.stringify(expected.state));
  }

  let swState: unknown;
  let directSwState: stopwatch.StopwatchState | undefined;
  const swSteps: Array<{ args: Record<string, unknown>; now: number; direct: (s: stopwatch.StopwatchState | undefined, n: number) => stopwatch.StopwatchState }> = [
    { args: { operation: 'start' }, now: 1000, direct: (_s, n) => directEngine(stopwatch.startStopwatch(n)) },
    { args: { operation: 'tick' }, now: 2500, direct: (s, n) => directEngine(stopwatch.tickStopwatch(s!, n)) },
    { args: { operation: 'lap' }, now: 3500, direct: (s, n) => directEngine(stopwatch.lapStopwatch(s!, n)) },
    { args: { operation: 'pause' }, now: 4500, direct: (s, n) => directEngine(stopwatch.pauseStopwatch(s!, n)) },
    { args: { operation: 'resume' }, now: 6000, direct: (s, n) => directEngine(stopwatch.resumeStopwatch(s!, n)) },
    { args: { operation: 'lap' }, now: 7000, direct: (s, n) => directEngine(stopwatch.lapStopwatch(s!, n)) },
    { args: { operation: 'reset' }, now: 8000, direct: (_s, _n) => stopwatch.resetStopwatch() },
  ];
  for (let i = 0; i < swSteps.length; i++) {
    const step = swSteps[i], expectedState = step.direct(directSwState, step.now);
    const frozenArgs = deepFreeze(step.args);
    const stepDeps = deepFreeze({ now: step.now, state: swState, randomBelow: () => 0, random01: () => 0 });
    const out = await runner('stopwatch').run(frozenArgs as RunnerArgs, stepDeps);
    const repeat = await runner('stopwatch').run(frozenArgs as RunnerArgs, stepDeps);
    check(out.ok && equal(out.result, expectedState) && equal(out.state, expectedState), `stopwatch full state sequence step ${i + 1}`);
    check(equal(out, repeat), `stopwatch state sequence step ${i + 1} repeats exactly`);
    swState = JSON.parse(JSON.stringify(out.ok ? out.state : null));
    directSwState = JSON.parse(JSON.stringify(expectedState));
  }

  let tallyState: unknown;
  let directTallyState: tally.TallyState | undefined;
  const tallySteps: Array<{ args: Record<string, unknown>; direct: (s: tally.TallyState | undefined) => tally.TallyState }> = [
    { args: { operation: 'add', name: 'readers', step: 2 }, direct: (s) => directEngine(tally.addCounter(s ?? tally.createTally(), 'readers', 2)) },
    { args: { operation: 'increment', name: 'readers' }, direct: (s) => directEngine(tally.changeTally(s!, 'readers', 1)) },
    { args: { operation: 'decrement', name: 'readers' }, direct: (s) => directEngine(tally.changeTally(s!, 'readers', -1)) },
    { args: { operation: 'set', name: 'readers', value: 12 }, direct: (s) => directEngine(tally.setTallyValue(s!, 'readers', 12)) },
    { args: { operation: 'reset', name: 'readers' }, direct: (s) => directEngine(tally.resetTally(s!, 'readers')) },
    { args: { operation: 'undo' }, direct: (s) => directEngine(tally.undoTally(s!)) },
  ];
  for (let i = 0; i < tallySteps.length; i++) {
    const step = tallySteps[i], expectedState = step.direct(directTallyState);
    const frozenArgs = deepFreeze(step.args);
    const stepDeps = deepFreeze({ now: 0, state: tallyState, randomBelow: () => 0, random01: () => 0 });
    const out = await runner('tally-counter').run(frozenArgs as RunnerArgs, stepDeps);
    const repeat = await runner('tally-counter').run(frozenArgs as RunnerArgs, stepDeps);
    check(out.ok && equal(out.result, expectedState) && equal(out.state, expectedState), `tally full state sequence step ${i + 1}`);
    check(equal(out, repeat), `tally state sequence step ${i + 1} repeats exactly`);
    tallyState = JSON.parse(JSON.stringify(out.ok ? out.state : null));
    directTallyState = JSON.parse(JSON.stringify(expectedState));
  }

  // Every stateful tool rejects missing and malformed prior state for operations that need it.
  await failure('timer', 'timer needs state', { operation: 'tick' }, { now: 1, randomBelow: () => 0, random01: () => 0 }, 'needs-state');
  await failure('timer', 'timer invalid state', { operation: 'pause' }, { now: 1, state: { status: 'bad' }, randomBelow: () => 0, random01: () => 0 }, 'needs-state');
  await failure('stopwatch', 'stopwatch needs state', { operation: 'lap' }, { now: 1, randomBelow: () => 0, random01: () => 0 }, 'needs-state');
  await failure('stopwatch', 'stopwatch invalid state', { operation: 'resume' }, { now: 1, state: { elapsedMs: 'bad' }, randomBelow: () => 0, random01: () => 0 }, 'needs-state');
  await failure('tally-counter', 'tally needs state', { operation: 'undo' }, { now: 1, randomBelow: () => 0, random01: () => 0 }, 'needs-state');
  await failure('tally-counter', 'tally invalid state', { operation: 'increment', name: 'x' }, { now: 1, state: { counters: null, history: [] }, randomBelow: () => 0, random01: () => 0 }, 'needs-state');

  // Required/conditional slots, unknown choices, invalid values, engine refusals, and malformed args.
  await failure('timer', 'timer missing operation', { durationMs: 1 }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'operation');
  await failure('timer', 'timer start missing duration', { operation: 'start' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'durationMs');
  await failure('timer', 'timer unknown operation', { operation: 'explode' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', 'operation');
  await failure('timer', 'timer engine duration overflow', { operation: 'start', durationMs: 1 }, { now: Number.MAX_SAFE_INTEGER, randomBelow: () => 0, random01: () => 0 }, 'engine-refused');
  await failure('stopwatch', 'stopwatch missing operation', {}, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'operation');
  await failure('stopwatch', 'stopwatch unknown operation', { operation: 'teleport' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', 'operation');
  await failure('stopwatch', 'stopwatch engine refusal', { operation: 'pause' }, { now: 0, state: stopwatch.createStopwatch(), randomBelow: () => 0, random01: () => 0 }, 'engine-refused');
  await failure('date-calculator', 'date missing operation', { date: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'operation');
  await failure('date-calculator', 'date missing date', { operation: 'weekday' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'date');
  await failure('date-calculator', 'date add missing amount', { operation: 'add', date: '2024-01-01', unit: 'days' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'amount');
  await failure('date-calculator', 'date add missing unit', { operation: 'add', date: '2024-01-01', amount: 1 }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'unit');
  await failure('date-calculator', 'date difference missing otherDate', { operation: 'difference', date: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'otherDate');
  await failure('date-calculator', 'date weekdays missing otherDate', { operation: 'count-weekdays', date: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'otherDate');
  await failure('date-calculator', 'date unknown operation', { operation: 'tomorrow', date: '2024-01-01' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', 'operation');
  await failure('date-calculator', 'date parse invalid calendar date', { operation: 'weekday', date: '2024-02-30' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', 'date');
  await failure('date-calculator', 'date engine refusal out of range', { operation: 'add', date: '9999-12-31', amount: 1, unit: 'days' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'engine-refused');
  await failure('tally-counter', 'tally missing operation', { name: 'x' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'operation');
  await failure('tally-counter', 'tally add missing name', { operation: 'add' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'name');
  await failure('tally-counter', 'tally set missing name', { operation: 'set', value: 3 }, { now: 0, state: tally.createTally(), randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'name');
  await failure('tally-counter', 'tally set missing value', { operation: 'set', name: 'x' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'x')), randomBelow: () => 0, random01: () => 0 }, 'missing-input', 'value');
  await failure('tally-counter', 'tally unknown operation', { operation: 'erase' }, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', 'operation');
  await failure('tally-counter', 'tally engine duplicate refusal', { operation: 'add', name: 'x' }, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'x')), randomBelow: () => 0, random01: () => 0 }, 'engine-refused');
  const timerCode = await runner('timer').run({ operation: 'start', durationMs: 1 } as RunnerArgs, { now: Number.MAX_SAFE_INTEGER, randomBelow: () => 0, random01: () => 0 });
  check(!timerCode.ok && timerCode.kind === 'engine-refused' && timerCode.message.includes('invalid-duration'), 'timer engine error code is preserved in failure message');
  const stopwatchCode = await runner('stopwatch').run({ operation: 'pause' } as RunnerArgs, { now: 0, state: stopwatch.createStopwatch(), randomBelow: () => 0, random01: () => 0 });
  check(!stopwatchCode.ok && stopwatchCode.kind === 'engine-refused' && stopwatchCode.message.includes('not-running'), 'stopwatch engine error code is preserved in failure message');
  const dateCode = await runner('date-calculator').run({ operation: 'add', date: '9999-12-31', amount: 1, unit: 'days' } as RunnerArgs, { now: 0, randomBelow: () => 0, random01: () => 0 });
  check(!dateCode.ok && dateCode.kind === 'engine-refused' && dateCode.message.includes('date-out-of-range'), 'date engine error code is preserved in failure message');
  const tallyCode = await runner('tally-counter').run({ operation: 'add', name: 'x' } as RunnerArgs, { now: 0, state: directEngine(tally.addCounter(tally.createTally(), 'x')), randomBelow: () => 0, random01: () => 0 });
  check(!tallyCode.ok && tallyCode.kind === 'engine-refused' && tallyCode.message.includes('counter-exists'), 'tally engine error code is preserved in failure message');

  // Slot-type matrix: every declared slot gets malformed types; numeric slots also reject NaN and Infinity.
  const badObjects: unknown[] = ['wrong', null, [], {}];
  const invalidSlot = async (id: string, slot: string, base: Record<string, unknown>, value: unknown) => failure(id, `${id}.${slot} rejects ${String(value)}`, { ...base, [slot]: value }, { now: 1, state: base.operation === 'tick' ? timer.createTimer() : undefined, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', slot);
  for (const value of badObjects) await invalidSlot('timer', 'durationMs', { operation: 'start' }, value);
  for (const value of [NaN, Infinity]) await invalidSlot('timer', 'durationMs', { operation: 'start' }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('timer', 'operation', {}, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('timer', 'now', { operation: 'start', durationMs: 1 }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('stopwatch', 'operation', {}, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('stopwatch', 'now', { operation: 'start' }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('date-calculator', 'operation', { date: '2024-01-01' }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('date-calculator', 'date', { operation: 'weekday' }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('date-calculator', 'otherDate', { operation: 'difference', date: '2024-01-01' }, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('date-calculator', 'amount', { operation: 'add', date: '2024-01-01', unit: 'days' }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('date-calculator', 'unit', { operation: 'add', date: '2024-01-01', amount: 1 }, value);
  for (const value of [1, null, [], {}]) await invalidSlot('tally-counter', 'operation', {}, value);
  for (const value of [1, null, [], {}]) await invalidSlot('tally-counter', 'name', { operation: 'add' }, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('tally-counter', 'value', { operation: 'set', name: 'x' }, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('tally-counter', 'step', { operation: 'add', name: 'x' }, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('tally-counter', 'min', { operation: 'add', name: 'x' }, value);
  for (const value of ['1', null, [], {}, NaN, Infinity]) await invalidSlot('tally-counter', 'max', { operation: 'add', name: 'x' }, value);

  for (const id of ['timer', 'stopwatch', 'date-calculator', 'tally-counter']) {
    for (const value of [null, undefined, [], 'not an object']) await failure(id, `${id} malformed args ${String(value)}`, value, { now: 0, randomBelow: () => 0, random01: () => 0 }, 'invalid-input', 'args');
  }

  // Long reply shortening preserves the complete engine result.
  const longName = 'x'.repeat(2400);
  const long = await runner('tally-counter').run({ operation: 'add', name: longName } as RunnerArgs, { now: 0, randomBelow: () => 0, random01: () => 0 });
  check(long.ok && long.reply.length === 2000 && (long.result as tally.TallyState).counters[longName].name === longName, 'long reply is shortened while the full result is preserved');

  // Seven faulty runner copies / call variants, each exercised and caught by a named check.
  const correctTimer = runner('timer');
  const ignoredNowMutant: ToolRunner = {
    toolId: 'timer',
    run: async (args, deps) => {
      const raw = args as Record<string, unknown>;
      const engine = timer.startTimer(raw.durationMs as number, deps.now); // deliberately ignores args.now
      return engine.ok ? { ok: true, toolId: 'timer', result: engine.value, state: engine.value, reply: 'mutant' } : { ok: false, toolId: 'timer', kind: 'engine-refused', message: engine.error };
    },
  };
  const fixedClockDeps = { now: 100, randomBelow: () => 0, random01: () => 0 };
  const correctClockRun = await correctTimer.run({ operation: 'start', durationMs: 1000, now: 9000 }, fixedClockDeps);
  const ignoredClockRun = await ignoredNowMutant.run({ operation: 'start', durationMs: 1000, now: 9000 }, fixedClockDeps);
  check(correctClockRun.ok && ignoredClockRun.ok && !equal(correctClockRun.result, ignoredClockRun.result), 'MUTANT 1 caught: copied runner ignores caller-supplied now');

  const swappedDateMutant: ToolRunner = {
    toolId: 'date-calculator',
    run: async (args) => {
      const raw = args as Record<string, unknown>;
      const engine = dates.differenceDates(raw.otherDate as string, raw.date as string); // deliberately swaps inputs
      return engine.ok ? { ok: true, toolId: 'date-calculator', result: engine.value, reply: 'mutant' } : { ok: false, toolId: 'date-calculator', kind: 'engine-refused', message: engine.error };
    },
  };
  const swapArgs = { operation: 'difference', date: '2024-01-01', otherDate: '2024-01-10' };
  const correctDiffRun = await runner('date-calculator').run(swapArgs, fixedClockDeps);
  const swappedDiffRun = await swappedDateMutant.run(swapArgs, fixedClockDeps);
  check(correctDiffRun.ok && swappedDiffRun.ok && !equal(correctDiffRun.result, swappedDiffRun.result), 'MUTANT 2 caught: copied runner swaps the two date-engine arguments');

  const throwingMutant: ToolRunner = { toolId: 'timer', run: async () => { throw new Error('mutant throw'); } };
  let escaped = false;
  try { await throwingMutant.run({} as RunnerArgs, fixedClockDeps); } catch { escaped = true; }
  check(escaped, 'MUTANT 3 caught: copied runner lets a bad-input exception escape');

  const mutatingMutant: ToolRunner = {
    toolId: 'timer',
    run: async (args) => { (args as Record<string, unknown>).durationMs = 99; return { ok: false, toolId: 'timer', kind: 'invalid-input', slot: 'durationMs', message: 'mutant' }; },
  };
  const immutableArgs = deepFreeze({ operation: 'start', durationMs: 1 });
  let mutationCaught = false;
  try { await mutatingMutant.run(immutableArgs as RunnerArgs, fixedClockDeps); } catch { mutationCaught = true; }
  check(mutationCaught && immutableArgs.durationMs === 1, 'MUTANT 4 caught: copied runner attempts to change frozen arguments');

  const choiceSpy = { engineCalls: 0 };
  const invalidChoiceMutant: ToolRunner = {
    toolId: 'timer',
    run: async (args, deps) => {
      const raw = args as Record<string, unknown>;
      if (raw.operation === 'unlisted-operation') {
        choiceSpy.engineCalls++;
        const engine = timer.startTimer(1000, deps.now); // deliberately treats unknown choice as start
        if (engine.ok) return { ok: true, toolId: 'timer', result: engine.value, state: engine.value, reply: 'mutant' };
      }
      return correctTimer.run(args, deps);
    },
  };
  const invalidChoiceRun = await invalidChoiceMutant.run({ operation: 'unlisted-operation' }, fixedClockDeps);
  check(choiceSpy.engineCalls === 1 && invalidChoiceRun.ok, 'MUTANT 5 caught: copied runner lets an unlisted choice reach an engine');

  const changedResultMutant: ToolRunner = {
    toolId: 'timer',
    run: async (args, deps) => {
      const outcome = await correctTimer.run(args, deps);
      return outcome.ok ? { ...outcome, result: { changed: true } } : outcome;
    },
  };
  const unchangedExpected = await correctTimer.run({ operation: 'start', durationMs: 1000 }, fixedClockDeps);
  const changedRun = await changedResultMutant.run({ operation: 'start', durationMs: 1000 }, fixedClockDeps);
  check(unchangedExpected.ok && changedRun.ok && !equal(unchangedExpected.result, changedRun.result), 'MUTANT 6 caught: copied runner changes the engine result before returning it');

  const ambientClockMutant: ToolRunner = {
    toolId: 'timer',
    run: async (args) => {
      const raw = args as Record<string, unknown>;
      const engine = timer.startTimer(raw.durationMs as number, Date.now()); // deliberately bypasses deps.now
      return engine.ok ? { ok: true, toolId: 'timer', result: engine.value, state: engine.value, reply: 'mutant' } : { ok: false, toolId: 'timer', kind: 'engine-refused', message: engine.error };
    },
  };
  const injectedClock = await correctTimer.run({ operation: 'start', durationMs: 10 }, { ...fixedClockDeps, now: 1234 });
  const ambientClock = await ambientClockMutant.run({ operation: 'start', durationMs: 10 }, { ...fixedClockDeps, now: 1234 });
  check(injectedClock.ok && ambientClock.ok && !equal(injectedClock.result, ambientClock.result), 'MUTANT 7 caught: copied runner reads ambient clock instead of deps.now');

  console.log(`runnersTime.test.ts: ${checks} checks passed (${cases} direct-engine cases).`);
}

void main().catch((error) => { console.error(error); throw error; });
