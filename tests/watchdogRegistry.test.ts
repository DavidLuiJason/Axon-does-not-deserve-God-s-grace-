import { runWatchdog, type WatchdogEntry } from '../src/safety/watchdogRegistry';

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

const calls: string[] = [];
const entries: WatchdogEntry[] = [
  { id: 'brain', layer: 3, probe: () => { calls.push('brain'); return { ok: true }; } },
  { id: 'dictionary', layer: 1, probe: () => { calls.push('dictionary'); return { ok: true, degraded: true }; } },
  { id: 'voice', layer: 4, probe: () => { calls.push('voice'); throw new Error('mic busy'); } },
  { id: 'sort', layer: 5 },
  { id: 'canary', layer: 0, canary: true, probe: () => { calls.push('canary'); return { ok: false, detail: 'expected failure' }; } },
];
const checked = runWatchdog(entries);
success(checked);
equal(checked.value.trust, 'TRUSTED', 'known canary trust');
deepEqual(checked.value.counts, { ONLINE: 1, DEGRADED: 1, OFFLINE: 1, 'NOT CHECKED': 1 }, 'known counts');
equal(checked.value.systems[2]?.detail, 'mic busy', 'thrown message without stack');
deepEqual(calls, ['brain', 'dictionary', 'voice', 'canary'], 'each probe called once in registry order');
equal(checked.value.systems.length, 4, 'canary excluded from systems');

const failedCanary = runWatchdog(entries.map((entry) => entry.id === 'canary'
  ? { ...entry, probe: () => ({ ok: true }) }
  : entry));
success(failedCanary);
equal(failedCanary.value.trust, 'CANARY-FAILED', 'successful known-bad probe fails trust');
deepEqual(failedCanary.value.counts, { ONLINE: 0, DEGRADED: 0, OFFLINE: 0, 'NOT CHECKED': 4 }, 'failed canary forces every system unchecked');
check(failedCanary.value.systems.every((system) => system.status === 'NOT CHECKED' && system.detail === 'canary-failed'), 'failed canary detail applied to every system');

const noCanary = runWatchdog(entries.filter((entry) => entry.canary !== true));
success(noCanary);
equal(noCanary.value.trust, 'NO-CANARY', 'no canary trust');
const malformed = runWatchdog([{ id: 'odd', layer: 2, probe: () => ({ ok: 'yes' } as unknown as { ok: boolean }) }]);
success(malformed);
equal(malformed.value.systems[0]?.status, 'OFFLINE', 'malformed probe is offline');
equal(malformed.value.systems[0]?.detail, 'malformed-result', 'malformed detail');
const long = runWatchdog([{ id: 'long', layer: 1, probe: () => { throw new Error('x'.repeat(250)); } }]);
success(long);
equal(long.value.systems[0]?.detail?.length, 200, 'detail is cut to 200 characters');

check(runWatchdog([{ id: 'x', layer: 6 }]).ok === false, 'bad layer returns typed error');
check(runWatchdog([{ id: 'x', layer: 1 }, { id: 'x', layer: 2 }]).ok === false, 'duplicate id returns typed error');
check(runWatchdog(new Array(1001).fill({ id: 'x', layer: 1 })).ok === false, 'registry size is bounded');
check(runWatchdog([{ id: 'x', layer: 1, probe: 'bad' as unknown as () => { ok: boolean } }]).ok === false, 'bad probe input returns typed error');
check(Object.isFrozen(checked.value) && Object.isFrozen(checked.value.systems) && Object.isFrozen(checked.value.counts), 'watchdog output is frozen');
// Director additions: a canary that is merely degraded, or has no probe at all, is NOT the known-bad OFFLINE answer, so the watchdog is not trusted.
{
  const live = (): { ok: boolean } => ({ ok: true });
  for (const canary of [{ id: 'c', layer: 0, canary: true, probe: () => ({ ok: true, degraded: true }) }, { id: 'c', layer: 0, canary: true }]) {
    const out = runWatchdog([{ id: 'x', layer: 1, probe: live }, canary]);
    if (!out.ok || out.value.trust !== 'CANARY-FAILED' || out.value.systems[0]!.status !== 'NOT CHECKED') throw new Error('a canary that is not OFFLINE must fail the watchdog');
  }
}
console.log(`PASS watchdogRegistry: ${checks} checks; order, statuses, canary gate, no-canary mode, malformed/throwing probes, bounds`);
