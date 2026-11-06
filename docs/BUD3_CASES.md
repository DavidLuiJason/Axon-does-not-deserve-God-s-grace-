# BUD3 CASES (Director, 2026-11-06). Part of the BUD3 prompt; do not return this file.

Worked from the rules in the prompt, then checked by two separate references (one in Python, one in TypeScript, written independently); they agree on all 133 calls below and on a sweep of 2,500 values. Rows are written as TypeScript literals: copy the expected values into your test as your own literals (never by calling a copy of the engine). `rec(domain, resource, measured, reported, limitEvents, safeHigh, limitLow, lastDate)` is a helper YOU write in the test: it returns the 13-field record with provider 'local', model 'weak', account 'owner', taskClass 'chat', workloadShape 'short', keys in the exact order of `ProbeRecord`.

## Table values (one table, HYPOTHESES the owner may change)
`probePercent` 10; `labelMax` 64; `amountMax` 1000000000000 (1e12). The sample minimum is NOT copied: it is `BUDGET_VIEW_TABLE.sampleMinimum` (5). Probe size: `maxAmount = floor(safeHigh * probePercent / 100)` in whole numbers; a probe needs `maxAmount >= 1`.

## Reading the rules in one place
Outcome order for planProbe, first match wins: CONFLICT (`limitLow` not null and `safeHigh` not null and `limitLow <= safeHigh`), NOT-NEEDED (`measured >= sampleMinimum`; REPORTED samples never count), NEEDS-OWNER-YES (resource flagged ownerCost AND `ownerYes` false), NO-RANGE (`safeHigh` null or maxAmount below 1), else PROBE with maxAmount. Only PROBE has a number; every other outcome has `maxAmount: null`.

### A. newProbeRecord (id | input => expected)
```
N1 | {domain: 'TASK', resource: 'steps', provider: 'local', model: 'weak', account: 'owner', taskClass: 'chat', workloadShape: 'short'} => OK rec('TASK', 'steps', 0, 0, 0, null, null, null)
N2 | {domain: 'ACCOUNT', resource: 'aiCalls', provider: 'p', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => OK (the 7 input labels, then measured 0, reported 0, limitEvents 0, safeHigh null, limitLow null, lastDate null)
N3 | {domain: 'TASK', resource: 'steps', provider: 'x'.repeat(64), model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => OK (the 7 input labels, then measured 0, reported 0, limitEvents 0, safeHigh null, limitLow null, lastDate null)
N4 | {domain: 'TASK', resource: 'steps', provider: 'x'.repeat(65), model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-label
N5 | {domain: 'TASK', resource: 'steps', provider: '', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-label
N6 | {domain: 'TASK', resource: 'steps', provider: ' x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-label
N7 | {domain: 'TASK', resource: 'steps', provider: 'x', model: 'm ', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-label
N8 | {domain: 'TASK', resource: 'steps', provider: 'x', model: 'm', account: 5, taskClass: 't', workloadShape: 'w'} => FAIL bad-label
N9 | {domain: 'TASK', resource: 'steps', provider: 'x', model: 'm', account: 'a', taskClass: 't'} => FAIL bad-label
N10 | {domain: 'TASK', resource: 'ramMb', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-resource
N11 | {domain: 'TASK', resource: 'nope', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-resource
N12 | {domain: 'TASK', resource: 'constructor', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-resource
N13 | {domain: 'TASK', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-resource
N14 | {domain: 'task', resource: 'steps', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-domain
N15 | {domain: 5, resource: 'steps', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-domain
N16 | {resource: 'steps', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-domain
N17 | {domain: 'nope', resource: 'nope', provider: '', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-domain
N18 | {domain: 'TASK', resource: 'nope', provider: '', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w'} => FAIL bad-resource
N19 | {domain: 'DEVICE', resource: 'networkMb', provider: 'x', model: 'm', account: 'a', taskClass: 't', workloadShape: 'w', extra: 1} => OK (the 7 input labels, then measured 0, reported 0, limitEvents 0, safeHigh null, limitLow null, lastDate null)
```
N19 has an extra key `extra`: it is ignored and does NOT appear in the record.

