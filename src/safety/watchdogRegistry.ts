export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type ProbeResult = { readonly ok: boolean; readonly degraded?: boolean; readonly detail?: string };
export type WatchdogEntry = {
  readonly id: string;
  readonly layer: number;
  readonly probe?: () => ProbeResult;
  readonly canary?: boolean;
};
export type WatchdogStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'NOT CHECKED';
export type WatchdogSystem = { readonly id: string; readonly layer: number; readonly status: WatchdogStatus; readonly detail: string | null };
export type WatchdogCounts = { readonly ONLINE: number; readonly DEGRADED: number; readonly OFFLINE: number; readonly 'NOT CHECKED': number };
export type WatchdogValue = {
  readonly trust: 'TRUSTED' | 'CANARY-FAILED' | 'NO-CANARY';
  readonly systems: readonly WatchdogSystem[];
  readonly counts: WatchdogCounts;
};

type ProbeOutcome = { readonly status: WatchdogStatus; readonly detail: string | null };

function failure<T = never>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false, error, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cutDetail(value: string): string {
  return value.slice(0, 200);
}

function thrownDetail(thrown: unknown): string {
  if (thrown instanceof Error && typeof thrown.message === 'string' && thrown.message.length > 0) return cutDetail(thrown.message);
  if (typeof thrown === 'string' && thrown.length > 0) return cutDetail(thrown);
  return 'probe-threw';
}

function runProbe(entry: WatchdogEntry): ProbeOutcome {
  if (entry.probe === undefined) return Object.freeze({ status: 'NOT CHECKED', detail: null });
  try {
    const raw: unknown = entry.probe();
    if (!isRecord(raw) || typeof raw.ok !== 'boolean'
      || (raw.degraded !== undefined && typeof raw.degraded !== 'boolean')
      || (raw.detail !== undefined && typeof raw.detail !== 'string')) {
      return Object.freeze({ status: 'OFFLINE', detail: 'malformed-result' });
    }
    const detail = typeof raw.detail === 'string' ? cutDetail(raw.detail) : null;
    if (!raw.ok) return Object.freeze({ status: 'OFFLINE', detail: detail ?? 'probe-failed' });
    return Object.freeze({ status: raw.degraded === true ? 'DEGRADED' : 'ONLINE', detail });
  } catch (thrown) {
    return Object.freeze({ status: 'OFFLINE', detail: thrownDetail(thrown) });
  }
}

export function runWatchdog(entries: WatchdogEntry[]): EngineResult<WatchdogValue> {
  if (!Array.isArray(entries)) return failure('invalid-entries', 'Watchdog entries must be an array.');
  if (entries.length > 1000) return failure('too-many-entries', 'Watchdog registry cannot exceed 1,000 entries.');
  const ids = new Set<string>();
  const normalized: WatchdogEntry[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const raw: unknown = entries[index];
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.trim().length === 0) {
      return failure('invalid-entry', `Watchdog entry ${index} needs a non-empty id.`);
    }
    const id = raw.id.trim();
    if (ids.has(id)) return failure('duplicate-id', `Watchdog id ${id} is duplicated.`);
    ids.add(id);
    if (typeof raw.layer !== 'number' || !Number.isInteger(raw.layer) || raw.layer < 0 || raw.layer > 5) {
      return failure('invalid-layer', `Watchdog entry ${id} layer must be an integer from zero to five.`);
    }
    if (raw.probe !== undefined && typeof raw.probe !== 'function') return failure('invalid-probe', `Watchdog entry ${id} probe must be a function.`);
    if (raw.canary !== undefined && typeof raw.canary !== 'boolean') return failure('invalid-canary', `Watchdog entry ${id} canary flag must be boolean.`);
    const entry: WatchdogEntry = {
      id,
      layer: raw.layer,
      ...(typeof raw.probe === 'function' ? { probe: raw.probe as () => ProbeResult } : {}),
      ...(raw.canary === true ? { canary: true } : {}),
    };
    normalized.push(entry);
  }

  const realOutcomes: Array<{ entry: WatchdogEntry; outcome: ProbeOutcome }> = [];
  let canaryCount = 0;
  let canaryFailed = false;
  for (const entry of normalized) {
    const outcome = runProbe(entry);
    if (entry.canary === true) {
      canaryCount += 1;
      if (outcome.status !== 'OFFLINE') canaryFailed = true;
    } else {
      realOutcomes.push({ entry, outcome });
    }
  }

  const trust: WatchdogValue['trust'] = canaryFailed ? 'CANARY-FAILED' : canaryCount > 0 ? 'TRUSTED' : 'NO-CANARY';
  const systems: WatchdogSystem[] = realOutcomes.map(({ entry, outcome }) => Object.freeze({
    id: entry.id,
    layer: entry.layer,
    status: canaryFailed ? 'NOT CHECKED' : outcome.status,
    detail: canaryFailed ? 'canary-failed' : outcome.detail,
  }));
  const counts = { ONLINE: 0, DEGRADED: 0, OFFLINE: 0, 'NOT CHECKED': 0 };
  for (const system of systems) counts[system.status] += 1;
  const value: WatchdogValue = Object.freeze({ trust, systems: Object.freeze(systems), counts: Object.freeze(counts) });
  return Object.freeze({ ok: true, value });
}
