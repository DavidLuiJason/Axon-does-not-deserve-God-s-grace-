# BATCH 6 - J1 Deep Dive Stop report

**Placement:** layer 3; finish-line stage D (decision engine); dependency: none.
**Files:** `src/decision/deepDiveStop.ts`, `tests/deepDiveStop.test.ts`, `docs/reports/BATCH6_J1_REPORT.md`.

## LAW CHECK (FL11)
- FL1: bounded decision engine only; no architecture changes.
- FL2: created only the three named new files.
- FL4: ran the test and eight deliberate breakages; each mutation was restored.
- FL7: decisions use caller-supplied numeric inputs; no estimates are invented.
- FL10: no screen, broker or brain wiring is included.
- FL11: exact card contract and first-failing-check order are enforced.
- FL13: no phrase or word lists; only the card's reason values are used.
- FL15: output is deterministic and testable; no evidence is promoted.
- N3: no existing source or repository file was changed.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `DEEP_DIVE_STOP OK: 153 checks`

Commands and output:
- `tsc --noEmit --strict --target ES2020 --module commonjs src/decision/deepDiveStop.ts src/learning/learningGate.ts src/export/manifestCompare.ts tests/deepDiveStop.test.ts tests/learningGate.test.ts tests/manifestCompare.test.ts` — `PASS: strict type-check`.
- `rm -rf out && tsc --strict --target ES2020 --module commonjs --outDir out src/decision/deepDiveStop.ts src/learning/learningGate.ts src/export/manifestCompare.ts tests/deepDiveStop.test.ts tests/learningGate.test.ts tests/manifestCompare.test.ts` — `PASS: compile to out`.
- `node out/tests/deepDiveStop.test.js` — `DEEP_DIVE_STOP OK: 153 checks`.
- `test:kernel` addition: `tsx tests/deepDiveStop.test.ts` (not added to package.json; package.json was not changed).

## Hand-worked oracle

Card cases A–H were encoded as independent expected-value assertions before execution:
- A: no cycles → CONTINUE/continue, spent 0, cyclesRun 0.
- B: gains 5,0 and costs 40,40 → spent 80; only one zero-gain cycle, so CONTINUE.
- C: two zero gains, costs 10+10 → STOP/no-gain, spent 20.
- D: gains 0,3,0 → last two gains are 3 and 0, so CONTINUE; spent 30.
- E: costs 50+50 → budget used at 100; costs 50+49 → CONTINUE at 99.
- F: owner stop beats success and budget; success beats budget; budget beats no-gain; no-gain beats max-cycles.
- G: maxCycles 3 stops at three, not two; default max 10 stops at ten, not nine.
- H: invalid gain 101, fractional gain, negative cost and non-object entry; 200/201 cycle boundary; budget 0/10,000,001; invalid flag; maxCycles 0/201; combined bad flag and bad cycles checks first-error order.

Two additional hand calculations:
- X1: costs 12+13 = 25 with budget 25; `spent >= budget`, therefore STOP/budget-used (not continue).
- X2: gains 0+0, costs 1+1, maxCycles 2, budget 10; no-gain precedes max-cycles, therefore STOP/no-gain.

## Deliberate breakages and test detection

1. Swapped owner-stop and success priority — CAUGHT by `owner-stop` priority oracle.
2. Disabled success stop — CAUGHT by `success` priority oracle.
3. Changed `spent >= budget` to `spent > budget` — CAUGHT by exact-budget boundary case.
4. Changed two consecutive zero-gain requirement to one — CAUGHT by the single-zero-gain CONTINUE case.
5. Changed max-cycle `>=` to `>` — CAUGHT by exact maxCycles boundary case.
6. Summed gains instead of costs — CAUGHT by spent arithmetic assertions.
7. Relaxed maximum gain from 100 to 101 — CAUGHT by invalid gain 101.
8. Removed freezing of the returned outer object — CAUGHT by `Object.isFrozen` assertion.

All eight mutations failed the test and were restored. No mutation was left in the delivered engine.

## Questions for the Director

none

## What I could not check

- `tsx` execution and package.json integration; the equivalent compiled Node test was run.
- Integration with the AXON repository, brain, broker, screens or phone; explicitly outside this batch.
- Full end-to-end behavior of the eventual decision system.
