# BATCH 6 - J3 Learning Gate report

**Placement:** layer 1 knowledge and admission; finish-line stage K (knowledge/admission foundation); dependency: none.
**Files:** `src/learning/learningGate.ts`, `tests/learningGate.test.ts`, `docs/reports/BATCH6_J3_REPORT.md`.

## LAW CHECK (FL11)
- FL1: implements only the admission sequence already fixed by 7F 1.
- FL2: created only the three named new files.
- FL4: ran the test and eight deliberate breakages; each mutation was restored.
- FL7: evidence booleans are checked literally; repetition is not evidence.
- FL11: revised card is followed exactly; old J3 card is void.
- FL13: only the three card-defined stages and actor values are closed sets.
- FL15: CANDIDATE → CHECKED → ADMITTED; only owner approval admits.
- N3: no existing source or repository file was changed.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `LEARNING_GATE OK: 151 checks`

Commands and output:
- `tsc --noEmit --strict --target ES2020 --module commonjs src/decision/deepDiveStop.ts src/learning/learningGate.ts src/export/manifestCompare.ts tests/deepDiveStop.test.ts tests/learningGate.test.ts tests/manifestCompare.test.ts` — `PASS: strict type-check`.
- `rm -rf out && tsc --strict --target ES2020 --module commonjs --outDir out src/decision/deepDiveStop.ts src/learning/learningGate.ts src/export/manifestCompare.ts tests/deepDiveStop.test.ts tests/learningGate.test.ts tests/manifestCompare.test.ts` — `PASS: compile to out`.
- `node out/tests/learningGate.test.js` — `LEARNING_GATE OK: 151 checks`.
- `test:kernel` addition: `tsx tests/learningGate.test.ts` (not added to package.json; package.json was not changed).

## Hand-worked oracle

Revised card cases A–G were worked from the stated rules and encoded as expected values:
- A: CANDIDATE → CHECKED by axon with sourceRecorded, independentlyConfirmed and knownAnswerTest true → CHECKED label.
- A: same valid transition by owner is also valid.
- B: independently falsifying each of the three required evidence booleans → missing-evidence.
- C: NONE with repeats 1,000,000 → missing-evidence; repeats do not help.
- D: CHECKED → ADMITTED by owner with ownerApprovedSource true → ADMITTED; false → missing-evidence.
- D: CHECKED → ADMITTED by axon → owner-only, including when all evidence is false (permission check precedes evidence).
- E: CANDIDATE → ADMITTED, staying in place, and ADMITTED → CHECKED → not-adjacent.
- F: CHECKED → CANDIDATE by axon and ADMITTED → CANDIDATE by owner are valid; the same backstep by axon is owner-only.
- G: invalid IDs, 61-character ID, invalid stages, repeats -1 and 1,000,001, missing evidence field, invalid target, and invalid actor return their exact specified errors; 60-character ID is valid; extra evidence key is ignored.

Two additional hand-worked cases:
- X1: CHECKED → ADMITTED by owner with only ownerApprovedSource true and repeats 1,000,000 → ADMITTED; the other three evidence flags are irrelevant to this transition.
- X2: ADMITTED → CANDIDATE by owner with all evidence false → NOT-VERIFIED; a step back requires no evidence.

## Deliberate breakages and test detection

1. Dropped sourceRecorded from forward evidence — CAUGHT by the sourceRecorded-false oracle.
2. Dropped independentlyConfirmed — CAUGHT by the independentlyConfirmed-false oracle.
3. Dropped knownAnswerTest — CAUGHT by the knownAnswerTest-false oracle.
4. Disabled owner-only gate for admission — CAUGHT by axon admission with all evidence.
5. Disabled owner-only gate for moves out of ADMITTED — CAUGHT by axon backstep from ADMITTED.
6. Disabled adjacency validation — CAUGHT by the skip/stay/back-to-CHECKED cases.
7. Relaxed repeats maximum from 1,000,000 to 1,000,001 — CAUGHT by the upper-bound invalid case.
8. Removed freezing of the returned outer object — CAUGHT by `Object.isFrozen` assertion.

All eight mutations failed the test and were restored. No mutation was left in the delivered engine.

## Questions for the Director

none

## What I could not check

- `tsx` execution and package.json integration; the equivalent compiled Node test was run.
- Integration with archive storage, the knowledge loader, brain or owner admission UI; explicitly outside this batch.
- Admission of real knowledge sources; this engine only checks the supplied evidence fields.
