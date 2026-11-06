WHO IT IS FOR: ChatGPT (also runs in Grok). One pure-engine job for the AXON project. No screens.

WHAT THIS DOES: builds BUD6 "Batch Plan": ONE isolated pure file with two functions. (a) `builderVector` turns the real capacity log (rows of numbers) into safe figures per builder and a BUILDER budget vector. (b) `packBatch` decides how many cards go into one master prompt and which stay in the mini-base. Nothing calls it yet.

WHAT YOU DO: read the roadmap in the mini-base zip, write the LAW CHECK, then create exactly 3 new files (listed under LANE), run the proof commands, and report.

WHAT TO BRING BACK: a zip containing ONLY these 3 files, same paths: `src/budget/batchPlan.ts`, `tests/batchPlan.test.ts`, `docs/reports/BUD6_BATCH_PLAN_REPORT.md`. Do not return the mini-base files.

ONE-LINE PASTE (with the mini-base zip attached): Read the attached prompt file `BUD6_FOR_CHATGPT_BATCH_PLAN_AND_BUILDER_VECTOR.md` completely and do exactly what it says.

---

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. Open ONLY the files this prompt names and the files you are asked to create or change; do not read any other document, folder or archive. AXON is a foundation-first project and its foundation is being reopened. Answer in at most five lines: (1) what the finished AXON contains (section 6 of the roadmap), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list only the laws this job touches (by number, one line each, at most 12 lines) and say how the job complies; repeat it in your report; if a law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13). (“Part 00” = section 3; “Part 5E” = section 6.)

---

## DIRECTOR PLACEMENT NOTE (roadmap 5.9 Plan B, 7T budget broker; owner 2026-11-05 gave the Director the decisions)
- **Item:** BUD6 of `docs/BUD1_BUDGET_BROKER_DESIGN.md` section 6 (B2 BUILDER domain, B4 samples): the builder vector from the capacity log, plus batch packing. **Layer:** 5 (Reach). **Dependency:** the existing `src/budget` files (read-only for you). **Builder:** ChatGPT. **Proof:** the rows in `docs/BUD6_CASES.md` (hand-worked, then run on a separate Director reference), a sweep, mutants; the Director reruns everything on his own reference.
- You treat this engine as PLANNED, not UNPLANNED. **Stays UNDECIDED (do not build toward):** where the log rows are stored or read (the caller passes rows; no storage, no `localStorage`), who calls these functions, how the owner sees the result, the other three BUILDER names (`builderMemoryMb`, `archiveExpandMb`, `testMinutes` have no log field: they stay unknown here), any change to `budgetBroker.ts`, `budgetView.ts` or the resource files.

## JOB BUD6: three exports in `src/budget/batchPlan.ts`

**Style:** follow `src/budget/budgetView.ts`: pure functions; NO `Date`, `Math.random`, `fetch`, `console`, storage, global state, regex literals or phrase lists. Inputs are never changed. Extension-less imports like the neighbours. Imports allowed, and only these: `import { BUDGET_VIEW_TABLE } from './budgetView'` (use its `sampleMinimum`; do not copy the number: FL14) and `import { BUILDER_RESOURCES } from './resources/builderResources'` (use its names and order). "Exact keys" checks count string AND symbol own keys (`Reflect.ownKeys`). Every result is deep-frozen (`Object.freeze`, including arrays and nested objects). Both functions take `unknown`, never throw (any exception: `bad-input`), and return `{ok:true,value}` or a frozen `{ok:false,error,message}`.

**Exports (exactly these names):**
```ts
export const BATCH_PLAN_TABLE = Object.freeze({ masterChars:16000, minCards:3, startCards:6, ceilingCards:10, raiseStep:2, maxDirectorTurns:2 });
export function builderVector(input: unknown): EngineResult<BuilderVectorValue>;   // message 'Builder vector input is invalid.'
export function packBatch(input: unknown): EngineResult<BatchPlanValue>;           // message 'Batch plan input is invalid.'
```
The table values are STARTING VALUES (HYPOTHESIS, the owner may change them); masterChars 16000 is the MEASURED recipe in `AI_CAPACITY.md` (a 28,000-character first prompt in Batch 6 was not accepted).

