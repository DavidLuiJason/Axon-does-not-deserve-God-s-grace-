# BATCH 4 — J2 Prompt Grader report

**Placement:** layer 5 Prompt Lab (P12); no dependency; finish-line stage L. **Files:** `src/promptlab/promptGrader.ts`, `tests/promptGrader.test.ts`, this report. New files only; no wiring.

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
**BUILT; ISOLATED TEST RUN: PASS.** Strict TypeScript compilation and Node execution completed: `PROMPT_GRADER OK: 21 checks`.

Hand-worked oracle: first prompt scores 5/5 and passes; `Please do it` scores 1/5, fails `goal`, `steps`, `nofluff`; gradeSet gives 1/1 positives, 1/1 negatives and no misgrades; changing p2 to expect pass yields `['p2']`.

## Deliberate breakages and test detection
1. Make contains matching case-sensitive — `GOAL` matching `goal` catches it.
2. Make max-chars exclusive at the boundary — exact max boundary at 3 catches it.
3. Count only lines beginning at column zero — leading-spaces line test catches it.
4. Treat empty contains-all as pass — bad-check assertion catches it.
5. Give omitted weights zero — default-weight assertion catches it.
6. Reverse failedIds from rubric order — exact failedIds array catches it.
7. Count a negative expected-pass case as positive — gradeSet hand oracle catches it.
8. Accept fractional/zero weights — bad-weight assertions catch it.
9. Permit duplicate check/case IDs or unknown kinds — duplicate-id and bad-check assertions catch it.
10. Count characters other than JS `text.length` — supplementary-character-specific mutation is NOT directly tested.

## What this cannot prove
It cannot prove prompt quality, rubric completeness, external evaluation agreement, or that a caller supplied a fair rubric. It grades only explicit caller checks and contains no built-in phrase list.

## `test:kernel` line to add (do not edit package.json)
`"test:kernel": "tsx tests/recheckQueue.test.ts && tsx tests/promptGrader.test.ts && tsx tests/licenceFlags.test.ts && tsx tests/interactionJournal.test.ts && tsx tests/budgetBroker.test.ts && tsx tests/mutantHarness.test.ts"`

**NOT RUN: repository `test:kernel`, whole-project tests, Prompt Lab UI/brain wiring, Director rerun.**
