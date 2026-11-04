# BATCH 4 — J1 Re-check Queue report

**Placement:** layer 5 knowledge drive; depends on FL15 admission and the mistake ledger; finish-line stage K. **Files:** `src/knowledge/recheckQueue.ts`, `tests/recheckQueue.test.ts`, this report. New files only; no wiring.

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
**BUILT; ISOLATED TEST RUN: PASS.** Strict TypeScript compilation and Node execution completed: `RECHECK_QUEUE OK: 24 checks`.

Hand-worked oracle: due order D,E,C,A; D overdue 800000 and escalated; E overdue 0; C never checked/null; A overdue 600000; B not due at 1100000. With maxDue 2, due D,E and deferred C,A.

## Deliberate breakages and test detection
1. Change `nowMs >= dueAtMs` to `>` — E's exact-due boundary catches it.
2. Treat `lastCheckedMs: null` as not due — the never-checked assertion catches it.
3. Sort importance ascending — hand-worked D,E,C,A catches it.
4. Put checked items before never-checked at equal importance — C-before-A catches it.
5. Reverse overdue ordering — C/A placement and exact overdue values catch it.
6. Escalate only after more than two failures — D with two failures catches it.
7. Ignore `maxDue: 0` — the zero-limit assertion catches it.
8. Reverse deferred IDs — exact `['C','A']` catches it.
9. Accept duplicate or blank IDs — duplicate-id and bad-item checks catch it.
10. Accept non-finite time or fractional/negative maxDue — bad-now and bad-max checks catch it.

## What this cannot prove
It cannot prove upstream admission, real mistake-ledger integration, durable scheduling across app restarts, or that AXON actually asks the owner when escalation is true.

## `test:kernel` line to add (do not edit package.json)
`"test:kernel": "tsx tests/recheckQueue.test.ts && tsx tests/promptGrader.test.ts && tsx tests/licenceFlags.test.ts && tsx tests/interactionJournal.test.ts && tsx tests/budgetBroker.test.ts && tsx tests/mutantHarness.test.ts"`

**NOT RUN: repository `test:kernel`, full project tests, phone/device tests, integration with the mistake ledger, Director rerun.**
