# BUD4 Queue State Table — Build Report

## Five-line AXON assessment

1. Finished AXON has six numbered layers: Ground, Knowledge slot, Reading language, Understanding, Voice and Reach; Reach includes tools, memory, media, device files, optional model, AXON Code/Web and outside AIs.
2. BUD4 is a Layer 5 (Reach), budget-side pure engine under BUD1 rule B9(6), with no dependencies and no caller.
3. Later breakage could come from a caller bypassing this transition table, conflating queue state with scheduler timing or journal history, or treating FAILED as retryable instead of creating a new queue entry.

## LAW CHECK (FL11)

- **FL1:** The engine stays in its assigned place in the complete AXON.
- **FL2:** The full roadmap and all five named source/reference files were read; no unnamed project files were inspected.
- **FL3:** The engine fits the complete AXON design and remains a narrow queue-state primitive.
- **FL4:** One isolated build was tested; the two-strike rule was observed.
- **FL5:** The dictionary remains untouched and is not removed, omitted or made optional.
- **FL9:** BUD4 follows its approved Layer 5 placement and has no dependency.
- **FL11:** This visible LAW CHECK is repeated in the report.
- **FL13:** State matching is structural and exact; no phrase list or vocabulary accumulation is added.
- **FL14:** One pure implementation is provided with no imports, duplicate logic, storage or wiring.

## Scope and files

Created exactly these three new files, preserving their requested paths:

- `src/budget/queueState.ts`
- `tests/queueState.test.ts`
- `docs/reports/BUD4_QUEUE_STATE_REPORT.md`

No existing file was edited. `package.json` was not edited. The engine has no imports; its `EngineResult` shape is local and not exported. The transition policy is held in one frozen data table. Success and failure result objects are frozen; success values and legal-move arrays are frozen. Validation order is `bad-from`, `bad-to`, `same-state`, `terminal-state`, `illegal-move`.

The 49 hand-worked rows and all listed input-error rows in `docs/BUD4_CASES.md` agree with the prompt's rules. The test includes all 49 exact outcomes, all seven exact legal lists, error-order cases, non-string inputs (number, null, undefined, object, array, symbol and boxed String), immutability/freeze checks, the 49-pair agreement sweep, terminal-reachability checks and QUEUED-to-COMPLETED reachability.

## Proof commands and output

Environment: Node `v22.16.0`; TypeScript `5.8.3`.

The prompt's first command was attempted exactly:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs --ignoreConfig src/budget/queueState.ts tests/queueState.test.ts
```

Output:

```text
error TS5023: Unknown compiler option '--ignoreConfig'.
```

As the prompt permits, `--ignoreConfig` was omitted. Exact successful strict type-check command:

```sh
tsc --noEmit --strict --target ES2020 --module commonjs src/budget/queueState.ts tests/queueState.test.ts
```

Printed output: **no output; exit code 0**.

Compile and run the emitted test under Node:

```sh
tsc --strict --target ES2020 --module commonjs --outDir /tmp/bud4-build src/budget/queueState.ts tests/queueState.test.ts
node /tmp/bud4-build/tests/queueState.test.js
```

Printed output:

```text
QUEUE_STATE OK: 319 checks
```

## Deliberate mutant proof

Each mutant was compiled and its emitted test was run under Node. All nine mutants caused the test to fail:

1. Add `BLOCKED -> RUNNING` — caught by `grid row 30 BLOCKED -> RUNNING fails`.
2. Add `QUEUED -> COMPLETED` — caught by `grid row 6 QUEUED -> COMPLETED fails`.
3. Allow `COMPLETED -> QUEUED` (add that table edge and remove the COMPLETED terminal guard) — caught by `grid row 36 COMPLETED -> QUEUED fails`.
4. Check `terminal-state` before `same-state` — caught by `grid row 41 COMPLETED -> COMPLETED exact failure code and message`.
5. Validate `to` before `from` — caught by `both arguments invalid: from first exact failure code and message`.
6. Accept lowercase state names — the lowercase-from test failed because the mutant proceeded into an invalid table lookup and threw.
7. Drop `RUNNING -> PAUSED` — caught by `grid row 10 RUNNING -> PAUSED succeeds`.
8. Return the QUEUED legal list in the wrong order — caught by `legalQueueMoves QUEUED exact ordered list`.
9. Remove freezing from success results — caught by `grid row 2 QUEUED -> RUNNING success result frozen`.

Mutant proof result: **9 of 9 killed**. Each mutant was applied independently to a temporary copy; the original engine was restored before final proof and packaging.

## Package script instruction

Do not edit `package.json` in this job. The exact script entry to add later is:

```json
"test:kernel": "tsx tests/queueState.test.ts"
```

## NOT RUN

- `tsx tests/queueState.test.ts` — NOT RUN; `tsx` is not installed in this build environment (`tsx: command not found`). The TypeScript test was compiled and run successfully with Node as shown above.
- `npm run test:kernel` — NOT RUN; `package.json` was intentionally not edited, as instructed.
- Integration with a caller, scheduler, journal, storage or UI — NOT RUN and explicitly outside BUD4 scope.

## DIRECTOR VERDICT (added at merge, 2026-11-06)

ACCEPTED (evidence not the builder's own claim). Director reruns, Node 22 and tsx, tsc strict with `--ignoreConfig`: type-check clean; `tsx tests/queueState.test.ts` printed `QUEUE_STATE OK: 340 checks` (319 returned + 21 added by the Director). The 49 grid rows match `docs/BUD4_CASES.md` row for row (script diff, 0 mismatches). A second, independent reference (edge set, written separately) agreed with the engine on 1,190 calls (all state pairs plus 27 junk inputs including `constructor`, `__proto__`, boxed String, symbol, BigInt, NaN), with frozen results and the fixed message. 21 deliberate mutants: the returned test killed 20; the survivor (`legalQueueMoves` accepting a boxed String) was a test gap, closed by the Director's added `legalQueueMoves` non-string checks; after that 21 of 21 killed.

Correction to the section above: the line to add to `package.json` is NOT the whole script. `test:kernel` already chains many tests; the Director appended ` && tsx tests/queueState.test.ts` to the end of it at merge.

NOT RUN: cloud build, full `npm run test:kernel`, phone. Nothing calls this engine yet (by design).

