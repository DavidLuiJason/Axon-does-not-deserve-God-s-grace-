type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type QueueState = 'QUEUED'|'RUNNING'|'PAUSED'|'WAITING_FOR_OWNER'|'BLOCKED'|'COMPLETED'|'FAILED';

export const QUEUE_STATES: readonly QueueState[] = Object.freeze([
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'WAITING_FOR_OWNER',
  'BLOCKED',
  'COMPLETED',
  'FAILED'
]);

const ERROR_MESSAGE = 'Queue state move is invalid.';

const ALLOWED_MOVES: Readonly<Record<QueueState, readonly QueueState[]>> = Object.freeze({
  QUEUED: Object.freeze(['RUNNING', 'WAITING_FOR_OWNER', 'BLOCKED'] as QueueState[]),
  RUNNING: Object.freeze(['PAUSED', 'WAITING_FOR_OWNER', 'BLOCKED', 'COMPLETED', 'FAILED'] as QueueState[]),
  PAUSED: Object.freeze(['RUNNING', 'BLOCKED', 'FAILED'] as QueueState[]),
  WAITING_FOR_OWNER: Object.freeze(['RUNNING', 'BLOCKED'] as QueueState[]),
  BLOCKED: Object.freeze(['QUEUED', 'FAILED'] as QueueState[]),
  COMPLETED: Object.freeze([] as QueueState[]),
  FAILED: Object.freeze([] as QueueState[])
});

function isQueueState(value: unknown): value is QueueState {
  return typeof value === 'string' && QUEUE_STATES.includes(value as QueueState);
}

function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: ERROR_MESSAGE });
}

function success<T>(value: T): EngineResult<T> {
  return Object.freeze({ ok: true as const, value });
}

export function queueMove(from: unknown, to: unknown): EngineResult<{ readonly from: QueueState; readonly to: QueueState }> {
  if (!isQueueState(from)) return failure('bad-from');
  if (!isQueueState(to)) return failure('bad-to');
  if (from === to) return failure('same-state');
  if (from === 'COMPLETED' || from === 'FAILED') return failure('terminal-state');
  if (!ALLOWED_MOVES[from].includes(to)) return failure('illegal-move');

  return success(Object.freeze({ from, to }));
}

export function legalQueueMoves(from: unknown): EngineResult<readonly QueueState[]> {
  if (!isQueueState(from)) return failure('bad-from');
  return success(ALLOWED_MOVES[from]);
}