### A. `builderVector({ rows, builder })`
Validation, first failure wins: (1) input not a non-array object: `bad-input`; (2) keys not exactly `rows`, `builder`: `unknown-key`; (3) `builder` not a non-empty string: `bad-builder`; (4) `rows` not an array: `bad-rows`; (5) any row invalid (checked for ALL rows first, in order): `bad-row`; (6) two rows with the same `id`: `duplicate-row-id`.
A ROW has exactly the keys `id` (non-empty string), `date` (string of exactly 10 characters shaped four digits, `-`, two digits, `-`, two digits: check by character codes, no Date, no regex), `builder` (non-empty string), `mode` (`'A'` single job, `'B'` master batch, `'D'` Director account), `cards` (positive integer), `accepted` (null or integer 0..cards), `promptChars`, `miniBaseFiles`, `filesReturned`, `directorCommands`, `directorTurns` (each null or a positive integer), `outcome` (`'OK'`, `'PARTIAL'`, `'FAILED'`), `source` (`'MEASURED'` or `'REPORTED'`). Consistency: `OK` needs accepted null or equal to cards; `PARTIAL` needs accepted null or below cards; `FAILED` needs accepted null or 0; any other mix is `bad-row`.
**Figures.** Use only the rows whose `builder` equals the input `builder` (`runs` = their count; zero rows is fine, not an error). For each field `promptChars`, `miniBaseFiles`, `filesReturned`, `directorCommands` (in this order) compute a figure from the rows with a non-null value in that field: OK values = values of rows with outcome `OK`; BAD values = values of rows with outcome `PARTIAL` or `FAILED`.
- No OK values: `{figure:null, reason:'no-ok-rows', okRows:0, badRows:<count of BAD values>, basis:null}`.
- Else `safe` = the LARGEST OK value. If there are BAD values and the SMALLEST BAD value is at or below `safe`: `{figure:null, reason:'conflict', okRows:<count>, badRows:<count>, basis:null}` (a failure at or below a success: the log does not say where the limit is, so no figure).
- Else `{figure:safe, reason:'ok', okRows, badRows, basis}` where basis is `'OBSERVED'` when okRows is at least `BUDGET_VIEW_TABLE.sampleMinimum`, else `'ESTIMATE'`.
**Vector.** `capacity` holds only figures that exist: `repoFiles` = the `filesReturned` figure, `reviewCommands` = the `directorCommands` figure (key order follows `BUILDER_RESOURCES`). `unknown` lists every `BUILDER_RESOURCES` name that has NO capacity, in `BUILDER_RESOURCES` order, as `{resource, reason}`: for `repoFiles` and `reviewCommands` the reason is that figure's reason (`no-ok-rows` or `conflict`); for the other three names it is `'no-log-field'`. `promptChars` and `miniBaseFiles` are packing figures: they appear in `figures` only, never in `capacity`.
Value key order: `builder, runs, figures{promptChars,miniBaseFiles,filesReturned,directorCommands}, capacity, unknown`. Each figure's key order: `figure, reason, okRows, badRows, basis`.

