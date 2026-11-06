declare const console: { log: (value: string) => void };
import { queueMove, legalQueueMoves, QUEUE_STATES, QueueState } from '../src/budget/queueState';

let checks = 0;
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error('FAIL: ' + label);
  checks++;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), label);
}

const MESSAGE = 'Queue state move is invalid.';
const states: QueueState[] = [
  'QUEUED', 'RUNNING', 'PAUSED', 'WAITING_FOR_OWNER', 'BLOCKED', 'COMPLETED', 'FAILED'
];

type GridResult = 'OK' | 'same-state' | 'terminal-state' | 'illegal-move' | 'bad-from' | 'bad-to';
const grid: Array<[QueueState, QueueState, GridResult]> = [
  ['QUEUED','QUEUED','same-state'],
  ['QUEUED','RUNNING','OK'],
  ['QUEUED','PAUSED','illegal-move'],
  ['QUEUED','WAITING_FOR_OWNER','OK'],
  ['QUEUED','BLOCKED','OK'],
  ['QUEUED','COMPLETED','illegal-move'],
  ['QUEUED','FAILED','illegal-move'],
  ['RUNNING','QUEUED','illegal-move'],
  ['RUNNING','RUNNING','same-state'],
  ['RUNNING','PAUSED','OK'],
  ['RUNNING','WAITING_FOR_OWNER','OK'],
  ['RUNNING','BLOCKED','OK'],
  ['RUNNING','COMPLETED','OK'],
  ['RUNNING','FAILED','OK'],
  ['PAUSED','QUEUED','illegal-move'],
  ['PAUSED','RUNNING','OK'],
  ['PAUSED','PAUSED','same-state'],
  ['PAUSED','WAITING_FOR_OWNER','illegal-move'],
  ['PAUSED','BLOCKED','OK'],
  ['PAUSED','COMPLETED','illegal-move'],
  ['PAUSED','FAILED','OK'],
  ['WAITING_FOR_OWNER','QUEUED','illegal-move'],
  ['WAITING_FOR_OWNER','RUNNING','OK'],
  ['WAITING_FOR_OWNER','PAUSED','illegal-move'],
  ['WAITING_FOR_OWNER','WAITING_FOR_OWNER','same-state'],
  ['WAITING_FOR_OWNER','BLOCKED','OK'],
  ['WAITING_FOR_OWNER','COMPLETED','illegal-move'],
  ['WAITING_FOR_OWNER','FAILED','illegal-move'],
  ['BLOCKED','QUEUED','OK'],
  ['BLOCKED','RUNNING','illegal-move'],
  ['BLOCKED','PAUSED','illegal-move'],
  ['BLOCKED','WAITING_FOR_OWNER','illegal-move'],
  ['BLOCKED','BLOCKED','same-state'],
  ['BLOCKED','COMPLETED','illegal-move'],
  ['BLOCKED','FAILED','OK'],
  ['COMPLETED','QUEUED','terminal-state'],
  ['COMPLETED','RUNNING','terminal-state'],
  ['COMPLETED','PAUSED','terminal-state'],
  ['COMPLETED','WAITING_FOR_OWNER','terminal-state'],
  ['COMPLETED','BLOCKED','terminal-state'],
  ['COMPLETED','COMPLETED','same-state'],
  ['COMPLETED','FAILED','terminal-state'],
  ['FAILED','QUEUED','terminal-state'],
  ['FAILED','RUNNING','terminal-state'],
  ['FAILED','PAUSED','terminal-state'],
  ['FAILED','WAITING_FOR_OWNER','terminal-state'],
  ['FAILED','BLOCKED','terminal-state'],
  ['FAILED','COMPLETED','terminal-state'],
  ['FAILED','FAILED','same-state']
];

function expectMove(from: unknown, to: unknown, expected: GridResult, label: string): void {
  const result = queueMove(from, to);
  if (expected === 'OK') {
    check(result.ok, label + ' succeeds');
    if (result.ok) {
      equal(result, { ok: true, value: { from, to } }, label + ' exact success value');
      check(Object.isFrozen(result), label + ' success result frozen');
      check(Object.isFrozen(result.value), label + ' success value frozen');
    }
  } else {
    check(!result.ok, label + ' fails');
    if (!result.ok) {
      equal(result, { ok: false, error: expected, message: MESSAGE }, label + ' exact failure code and message');
      check(Object.isFrozen(result), label + ' failure result frozen');
    }
  }
}

for (let i = 0; i < grid.length; i++) {
  const [from, to, expected] = grid[i];
  expectMove(from, to, expected, 'grid row ' + (i + 1) + ' ' + from + ' -> ' + to);
}
check(grid.length === 49, 'all 49 hand-worked grid rows included');

const expectedLists: Array<[QueueState, QueueState[]]> = [
  ['QUEUED', ['RUNNING','WAITING_FOR_OWNER','BLOCKED']],
  ['RUNNING', ['PAUSED','WAITING_FOR_OWNER','BLOCKED','COMPLETED','FAILED']],
  ['PAUSED', ['RUNNING','BLOCKED','FAILED']],
  ['WAITING_FOR_OWNER', ['RUNNING','BLOCKED']],
  ['BLOCKED', ['QUEUED','FAILED']],
  ['COMPLETED', []],
  ['FAILED', []]
];
for (const [from, expected] of expectedLists) {
  const result = legalQueueMoves(from);
  check(result.ok, 'legalQueueMoves ' + from + ' succeeds');
  if (result.ok) {
    equal(result.value, expected, 'legalQueueMoves ' + from + ' exact ordered list');
    check(Object.isFrozen(result), 'legalQueueMoves ' + from + ' result frozen');
    check(Object.isFrozen(result.value), 'legalQueueMoves ' + from + ' list frozen');
  }
}
check(Object.isFrozen(QUEUE_STATES), 'QUEUE_STATES frozen');
equal(QUEUE_STATES, states, 'QUEUE_STATES exact seven-state order');
check(QUEUE_STATES.length === 7, 'QUEUE_STATES has exactly seven entries');

