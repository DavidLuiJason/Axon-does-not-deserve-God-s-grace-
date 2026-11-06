# BUD2 CASES (Director, 2026-11-06). Part of the BUD2 prompt; do not return this file.

Worked by hand from the rules in the prompt, then checked by two separate references (one in Python, one in TypeScript); they agree on every row. A state is written as a literal `BudgetState` (the engine type, which now has `samples`). `request` is a resource vector. Result words: OUTCOME; reasons as `code@resource` in the fixed order (resources A to Z; within a resource: overrun, over-budget, no-figure, estimate-only, margin, reserve-only); basis per requested resource with a figure (resource, ESTIMATE or OBSERVED, sample count), resources A to Z; ownerCost yes or no. A request amount of 0 is skipped.

## Table values (one table, HYPOTHESES the owner may change)
`sampleMinimum` 5; `smallRequestPercent` 10; `marginPercent` 20 for each of DEVICE, TASK, ACCOUNT, BUILDER. Margin test: `after * 100 < capacity * marginPercent` (strict, whole-number arithmetic, no decimals). Small request: `amount * 100 <= capacity * smallRequestPercent`. A resource is OBSERVED only when `samples >= sampleMinimum`; a missing samples entry counts as 0.

## Fixtures (all `observed`, `used`, `verificationReserve` as shown; `reservations` empty unless shown)
- **F1** (TASK): `{"capacity":{"steps":100,"tests":20,"files":50},"verificationReserve":{"steps":10},"used":{"steps":5,"tests":3},"observed":["steps","tests"],"samples":{"steps":5,"tests":2},"reservations":[]}`
- **F2** (TASK): `{"capacity":{"steps":10},"verificationReserve":{},"used":{"steps":51},"observed":["steps"],"samples":{"steps":5},"reservations":[]}`
- **F3** (TASK): `{"capacity":{"steps":10,"tests":20},"verificationReserve":{},"used":{"steps":51,"tests":0},"observed":["steps"],"samples":{"steps":5,"tests":5},"reservations":[]}`
- **F4** (TASK): `{"capacity":{"steps":100},"verificationReserve":{"steps":10},"used":{},"observed":["steps"],"samples":{"steps":5},"reservations":[{"id":"a","kind":"work","amounts":{"steps":50}}]}`
- **F5** (DEVICE): `{"capacity":{"ramMb":2000,"networkMb":100,"batteryPct":100},"verificationReserve":{},"used":{"ramMb":500},"observed":["ramMb"],"samples":{"ramMb":5,"networkMb":5,"batteryPct":5},"reservations":[]}`
- **F6** (ACCOUNT): `{"capacity":{"aiCalls":20,"attachments":10},"verificationReserve":{},"used":{"aiCalls":2},"observed":["aiCalls"],"samples":{"aiCalls":5,"attachments":5},"reservations":[]}`
- **F7** (BUILDER): `{"capacity":{"testMinutes":60,"repoFiles":4000},"verificationReserve":{"testMinutes":10},"used":{},"observed":[],"samples":{"testMinutes":5,"repoFiles":0},"reservations":[]}`

## The 26 rows
| # | fixture | request | expected |
|---|---|---|---|
| 1 | F1 | `{"steps":75}` | AVAILABLE; reasons: -; basis: steps OBSERVED 5; ownerCost: no |
| 2 | F1 | `{"steps":76}` | CONSTRAINED; reasons: margin@steps; basis: steps OBSERVED 5; ownerCost: no |
| 3 | F1 | `{"steps":85}` | CONSTRAINED; reasons: margin@steps,reserve-only@steps; basis: steps OBSERVED 5; ownerCost: no |
| 4 | F1 | `{"steps":86}` | BLOCKED; reasons: over-budget@steps; basis: steps OBSERVED 5; ownerCost: no |
| 5 | F1 | `{"steps":1}` | AVAILABLE; reasons: -; basis: steps OBSERVED 5; ownerCost: no |
| 6 | F1 | `{"tests":2}` | AVAILABLE; reasons: -; basis: tests ESTIMATE 2; ownerCost: no |
| 7 | F1 | `{"tests":3}` | UNKNOWN; reasons: estimate-only@tests; basis: tests ESTIMATE 2; ownerCost: no |
| 8 | F1 | `{"files":5}` | AVAILABLE; reasons: -; basis: files ESTIMATE 0; ownerCost: no |
| 9 | F1 | `{"files":6}` | UNKNOWN; reasons: estimate-only@files; basis: files ESTIMATE 0; ownerCost: no |
| 10 | F1 | `{"steps":75,"tests":3}` | UNKNOWN; reasons: estimate-only@tests; basis: steps OBSERVED 5, tests ESTIMATE 2; ownerCost: no |
| 11 | F1 | `{"steps":86,"tests":3}` | BLOCKED; reasons: over-budget@steps,estimate-only@tests; basis: steps OBSERVED 5, tests ESTIMATE 2; ownerCost: no |
| 12 | F1 | `{"toolCalls":1}` | UNKNOWN; reasons: no-figure@toolCalls; basis: -; ownerCost: no |
| 13 | F1 | `{"steps":75,"toolCalls":1}` | UNKNOWN; reasons: no-figure@toolCalls; basis: steps OBSERVED 5; ownerCost: no |
| 14 | F2 | `{"steps":1}` | BLOCKED; reasons: overrun@steps,over-budget@steps; basis: steps OBSERVED 5; ownerCost: no |
| 15 | F3 | `{"tests":2}` | AVAILABLE; reasons: -; basis: tests OBSERVED 5; ownerCost: no |
| 16 | F4 | `{"steps":40}` | CONSTRAINED; reasons: margin@steps,reserve-only@steps; basis: steps OBSERVED 5; ownerCost: no |
| 17 | F4 | `{"steps":41}` | BLOCKED; reasons: over-budget@steps; basis: steps OBSERVED 5; ownerCost: no |
| 18 | F5 | `{"ramMb":100}` | AVAILABLE; reasons: -; basis: ramMb OBSERVED 5; ownerCost: no |
| 19 | F5 | `{"networkMb":5}` | AVAILABLE; reasons: -; basis: networkMb OBSERVED 5; ownerCost: yes |
| 20 | F5 | `{"ramMb":100,"networkMb":0}` | AVAILABLE; reasons: -; basis: ramMb OBSERVED 5; ownerCost: no |
| 21 | F6 | `{"aiCalls":1}` | AVAILABLE; reasons: -; basis: aiCalls OBSERVED 5; ownerCost: yes |
| 22 | F7 | `{"testMinutes":49}` | CONSTRAINED; reasons: margin@testMinutes; basis: testMinutes OBSERVED 5; ownerCost: no |
| 23 | F7 | `{"repoFiles":400}` | AVAILABLE; reasons: -; basis: repoFiles ESTIMATE 0; ownerCost: no |
| 24 | F7 | `{"repoFiles":401}` | UNKNOWN; reasons: estimate-only@repoFiles; basis: repoFiles ESTIMATE 0; ownerCost: no |
| 25 | F5 | `{"ramMb":1501}` | BLOCKED; reasons: over-budget@ramMb; basis: ramMb OBSERVED 5; ownerCost: no |
| 26 | F5 | `{"ramMb":1500}` | CONSTRAINED; reasons: margin@ramMb; basis: ramMb OBSERVED 5; ownerCost: no |

