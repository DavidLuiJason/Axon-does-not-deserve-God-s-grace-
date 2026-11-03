import { appendMistakeLedger, isLedgerDate, parseMistakeLedger, serializeMistakeLedger } from '../src/safety/mistakeLedger';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }

const first = { id: 'M-001', date: '2026-11-03', mistake: 'Repeated a failed fix', correction: 'Stop after the second failure', regressionTest: 'two-strike regression case' };
assert(isLedgerDate('2024-02-29'), 'leap day should be valid');
assert(!isLedgerDate('2025-02-29'), 'non-leap February 29 should be invalid');
const empty: readonly unknown[] = Object.freeze([]);
const appended = appendMistakeLedger(empty, first);
assert(appended.ok, 'valid entry should append');
equal(empty.length, 0, 'append must not mutate original array');
equal(appended.value.length, 1, 'one entry appended');
const second = appendMistakeLedger(appended.value, { ...first, id: 'M-002', date: '2024-02-29' });
assert(second.ok, 'valid second entry should append');
equal(second.value[0]!.id, 'M-001', 'existing entry order preserved');
const missingTest = appendMistakeLedger([], { ...first, regressionTest: '  ' });
assert(!missingTest.ok && missingTest.error === 'missing-regression-test', 'regression test is mandatory');
const badDate = appendMistakeLedger([], { ...first, date: '2026-02-30' });
assert(!badDate.ok && badDate.error === 'invalid-date', 'impossible date rejected');
const duplicate = appendMistakeLedger([first], first);
assert(!duplicate.ok && duplicate.error === 'duplicate-id', 'duplicate ids rejected');
const serialized = serializeMistakeLedger(second.value);
assert(serialized.ok, 'ledger serializes');
assert(serialized.value.endsWith('\n'), 'JSONL serialization ends with newline');
const parsed = parseMistakeLedger(serialized.value);
assert(parsed.ok, 'serialized ledger parses');
equal(parsed.value.length, 2, 'round-trip entry count');
equal(parsed.value[1]!.date, '2024-02-29', 'round-trip values retained');
const damaged = parseMistakeLedger(`${serialized.value}not-json\n`);
assert(!damaged.ok && damaged.error === 'damaged-ledger' && damaged.line === 3, 'damaged line rejected with line number');
const blank = parseMistakeLedger(`${JSON.stringify(first)}\n\n`);
assert(!blank.ok && blank.error === 'damaged-ledger' && blank.line === 2, 'blank interior line rejected');
// Director additions (Batch 2 verification): century leap rule and duplicates inside a stored ledger.
{
  const base = { id: 'x1', mistake: 'm', correction: 'c', regressionTest: 'tests/x.test.ts' };
  assert(!appendMistakeLedger([], { ...base, date: '1900-02-29' }).ok, '1900 is not a leap year');
  assert(appendMistakeLedger([], { ...base, date: '2000-02-29' }).ok, '2000 is a leap year');
  const line = JSON.stringify({ ...base, date: '2026-11-03' });
  const dup = parseMistakeLedger(`${line}\n${line}\n`);
  assert(!dup.ok && dup.error === 'damaged-ledger', 'a stored ledger with a repeated id is rejected');
  assert(!serializeMistakeLedger([{ ...base, date: '2026-11-03' }, { ...base, date: '2026-11-04' }]).ok, 'serialising a repeated id is rejected');
}
console.log('PASS mistakeLedger: date, append-only, mandatory regression, duplicate, JSONL round-trip and damaged-line cases');
