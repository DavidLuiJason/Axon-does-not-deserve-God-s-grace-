# BUD2 Budget View — Builder Report

## Five-line AXON assessment

1. **Finished AXON:** Six layers — Ground, Knowledge, Reading Language, Understanding, Voice and Reach (tools, memory, media, device access, optional AI models, AXON Code and Web).
2. **BUD2 placement:** Layer 5, Reach; budget side of the 7T Budget Broker, following BUD1.
3. **Later additions:** BUD3 probes, device-tier measurements, journal integration and eventual callers remain separate work.
4. **Possible breakage:** Incorrect resource names, incorrect budget classification, or changes to the broker's existing state contract could break future integration.
5. **Scope:** BUD2 is an isolated reporting engine. It neither authorizes actions nor changes budget state.

## LAW CHECK (FL11)

- FL1 — Located in Layer 5 and the 7T roadmap.
- FL2 — Read the complete roadmap and the specifically named files only.
- FL3 — Keeps future probes, callers and integrations separate.
- FL4 — One isolated engine, exact tests and two-strike stopping rule.
- FL5 — Dictionary remains untouched and is never excluded.
- FL7 — Uses explicit fixtures, boundary tests and deliberate mutants.
- FL9 — Follows the BUD2 placement under the budget broker.
- FL11 — This check is repeated in the delivery report.
- FL12 — No independent chat or screen execution; the engine is isolated.
- FL13 — Uses closed resource structures, not fixed brain phrases.
- FL14 — Uses the existing budget engine rather than duplicating its calculations.

No conflict with the roadmap was identified.

## Files created

Exactly the seven files in the requested lane:

1. `src/budget/resources/deviceResources.ts`
2. `src/budget/resources/taskResources.ts`
3. `src/budget/resources/accountResources.ts`
4. `src/budget/resources/builderResources.ts`
5. `src/budget/budgetView.ts`
6. `tests/budgetView.test.ts`
7. `docs/reports/BUD2_BUDGET_VIEW_REPORT.md`

No mini-base file, engine, test, roadmap, package file or dictionary file was edited.

## Proof commands and output

The local TypeScript compiler does not recognize `--ignoreConfig` (TS5023), so the prompt's stated fallback was used: the same command without that flag.

Command:
```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/budget/budgetView.ts tests/budgetView.test.ts
```
Output: no errors (exit code 0).

Command:
```sh
rm -rf dist && tsc --strict --target ES2020 --module commonjs --outDir dist src/budget/budgetView.ts tests/budgetView.test.ts && node dist/tests/budgetView.test.js
```
Output:
```text
BUDGET_VIEW OK: 627 checks
```

Command:
```sh
rm -rf distbroker && tsc --strict --target ES2020 --module commonjs --outDir distbroker src/budget/budgetBroker.ts tests/budgetBroker.test.ts && node distbroker/tests/budgetBroker.test.js
```
Output:
```text
BUDGET_BROKER OK: 40 checks
```

The test covers all 26 hand-worked rows, both real-engine integration rows, the 1–95 boundary sweep, input failures and validation order, all four exact closed sets and their freezing, the table and nested freezing, full result freezing, unchanged input state/request, cross-domain name rejection, and zero-amount skipping for an unknown-figure resource.

## Deliberate mutant results

Each mutant was applied independently to `budgetView.ts`, compiled, and run against the unchanged test. Every mutant made the test fail; the original engine was restored before the final clean proof.

| Mutant | Test failure that caught it |
|---|---|
| Ignore margin | `case 2 exact result` |
| Change margin `<` to `<=` | `case 1 exact result` |
| Drop `estimate-only` | `case 7 exact result` |
| Change sample minimum from 5 to 1 | `case 6 exact result` |
| Change small-request `>` to `>=` | `case 6 exact result` |
| Hide overrun | `case 14 exact result` |
| Check UNKNOWN before BLOCKED | `case 11 exact result` |
| Keep only the first reason | `case 3 exact result` |
| Force `ownerCost` false | `case 19 exact result` |
| Evaluate zero amounts | `case 20 exact result` |
| Accept DEVICE `ramMb` in TASK | `other domain name fails` |
| Drop `reserve-only` | `case 3 exact result` |
| Remove nested reason-item freezing | `case 2 reason items frozen` |
| Swap state/request validation order | `ORDER state before request code` |

## `test:kernel` append text

Append this exact text to the end of the existing `test:kernel` command; do not replace the script:

```text
&& tsx tests/budgetView.test.ts
```

## NOT RUN

- `tsx tests/budgetView.test.ts` directly: NOT RUN; `tsx` is not installed in this isolated mini-base runtime. The test was compiled with TypeScript and executed under Node as shown above.
- Full repository `test:kernel`, full application build, cloud build, and Director's independent reference rerun: NOT RUN; the mini-base does not include the full repository/package setup, and those are outside this builder lane.
- Director's independent verification remains required before merge.

## DIRECTOR VERDICT (2026-11-06): ACCEPTED, with 7 Director checks added
Evidence is not the builder's claim. MEASURED in the Director sandbox: `tsc --noEmit --strict --target ES2020 --module commonjs --ignoreConfig` clean; returned test 627 checks OK; broker test `BUDGET_BROKER OK: 40 checks`; J6 `ACT_OR_ASK OK: 9621 checks`; an independent reference with its own arithmetic (no engine calls, `docs/director/BUD2_reference.ts.txt`) agrees on 17,729 random calls across all four domains (BLOCKED 14,369, UNKNOWN 2,966, CONSTRAINED 53, AVAILABLE 341), and no call changed its input. The Director ran 45 mutants of its own against the returned test: 33 killed, 11 survived. 4 survivors are equivalent (cannot change any result: reserve-only `===` versus `<=`, blocked without `overrun` because an overrun always brings `over-budget`, a missing reservations array and an inherited samples entry). 3 were real gaps and 4 more were untested edges. The Director added 7 checks (remaining exactly 0 is not an overrun; a reserve entry of 0 gives no `reserve-only`; a symbol key is refused; missing samples and a non-array `reservations` are refused even for a no-figure request; a taken probe id is `bad-state`; a used entry without a capacity entry is `no-figure`); test now `BUDGET_VIEW OK: 673 checks`, and the only survivors are the 4 equivalent ones. The merge also carries the Director's `samples` change to `src/budget/budgetBroker.ts` and `tests/budgetBroker.test.ts` (the repo copy lacked it; `BUDGET_BROKER OK: 40 checks`). `package.json` `test:kernel` was appended with ` && tsx tests/budgetView.test.ts` (appended, not replaced). NOT RUN: cloud build, full `test:kernel`, phone.
