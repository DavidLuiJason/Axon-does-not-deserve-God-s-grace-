# BIND-FEED board lines (append to docs/JOB_BOARD.md when convenient; Director, twenty-third account, second turn, 2026-10-31)

## Owner decisions recorded (owner dictation 2026-10-31; owner may overrule any Director choice)
1. The word `much` as a second-reading closed set (FL13): CONFIRMED (owner: "if you also agree"; Director agrees: MEASURED 49 of 50, wrong confident answers 0, verb-backing guard in place; "how much is 12 times 3" stays a separate gap, 7L 4).
2. Repair-stage questions: DIRECTOR CHOSE (see the DECIDED line at the end of `docs/REPAIR_STAGE_DESIGN.md`): exact repeats plus markers `wait` and `oops` only when a whole piece; limits 3 and 4; R5 out.
3. "AXON's way of replying": owner dropped it (thinking aloud). Nothing recorded as a wish.
4. NEXT job: DIRECTOR CHOSE BF1 + BF2 (BIND-FEED), then REP0 + REP1. Reason: the text family is the open job (FIRST SCREEN 1) and its chain is not proven on real stages: Reading and Resolution are measured (49 of 50), but nothing builds the binder's input from real Meaning output.

## FINDING (MEASURED by reading the code, not by a run)
`bindArguments` has NO caller under `src/` (grep, 2026-10-31); `BindInput` is built only in `tests/textCounterPilot.test.ts` and `tests/argumentBinder.test.ts`, where the pilot stands in for Meaning (unit word, quote, detail span, pointer words). The real pipeline stops after Resolution (`ctx.resolutions`). So "wire `readReferences` into `BindInput.references`" is only one field of a larger missing piece: the whole feed from `ctx` to `BindInput`. Who CALLS a runner after Resolution is Planning and Execution (7E stages 7 and 8), which are UNPLANNED (7L 2): GO-LIVE cannot be a one-step switch. Needs its own design job (LIVE0) before any switch; the switch stays OFF.

## Jobs (sizes are Director estimates, UNMEASURED; Director builds both itself; BATCH LAW: two related jobs)
- **BF1 [feed adapter]:** pure `src/brain/mind/bind/bindFeed.ts` + `tests/bindFeed.test.ts`; contract in `docs/BIND_FEED_DESIGN.md`. About 1 file under 150 lines plus 1 test. Size 3 of 10.
- **BF2 [real-stage measurement]:** `docs/director/bindFeedMeasure.ts.txt` runs the 50 requests through the real stages, feeds, binds, and compares args and decision with the pilot's stand-in and with the legacy handler. Size 3 of 10. One turn for both if it stays within 12 commands; otherwise BF1 then BF2.
- **REP0 [repair corpus and baseline] + REP1 [R1 exact repeats, markers, R2 pairs as pure engine]:** after BF2. Sizes UNMEASURED (7L).
- **LIVE0 [design: who calls a runner after Resolution]:** after REP1 unless owner moves it up; design only.
- Then: converter schema split before the numbers family; owner machine check once a day.

NOT RUN: full test suite, cloud build, owner machine check, any new measurement this turn. Roadmap: NOT changed (UPDATE LAW: nothing here is a law, direction or new item; the finding and jobs live on the board).
