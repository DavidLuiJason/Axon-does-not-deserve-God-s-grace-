import { missedRuns, nextRuns } from '../src/schedule/scheduler';

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

let result = nextRuns({ kind: 'once', atMs: 1000 }, 999, 1);
success(result);
deepEqual(result.value, [1000], 'once after 999');
result = nextRuns({ kind: 'once', atMs: 1000 }, 1000, 1);
success(result);
deepEqual(result.value, [], 'once is strictly after');
result = nextRuns({ kind: 'every', startMs: 0, everyMs: 60000 }, 0, 3);
success(result);
deepEqual(result.value, [60000, 120000, 180000], 'every known answer');
result = nextRuns({ kind: 'every', startMs: 0, everyMs: 60000 }, 59999, 1);
success(result);
deepEqual(result.value, [60000], 'every from before next run');
result = nextRuns({ kind: 'every', startMs: 600000, everyMs: 60000 }, 0, 1);
success(result);
deepEqual(result.value, [600000], 'every includes start time');

result = nextRuns({ kind: 'daily', hour: 9, minute: 30, offsetMinutes: 60 }, 1793750400000, 2);
success(result);
deepEqual(result.value, [1793781000000, 1793867400000], 'daily positive offset');
result = nextRuns({ kind: 'daily', hour: 9, minute: 30, offsetMinutes: 60 }, 1793781000000, 1);
success(result);
deepEqual(result.value, [1793867400000], 'daily strict after');
result = nextRuns({ kind: 'daily', hour: 23, minute: 0, offsetMinutes: -300 }, 1793750400000, 2);
success(result);
deepEqual(result.value, [1793764800000, 1793851200000], 'daily negative offset crosses UTC date');
result = nextRuns({ kind: 'weekly', weekdays: [1, 3], hour: 7, minute: 0, offsetMinutes: 60 }, 1793768400000, 3);
success(result);
deepEqual(result.value, [1793772000000, 1794204000000, 1794376800000], 'weekly local weekdays');
result = missedRuns({ kind: 'every', startMs: 0, everyMs: 60000 }, 0, 180000, 1000);
success(result);
deepEqual(result.value, [60000, 120000, 180000], 'missed interval runs');
result = missedRuns({ kind: 'every', startMs: 0, everyMs: 60000 }, 0, 180000, 0);
success(result);
deepEqual(result.value, [], 'zero missed-run cap');

check(nextRuns({ kind: 'once', atMs: Number.NaN }, 0, 1).ok === false, 'nextRuns rejects NaN rule time');
check(nextRuns({ kind: 'every', startMs: 0, everyMs: 59999 }, 0, 1).ok === false, 'nextRuns rejects short interval');
check(nextRuns({ kind: 'daily', hour: 24, minute: 0, offsetMinutes: 0 }, 0, 1).ok === false, 'nextRuns rejects hour range');
check(nextRuns({ kind: 'weekly', weekdays: [], hour: 1, minute: 0, offsetMinutes: 0 }, 0, 1).ok === false, 'nextRuns rejects empty weekdays');
check(nextRuns({ kind: 'other' } as unknown as { kind: 'once'; atMs: number }, 0, 1).ok === false, 'nextRuns rejects bad kind');
check(nextRuns({ kind: 'once', atMs: 1 }, 0, 0).ok === false, 'nextRuns rejects zero count');
check(missedRuns({ kind: 'once', atMs: 1 }, Number.NaN, 10, 1).ok === false, 'missedRuns rejects invalid time');
check(missedRuns({ kind: 'once', atMs: 1 }, 0, 10, 1001).ok === false, 'missedRuns rejects excessive max');
check(Object.isFrozen(result.value), 'run list is frozen');
// Director additions: runs before 1970 (negative epoch) round DOWN, never toward zero. Hand-counted: after -100000000 ms (about 1.157 days before 1970), 23:00 UTC is at -90000000 and -3600000.
{
  const early = nextRuns({ kind: 'daily', hour: 23, minute: 0, offsetMinutes: 0 }, -100000000, 2);
  if (!early.ok || early.value.length !== 2 || early.value[0] !== -90000000 || early.value[1] !== -3600000) throw new Error('negative epoch daily runs: ' + JSON.stringify(early));
}
console.log(`PASS scheduler: ${checks} checks; once, interval, daily/weekly fixed offsets, strict-after, missed runs, typed errors`);