### B. recordSample (id | input => expected); E = rec('TASK','steps',0,0,0,null,null,null)
```
S1 | {record: E, sample: {kind: 'ran', amount: 20, date: '2026-11-01', source: 'MEASURED'}} => OK rec('TASK', 'steps', 1, 0, 0, 20, null, '2026-11-01')
S2 | {record: rec('TASK', 'steps', 1, 0, 0, 20, null, '2026-11-01'), sample: {kind: 'ran', amount: 10, date: '2026-10-30', source: 'MEASURED'}} => OK rec('TASK', 'steps', 2, 0, 0, 20, null, '2026-11-01')
S3 | {record: rec('TASK', 'steps', 2, 0, 0, 20, null, '2026-11-01'), sample: {kind: 'ran', amount: 50, date: '2026-11-06', source: 'REPORTED'}} => OK rec('TASK', 'steps', 2, 1, 0, 50, null, '2026-11-06')
S4 | {record: rec('TASK', 'steps', 2, 1, 0, 50, null, '2026-11-06'), sample: {kind: 'limit', amount: 80, date: '2026-11-05', source: 'REPORTED'}} => OK rec('TASK', 'steps', 2, 1, 1, 50, 80, '2026-11-06')
S5 | {record: rec('TASK', 'steps', 2, 1, 1, 50, 80, '2026-11-06'), sample: {kind: 'limit', amount: 60, date: '2026-11-06', source: 'REPORTED'}} => OK rec('TASK', 'steps', 2, 1, 2, 50, 60, '2026-11-06')
S6 | {record: rec('TASK', 'steps', 2, 1, 1, 50, 80, '2026-11-06'), sample: {kind: 'limit', amount: 90, date: '2026-11-07', source: 'REPORTED'}} => OK rec('TASK', 'steps', 2, 1, 2, 50, 80, '2026-11-07')
S7 | {record: rec('TASK', 'steps', 2, 1, 1, 50, 80, '2026-11-06'), sample: {kind: 'ran', amount: 30, date: '2026-11-06', source: 'MEASURED'}} => OK rec('TASK', 'steps', 3, 1, 1, 50, 80, '2026-11-06')
S8 | {record: rec('TASK', 'steps', 2, 1, 2, 50, 60, '2026-11-06'), sample: {kind: 'limit', amount: 90, date: '2026-11-04', source: 'REPORTED'}} => OK rec('TASK', 'steps', 2, 1, 3, 50, 60, '2026-11-06')
S9 | {record: E, sample: {kind: 'limit', amount: 40, date: '2026-11-02', source: 'REPORTED'}} => OK rec('TASK', 'steps', 0, 0, 1, null, 40, '2026-11-02')
S10 | {record: E, sample: {kind: 'ran', amount: 1e12, date: '2026-11-02', source: 'MEASURED'}} => OK rec('TASK', 'steps', 1, 0, 0, 1e12, null, '2026-11-02')
S11 | {record: E, sample: {kind: 'ran', amount: 1, date: '2026-02-31', source: 'REPORTED'}} => OK rec('TASK', 'steps', 0, 1, 0, 1, null, '2026-02-31')
S12 | {record: E, sample: {kind: 'ran', amount: 1, date: '2026-11-02', source: 'MEASURED'}} => OK rec('TASK', 'steps', 1, 0, 0, 1, null, '2026-11-02')
S20 | {record: E, sample: {kind: 'limit', amount: 40, date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S21 | {record: E, sample: {kind: 'ran', amount: 0, date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S22 | {record: E, sample: {kind: 'ran', amount: -1, date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S23 | {record: E, sample: {kind: 'ran', amount: 1.5, date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S24 | {record: E, sample: {kind: 'ran', amount: '5', date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S25 | {record: E, sample: {kind: 'ran', amount: 1e12 + 1, date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S30 | {record: E, sample: {kind: 'RAN', amount: 5, date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S31 | {record: E, sample: {kind: 'ran', amount: 5, date: '2026-11-02', source: 'measured'}} => FAIL bad-sample
S32 | {record: E, sample: {kind: 'ran', date: '2026-11-02', source: 'MEASURED'}} => FAIL bad-sample
S33 | {record: E, sample: {amount: 5, date: '2026-11-02', source: 'MEASURED', kind: 'ran', extra: 9}} => OK rec('TASK', 'steps', 1, 0, 0, 5, null, '2026-11-02')
```
S3d (ten bad dates, each with E and `{kind:'ran', amount:5, source:'MEASURED'}`, each FAIL bad-sample): '2026-13-01', '2026-00-10', '2026-11-32', '2026-11-00', '2026/11/01', '26-11-01', '2026-1-01', '', '2026-11-011', '2026-1a-01'.
Date rule: 10 characters, digits except `-` at positions 4 and 7, month 01 to 12, day 01 to 31; NOT calendar-checked (`2026-02-31` is accepted, S11; HYPOTHESIS).

