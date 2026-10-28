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
| C0b-D | design: typed values as EVIDENCE for a tool (percent, date, quantity with unit, number base, quotes) read from each schema's declared slots, no word lists | D | S | contract file plus a written corpus of value cases |
| C0b-C | build it in Resolution scoring | C | M | dev exact up; golden transcript (79) and resolve tests unchanged |
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
