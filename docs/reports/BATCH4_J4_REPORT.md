# BATCH 4 — J4 Interaction Journal report

**Placement:** layer 5 (P18); no dependency; finish-line stage L. **Files:** `src/journal/interactionJournal.ts`, `tests/interactionJournal.test.ts`, this report. New files only; no wiring.

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
**BUILT; ISOLATED TEST RUN: PASS.** Strict TypeScript compilation and Node execution completed: `INTERACTION_JOURNAL OK: 18 checks`.

Hand-worked oracle: ChatGPT = 3 episodes, 2 accepted, 1 not accepted, 0 pending, 1 limit hit, 70 commands, last e4, enough true; Grok = one pending sample, 5 commands, enough false. Account aliases a/b/c match supplied counts and last IDs. Duplicate e1 and extra `password` are rejected.

## Deliberate breakages and test detection
1. Mutate the old journal during append — old length and new-array assertions catch it.
2. Allow duplicate episode IDs — duplicate-id assertion catches it.
3. Accept a `password` field — secret-field assertion catches it.
4. Accept `apiKey` (case-insensitive `apikey`) or `token` — secret-key assertions catch it.
5. Silently ignore unknown fields — `unexpected` field assertion catches it.
6. Accept blank required strings — blank provider assertion catches it.
7. Accept negative or fractional command counts — both command assertions catch it.
8. Accept invalid verdict/tests enums — enum assertions catch it.
9. Sort profile rows instead of first-occurrence order — exact profile arrays catch it.
10. Set `enough` below three episodes — ChatGPT (3) and Grok (1) catch it.
11. Omit lastEpisodeId updates — e4 last-ID assertions catch it.
12. Add percentages — returned shape and exact count-only assertions catch the absence of a percentage field.

## What this cannot prove
It cannot prove outside-AI verdict truth, account identity, provider/model claims, persistence, or owner approval of work-preference profiles. Files/hashes are not part of this card's supplied Episode type.

## `test:kernel` line to add (do not edit package.json)
`"test:kernel": "tsx tests/recheckQueue.test.ts && tsx tests/promptGrader.test.ts && tsx tests/licenceFlags.test.ts && tsx tests/interactionJournal.test.ts && tsx tests/budgetBroker.test.ts && tsx tests/mutantHarness.test.ts"`

**NOT RUN: real outside-AI session capture, durable storage, account authentication, UI/brain wiring, Director rerun.**