Reading the edge rows: row 3 and row 16 leave exactly the verification reserve (10), so `reserve-only` AND `margin` both appear (all reasons are kept). Row 1 leaves exactly 20 of 100: that is NOT under the margin. Rows 6 and 8 are small probes (at most 10 percent of capacity) on a figure with fewer than 5 samples: they proceed and the basis stays ESTIMATE. Rows 7 and 9 are one unit larger: UNKNOWN. Row 14: a resource already used above capacity gives `overrun` and also `over-budget` for any positive request. Row 15: an overrun on a resource that is not requested is ignored. Row 20: a requested amount of 0 is skipped (not in basis, not in ownerCost). Row 26: a request that fits exactly to zero is allowed (after 0 is under the margin, so CONSTRAINED; there is no reserve, so no `reserve-only`).

## Integration rows (real engine; build the state with the engine, not a literal)
`newBudget({steps:100},{steps:10})`, then k times: `reserve(s,'r'+i,{steps:1},'work')` and `settle(s,'r'+i,{steps:1})`, take `.value.state`. TASK request `{steps:75}`:
- k = 5 gives `AVAILABLE; reasons: -; basis: steps OBSERVED 5; ownerCost: no`
- k = 4 gives `UNKNOWN; reasons: estimate-only@steps; basis: steps ESTIMATE 4; ownerCost: no` (one sample fewer: still an estimate)

## Boundary sweep on F1, request `{steps: a}` for a = 1 to 95
a 1 to 75: AVAILABLE. a 76 to 85: CONSTRAINED, with `margin@steps`, and ALSO `reserve-only@steps` exactly at a = 85. a 86 to 95: BLOCKED with `over-budget@steps`.

## Input-error rows (exact code, message `Budget view input is invalid.`; the call is `budgetView(input)`; S = F1's state, D = 'TASK')
| input | code |
|---|---|
| undefined, null, `[]`, `'x'` | bad-input |
| domain `'task'`, `5`, or missing (otherwise valid) | bad-domain |
| state missing, `{}`, `null`, or F1's state with `samples` removed | bad-state |
| request missing, `[]`, `null` | bad-request |
| request `{nope:1}`; `{steps:1,ramMb:1}` (ramMb is a DEVICE name); `{constructor:1}`; JSON.parse of `{"__proto__":1}` | unknown-resource |
| request `{steps:-1}`, `{steps:NaN}`, `{steps:Infinity}`, `{steps:'5'}` | bad-amount |
| request `{}`, `{steps:0,tests:0}` | empty-request |
| ORDER: domain `'x'` with bad state and bad request | bad-domain |
| ORDER: bad state and bad request | bad-state |
| ORDER: `{nope:1,steps:-1}` | unknown-resource (names are checked before amounts) |
| ORDER: `{nope:0}` | unknown-resource (before empty-request) |

## Closed resource-name sets (owner approved 2026-11-06; names, order, units and ownerCost exact)
DEVICE_RESOURCES: ramMb megabytes no; cpuMs milliseconds no; storageMb megabytes no; batteryPct percent no; networkMb megabytes YES.
TASK_RESOURCES: steps steps no; toolCalls calls no; files files no; outputKb kilobytes no; tests tests no.
ACCOUNT_RESOURCES: aiCalls calls YES; turns turns YES; contextChars characters YES; attachments files YES.
BUILDER_RESOURCES: builderMemoryMb megabytes no; archiveExpandMb megabytes no; repoFiles files no; testMinutes minutes no; reviewCommands commands no.
Each entry is `{name, unit, ownerCost}`, frozen; each array frozen.

## Engine fact the Director added (do not edit the engine)
`BudgetState` has a new field `samples` (frozen record: resource to number of settled runs). A new budget has `{}`; `settle` adds 1 per resource in the actual vector; `reserve` and `release` carry it unchanged.
