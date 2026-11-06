# BUD3 Probe Plan Report

## AXON assessment (roadmap v21.3)

1. **Finished AXON:** Six layers — 0 Ground, 1 Knowledge, 2 Reading Language, 3 Understanding, 4 Voice and 5 Reach; Reach includes tools, memory, media, device files, optional models, AXON Code, Web and outside AIs.
2. **BUD3 placement:** Layer 5 (Reach), budget side, under 7T's Interaction Journal, Profiles and Budget Broker. This is a PLANNED isolated engine, not an integration.
3. **Possible later breakage:** Incorrect probe sizing, false safe ranges, conflicting limit records, owner-approval bypasses, or duplicated sample-minimum values could undermine the future Budget Broker.

Correction: the roadmap's layer numbering is 0–5, which is six layers.

## LAW CHECK (FL11)

- **FL1:** Small engine placed within the complete AXON architecture.
- **FL2:** Only the roadmap and explicitly named files were read.
- **FL3:** Probe records remain compatible with future budget integration.
- **FL4:** One isolated job; two-strike failure rule observed.
- **FL5:** Dictionary remains untouched and included in the base.
- **FL7:** Hypotheses are tested with hand-worked cases, a sweep and mutants.
- **FL9:** Follows the 7T budget-broker placement.
- **FL11:** This LAW CHECK is repeated in this report.
- **FL13:** No fixed phrase lists or brain changes.
- **FL14:** The sample minimum is read from `BUDGET_VIEW_TABLE.sampleMinimum`; it is not duplicated.

## Files created

Exactly these three new files:

- `src/budget/probePlan.ts`
- `tests/probePlan.test.ts`
- `docs/reports/BUD3_PROBE_PLAN_REPORT.md`

No mini-base file was edited. `package.json` was not edited. The engine imports only `BUDGET_VIEW_TABLE` and the `BudgetDomain` type from `budgetView.ts`, plus the four resource files. It does not import `budgetBroker`.

## Proof commands and output

The installed TypeScript 5.8.3 does not recognize `--ignoreConfig` (TS5023), so the flag was omitted as the prompt permits.

Command:
```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/budget/probePlan.ts tests/probePlan.test.ts
```
Output: no errors.

Command:
```sh
tsc --strict --target ES2020 --module commonjs --outDir /tmp/bud3-final-js src/budget/probePlan.ts tests/probePlan.test.ts
node /tmp/bud3-final-js/tests/probePlan.test.js
```
Output:
```text
PROBE_PLAN OK: 11336 checks
```

Read-only BUD2 regression command:
```sh
tsc --strict --target ES2020 --module commonjs --outDir /tmp/bud3-final-budgetview-js tests/budgetView.test.ts
node /tmp/bud3-final-budgetview-js/tests/budgetView.test.js
```
Output:
```text
BUDGET_VIEW OK: 673 checks
```

The `tsx` executable is not installed in this environment. The test was compiled with `tsc` and run under Node instead; that satisfies the compiled-test proof. The repository `test:kernel` script was not run because `package.json` is not in the mini-base and is outside the allowed lane.

## Deliberate mutants

Each mutant was applied separately, compiled, and run against the unchanged test. All 17 were caught:

| Mutant | Test check that failed |
|---|---|
| `probePercent` 10 → 11 | `PROBE_TABLE exact` |
| `Math.floor` → `Math.ceil` | `P3 ownerYes false whole success result` |
| Conflict `<=` → `<` | `P13 ownerYes false whole success result` |
| Count REPORTED samples as measured | `P7 ownerYes false whole success result` |
| Copy sample minimum as 4 | `P7 ownerYes false whole success result` |
| Check NOT-NEEDED before CONFLICT | `P16 ownerYes false whole success result` |
| Check NEEDS-OWNER-YES before NOT-NEEDED | `P12 ownerYes false whole success result` |
| Force `ownerCost` to false | `P9 ownerYes false whole success result` |
| Keep latest `safeHigh` sample instead of largest | `S2 whole success result` |
| Keep latest `limitLow` sample instead of smallest | `S6 whole success result` |
| Keep last sample date instead of latest date | `S2 whole success result` |
| Accept a MEASURED limit event | `S20 fails` |
| Accept amount zero | `S21 fails` |
| Accept month 13 | `S3d 2026-13-01 fails` |
| Accept a 65-character label | `N4 fails` |
| Validate sample before record | `ORDER record before sample exact error code` |
| Accept non-boolean `ownerYes` | `X2 fails` |

The common mutant proof commands were:
```sh
tsc --strict --target ES2020 --module commonjs --outDir /tmp/bud3-mutant-N src/budget/probePlan.ts tests/probePlan.test.ts
node /tmp/bud3-mutant-N/tests/probePlan.test.js
```
For each mutant, compilation succeeded and the Node test exited non-zero at the check listed above.

## `test:kernel` append text

Append exactly this text to the end of the existing `test:kernel` line; do not replace the script:
```text
&& tsx tests/probePlan.test.ts
```

## NOT RUN

- `tsc --ignoreConfig`: NOT RUN with that flag because this installed `tsc` rejects it; the permitted command without the flag passed.
- `tsx tests/probePlan.test.ts`: NOT RUN because `tsx` is not installed. The compiled test was run with Node and passed.
- Repository `test:kernel` script: NOT RUN; `package.json` was not provided and was explicitly outside the allowed files.
- Director's independent rerun/reference: NOT RUN; this is the builder report, not the Director's verification.

## DIRECTOR VERDICT (2026-11-06): ACCEPTED, with Director checks added
Evidence is not the builder's claim. MEASURED in the Director sandbox: `tsc --noEmit --strict --target ES2020 --module commonjs --ignoreConfig` clean; returned test `PROBE_PLAN OK: 11336 checks`; `BUDGET_VIEW OK: 673 checks` still passes; two independent references (`docs/director/BUD3_reference.py.txt`, `BUD3_reference.ts.txt`) agree on all 133 case rows and a 2,500-value sweep, and the engine agrees with the TypeScript reference on 30,000 random calls (valid and corrupted records, samples, owner answers) with no input changed (outcomes seen: bad-owner-yes 3,940; bad-sample 7,149; CONFLICT 1,179; bad-record 4,225; PROBE 1,594; NOT-NEEDED 249; NEEDS-OWNER-YES 343; NO-RANGE 589; sample ok 691). The Director ran 68 mutants of its own against the returned test: 62 were killed, 6 survived. 3 survivors are equivalent (cannot change any result: conflict test without the null guard, a MEASURED count on a limit that is refused earlier, the own-key check that the type checks already cover). 3 were real gaps: the owner yes is asked BEFORE NO-RANGE (an ACCOUNT record with no range or a range under 10 must say NEEDS-OWNER-YES without the yes); a negative count that stays consistent with the other fields (measured -1 with reported 1); punctuation characters next to digits in a date (`:` and `/`). The Director added 100 assertions for them; test now `PROBE_PLAN OK: 11436 checks`, and only the 3 equivalent survivors remain. `package.json` `test:kernel` was appended with ` && tsx tests/probePlan.test.ts` (appended, not replaced). NOT RUN: cloud build, full `test:kernel`, phone.
