# BUD6 CASES (Director, 2026-11-06). Hand-worked first, then run on the Director reference. Builders: assert every row.

Data: `tests/fixtures/builderLogRows.ts` (`BUILDER_LOG_ROWS`, 30 rows: ChatGPT 18, Grok 1, Claude 11). Sources: `AI_CAPACITY.md`, `DIRECTOR_LIMITS.md`, the board, MERGE_TAG, `docs/reports/BATCH*`. null = the log does not say. A value is entered only where the row's result plausibly depends on it.

## 1. builderVector, the real log (`rows` = BUILDER_LOG_ROWS)
**builder `ChatGPT`:** runs 18.
| field | OK values (outcome OK) | BAD values (PARTIAL or FAILED) | result |
|---|---|---|---|
| promptChars | 16000, 14044, 12920 | 38000, 28000 | safe 16000 is below the smallest BAD 28000: `{figure:16000, reason:'ok', okRows:3, badRows:2, basis:'ESTIMATE'}` |
| miniBaseFiles | 10, 6, 7 | none | `{figure:10, reason:'ok', okRows:3, badRows:0, basis:'ESTIMATE'}` |
| filesReturned | 1, 1, 22, 18, 18, 18, 18, 3, 3, 3, 7, 3 (12 values) | none | `{figure:22, reason:'ok', okRows:12, badRows:0, basis:'OBSERVED'}` |
| directorCommands | none | none | `{figure:null, reason:'no-ok-rows', okRows:0, badRows:0, basis:null}` |
`capacity` = `{repoFiles:22}`. `unknown` = builderMemoryMb `no-log-field`, archiveExpandMb `no-log-field`, testMinutes `no-log-field`, reviewCommands `no-ok-rows` (in that order).
**builder `Claude`:** runs 11. directorCommands: OK values 12, 6, 17, 14, 20, 14, 30, 43, 24 (9 rows), BAD value 24 (the account that hit its limit at the next message): safe 43 is NOT below 24, so `{figure:null, reason:'conflict', okRows:9, badRows:1, basis:null}`. The other three fields have no values: `no-ok-rows` (badRows 0). `capacity` = `{}`. `unknown` = builderMemoryMb `no-log-field`, archiveExpandMb `no-log-field`, repoFiles `no-ok-rows`, testMinutes `no-log-field`, reviewCommands `conflict`. (Honest reading: the log cannot say what limits a Director account; 7L and 5.8 already suspect roadmap edits, not commands.)
**builder `Grok`:** runs 1; promptChars: no OK values, one BAD (38000): `{figure:null, reason:'no-ok-rows', okRows:0, badRows:1, basis:null}`; `capacity` `{}`; `unknown` lists all five (repoFiles `no-ok-rows`, reviewCommands `no-ok-rows`, the others `no-log-field`).
**builder `Vibe`** (no rows): runs 0, every figure `no-ok-rows` with 0 and 0, `capacity` `{}`, five unknown.

## 2. builderVector edge rows (R0 = the row `gpt-b03b1abc`)
- Boundary: 4 OK rows with filesReturned 5 give basis `ESTIMATE`; 5 give `OBSERVED`.
- Conflict boundary: OK promptChars 10000 plus a FAILED 10000: `conflict`. FAILED 10001: figure 10000.
- Errors: rows `5` -> `bad-rows`; date `2026-1-05`, `2026/01/05`, `2026-01x05`, `2026x01-05`, `2026-01-0a` -> `bad-row`; outcome OK with accepted 2 of 3 -> `bad-row`; FAILED with accepted 2 -> `bad-row`; PARTIAL with accepted 3 of 3 -> `bad-row`; cards 0 -> `bad-row`; an extra key on a row -> `bad-row`; the same row twice -> `duplicate-row-id`; a bad row AFTER a duplicate pair still gives `bad-row` (row checks run first); builder `''` -> `bad-builder`; a missing or extra top-level key -> `unknown-key`; `5` -> `bad-input`; `rows: []` is valid (runs 0).

