declare const console: { log: (value: string) => void };
import { approvalWaitState, capabilityWindowState } from '../src/capabilities/capabilityWindow';

let checks = 0;
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error('FAIL: ' + label);
  checks++;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), label);
}
function verifyCall<T>(fn: (input: unknown) => T, input: unknown, label: string): T {
  const before = JSON.stringify(input);
  const first = fn(input);
  const after = JSON.stringify(input);
  const second = fn(input);
  check(before === after, label + ' input unchanged');
  equal(first, second, label + ' deterministic repeat');
  check(Object.isFrozen(first), label + ' result frozen');
  const inspected = first as any;
  if (inspected !== null && typeof inspected === 'object' && inspected.ok === true) {
    check(Object.isFrozen(inspected.value), label + ' value frozen');
  }
  return first;
}
function expectWindow(input: unknown, state: string, reason: string, canErase: boolean, label: string): void {
  const result = verifyCall(capabilityWindowState, input, label) as any;
  check(result.ok === true, label + ' succeeds');
  equal(result.value, { state, reason, canErase }, label + ' exact value');
}
function expectWait(input: unknown, value: unknown, label: string): void {
  const result = verifyCall(approvalWaitState, input, label) as any;
  check(result.ok === true, label + ' succeeds');
  equal(result.value, value, label + ' exact value');
}
function expectError(fn: (input: unknown) => any, input: unknown, code: string, message: string, label: string): void {
  const result = verifyCall(fn, input, label);
  check(result.ok === false, label + ' fails');
  check(result.error === code, label + ' exact error code');
  check(result.message === message, label + ' fixed error message');
}

const BASE = { kind: 'USER', frozen: false, safeMode: false, now: 1000 };
const CW = 'Capability window input is invalid.';
const AW = 'Approval wait input is invalid.';

// Every hand-worked capability-window success case C1-C17 is literal.
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000 }, 'ACTIVE', 'in-window', true, 'C1 no window at all');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000, startAt: 2000 }, 'SLEEPING', 'before-start', true, 'C2 before the start');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000, startAt: 1000 }, 'ACTIVE', 'in-window', true, 'C3 exactly at start');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000, startAt: 500, endAt: 2000 }, 'ACTIVE', 'in-window', true, 'C4 inside a window');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000, endAt: 1000 }, 'ENDED', 'after-end', true, 'C5 exactly at end');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000, startAt: 100, endAt: 900 }, 'ENDED', 'after-end', true, 'C6 long past end');
expectWindow({ kind: 'USER', frozen: true, safeMode: false, now: 1000, startAt: 2000 }, 'FROZEN', 'frozen', true, 'C7 frozen beats sleeping');
expectWindow({ kind: 'USER', frozen: false, safeMode: true, now: 1000 }, 'FROZEN', 'safe-mode', true, 'C8 safe mode freezes USER');
expectWindow({ kind: 'SYSTEM', frozen: false, safeMode: true, now: 1000 }, 'ACTIVE', 'in-window', false, 'C9 safe mode leaves SYSTEM');
expectWindow({ kind: 'SYSTEM', frozen: true, safeMode: false, now: 1000 }, 'FROZEN', 'frozen', false, 'C10 frozen SYSTEM');
expectWindow({ kind: 'USER', frozen: true, safeMode: false, now: 1000, startAt: 100, endAt: 900 }, 'FROZEN', 'frozen', true, 'C11 frozen beats ended');
expectWindow({ kind: 'USER', frozen: true, safeMode: true, now: 1000 }, 'FROZEN', 'frozen', true, 'C12 frozen reason precedence');
expectWindow({ kind: 'USER', frozen: false, safeMode: true, now: 1000, startAt: 2000 }, 'FROZEN', 'safe-mode', true, 'C13 safe mode beats sleeping');
expectWindow({ kind: 'SYSTEM', frozen: false, safeMode: false, now: 1000, startAt: 5000 }, 'SLEEPING', 'before-start', false, 'C14 SYSTEM sleeping');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 0, startAt: 0 }, 'ACTIVE', 'in-window', true, 'C15 zero start');
expectWindow({ kind: 'USER', frozen: false, safeMode: false, now: 1000, endAt: 1001 }, 'ACTIVE', 'in-window', true, 'C16 one tick before end');
expectWindow({ kind: 'SYSTEM', frozen: false, safeMode: false, now: 1000, endAt: 500 }, 'ENDED', 'after-end', false, 'C17 SYSTEM ended');

