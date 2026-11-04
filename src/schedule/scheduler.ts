export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type OnceRule = { readonly kind: 'once'; readonly atMs: number };
export type EveryRule = { readonly kind: 'every'; readonly startMs: number; readonly everyMs: number };
export type DailyRule = { readonly kind: 'daily'; readonly hour: number; readonly minute: number; readonly offsetMinutes: number };
export type WeeklyRule = { readonly kind: 'weekly'; readonly weekdays: readonly number[]; readonly hour: number; readonly minute: number; readonly offsetMinutes: number };
export type ScheduleRule = OnceRule | EveryRule | DailyRule | WeeklyRule;

const DAY_MS = 86_400_000n;
const MINUTE_MS = 60_000n;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

type NormalizedRule =
  | { readonly kind: 'once'; readonly atMs: bigint }
  | { readonly kind: 'every'; readonly startMs: bigint; readonly everyMs: bigint }
  | { readonly kind: 'daily'; readonly hour: number; readonly minute: number; readonly offsetMinutes: number }
  | { readonly kind: 'weekly'; readonly weekdays: ReadonlySet<number>; readonly hour: number; readonly minute: number; readonly offsetMinutes: number };

function failure<T = never>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false, error, message });
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function normalizeRule(input: unknown): EngineResult<NormalizedRule> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return failure('invalid-rule', 'Schedule rule must be an object.');
  }
  const raw = input as Record<string, unknown>;
  if (raw.kind === 'once') {
    if (!isSafeInteger(raw.atMs)) return failure('invalid-time', 'Once rule atMs must be a safe epoch-millisecond integer.');
    return Object.freeze({ ok: true, value: Object.freeze({ kind: 'once', atMs: BigInt(raw.atMs) }) });
  }
  if (raw.kind === 'every') {
    if (!isSafeInteger(raw.startMs) || !isSafeInteger(raw.everyMs)) return failure('invalid-time', 'Every rule times must be safe integers.');
    if (raw.everyMs < 60_000) return failure('invalid-interval', 'Every rule interval must be at least 60,000 milliseconds.');
    return Object.freeze({ ok: true, value: Object.freeze({ kind: 'every', startMs: BigInt(raw.startMs), everyMs: BigInt(raw.everyMs) }) });
  }
  if (raw.kind === 'daily' || raw.kind === 'weekly') {
    if (!Number.isInteger(raw.hour) || typeof raw.hour !== 'number' || raw.hour < 0 || raw.hour > 23) {
      return failure('invalid-hour', 'Hour must be an integer from zero to 23.');
    }
    if (!Number.isInteger(raw.minute) || typeof raw.minute !== 'number' || raw.minute < 0 || raw.minute > 59) {
      return failure('invalid-minute', 'Minute must be an integer from zero to 59.');
    }
    if (!Number.isInteger(raw.offsetMinutes) || typeof raw.offsetMinutes !== 'number' || raw.offsetMinutes < -840 || raw.offsetMinutes > 840) {
      return failure('invalid-offset', 'UTC offset must be an integer from -840 to 840 minutes.');
    }
    if (raw.kind === 'daily') {
      return Object.freeze({ ok: true, value: Object.freeze({ kind: 'daily', hour: raw.hour, minute: raw.minute, offsetMinutes: raw.offsetMinutes }) });
    }
    if (!Array.isArray(raw.weekdays) || raw.weekdays.length === 0) return failure('invalid-weekdays', 'Weekly rule needs at least one weekday.');
    const weekdays = new Set<number>();
    for (const weekday of raw.weekdays) {
      if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 || weekdays.has(weekday)) {
        return failure('invalid-weekdays', 'Weekdays must be unique integers from zero to six.');
      }
      weekdays.add(weekday);
    }
    return Object.freeze({ ok: true, value: Object.freeze({ kind: 'weekly', weekdays, hour: raw.hour, minute: raw.minute, offsetMinutes: raw.offsetMinutes }) });
  }
  return failure('invalid-rule-kind', 'Schedule rule kind must be once, every, daily or weekly.');
}

