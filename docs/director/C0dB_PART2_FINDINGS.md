# C0d-B PART 2 of 4: throwaway prototype for cause A (Director, nineteenth account, 2026-10-29)
Evidence labels: MEASURED = printed by the real stack in my sandbox; DIRECTOR READING = my judgment; HYPOTHESIS = not tested. Scratch only: nothing in the repository changed. The diff is evidence, not code to merge (`C0dB_PART2_prototype.diff.txt`).

## What I changed (scratch copy of zip "main 5")
Where the verb comes from (MEASURED by reading the code): `meaning/structure/clauseParts.ts` picks `parts.verb` as the FIRST word with any verb sense that is not an auxiliary and does not follow a determiner. `resolve/clauseInputs.ts` passes it on to Resolution. So "characters", "times", "type", "batch" win because they also have a verb sense.
Prototype = three structural guards, no phrase lists, in the main-verb loop (plus five optional flags passed from `glue.ts`):
1. A word that is also a noun and has an auxiliary LATER in the clause is its subject, not the verb.
2. After a plain (non-modal) auxiliary that is not followed by a subject pronoun, a word with a noun or adjective sense is the complement, not the verb (words ending in "ing" are kept as verbs).
3. A noun-or-verb word directly before another verb that is followed by a determiner or possessive is a modifier.

## Numbers (MEASURED, real dictionary)
| Corpus | Before | With prototype |
|---|---|---|
| dev exact | 31/57 | **31/57** (no gain) |
| dev, split | right choice 10 / wrong tool 10 / nothing 6 | right choice 9 / wrong tool 9 / nothing 8 |
| dev2 exact | 11/26 | **11/26** (no change) |
| golden transcript | 79 messages | **79 messages, 242 field checks pass** |
| held-out | 18/57 | NOT RUN (file not attached) |
| `structureRunner` | OK | OK |
| `structureGlue` | OK | FAILS: its mutant looks for the old text of `glue.ts` that I edited ("text not found"); a side effect of the patch, not a behaviour regression (DIRECTOR READING) |

Only 3 of the 9 cause-A cases changed at all, and none became exact:
- "How many characters are in this sentence": verb is now the copula; result went from wrong tool to nothing.
- "What type of file is this and how big is it": was asked-with-right-choice, now nothing (a loss).
- "Batch convert my photos to jpg": verb is now "convert"; still the wrong tools (picture-to-table, collage-maker).
The other six cause-A cases did not change. I did not print their new verbs, so why my rules did not fire on them is HYPOTHESIS (for "Is this sentence correct" my own "not followed by a subject" guard probably blocks it, because "this" is a subject word).

## GO / NO-GO
**NO-GO for "fix the verb in `clauseParts` and expect dev to rise."** Gain is 0 exact on dev, 0 on dev2, one loss in category. This confirms the caveat in Part 1 (point 5): a correct verb alone does not reach the right tool, because the next layers have nothing to match (no counting concept for "characters", no arithmetic concept for "times", the format-name noun still outweighs the verb).
**First strike on this approach (Two-Strike Rule).** Failed assumption: that the verb pick in the clause parts is the binding lever. Layer analysis: the verb is now right in 3 cases, but Resolution scoring and the tool concepts decide the result, so the lever is downstream (C0d-D weigh verb and details, C0d-C closeness). I will not tune the guards again to chase the number.

## Recommendation (the Director picks, per roadmap)
- Do NOT write Part 3 (design and tests) for the verb guards as they are. Reorder: **C0d-D [weigh the verb and the details] first**, because it covers cause B (3) and the cases where the verb is already right but loses to a noun, and it is where the three improved parse results would turn into exact ones.
- Keep guard 1 and 3 as a possible small add-on later only if a numbers test shows a gain.
- Next turn (one part): **Part 2b**, measure only: print verb and top three candidates for the 9 cause-A and 3 cause-B cases with the prototype in place, to see exactly which layer loses each one. No code written.

## Honest accounting
This part used about 17 commands (budget was about 12): 4 went to getting the baseline to run (the sandbox has no `jszip`, so I added an empty stand-in in scratch only; one shell error). No full test run. Nothing was lost: this file and the diff are the deliverable.

## Board lines (copy into `docs/JOB_BOARD.md` when you next merge)
2026-10-29 (Director, nineteenth account): **B04C0d-B Part 2 [prototype for wrong verb or clause] DONE, result NO-GO.** MEASURED (real dictionary): the verb pick in `clauseParts.ts` was changed with three structural guards; dev stays 31/57, dev2 11/26, golden 79 (242 checks); 3 of 9 cause-A cases changed their verb, none became exact, one lost its right choice. Reading: the verb is not the binding lever; Resolution scoring is. NEW ORDER (Director, proposal): C0d-D [weigh verb and details] before C0d-B Part 3; Part 2b (measure only) next. NOT RUN: held-out corpus, owner machine check, cloud build. No repository change.
2026-10-29 (Director, nineteenth account): board catch-up from the zip (RECONSTRUCTED from file names and `docs/reports/`, not from the earlier chats): C27 colour engine, C28 DC circuit engine, C29 physics engine, C30 shelf format, C31 loop skeleton with fake tools are IN the repository (files present in the "main 5" zip, which is identical to "main 4"). C31 detail is in `docs/director/C31_BOARD_LINES.md`. Owner step still open: add `&& tsx tests/loop.test.ts` to `test:kernel` in `package.json` (not yet there). C29 tests and mutants never run (roadmap v20.2).
INTAKE_LOG: 2026-10-29 (Director, nineteenth account): roadmap v20.2, main zip (two copies, identical), C0dB_PART1_FINDINGS.md; Part 2 prototype run. Roadmap not edited.