// Every hand-worked capability-window error case D1-D16 is literal.
expectError(capabilityWindowState, null, 'bad-input', CW, 'D1 null');
expectError(capabilityWindowState, [], 'bad-input', CW, 'D2 array');
expectError(capabilityWindowState, { ...BASE, extra: 1 }, 'unknown-key', CW, 'D3 unknown key');
expectError(capabilityWindowState, { ...BASE, confidence: 0.9 }, 'unknown-key', CW, 'D4 confidence key');
expectError(capabilityWindowState, { ...BASE, kind: 'user' }, 'bad-kind', CW, 'D5 lower-case kind');
expectError(capabilityWindowState, { ...BASE, frozen: 'no' }, 'bad-flag', CW, 'D6 frozen not boolean');
expectError(capabilityWindowState, { kind: 'USER', frozen: false, now: 1000 }, 'bad-flag', CW, 'D7 safeMode missing');
expectError(capabilityWindowState, { ...BASE, now: -1 }, 'bad-time', CW, 'D8 negative now');
expectError(capabilityWindowState, { ...BASE, now: 1.5 }, 'bad-time', CW, 'D9 fractional now');
expectError(capabilityWindowState, { kind: 'USER', frozen: false, safeMode: false }, 'bad-time', CW, 'D10 now missing');
expectError(capabilityWindowState, { ...BASE, startAt: undefined }, 'bad-time', CW, 'D11 startAt undefined');
expectError(capabilityWindowState, { ...BASE, startAt: -1 }, 'bad-time', CW, 'D12 startAt negative');
expectError(capabilityWindowState, { ...BASE, startAt: null }, 'bad-time', CW, 'D13 startAt null');
expectError(capabilityWindowState, { ...BASE, endAt: '9' }, 'bad-time', CW, 'D14 endAt string');
expectError(capabilityWindowState, { ...BASE, startAt: 5, endAt: 5 }, 'bad-window', CW, 'D15 start equals end');
expectError(capabilityWindowState, { ...BASE, startAt: 9, endAt: 5 }, 'bad-window', CW, 'D16 start after end');
const symbolWindow = { ...BASE } as Record<PropertyKey, unknown>;
symbolWindow[Symbol('unexpected')] = 1;
expectError(capabilityWindowState, symbolWindow, 'unknown-key', CW, 'symbol key rejected');

// Every hand-worked approval-wait success case T1-T7 is literal.
expectWait({ requestedAt: 0, now: 0 }, { waitDays: 2, readyAt: 172800000, ready: false, remainingMs: 172800000 }, 'T1 default two days');
expectWait({ requestedAt: 0, now: 172799999 }, { waitDays: 2, readyAt: 172800000, ready: false, remainingMs: 1 }, 'T2 one millisecond early');
expectWait({ requestedAt: 0, now: 172800000 }, { waitDays: 2, readyAt: 172800000, ready: true, remainingMs: 0 }, 'T3 exactly ready');
expectWait({ requestedAt: 1000, now: 2592001000, waitDays: 30 }, { waitDays: 30, readyAt: 2592001000, ready: true, remainingMs: 0 }, 'T4 thirty days');
expectWait({ requestedAt: 100, now: 999999999, waitDays: 1 }, { waitDays: 1, readyAt: 86400100, ready: true, remainingMs: 0 }, 'T5 one day long after');
expectWait({ requestedAt: 0, now: 1 }, { waitDays: 2, readyAt: 172800000, ready: false, remainingMs: 172799999 }, 'T6 just after request');
expectWait({ requestedAt: 0, now: 216000000, waitDays: 5 }, { waitDays: 5, readyAt: 432000000, ready: false, remainingMs: 216000000 }, 'T7 five days halfway');

// Every hand-worked approval-wait error case E1-E10 is literal.
expectError(approvalWaitState, { requestedAt: 0, now: 5, waitDays: 31 }, 'bad-wait-days', AW, 'E1 31 days');
expectError(approvalWaitState, { requestedAt: 0, now: 5, waitDays: 0 }, 'bad-wait-days', AW, 'E2 zero days');
expectError(approvalWaitState, { requestedAt: 0, now: 5, waitDays: 1.5 }, 'bad-wait-days', AW, 'E3 fractional days');
expectError(approvalWaitState, { requestedAt: 10, now: 5 }, 'clock-before-request', AW, 'E4 clock before request');
expectError(approvalWaitState, { requestedAt: 0, now: 1, waitDays: null }, 'bad-wait-days', AW, 'E5 null days');
expectError(approvalWaitState, { requestedAt: 0, now: 1, x: 1 }, 'unknown-key', AW, 'E6 unknown key');
expectError(approvalWaitState, { requestedAt: -1, now: 1 }, 'bad-time', AW, 'E7 negative request time');
expectError(approvalWaitState, { requestedAt: 0 }, 'bad-time', AW, 'E8 now missing');
expectError(approvalWaitState, [], 'bad-input', AW, 'E9 array');
expectError(approvalWaitState, { requestedAt: 0, now: 1, waitDays: '2' }, 'bad-wait-days', AW, 'E10 string days');
const symbolWait = { requestedAt: 0, now: 1 } as Record<PropertyKey, unknown>;
symbolWait[Symbol('unexpected')] = 1;
expectError(approvalWaitState, symbolWait, 'unknown-key', AW, 'approval symbol key rejected');

// Validation order and present-but-undefined/null behavior.
expectError(capabilityWindowState, { ...BASE, kind: 'bad', extra: 1 }, 'unknown-key', CW, 'unknown key precedes kind');
expectError(capabilityWindowState, { ...BASE, kind: 'bad', frozen: 'x' }, 'bad-kind', CW, 'kind precedes flag');
expectError(capabilityWindowState, { ...BASE, frozen: 'x', now: -1 }, 'bad-flag', CW, 'flag precedes time');
expectError(capabilityWindowState, { ...BASE, now: -1, startAt: 5, endAt: 5 }, 'bad-time', CW, 'time precedes bad window');
expectError(approvalWaitState, { requestedAt: -1, now: 0, waitDays: 0, x: 1 }, 'unknown-key', AW, 'unknown precedes time');
expectError(approvalWaitState, { requestedAt: -1, now: 0, waitDays: 0 }, 'bad-time', AW, 'time precedes wait days');

console.log('CAPABILITY_WINDOW OK: ' + checks + ' checks');