### C. bad records (16 records, all with ownerYes true or sample `{kind:'ran',amount:5,date:'2026-11-02',source:'MEASURED'}`): every one gives FAIL bad-record from BOTH recordSample and planProbe
```
B1 | rec('TASK', 'steps', -1, 0, 0, null, null, null)
B2 | rec('TASK', 'steps', 1, 0, 0, null, null, null)
B3 | rec('TASK', 'steps', 1, 0, 0, 10, null, null)
B4 | rec('TASK', 'steps', 1, 0, 0, 10, 5, '2026-11-01')
B5 | rec('TASK', 'steps', 0, 0, 1, null, null, null)
B6 | rec('TASK', 'steps', 0, 0, 1, null, 5, null)
B7 | rec('TASK', 'steps', 0, 0, 1, 3, 5, '2026-11-01')
B8 | rec('TASK', 'steps', 1, 0, 0, 0, null, '2026-11-01')
B9 | rec('task', 'steps', 0, 0, 0, null, null, null)
B10 | rec('TASK', 'ramMb', 0, 0, 0, null, null, null)
B11 | {domain: 'TASK', resource: 'steps', provider: '', model: 'weak', account: 'owner', taskClass: 'chat', workloadShape: 'short', measured: 0, reported: 0, limitEvents: 0, safeHigh: null, limitLow: null, lastDate: null}
B12 | rec('TASK', 'steps', 1.5, 0, 0, 5, null, '2026-11-01')
B13 | rec('TASK', 'steps', 1, 0, 0, 5, null, '2026-11-32')
B14 | rec('TASK', 'steps', 1, 0, 0, 5, null, null)
B15 | rec('TASK', 'steps', 0, 0, 0, 5, null, null)
B16 | rec('TASK', 'steps', 0, 0, 0, null, null, '2026-11-01')
```

