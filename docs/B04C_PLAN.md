# B04C PLAN: typed execution (Director, 2026-10-28)
Roadmap 7E, 7I and the ledger rows C0a to C2g. This file holds the evidence and the split; the board keeps the story.

## What B04C is
Today `execution` in `src/brain/mind/stages.ts` hands the RAW TEXT to the legacy executor (regex handlers in `localRules.ts`, `textCountCommand.ts`). B04C makes a matched tool run from chat with TYPED arguments only (values found by Meaning, text taken from quoted material or from a clause detail span, never from the whole message), one family per job, each retiring a legacy handler. Only 3 of 63 capabilities have a chat action today (text-counter, dictionary, taught-meanings); 58 are `not-built` in chat.

## Evidence (MEASURED 2026-10-28, `tests/toolRequestAccuracy.test.ts`)
Does Resolution reach the RIGHT tool for a clear request? 57 requests, 28 tools in the five B04C families.
- **Dev corpus** (`tests/fixtures/toolRequests.json`, builders may read it): exact 21/57 (37%); asked with the right choice among others 12; wrong tool 12; nothing 12. Per family: text 7/16, numbers 0/6, time 4/8, create 7/10, files and converter 3/17.
- **Held-out corpus** (different wording, kept OUTSIDE the repository by the owner): exact 11/57 (19%).
- Examples: "Count the words in 'the quick brown fox'" resolves to the translator; "Convert 5 miles to kilometres" asks among audio, case, document and file converters; "What is 15 percent of 240" and "How many days until 2026-12-25" find nothing.
- Reading: a clause with no action verb (a question like "What is 15 percent of 240") has little to match, and typed values (percent, date, quantity with unit) are not used as evidence for a tool. So B04C cannot start with the runners: a runner behind the wrong match answers the wrong question.

## The split (one turn each; every row has a proof)
| ID | Job | By | Size | Proof |
|---|---|---|---|---|
| C0a | measure and ratchet (this package) | D | done | 21/57 dev, 11/57 held-out; ratchet in `test:kernel` |
| C0b-D | design: typed values as EVIDENCE for a tool (percent, quantity, duration, date, time), declared per schema, no word lists | D | done | DONE 2026-10-28: contract rules 8 to 11 in `resolveTypes.ts`, `values` in `schemaTypes.ts`, `tests/valueCases.test.ts` (37 cases) |
| C0b-C | build it in Resolution scoring (section C0b-D below says exactly what) | C | M | dev exact at least 27 and wrong tool not above 11; golden transcript (79) and resolve tests unchanged; `valueCases` passes |
| C0c-1 | schema vocabulary fixes: text-writing and create-encode (13 tools) | C | M | dev and held-out; no hard-coded phrases |
| C0c-2 | schema vocabulary fixes: numbers, time, converter (8 tools) | C | M | same |
| C0c-3 | schema vocabulary fixes: files-convert and the rest (7 tools) | C | M | same |
| C1 | execution contract: `ToolRunner`, argument binder (values, quoted text, detail spans), runner registry, per-tool switch (off means legacy), SHADOW comparison; pilot: text-counter against `textCountCommand` | D | M | pilot reply identical on 50 requests |
| C2a to C2e | runners by family: text A (4 tools), text B (4), numbers and converter (4), time (4), create (5); each adapts an EXISTING engine | C x5 | M each | reply equals the engine's own result on 50 requests per family |
| go-live | per family the Director switches Execution to the runner; replies may change, so each family's golden changes are listed and approved | D | small each | owner sees the changed replies |
| C2f, C2g | files family (7 tools) | C x2 | M each | PARKED: needs files in chat (permission, AI Studio screen) |

## Targets (Director PROPOSALS, owner to confirm)
After C0b and C0c: dev exact at least 85%, held-out exact at least 70%, wrong tool at most 5%. The held-out set is used ONLY by the Director when a builder returns, so a builder cannot tune to it.

