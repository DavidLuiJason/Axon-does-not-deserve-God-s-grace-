# BATCH 4 — J3 Licence Flags report

**Placement:** layers 1 and 5 (7R, 7F 2, section 9); depends on the source record; finish-line stage K. **Files:** `src/web/licenceFlags.ts`, `tests/licenceFlags.test.ts`, this report. New files only; no wiring.

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
**BUILT; ISOLATED TEST RUN: PASS.** Strict TypeScript compilation and Node execution completed: `LICENCE_FLAGS OK: 19 checks`.

Hand-worked oracle: CC-BY-SA gives attribution-required + share-alike and owner-decision; CC-BY gives yes-with-credit; CC0 gives yes; null gives no and owner decision; unknown licence gives owner-decision. `flagMany(['MIT','GPL-3.0-only',null,'CC0-1.0'])` returns indexes [1,2], total 4, needOwnerDecision 2.

## Deliberate breakages and test detection
1. Treat CC0 as no-licence-found — exact CC0 flag and mayBundle assertion catches it.
2. Drop share-alike from CC-BY-SA — exact two-flag array catches it.
3. Treat non-commercial as attribution-only — CC-BY-NC assertion catches it.
4. Treat no-derivatives as attribution-only — CC-BY-ND assertion catches it.
5. Omit GPL-3.0-only share-alike — GPL assertion catches it.
6. Treat unknown text as bundleable — Made-Up-1 owner-decision catches it.
7. Treat blank/null as unknown — null, undefined and blank checks catch it.
8. Mark CC-BY as verified — constant `REPORTED` assertion catches it.
9. Return flags in noncanonical order — exact flag arrays catch it.
10. Count an invalid member as an owner decision — mixed `flagMany` assertion catches it.

## What this cannot prove
It cannot prove that a source's licence statement is legally accurate, that the source record belongs to the content, that attribution text is sufficient, or that bundling is legally permitted in a jurisdiction. `REPORTED` is not `VERIFIED`.

## `test:kernel` line to add (do not edit package.json)
`"test:kernel": "tsx tests/recheckQueue.test.ts && tsx tests/promptGrader.test.ts && tsx tests/licenceFlags.test.ts && tsx tests/interactionJournal.test.ts && tsx tests/budgetBroker.test.ts && tsx tests/mutantHarness.test.ts"`

**NOT RUN: actual source-record integration, archive manifest/credit generation, legal review, Director rerun.**