### D. planProbe (id | record => ownerYes false ; ownerYes true). Rows P1 to P21 with `both` have the same result for false and true
```
P1 | rec('TASK', 'steps', 0, 0, 0, null, null, null) => both OK {outcome: 'NO-RANGE', maxAmount: null, measured: 0, reported: 0, ownerCost: false}
P2 | rec('TASK', 'steps', 2, 0, 0, 100, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 10, measured: 2, reported: 0, ownerCost: false}
P3 | rec('TASK', 'steps', 2, 0, 0, 99, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 9, measured: 2, reported: 0, ownerCost: false}
P4 | rec('TASK', 'steps', 2, 0, 0, 10, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 1, measured: 2, reported: 0, ownerCost: false}
P5 | rec('TASK', 'steps', 2, 0, 0, 9, null, '2026-11-01') => both OK {outcome: 'NO-RANGE', maxAmount: null, measured: 2, reported: 0, ownerCost: false}
P6 | rec('TASK', 'steps', 5, 0, 0, 100, null, '2026-11-01') => both OK {outcome: 'NOT-NEEDED', maxAmount: null, measured: 5, reported: 0, ownerCost: false}
P7 | rec('TASK', 'steps', 4, 3, 0, 100, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 10, measured: 4, reported: 3, ownerCost: false}
P8 | rec('TASK', 'steps', 0, 2, 0, 100, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 10, measured: 0, reported: 2, ownerCost: false}
P9 | rec('ACCOUNT', 'aiCalls', 0, 2, 0, 100, null, '2026-11-01') => false OK {outcome: 'NEEDS-OWNER-YES', maxAmount: null, measured: 0, reported: 2, ownerCost: true} ; true OK {outcome: 'PROBE', maxAmount: 10, measured: 0, reported: 2, ownerCost: true}
P10 | rec('DEVICE', 'ramMb', 1, 0, 0, 100, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 10, measured: 1, reported: 0, ownerCost: false}
P11 | rec('DEVICE', 'networkMb', 1, 0, 0, 100, null, '2026-11-01') => false OK {outcome: 'NEEDS-OWNER-YES', maxAmount: null, measured: 1, reported: 0, ownerCost: true} ; true OK {outcome: 'PROBE', maxAmount: 10, measured: 1, reported: 0, ownerCost: true}
P12 | rec('ACCOUNT', 'aiCalls', 5, 0, 0, 100, null, '2026-11-01') => both OK {outcome: 'NOT-NEEDED', maxAmount: null, measured: 5, reported: 0, ownerCost: true}
P13 | rec('TASK', 'steps', 2, 0, 1, 50, 50, '2026-11-01') => both OK {outcome: 'CONFLICT', maxAmount: null, measured: 2, reported: 0, ownerCost: false}
P14 | rec('TASK', 'steps', 2, 0, 1, 50, 51, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 5, measured: 2, reported: 0, ownerCost: false}
P15 | rec('TASK', 'steps', 2, 0, 1, 50, 40, '2026-11-01') => both OK {outcome: 'CONFLICT', maxAmount: null, measured: 2, reported: 0, ownerCost: false}
P16 | rec('TASK', 'steps', 5, 0, 1, 50, 40, '2026-11-01') => both OK {outcome: 'CONFLICT', maxAmount: null, measured: 5, reported: 0, ownerCost: false}
P17 | rec('ACCOUNT', 'turns', 1, 0, 2, 50, 40, '2026-11-01') => both OK {outcome: 'CONFLICT', maxAmount: null, measured: 1, reported: 0, ownerCost: true}
P18 | rec('TASK', 'steps', 0, 0, 1, null, 30, '2026-11-01') => both OK {outcome: 'NO-RANGE', maxAmount: null, measured: 0, reported: 0, ownerCost: false}
P19 | rec('BUILDER', 'repoFiles', 0, 1, 0, 4000, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 400, measured: 0, reported: 1, ownerCost: false}
P20 | rec('BUILDER', 'testMinutes', 3, 0, 0, 60, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 6, measured: 3, reported: 0, ownerCost: false}
P21 | rec('TASK', 'steps', 2, 0, 0, 1e12, null, '2026-11-01') => both OK {outcome: 'PROBE', maxAmount: 100000000000, measured: 2, reported: 0, ownerCost: false}
```
Value shape: `{outcome, maxAmount, measured, reported, ownerCost}`; maxAmount is a number only for PROBE, else null.

