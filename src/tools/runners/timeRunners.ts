import { getSchema } from './runnerSchema';
import {
  DATE_CALCULATOR_DESCRIPTOR,
  LEGACY_ENGINE_DESCRIPTORS,
  STOPWATCH_DESCRIPTOR,
  TALLY_COUNTER_DESCRIPTOR,
  TIMER_DESCRIPTOR,
} from '../engines/legacyDescriptors';
import {
  addDate, countWeekdays, dayOfYear, differenceDates, isoWeekNumber, parseDate, weekday,
  type DateDifference,
} from '../engines/time/dateCalc';
import {
  lapStopwatch, pauseStopwatch, resetStopwatch, resumeStopwatch,
  startStopwatch, tickStopwatch,
  type StopwatchState,
} from '../engines/time/stopwatch';
import {
  createTally, addCounter, changeTally, resetTally, setTallyValue, undoTally,
  type TallyState,
} from '../engines/time/tally';
import {
  formatTimerHms, pauseTimer, resetTimer, resumeTimer, startTimer, tickTimer,
  type TimerState,
} from '../engines/time/timer';
import {
  RUNNER_REPLY_LIMIT, runnerFail, shortenReply,
  type RunnerArgs, type RunnerDeps, type RunnerOutcome, type ToolRunner,
} from './runnerTypes';

const IDS = ['timer', 'stopwatch', 'date-calculator', 'tally-counter'] as const;
type TimeToolId = typeof IDS[number];
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fail(toolId: TimeToolId, kind: Parameters<typeof runnerFail>[1], message: string, slot?: string): RunnerOutcome {
  return runnerFail(toolId, kind, message, slot);
}
function descriptorFor(toolId: TimeToolId) {
  return LEGACY_ENGINE_DESCRIPTORS.find((item) => item.toolId === toolId);
}
function validateArgs(toolId: TimeToolId, raw: unknown): RunnerOutcome | null {
  if (!isRecord(raw)) return fail(toolId, 'invalid-input', 'The supplied values must be an object.', 'args');
  const schema = getSchema(toolId);
  const descriptor = descriptorFor(toolId);
  if (!schema || !descriptor) return fail(toolId, 'invalid-input', 'The tool description is unavailable.');
  const allowed = new Set(schema.slots.map((slot) => slot.name));
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) return fail(toolId, 'invalid-input', 'This value is not used by this tool.', key);
  }
  for (const slot of schema.slots) {
    const value = raw[slot.name];
    if (value === undefined) continue;
    let valid = false;
    switch (slot.kind) {
      case 'text': valid = typeof value === 'string'; break;
      case 'date': valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDate(value).ok; break;
      case 'number': valid = typeof value === 'number' && Number.isFinite(value); break;
      case 'duration': valid = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; break;
      case 'time': valid = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; break;
      case 'choice': {
        const input = descriptor.inputs.find((item) => item.name === slot.name);
        const choices = (input as { choices?: readonly string[] } | undefined)?.choices;
        valid = typeof value === 'string' && !!choices?.includes(value);
        break;
      }
      case 'yes-no': valid = typeof value === 'boolean'; break;
      case 'quantity': case 'file': valid = false; break;
    }
    if (!valid) return fail(toolId, 'invalid-input', 'This value has the wrong type or is not an available choice.', slot.name);
  }
  return null;
}
function required(raw: RecordValue, toolId: TimeToolId, slot: string): RunnerOutcome | null {
  return raw[slot] === undefined ? fail(toolId, 'missing-input', 'A value is needed to continue.', slot) : null;
}
function engineFailure(toolId: TimeToolId, error: string): RunnerOutcome {
  return fail(toolId, 'engine-refused', `The tool could not complete this operation (${error}).`);
}
function clock(raw: RecordValue, deps: RunnerDeps, toolId: TimeToolId): { value: number } | RunnerOutcome {
  const value = raw.now === undefined ? deps?.now : raw.now;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return fail(toolId, 'invalid-input', 'A valid time in milliseconds is needed.', raw.now === undefined ? 'now' : 'now');
  }
  return { value };
}
function timerState(value: unknown): value is TimerState {
  if (!isRecord(value)) return false;
  return ['idle', 'running', 'paused', 'finished'].includes(String(value.status))
    && Number.isSafeInteger(value.durationMs) && Number(value.durationMs) >= 0
    && Number.isSafeInteger(value.remainingMs) && Number(value.remainingMs) >= 0
    && (value.status !== 'running' || value.deadlineAt !== null)
    && (value.startedAt === null || (Number.isSafeInteger(value.startedAt) && Number(value.startedAt) >= 0))
    && (value.deadlineAt === null || (Number.isSafeInteger(value.deadlineAt) && Number(value.deadlineAt) >= 0))
    && (value.pausedAt === null || (Number.isSafeInteger(value.pausedAt) && Number(value.pausedAt) >= 0));
}
function stopwatchState(value: unknown): value is StopwatchState {
  if (!isRecord(value) || !Array.isArray(value.laps)) return false;
  return ['idle', 'running', 'paused'].includes(String(value.status))
    && Number.isSafeInteger(value.elapsedMs) && Number(value.elapsedMs) >= 0
    && Number.isSafeInteger(value.lastLapTotalMs) && Number(value.lastLapTotalMs) >= 0
    && (value.startedAt === null || (Number.isSafeInteger(value.startedAt) && Number(value.startedAt) >= 0))
    && (value.pausedAt === null || (Number.isSafeInteger(value.pausedAt) && Number(value.pausedAt) >= 0))
    && value.laps.every((lap: unknown) => isRecord(lap)
      && Number.isSafeInteger(lap.splitMs) && Number(lap.splitMs) >= 0
      && Number.isSafeInteger(lap.totalMs) && Number(lap.totalMs) >= 0);
}
function tallyState(value: unknown): value is TallyState {
  if (!isRecord(value) || !isRecord(value.counters) || !Array.isArray(value.history)) return false;
  return Object.entries(value.counters).every(([key, counter]) => isRecord(counter)
    && counter.name === key && Number.isSafeInteger(counter.value) && Number.isSafeInteger(counter.step)
    && counter.step !== 0
    && (counter.min === undefined || Number.isSafeInteger(counter.min))
    && (counter.max === undefined || Number.isSafeInteger(counter.max))
    && (counter.min === undefined || counter.max === undefined || Number(counter.min) <= Number(counter.max)));
}
function hms(milliseconds: number): string {
  const [hours, minutes, seconds] = formatTimerHms(milliseconds).split(':').map(Number);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, and ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}