## 3. packBatch rows (history is newest last; `usable` = 16000 minus overheadChars)
| id | cards | overhead | history (last) | result |
|---|---|---|---|---|
| P1 | A to G, 3000 chars each | 4000 | none | target 6 `start`; usable 12000: A B C D fit (12000); E, F, G `no-room`; `PACKED`, usedChars 12000 |
| P2 | c1 to c8, 1000 each | 4000 | none | target 6 `start`: c1 to c6 in the master (6000); c7, c8 `target-reached`; `PACKED` |
| P3 | c1 to c8, 1000 each | 0 | 6 cards, 6 accepted, turns null | target 6 `turns-unknown` (no raise on unknown) |
| P4 | c1 to c10, 1000 each | 0 | 6, 6, turns 2 | target 8 `raise`; 8 in the master, 2 `target-reached`, usedChars 8000 |
| P5 | c1 to c10 | 0 | 6, 5 accepted, turns 2 | target 5 `shrink` |
| P6 | c1 to c10 | 0 | 6, 6, turns 3 | target 5 `shrink` (three Director turns is over the limit of two) |
| P7 | c1 to c10 | 0 | 10, 10, turns 1 | target 10 `raise` (clamped to the ceiling) |
| P8 | c1 to c10 | 0 | 3, 2 accepted, turns 1 | target 3 `shrink` (clamped to the floor) |
| P9 | big 20000, s1 1000, s2 1000 | 4000 | none | big `over-limit`; s1, s2 in the master; two cards: `TOO-FEW`, usedChars 2000 |
| P10 | c1 to c3, 1000 each | 16000 | none | usable 0: all three `no-room`; `NOTHING`, target 6 `start` |
| P11 | one card | 20000 | none | usable negative: `NOTHING` |
| P12 | c1 to c10 | 0 | 6 cards, 3 accepted, turns null (the real Batch 6) | target 5 `shrink` |
More rows: history 12 cards, 12 accepted, turns null: target 10 `turns-unknown` (ceiling clamp). Two history entries `{6,1,9}` then `{6,6,2}`: only the LAST counts, target 8. Exactly three 1000-char cards at overhead 4000: `PACKED`. One card of exactly 12000 at overhead 4000 fits; 12001 is `over-limit`. Cards 7000, 5001, 5000 at overhead 4000 (usable 12000): 7000 in, 5001 `no-room`, 5000 in (skip and continue), master `['a','c']`.
Errors: `5` -> `bad-input`; only `{cards}` -> `unknown-key`; `cards: []`, a duplicate id, `chars` 0 or 1.5, an extra key on a card -> `bad-cards`; overhead -1 or 1.5 -> `bad-overhead`; history not an array, accepted above cards, or a missing key -> `bad-history`; `cards: []` with overhead -1 and history `'x'` -> `bad-cards` (first failure wins).

## 4. The vector against the existing broker (capacity `{repoFiles:22}` from `newBudget`, domain BUILDER, nothing settled)
- request repoFiles 30: `BLOCKED`, reasons `over-budget` then `estimate-only` (both on repoFiles).
- repoFiles 10: `UNKNOWN`, reason `estimate-only` (10 is above 10 percent of 22 and there are 0 samples).
- repoFiles 2: `AVAILABLE` (2 is not above 10 percent of 22; 20 left is above the 20 percent margin).
- testMinutes 5: `UNKNOWN`, reason `no-figure` on testMinutes.
- `newBudget({})` (the Claude capacity) is refused: no BUILDER budget exists yet for the Director side.

## 5. Findings the card carries (for the board)
F1 roadmap 5.9 still says no batch has run; six ran (Batches 1 to 6), and the tags outrank the roadmap: edit due at the next roadmap job. F2 `AI_CAPACITY.md` lists B03B1b as both a size that worked and a partial delivery: row `gpt-b03b1b` is PARTIAL with no numbers, the group row `gpt-b03b1abc` is OK with 16000 and 10. F3 Batch 6's first return (a 28 KB prompt) was not accepted: supports the 16,000 recipe. F4 no real batch row has a Director turn count: `packBatch` cannot raise from today's log until the Director records commands and turns per batch. F5 the Director commands figure is a conflict (24 hit the limit, 43 stayed active): consistent with the owner's suspicion in 5.8. F6 three of the five BUILDER names (`builderMemoryMb`, `archiveExpandMb`, `testMinutes`) have no log field: they need measurement, not log reading (BUD5-style).
