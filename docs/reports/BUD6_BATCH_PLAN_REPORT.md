# BUD6 Batch Plan — implementation report

## Result

Implemented the isolated pure engine in `src/budget/batchPlan.ts` and its test in `tests/batchPlan.test.ts`.

- `builderVector` validates the complete log before duplicate-ID checks, computes the four figures, and emits capacity/unknown resources in `BUILDER_RESOURCES` order.
- `packBatch` validates inputs, uses only the newest history entry, clamps the target, and packs cards in one ordered pass.
- Both exports accept `unknown`, return frozen success/failure results, catch exceptions, and do not mutate inputs.
- `BATCH_PLAN_TABLE` contains the requested starting hypotheses.
- No existing file, fixture, package file, lock file, dictionary, broker, or resource definition was changed.

## LAW CHECK (FL11)

- **FL1 — Top view:** placed in Layer 5 Reach / 7T Budget Broker; later risk is capacity evidence or broker-interface drift.
- **FL2 — Read exact scope:** read the complete roadmap, Part 00 (§3), and the named BUD6 design, cases, capacity, broker, view, resource, fixture, and test files only.
- **FL4 — Measure/no repeats:** uses the real numeric fixture and hand-worked cases; records the unavailable `tsx` proof honestly.
- **FL5 — Dictionary is core:** untouched; no dictionary content or reachability was removed or changed.
- **FL7 — Measure why:** figures come only from logged successes/failures; conflict and insufficient evidence remain unknown.
- **FL9 — Plan first:** BUD6 is implemented at its Director-assigned Layer 5 / 7T placement, without wiring or storage.
- **FL11 — Every-Stage:** this touched-law check is included here and was applied before implementation.
- **FL13 — Structure before vocabulary:** no phrase lists, vocabulary matching, or brain changes were added.
- **FL14 — One engine, no duplicate logic:** imports `BUDGET_VIEW_TABLE.sampleMinimum`; does not duplicate the sample threshold.

## Cases-file row coverage

Every hand-worked row and additional boundary in `docs/BUD6_CASES.md` was represented in the test:

| Cases-file row / group | Result |
|---|---|
| Real log — ChatGPT (18 runs; four figures; capacity; unknown order) | PASS |
| Real log — Claude (11 runs; command conflict; empty capacity; unknown reasons/order) | PASS |
| Real log — Grok (1 run; prompt no-OK; all unknown resources) | PASS |
| Real log — Vibe (0 runs; all figures unknown; all five resources unknown) | PASS |
| Vector edge R0 — 4/5 sample boundary | PASS |
| Vector edge R0 — equal/beyond conflict boundary | PASS |
| Vector validation — bad rows, malformed dates, inconsistent outcomes, zero cards, extra row key | PASS |
| Vector validation — duplicate ID; invalid row after duplicate pair; builder; top-level keys; non-object; empty rows | PASS |
| P1 | PASS |
| P2 | PASS |
| P3 | PASS |
| P4 | PASS |
| P5 | PASS |
| P6 | PASS |
| P7 | PASS |
| P8 | PASS |
| P9 | PASS |
| P10 | PASS |
| P11 | PASS |
| P12 | PASS |
| Additional — unknown-turn ceiling clamp; only last history entry; exactly three cards | PASS |
| Additional — exactly usable chars; one over; skip a too-large remaining card and continue | PASS |
| Pack validation — bad input, unknown/missing keys, empty/duplicate/bad cards, bad overhead, bad history, first-failure precedence | PASS |
| Broker link — ChatGPT capacity accepted; repoFiles 30/10/2 and testMinutes 5 interpreted as specified | PASS |
| Broker link — empty Claude capacity refused by `newBudget` | PASS |
| 2,000 deterministic packing sweep and invariants | PASS |
| Deep-frozen outputs and unchanged inputs | PASS |

## Proof results

- **Strict TypeScript:** `tsc --noEmit --strict --target ES2020 --module commonjs --moduleResolution node src/budget/batchPlan.ts tests/batchPlan.test.ts` — **PASS, exit 0, no diagnostics**. Imported source dependencies were included by TypeScript.
- **Runtime test:** executed with Node 22 using the globally installed TypeScript `transpileModule` require hook — **PASS**. Last line: `BATCH_PLAN OK: 16423 checks`.
- **`tsx tests/batchPlan.test.ts`: NOT RUN.** `tsx` is not installed in this mini-base/runtime, and there is no package manifest in the mini-base. The Node transpile run is a supplementary runtime check, not a claim that the requested `tsx` command ran.
- **Director reference rerun / independent sweep / mutants: NOT RUN.** These are the Director's independent proof steps.
- **Package script change: NOT MADE.** Exact line for the owner/Director to append when integrating: `tsx tests/batchPlan.test.ts`.

## Limits and later risks

The builder capacity vector is only as reliable as the numeric log. `promptChars` and `miniBaseFiles` remain packing evidence, not broker capacity. `builderMemoryMb`, `archiveExpandMb`, and `testMinutes` remain unknown because the log has no corresponding fields. `reviewCommands` remains unknown for ChatGPT and conflicting for Claude. The 16,000-character master size and card-count table are starting values/hypotheses; future measurements may require changing them. Nothing in this job stores log rows, calls the functions, displays results, or changes broker/view/resource behavior.