// Input-error rows, including exact validation order and non-string inputs.
expectMove('running','COMPLETED','bad-from','lowercase from');
expectMove('RUNNING ','COMPLETED','bad-from','trailing-space from');
expectMove(42,'RUNNING','bad-from','number from');
expectMove(null,'RUNNING','bad-from','null from');
expectMove(undefined,'RUNNING','bad-from','undefined from');
const objectFrom: Record<string, unknown> = {};
expectMove(objectFrom,'RUNNING','bad-from','object from');
check(Reflect.ownKeys(objectFrom).length === 0, 'object input unchanged');
expectMove('QUEUED','Running','bad-to','wrong-case to');
expectMove('QUEUED',7,'bad-to','number to');
expectMove('QUEUED',undefined,'bad-to','missing to');
expectMove('nope','nope2','bad-from','both arguments invalid: from first');
expectMove('COMPLETED','COMPLETED','same-state','same terminal state before terminal check');
expectMove('FAILED','QUEUED','terminal-state','terminal source');
expectMove('QUEUED','COMPLETED','illegal-move','must run before complete');
expectMove('BLOCKED','RUNNING','illegal-move','blocked must re-queue');

const arrayFrom: unknown[] = [];
expectMove(arrayFrom,'RUNNING','bad-from','array from');
check(arrayFrom.length === 0, 'array input unchanged');
const symbolFrom = Symbol('state');
expectMove(symbolFrom,'RUNNING','bad-from','symbol from');
const boxedFrom = new String('QUEUED');
expectMove(boxedFrom,'RUNNING','bad-from','String object from');
check(boxedFrom.valueOf() === 'QUEUED', 'String object input unchanged');

const legalBad = legalQueueMoves('failed');
check(!legalBad.ok, 'lowercase legalQueueMoves fails');
if (!legalBad.ok) {
  equal(legalBad, { ok: false, error: 'bad-from', message: MESSAGE }, 'lowercase legalQueueMoves exact error');
  check(Object.isFrozen(legalBad), 'lowercase legalQueueMoves failure frozen');
}
const legalQueueMovesAny = legalQueueMoves as (...args: unknown[]) => ReturnType<typeof legalQueueMoves>;
const legalMissing = legalQueueMovesAny();
check(!legalMissing.ok, 'missing legalQueueMoves argument fails');
if (!legalMissing.ok) {
  equal(legalMissing, { ok: false, error: 'bad-from', message: MESSAGE }, 'missing legalQueueMoves exact error');
  check(Object.isFrozen(legalMissing), 'missing legalQueueMoves failure frozen');
}
const legalObject = legalQueueMoves({});
check(!legalObject.ok, 'object legalQueueMoves argument fails');
if (!legalObject.ok) {
  equal(legalObject, { ok: false, error: 'bad-from', message: MESSAGE }, 'object legalQueueMoves exact error');
}

// Director addition (BUD4 merge): legalQueueMoves also refuses every non-string input.
const legalBadInputs: Array<[string, unknown]> = [
  ['number', 42], ['null', null], ['undefined', undefined], ['array', ['QUEUED']],
  ['symbol', Symbol('state')], ['String object', new String('QUEUED')], ['trailing space', 'QUEUED ']
];
for (const [name, value] of legalBadInputs) {
  const result = legalQueueMoves(value);
  check(!result.ok, 'legalQueueMoves ' + name + ' fails');
  if (!result.ok) {
    equal(result, { ok: false, error: 'bad-from', message: MESSAGE }, 'legalQueueMoves ' + name + ' exact error');
    check(Object.isFrozen(result), 'legalQueueMoves ' + name + ' failure frozen');
  }
}

// Both public functions agree for every possible state pair.
let sweepPairs = 0;
for (const from of states) {
  const legal = legalQueueMoves(from);
  check(legal.ok, 'sweep legal list succeeds for ' + from);
  if (!legal.ok) throw new Error('FAIL: sweep list unexpectedly failed');
  for (const to of states) {
    const move = queueMove(from, to);
    check(move.ok === legal.value.includes(to), 'sweep agreement ' + from + ' -> ' + to);
    sweepPairs++;
  }
}
check(sweepPairs === 49, 'all 49 agreement pairs swept');

// Every non-terminal state has a path to a terminal state.
function canReachTerminal(start: QueueState): boolean {
  const pending: QueueState[] = [start];
  const seen: QueueState[] = [];
  while (pending.length > 0) {
    const current = pending.shift() as QueueState;
    if (current === 'COMPLETED' || current === 'FAILED') return true;
    if (seen.includes(current)) continue;
    seen.push(current);
    const next = legalQueueMoves(current);
    if (next.ok) for (const state of next.value) pending.push(state);
  }
  return false;
}
for (const state of states) {
  if (state !== 'COMPLETED' && state !== 'FAILED') {
    check(canReachTerminal(state), state + ' can reach a terminal state');
  }
}
function canReachCompleted(start: QueueState): boolean {
  const pending: QueueState[] = [start];
  const seen: QueueState[] = [];
  while (pending.length > 0) {
    const current = pending.shift() as QueueState;
    if (current === 'COMPLETED') return true;
    if (seen.includes(current)) continue;
    seen.push(current);
    const next = legalQueueMoves(current);
    if (next.ok) for (const state of next.value) pending.push(state);
  }
  return false;
}
check(canReachCompleted('QUEUED'), 'COMPLETED reachable from QUEUED');

console.log('QUEUE_STATE OK: ' + checks + ' checks');
