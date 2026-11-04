# BATCH 4 — J5 Budget Broker report

**Placement:** layer 5 (P19); no dependency; finish-line stage L. **Files:** `src/budget/budgetBroker.ts`, `tests/budgetBroker.test.ts`, this report. New files only; no wiring.

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
**BUILT; ISOLATED TEST RUN: PASS.** Strict TypeScript compilation and Node execution completed: `BUDGET_BROKER OK: 29 checks`.

Hand-worked oracle: capacity steps 10/tokens 1000 with verification reserve steps 2; work t1 reserves 5/400; t2 work reservation of 4 steps fails short by 1; verification v1 reserves 4 steps. Settling t1 at 3/100 yields no overrun and remaining 3 steps/900 tokens, both OBSERVED. Settling v1 at 9 steps yields `['steps']` and -2 remaining.

## Deliberate breakages and test detection
1. Deduct verificationReserve from `remaining()` — hand remaining 5 after t1 catches it.
2. Let work consume verification reserve — t2 over-budget-by-1 catches it.
3. Apply work ceiling to verification — successful v1 reservation catches it.
4. Settle using estimate, not actual — 3 steps/900 tokens remaining catches it.
5. Treat omitted actual resources as still consumed at estimate — empty actual vector catches it.
6. Reject an overrun instead of recording it — successful v1 settlement with `['steps']` catches it.
7. Fail to sort multi-resource overruns — implementation sorts; multi-resource ordering is NOT directly tested.
8. Accept unknown resources or negative/non-finite amounts — corresponding error assertions catch it.
9. Keep released reservation allocated — release-to-zero-reservations catches it.
10. Mutate old states during reserve — original state unchanged catches it.
11. Mark estimates OBSERVED before settlement — ESTIMATE basis checks catch it.
12. Allow duplicate IDs or settle/release missing IDs — duplicate/no-reservation assertions catch it.

## What this cannot prove
It cannot prove estimate correctness, device RAM/battery measurements, concurrent reservation safety, persistent recovery after process death, or integration with tool/account limits. It is an immutable pure state engine.

## `test:kernel` line to add (do not edit package.json)
`"test:kernel": "tsx tests/recheckQueue.test.ts && tsx tests/promptGrader.test.ts && tsx tests/licenceFlags.test.ts && tsx tests/interactionJournal.test.ts && tsx tests/budgetBroker.test.ts && tsx tests/mutantHarness.test.ts"`

**NOT RUN: concurrency, real device measurements, background persistence, broker integration, Director rerun.**