function dateWords(date: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [year, month, day] = date.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}
function weekdayName(isoDay: number): string {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return names[isoDay - 1] ?? String(isoDay);
}
function success(toolId: TimeToolId, result: unknown, reply: string, state?: unknown): RunnerOutcome {
  const bounded = shortenReply(reply, RUNNER_REPLY_LIMIT);
  return state === undefined
    ? { ok: true, toolId, result, reply: bounded }
    : { ok: true, toolId, result, reply: bounded, state };
}

async function runTimer(args: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
  const toolId = 'timer' as const;
  try {
    const invalid = validateArgs(toolId, args); if (invalid) return invalid;
    const raw = args as RecordValue;
    const missing = required(raw, toolId, 'operation'); if (missing) return missing;
    const operation = raw.operation as string;
    if (operation === 'start') {
      const absent = required(raw, toolId, 'durationMs'); if (absent) return absent;
      const time = clock(raw, deps, toolId); if ('ok' in time) return time;
      const result = startTimer(raw.durationMs as number, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Timer is ${result.value.status}. Time remaining: ${hms(result.value.remainingMs)}.`, result.value);
    }
    if (operation === 'reset') {
      const result = resetTimer();
      return success(toolId, result, `Timer is ${result.status}. Time remaining: ${hms(result.remainingMs)}.`, result);
    }
    if (!timerState(deps?.state)) return fail(toolId, 'needs-state', 'Start a timer before using this operation.');
    const time = clock(raw, deps, toolId); if ('ok' in time) return time;
    if (operation === 'tick') {
      const result = tickTimer(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Timer is ${result.value.state.status}. Time remaining: ${hms(result.value.remainingMs)}.`, result.value.state);
    }
    if (operation === 'pause') {
      const result = pauseTimer(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Timer is ${result.value.status}. Time remaining: ${hms(result.value.remainingMs)}.`, result.value);
    }
    if (operation === 'resume') {
      const result = resumeTimer(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Timer is ${result.value.status}. Time remaining: ${hms(result.value.remainingMs)}.`, result.value);
    }
    return fail(toolId, 'invalid-input', 'Choose a supported timer operation.', 'operation');
  } catch {
    return fail(toolId, 'invalid-input', 'The timer could not use the supplied values.', 'args');
  }
}