function floorDiv(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

function weekdayForEpochDay(day: bigint): number {
  const remainder = ((day + 4n) % 7n + 7n) % 7n;
  return Number(remainder);
}

function toSafeNumber(value: bigint): number | null {
  if (value < MIN_SAFE || value > MAX_SAFE) return null;
  return Number(value);
}

function buildLocalRuns(
  rule: Extract<NormalizedRule, { kind: 'daily' | 'weekly' }>,
  afterMs: number,
  count: number,
): EngineResult<readonly number[]> {
  const offset = BigInt(rule.offsetMinutes) * MINUTE_MS;
  const localAfter = BigInt(afterMs) + offset;
  let day = floorDiv(localAfter, DAY_MS);
  const minuteOfDay = BigInt(rule.hour * 60 + rule.minute) * MINUTE_MS;
  const runs: number[] = [];
  while (runs.length < count) {
    if (rule.kind === 'daily' || rule.weekdays.has(weekdayForEpochDay(day))) {
      const candidate = day * DAY_MS + minuteOfDay - offset;
      if (candidate > BigInt(afterMs)) {
        const safe = toSafeNumber(candidate);
        if (safe === null) return failure('time-out-of-range', 'A calculated run time exceeds safe epoch-millisecond limits.');
        runs.push(safe);
      }
    }
    day += 1n;
  }
  return Object.freeze({ ok: true, value: Object.freeze(runs) });
}

function nextRunsNormalized(rule: NormalizedRule, afterMs: number, count: number): EngineResult<readonly number[]> {
  if (count === 0) return Object.freeze({ ok: true, value: Object.freeze([]) });
  if (rule.kind === 'once') {
    if (rule.atMs <= BigInt(afterMs)) return Object.freeze({ ok: true, value: Object.freeze([]) });
    const safe = toSafeNumber(rule.atMs);
    if (safe === null) return failure('time-out-of-range', 'Once run time exceeds safe epoch-millisecond limits.');
    return Object.freeze({ ok: true, value: Object.freeze([safe]) });
  }
  if (rule.kind === 'every') {
    const after = BigInt(afterMs);
    const firstIndex = after < rule.startMs ? 0n : floorDiv(after - rule.startMs, rule.everyMs) + 1n;
    const runs: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const candidate = rule.startMs + (firstIndex + BigInt(index)) * rule.everyMs;
      const safe = toSafeNumber(candidate);
      if (safe === null) return failure('time-out-of-range', 'A calculated run time exceeds safe epoch-millisecond limits.');
      runs.push(safe);
    }
    return Object.freeze({ ok: true, value: Object.freeze(runs) });
  }
  return buildLocalRuns(rule, afterMs, count);
}

export function nextRuns(rule: ScheduleRule, afterMs: number, count: number): EngineResult<readonly number[]> {
  if (!isSafeInteger(afterMs)) return failure('invalid-time', 'afterMs must be a safe epoch-millisecond integer.');
  if (!Number.isInteger(count) || count < 1 || count > 1000) return failure('invalid-count', 'count must be an integer from one to 1,000.');
  const normalized = normalizeRule(rule);
  if (!normalized.ok) return failure(normalized.error, normalized.message);
  return nextRunsNormalized(normalized.value, afterMs, count);
}

export function missedRuns(rule: ScheduleRule, lastMs: number, nowMs: number, max: number): EngineResult<readonly number[]> {
  if (!isSafeInteger(lastMs) || !isSafeInteger(nowMs)) return failure('invalid-time', 'lastMs and nowMs must be safe epoch-millisecond integers.');
  if (!Number.isInteger(max) || max < 0 || max > 1000) return failure('invalid-count', 'max must be an integer from zero to 1,000.');
  const normalized = normalizeRule(rule);
  if (!normalized.ok) return failure(normalized.error, normalized.message);
  if (max === 0 || nowMs <= lastMs) return Object.freeze({ ok: true, value: Object.freeze([]) });
  const next = nextRunsNormalized(normalized.value, lastMs, max);
  if (!next.ok) return failure(next.error, next.message);
  return Object.freeze({ ok: true, value: Object.freeze(next.value.filter((time) => time <= nowMs)) });
}
