type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type CapabilityWindowState = {
  readonly state: 'ACTIVE' | 'SLEEPING' | 'ENDED' | 'FROZEN';
  readonly reason: 'in-window' | 'before-start' | 'after-end' | 'frozen' | 'safe-mode';
  readonly canErase: boolean;
};

export type ApprovalWaitState = {
  readonly waitDays: number;
  readonly readyAt: number;
  readonly ready: boolean;
  readonly remainingMs: number;
};

const CAPABILITY_ERROR_MESSAGE = 'Capability window input is invalid.';
const APPROVAL_ERROR_MESSAGE = 'Approval wait input is invalid.';
const DAY_MS = 86_400_000;

function failure<T>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message });
}

function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function capabilityWindowState(input: unknown): EngineResult<CapabilityWindowState> {
  try {
    if (!isPlainObject(input)) return failure('bad-input', CAPABILITY_ERROR_MESSAGE);
    const raw = input;
    const allowed = ['kind', 'frozen', 'safeMode', 'now', 'startAt', 'endAt'];
    for (const key of Reflect.ownKeys(raw)) {
      if (typeof key !== 'string' || !allowed.includes(key)) {
        return failure('unknown-key', CAPABILITY_ERROR_MESSAGE);
      }
    }
    if (raw.kind !== 'USER' && raw.kind !== 'SYSTEM') {
      return failure('bad-kind', CAPABILITY_ERROR_MESSAGE);
    }
    if (typeof raw.frozen !== 'boolean' || typeof raw.safeMode !== 'boolean') {
      return failure('bad-flag', CAPABILITY_ERROR_MESSAGE);
    }
    const hasStart = hasOwn(raw, 'startAt');
    const hasEnd = hasOwn(raw, 'endAt');
    if (!validTime(raw.now) || (hasStart && !validTime(raw.startAt)) || (hasEnd && !validTime(raw.endAt))) {
      return failure('bad-time', CAPABILITY_ERROR_MESSAGE);
    }
    if (hasStart && hasEnd && (raw.startAt as number) >= (raw.endAt as number)) {
      return failure('bad-window', CAPABILITY_ERROR_MESSAGE);
    }

    let state: CapabilityWindowState['state'] = 'ACTIVE';
    let reason: CapabilityWindowState['reason'] = 'in-window';
    if (raw.frozen === true) {
      state = 'FROZEN';
      reason = 'frozen';
    } else if (raw.safeMode === true && raw.kind === 'USER') {
      state = 'FROZEN';
      reason = 'safe-mode';
    } else if (hasStart && (raw.now as number) < (raw.startAt as number)) {
      state = 'SLEEPING';
      reason = 'before-start';
    } else if (hasEnd && (raw.now as number) >= (raw.endAt as number)) {
      state = 'ENDED';
      reason = 'after-end';
    }
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({ state, reason, canErase: raw.kind === 'USER' }),
    });
  } catch {
    return failure('bad-input', CAPABILITY_ERROR_MESSAGE);
  }
}

export function approvalWaitState(input: unknown): EngineResult<ApprovalWaitState> {
  try {
    if (!isPlainObject(input)) return failure('bad-input', APPROVAL_ERROR_MESSAGE);
    const raw = input;
    const allowed = ['requestedAt', 'now', 'waitDays'];
    for (const key of Reflect.ownKeys(raw)) {
      if (typeof key !== 'string' || !allowed.includes(key)) {
        return failure('unknown-key', APPROVAL_ERROR_MESSAGE);
      }
    }
    if (!validTime(raw.requestedAt) || !validTime(raw.now)) {
      return failure('bad-time', APPROVAL_ERROR_MESSAGE);
    }
    const hasWaitDays = hasOwn(raw, 'waitDays');
    const waitDays = hasWaitDays ? raw.waitDays : 2;
    if (typeof waitDays !== 'number' || !Number.isSafeInteger(waitDays) || waitDays < 1 || waitDays > 30) {
      return failure('bad-wait-days', APPROVAL_ERROR_MESSAGE);
    }
    if ((raw.now as number) < (raw.requestedAt as number)) {
      return failure('clock-before-request', APPROVAL_ERROR_MESSAGE);
    }
    const readyAt = (raw.requestedAt as number) + waitDays * DAY_MS;
    const remaining = readyAt - (raw.now as number);
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        waitDays,
        readyAt,
        ready: (raw.now as number) >= readyAt,
        remainingMs: remaining > 0 ? remaining : 0,
      }),
    });
  } catch {
    return failure('bad-input', APPROVAL_ERROR_MESSAGE);
  }
}