### E. planProbe bad inputs (id | input => expected); E as above
```
X1 | {record: E} => FAIL bad-owner-yes
X2 | {record: E, ownerYes: 'true'} => FAIL bad-owner-yes
X3 | {record: E, ownerYes: 1} => FAIL bad-owner-yes
X4 | {record: E, ownerYes: null} => FAIL bad-owner-yes
X5 | {ownerYes: true} => FAIL bad-record
X6 | {record: null, ownerYes: true} => FAIL bad-record
X7 | {record: [], ownerYes: true} => FAIL bad-record
X8 | {record: rec('TASK', 'steps', -1, 0, 0, null, null, null), ownerYes: 'x'} => FAIL bad-record
```
## F. Special inputs (not expressible as plain literals; each is a required check)
- All three functions: `undefined`, `null`, `[]`, `'x'`, `5` give FAIL bad-input.
- newProbeRecord with domain `'constructor'`, `'__proto__'` or `'toString'` gives FAIL bad-domain; with resource `'constructor'`, `'__proto__'` or `'toString'` (domain TASK) gives FAIL bad-resource (own names only).
- recordSample with E and amount `NaN`, `Infinity`, `-Infinity`, `true` gives FAIL bad-sample.
- recordSample and planProbe with a record whose `measured` is `NaN`, or whose `safeHigh` is `Infinity` (other fields consistent), give FAIL bad-record.
- planProbe with E and ownerYes `undefined`, `null`, `'true'`, `1` give FAIL bad-owner-yes.
- ORDER: bad input beats everything; for recordSample a bad record plus a bad sample gives bad-record; for planProbe a bad record plus a bad ownerYes gives bad-record (X8); for newProbeRecord a bad domain plus a bad resource gives bad-domain (N17) and a bad resource plus a bad label gives bad-resource (N18).

## G. Integration rows (build the record with newProbeRecord and recordSample, then planProbe; all labels 'local','weak','owner','chat','short')
1. TASK steps, four recordSample `ran` MEASURED: (20, '2026-11-01'), (40, '2026-11-02'), (30, '2026-11-03'), (100, '2026-11-04'). Record: `rec('TASK','steps',4,0,0,100,null,'2026-11-04')`. planProbe ownerYes false: `{outcome:'PROBE', maxAmount:10, measured:4, reported:0, ownerCost:false}`.
2. Add a fifth `ran` MEASURED (60, '2026-11-05'): `rec('TASK','steps',5,0,0,100,null,'2026-11-05')`; planProbe: `{outcome:'NOT-NEEDED', maxAmount:null, measured:5, reported:0, ownerCost:false}`.
3. ACCOUNT aiCalls, five `ran` REPORTED: (50, '2026-11-01'), (60, '2026-11-02'), (70, '2026-11-03'), (80, '2026-11-04'), (90, '2026-11-05'). Record: `rec('ACCOUNT','aiCalls',0,5,0,90,null,'2026-11-05')`. planProbe ownerYes false: `{outcome:'NEEDS-OWNER-YES', maxAmount:null, measured:0, reported:5, ownerCost:true}`; ownerYes true: `{outcome:'PROBE', maxAmount:9, measured:0, reported:5, ownerCost:true}` (five REPORTED samples are still not OBSERVED).
4. Add a `limit` REPORTED (85, '2026-11-06'): `rec('ACCOUNT','aiCalls',0,5,1,90,85,'2026-11-06')`; planProbe ownerYes true: `{outcome:'CONFLICT', maxAmount:null, measured:0, reported:5, ownerCost:true}`.

## H. Sweep and property
TASK steps, `measured 2`, `reported 0`, `limitEvents 0`, `safeHigh h`, `limitLow null`, lastDate '2026-11-01', ownerYes false, for h = 1 to 2500: h 1 to 9 gives NO-RANGE; h from 10 gives PROBE with `maxAmount = floor(h / 10)`. Property for every PROBE in the sweep: `maxAmount * 100 <= h * 10` and `(maxAmount + 1) * 100 > h * 10` (a probe never exceeds the fraction, and is the largest that does not).

## I. Closed-set facts used by planProbe (from `src/budget/resources/`, read-only)
ownerCost is true for DEVICE `networkMb` and for every ACCOUNT resource (aiCalls, turns, contextChars, attachments); false for all others. The domain's own names are the only resources a record may name.
