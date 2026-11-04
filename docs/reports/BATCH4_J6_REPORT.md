# BATCH 4 — J6 Mutant Harness report

**Placement:** layer 5 test kit (P17); no dependency; finish-line stage L. **Files:** `src/testkit/mutantHarness.ts`, `tests/mutantHarness.test.ts`, this report. New files only; no wiring.

## LAW CHECK (FL11)
- FL1: mapped to AXON's five-layer finished architecture; this is an isolated engine.
- FL2: only the named engine and test files are involved; no repository files were read or edited.
- FL4: sized as one pure engine and one test; failures are stopped under the two-strike rule.
- FL5: dictionary and its files are untouched and remain part of AXON.
- FL9: placement follows the Director's written Batch 4 contract.
- FL11: this law check is repeated here and was included before implementation.
- FL13: no fixed phrase lists or brain phrase handlers are introduced.
- FL15: where applicable, source/licence claims remain reported until admission checks and owner approval.

## Result
**BUILT; ISOLATED TEST RUN: PASS.** Strict TypeScript compilation and Node execution completed: `MUTANT_HARNESS OK: 20 checks`.

Hand-worked oracle: m1 caught by c1/wrong-answer; m3 caught by c1/threw; m4 caught by c2/wrong-answer; m2 survives; caughtCount 3, total 4. Wrong expected original answer returns original-fails naming the case. Differential examples return 3 agreements or one mismatch at index 1.

## Deliberate breakages and test detection
1. Skip original validation — original-fails assertion catches it.
2. Stop original validation after first failing case — multi-failure accumulation is NOT directly tested.
3. Catch a mutant only after its last failing case — first-case c1 assertions for m1/m3 catch it.
4. Let a throwing mutant survive — m3 `threw` assertion catches it.
5. Sort mutants or caught records — exact caught/survived order catches it.
6. Compare object key order as significant — `{a,b}` versus `{b,a}` deep equality catches it.
7. Ignore array order — `[1,2]` versus `[2,1]` catches it.
8. Treat two thrown outcomes as different — two-throws-agree catches it.
9. Treat one throw and one return as equal — one-throws-differ catches it.
10. Treat `0` and `-0` as equal or `NaN` as unequal — Object.is assertion catches it.
11. Accept empty mutants/cases or duplicate IDs — empty-list and duplicate-id assertions catch it.
12. Count a differing input as agreement — exact index/value mismatch catches it.

## What this cannot prove
It cannot prove the supplied cases are sufficient, that mutants represent every realistic defect, or correctness outside tested inputs. It runs supplied functions; it does not rewrite source.

## `test:kernel` line to add (do not edit package.json)
`"test:kernel": "tsx tests/recheckQueue.test.ts && tsx tests/promptGrader.test.ts && tsx tests/licenceFlags.test.ts && tsx tests/interactionJournal.test.ts && tsx tests/budgetBroker.test.ts && tsx tests/mutantHarness.test.ts"`

**NOT RUN: full repository kernel suite, property/held-out/regression campaigns, phone runtime, Director rerun.**
