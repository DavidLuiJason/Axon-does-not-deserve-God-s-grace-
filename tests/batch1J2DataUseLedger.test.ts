import assert from 'node:assert/strict';
import { applyUsageRetention, isUsageDate, recordUsage, rollupUsage, usageDateOffset, type UsageDailyRecord } from '../src/tools/engines/data/dataUseLedger';

assert.equal(isUsageDate('2024-02-29'), true);
assert.equal(isUsageDate('2023-02-29'), false);
assert.equal(isUsageDate('2024-13-01'), false);
assert.equal(usageDateOffset('2024-02-28', 1), '2024-02-29');
assert.equal(usageDateOffset('2024-02-29', 1), '2024-03-01');
assert.equal(usageDateOffset('9999-12-31', 1), null);
let ledger: UsageDailyRecord[] = [];
for (let i = 0; i < 400; i += 1) {
  const date = usageDateOffset('2023-01-01', i);
  assert.ok(date);
  const entry = recordUsage(ledger, { date, source: 'axon-web', receivedBytes: i + 1, sentBytes: (i + 1) * 2 });
  assert.equal(entry.ok, true);
  if (entry.ok) ledger = entry.value;
}
assert.equal(ledger.length, 400);
const year = rollupUsage(ledger, 'year');
assert.equal(year.ok, true);
if (year.ok) {
  const totalReceived = year.value.reduce((sum, row) => sum + row.receivedBytes, 0);
  const totalSent = year.value.reduce((sum, row) => sum + row.sentBytes, 0);
  assert.equal(totalReceived, 80_200);
  assert.equal(totalSent, 160_400);
  assert.equal(year.value.reduce((sum, row) => sum + row.totalBytes, 0), 240_600);
  assert.deepEqual(year.value.map((row) => row.period), ['2023', '2024']);
  assert.equal(year.value.reduce((sum, row) => sum + row.activeDays, 0), 400);
}
const monthly = rollupUsage(ledger, 'month');
assert.equal(monthly.ok, true);
if (monthly.ok) {
  assert.equal(monthly.value[0]?.period, '2023-01');
  assert.equal(monthly.value.at(-1)?.period, '2024-02');
  assert.equal(monthly.value.reduce((sum, row) => sum + row.recordCount, 0), 400);
}
const leapSample = recordUsage([], { date: '2024-02-29', source: 'axon-web', receivedBytes: 7, sentBytes: 11 });
assert.equal(leapSample.ok, true);
if (leapSample.ok) assert.deepEqual(leapSample.value, [{ date: '2024-02-29', source: 'axon-web', receivedBytes: 7, sentBytes: 11 }]);
const duplicate = recordUsage([], { date: '2026-11-03', source: 'browser', receivedBytes: 10, sentBytes: 5 });
assert.equal(duplicate.ok, true);
const merged = duplicate.ok ? recordUsage(duplicate.value, { date: '2026-11-03', source: 'browser', receivedBytes: 2, sentBytes: 3 }) : duplicate;
assert.equal(merged.ok, true);
if (merged.ok) assert.deepEqual(merged.value, [{ date: '2026-11-03', source: 'browser', receivedBytes: 12, sentBytes: 8 }]);
const retained = applyUsageRetention(ledger, '2024-02-04', 30);
assert.equal(retained.ok, true);
if (retained.ok) {
  assert.equal(retained.value.length, 30);
  assert.equal(retained.value[0]?.date, '2024-01-06');
  assert.equal(retained.value.at(-1)?.date, '2024-02-04');
}
assert.equal(recordUsage([], { date: '2023-02-29', source: 'x', receivedBytes: 1, sentBytes: 1 }).ok, false);
const sparse: UsageDailyRecord[] = new Array(1);
assert.equal(rollupUsage(sparse, 'month').ok, false, 'sparse record arrays are rejected');
assert.equal(recordUsage([], { date: '2024-01-01', source: 'x', receivedBytes: -1, sentBytes: 1 }).ok, false);
const maxed = recordUsage([], { date: '2024-01-01', source: 'x', receivedBytes: Number.MAX_SAFE_INTEGER, sentBytes: 0 });
assert.equal(maxed.ok, true);
const overflow = maxed.ok ? recordUsage(maxed.value, { date: '2024-01-01', source: 'x', receivedBytes: 1, sentBytes: 0 }) : maxed;
assert.equal(overflow.ok, false);
console.log('BATCH1 J2: 400 synthetic daily records; leap day, monthly/yearly totals and 30-day retention passed');