async function runStopwatch(args: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
  const toolId = 'stopwatch' as const;
  try {
    const invalid = validateArgs(toolId, args); if (invalid) return invalid;
    const raw = args as RecordValue;
    const missing = required(raw, toolId, 'operation'); if (missing) return missing;
    const operation = raw.operation as string;
    if (operation === 'start') {
      const time = clock(raw, deps, toolId); if ('ok' in time) return time;
      const result = startStopwatch(time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Stopwatch is running. Elapsed time: ${hms(result.value.elapsedMs)}. Lap count: 0.`, result.value);
    }
    if (operation === 'reset') {
      const result = resetStopwatch();
      return success(toolId, result, `Stopwatch is idle. Elapsed time: ${hms(result.elapsedMs)}. Lap count: 0.`, result);
    }
    if (!stopwatchState(deps?.state)) return fail(toolId, 'needs-state', 'Start a stopwatch before using this operation.');
    const time = clock(raw, deps, toolId); if ('ok' in time) return time;
    if (operation === 'tick') {
      const result = tickStopwatch(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Stopwatch is ${result.value.status}. Elapsed time: ${hms(result.value.elapsedMs)}. Lap count: ${result.value.laps.length}.`, result.value);
    }
    if (operation === 'pause') {
      const result = pauseStopwatch(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Stopwatch is paused. Elapsed time: ${hms(result.value.elapsedMs)}. Lap count: ${result.value.laps.length}.`, result.value);
    }
    if (operation === 'resume') {
      const result = resumeStopwatch(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `Stopwatch is running. Elapsed time: ${hms(result.value.elapsedMs)}. Lap count: ${result.value.laps.length}.`, result.value);
    }
    if (operation === 'lap') {
      const result = lapStopwatch(deps.state, time.value);
      if (!result.ok) return engineFailure(toolId, result.error);
      const last = result.value.laps[result.value.laps.length - 1];
      return success(toolId, result.value, `Lap recorded. Elapsed time: ${hms(result.value.elapsedMs)}. Lap count: ${result.value.laps.length}. Last lap: ${hms(last.splitMs)}.`, result.value);
    }
    return fail(toolId, 'invalid-input', 'Choose a supported stopwatch operation.', 'operation');
  } catch {
    return fail(toolId, 'invalid-input', 'The stopwatch could not use the supplied values.', 'args');
  }
}

async function runDateCalculator(args: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
  void deps;
  const toolId = 'date-calculator' as const;
  try {
    const invalid = validateArgs(toolId, args); if (invalid) return invalid;
    const raw = args as RecordValue;
    const missing = required(raw, toolId, 'operation'); if (missing) return missing;
    const dateMissing = required(raw, toolId, 'date'); if (dateMissing) return dateMissing;
    const date = raw.date as string;
    const operation = raw.operation as string;
    if (operation === 'add') {
      const amountMissing = required(raw, toolId, 'amount'); if (amountMissing) return amountMissing;
      const unitMissing = required(raw, toolId, 'unit'); if (unitMissing) return unitMissing;
      const result = addDate(date, raw.amount as number, raw.unit as 'years' | 'months' | 'days');
      if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `The date is ${dateWords(result.value)}.`);
    }
    if (operation === 'difference' || operation === 'count-weekdays') {
      const otherMissing = required(raw, toolId, 'otherDate'); if (otherMissing) return otherMissing;
      const result = operation === 'difference'
        ? differenceDates(date, raw.otherDate as string)
        : countWeekdays(date, raw.otherDate as string);
      if (!result.ok) return engineFailure(toolId, result.error);
      if (operation === 'difference') {
        const d = result.value as DateDifference;
        return success(toolId, result.value, `The difference is ${d.totalDays} days (${d.years} years, ${d.months} months, and ${d.days} days).`);
      }
      return success(toolId, result.value, `There are ${result.value} weekdays in that date range.`);
    }
    if (operation === 'weekday') {
      const result = weekday(date); if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `${dateWords(date)} is a ${weekdayName(result.value)}.`);
    }
    if (operation === 'day-of-year') {
      const result = dayOfYear(date); if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `${dateWords(date)} is day ${result.value} of the year.`);
    }
    if (operation === 'iso-week') {
      const result = isoWeekNumber(date); if (!result.ok) return engineFailure(toolId, result.error);
      return success(toolId, result.value, `${dateWords(date)} is in ISO week ${result.value}.`);
    }
    return fail(toolId, 'invalid-input', 'Choose a supported date operation.', 'operation');
  } catch {
    return fail(toolId, 'invalid-input', 'The date calculation could not use the supplied values.', 'args');
  }
}

async function runTally(args: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
  const toolId = 'tally-counter' as const;
  try {
    const invalid = validateArgs(toolId, args); if (invalid) return invalid;
    const raw = args as RecordValue;
    const missing = required(raw, toolId, 'operation'); if (missing) return missing;
    const operation = raw.operation as string;
    if (operation === 'add') {
      const nameMissing = required(raw, toolId, 'name'); if (nameMissing) return nameMissing;
      const before = deps?.state === undefined ? createTally() : deps.state;
      if (!tallyState(before)) return fail(toolId, 'needs-state', 'The saved counter state is not valid.');
      const result = addCounter(before, raw.name as string, raw.step as number | undefined, raw.min as number | undefined, raw.max as number | undefined);
      if (!result.ok) return engineFailure(toolId, result.error);
      const counter = result.value.counters[(raw.name as string).trim()];
      return success(toolId, result.value, `${counter.name} is now ${counter.value}.`, result.value);
    }
    if (!tallyState(deps?.state)) return fail(toolId, 'needs-state', 'Create a counter before using this operation.');
    if (operation === 'increment' || operation === 'decrement') {
      const nameMissing = required(raw, toolId, 'name'); if (nameMissing) return nameMissing;
      const result = changeTally(deps.state, raw.name as string, operation === 'increment' ? 1 : -1);
      if (!result.ok) return engineFailure(toolId, result.error);
      const counter = result.value.counters[raw.name as string];
      return success(toolId, result.value, `${counter.name} is now ${counter.value}.`, result.value);
    }
    if (operation === 'set') {
      const nameMissing = required(raw, toolId, 'name'); if (nameMissing) return nameMissing;
      const valueMissing = required(raw, toolId, 'value'); if (valueMissing) return valueMissing;
      const result = setTallyValue(deps.state, raw.name as string, raw.value as number);
      if (!result.ok) return engineFailure(toolId, result.error);
      const counter = result.value.counters[raw.name as string];
      return success(toolId, result.value, `${counter.name} is now ${counter.value}.`, result.value);
    }
    if (operation === 'reset') {
      const result = resetTally(deps.state, raw.name as string | undefined);
      if (!result.ok) return engineFailure(toolId, result.error);
      if (raw.name !== undefined) {
        const counter = result.value.counters[raw.name as string];
        return success(toolId, result.value, `${counter.name} is now ${counter.value}.`, result.value);
      }
      return success(toolId, result.value, 'All counters have been reset.', result.value);
    }
    if (operation === 'undo') {
      const result = undoTally(deps.state);
      if (!result.ok) return engineFailure(toolId, result.error);
      const current = Object.values(result.value.counters).map((counter) => `${counter.name}: ${counter.value}`);
      const reply = current.length === 0
        ? 'The last change has been undone. No counters remain.'
        : `The last change has been undone. Current counters: ${current.join('; ')}.`;
      return success(toolId, result.value, reply, result.value);
    }
    return fail(toolId, 'invalid-input', 'Choose a supported counter operation.', 'operation');
  } catch {
    return fail(toolId, 'invalid-input', 'The counter could not use the supplied values.', 'args');
  }
}

export const TIME_RUNNERS: readonly ToolRunner[] = [
  { toolId: TIMER_DESCRIPTOR.toolId, run: runTimer },
  { toolId: STOPWATCH_DESCRIPTOR.toolId, run: runStopwatch },
  { toolId: DATE_CALCULATOR_DESCRIPTOR.toolId, run: runDateCalculator },
  { toolId: TALLY_COUNTER_DESCRIPTOR.toolId, run: runTally },
];