## Risks
1. A builder tunes the schemas to the 57 dev requests (rule 13: examples only). Guard: the held-out set; the guard on phrase lists in `src/brain/mind`.
2. Raising accuracy changes which tool answers a message; the golden transcript (79 replies) must stay unchanged until go-live.
3. Text arguments: the legacy handler took the unquoted rest of the message ("count words in hello world"); typed binding must handle a detail span or ask. That choice is made in C1.

## C0b-D DESIGN (Director, 2026-10-28; DONE; the contract is in the code, this is the reasoning)
**Finding (MEASURED, scratch run of the real stages on the 57 dev requests).** Of the 12 "nothing found" requests, 6 carry a strong value and have no concept key to match ("What is 15 percent of 240", "How many days until 2026-12-25", "How many pounds is 3 kilograms", "Count down from 5 minutes"); the other 6 carry no such value. The values stage DOES find what they carry (percent, date, duration, quantity); Resolution only uses values after the match, to list missing slots. The adapter also folds a percent into a plain number.
**Design.** Four additions, all optional so nothing existing changes: (1) `ProvidedSlot.value` keeps the kind (percent stays a number slot AND is evidence); (2) `ActionSchema.values` lists the PRIMARY value kinds a tool is for (0 to 2 of `VALUE_KIND_LABELS`: percent, quantity, duration, date, time); (3) a third key group `v` in the scoring, weighed like any key, matched by identity, times `VALUE_WEIGHT` = 1 (rules 8, 9, 11 in `resolveTypes.ts`); (4) `Common.evidence` says whether the winner rested on concept, value or both (rule 10). Why a new declaration and not "read the slots" as first planned: MEASURED, percent has no slot kind, and the converter declares no quantity slot, so slots alone cannot say what a tool is for.
**Never evidence:** a bare number, a Roman numeral, quoted text. MEASURED: the reader finds the number 64 inside "Base64", and "two files" and "one go" read as numbers. **Trap:** "Is 5 minutes a long time" carries a duration but is not a timer request: a value-only winner is allowed to match, and C1 (execution) decides whether to confirm before running.
**Prototype (scratch only, not in the repository).** Declaring percent for the percentage helper, quantity for the converter, duration for the timer and date for the date calculator: dev exact 21 to 27 of 57, nothing found 12 to 6, wrong tool 12 to 11, asked-with-the-right-choice 12 to 13. A wider declaration set (also split-bill percent, loan duration, date calculator duration) gave only 25, because tools tie and Resolution asks: declare PRIMARY kinds only. The held-out corpus was NOT run on the prototype (the owner keeps it away): C0b-C is scored on it by the Director.
**What it does not fix.** 30 of the 57 requests still miss after the prototype, mostly text and file requests with no typed value (vocabulary: C0c-1 to C0c-3); the targets (85% dev) are far away. Arithmetic ("What is 12 times 7 plus 3") has no value kind: the reader does not read expressions (OPEN_ITEMS 50). Three reader gaps are recorded in `tests/fixtures/valueCases.json` (temperature in degrees, "5 years", "24 hour time"; OPEN_ITEMS 49).
**C0b-C (builder: ChatGPT or Grok), the scope.** Allowed files: `src/brain/mind/schema/actionSchemas.ts` (read an optional last column `values` in the DATA table; declare it for exactly four tools to start: percentage-helper, converter, timer, date-calculator), `src/brain/mind/resolve/resolve.ts` (rules 8 to 11), `src/brain/mind/resolve/clauseInputs.ts` (fill `ProvidedSlot.value`), new tests. Never the contract files, `package.json`, the corpora or the baseline. Proof: dev exact at least 27/57, wrong tool not above 11, `brainGolden` 79 messages unchanged, `valueCases` and `toolRequestAccuracy` pass, a MUTANT test (a bare number gives no key). The Director then runs the held-out corpus and raises the ratchet.