### B. `packBatch({ cards, overheadChars, history })`
Validation, first failure wins: (1) not a non-array object: `bad-input`; (2) keys not exactly `cards`, `overheadChars`, `history`: `unknown-key`; (3) `cards` not a NON-EMPTY array of objects with exactly `id` (non-empty string, all distinct) and `chars` (positive integer): `bad-cards`; (4) `overheadChars` not a non-negative integer: `bad-overhead`; (5) `history` not an array of objects with exactly `cards` (positive integer), `accepted` (integer 0..cards), `directorTurns` (null or positive integer): `bad-history`.
`history` is the earlier master batches, NEWEST LAST; only the LAST entry is read (an empty array is fine).
**Target size** (reason names the rule that fired, even if the number did not move), then clamp to `minCards`..`ceilingCards`:
1. no history: `startCards`, reason `'start'`.
2. last `accepted` below last `cards`, OR last `directorTurns` not null and above `maxDirectorTurns`: last `cards` minus 1, reason `'shrink'`.
3. else last `directorTurns` null (unknown): last `cards`, reason `'turns-unknown'` (never raise on unknown: unsure goes UP in caution).
4. else (all accepted, turns known and within the limit): last `cards` plus `raiseStep`, reason `'raise'`.
**Packing.** `usable` = `masterChars` minus `overheadChars`. Go through `cards` in the given order, one pass: while `usable` is 0 or below, every card goes to the mini-base with reason `'no-room'`; else if `inMaster` already has `target` cards: `'target-reached'`; else if the card's `chars` exceed `usable` by themselves: `'over-limit'`; else if used + chars would exceed `usable`: `'no-room'` (a later smaller card may still fit: skip and continue); else the card goes into the master (a card exactly equal to the room left fits). `usedChars` = sum of `chars` of the cards in the master (overhead not counted).
**Outcome:** no card in the master: `'NOTHING'`; one or two: `'TOO-FEW'`; `minCards` or more: `'PACKED'`.
Value key order: `outcome, target, targetReason, inMaster` (ids in order), `inMiniBase` (array of `{id, reason}` in card order), `usedChars`.

## Cases, fixture, proof
`docs/BUD6_CASES.md` holds the hand-worked rows (figures per builder, packing rows P1 to P12, vector rows against the existing `budgetView`). `tests/fixtures/builderLogRows.ts` is the real log as numbers (read-only: import `BUILDER_LOG_ROWS`, never edit it). Your test must assert EVERY row of the cases file, every validation error in the order above, the sample-minimum boundary (4 OK rows is `ESTIMATE`, 5 is `OBSERVED`), the conflict boundary (a failure equal to the safe value is a conflict; one above it is not), every packing boundary (exactly `usable`, one over, exactly three cards, the floor and ceiling clamps, only the last history entry counts), frozen results, inputs unchanged, and the link to the broker (`newBudget(capacity)` accepts the ChatGPT capacity and `budgetView` reads it as the cases file says; the empty Claude capacity is refused by `newBudget`). Add a sweep: 2,000 seeded random packings (a tiny seeded generator of your own) where you check the invariants: master plus mini-base is exactly the input cards once each in order; `usedChars` is at most `usable`; master count is at most `target`; a card in the master never has `chars` above `usable`.
**TYPE RULE (a real mistake, CHR2/CHR3, 2026-11-06):** the cloud runs `tsc --noEmit` over `tests/` too, but `tsx` does not type-check. Two lines that read `.error` on an un-narrowed `{ok:true}|{ok:false}` result passed every `tsx` run and failed the cloud lint. In your test, narrow the result (`r.ok ? undefined : r.error`) or cast it before reading `.error` or `.value`. Run `tsc --noEmit --strict` (or `node` plus the repo's tsc if you have it) on your three files and print the result in the report.

## LANE and DONE MEANS
**LANE (create ONLY these 3 files):** `src/budget/batchPlan.ts`, `tests/batchPlan.test.ts`, `docs/reports/BUD6_BATCH_PLAN_REPORT.md`. Do not touch `package.json` (put the exact line to append in the report: `tsx tests/batchPlan.test.ts`), `tools/files.lock`, any existing file, or the fixture. The test prints `BATCH_PLAN OK: <n> checks` and exits non-zero on the first failure.
**DONE MEANS:** the test passes under `tsx` (report the count); strict type check clean on the three files (print it); the LAW CHECK is in the report; the report lists each cases-file row with PASS; the report says what you could NOT run.
**START RULE:** if a file named here is missing from the mini-base, or the cases file and this prompt disagree, STOP and say so; never guess a value.
**HONEST DELIVERY:** anything you could not run is written NOT RUN; a partly passing file is still delivered with its failures listed. Never write that a test passed unless you ran it and print its last line.
**Rival/gap (rule 9):** other planners pick a batch size by feel and call a guess a limit. Here a figure exists only where successes and failures leave room for it, an estimate says it is an estimate, and a size never rises on unknown evidence.
