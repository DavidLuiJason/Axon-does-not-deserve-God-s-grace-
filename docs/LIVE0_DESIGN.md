# LIVE0: WHO CALLS A RUNNER AFTER RESOLUTION (Director, 2026-10-31). DESIGN ONLY, nothing built. Roadmap 7E stages 5 to 8, 7L 2 and 4.

**What:** the missing link between a Resolution `match`, the binder (BIND-FEED, built) and a tool runner (built, switches all OFF), so a tool can go live without waiting for the unbuilt Dialogue, Planning and Verification stages. Rival/gap (rule 9): assistants that call tools do it through a model that fills the arguments; AXON must do it through typed, traced stages and never give a different answer than today unless the owner switched that tool ON. Gap today (MEASURED by reading the code, 2026-10-31): stages 6 dialogue, 7 planning and 9 verification are `not-built`; stage 8 `execution` just calls the legacy provider chain (`legacy.ts`); nothing outside tests uses `execute`, the switches or the binder.

## 1. Where it sits (FL1, FL12)
A DIRECT LANE inside stage 8, written as its own pure-ish function in its own file (`src/brain/mind/directLane.ts`) so Planning can call the same function later (it is the FAST path of 7E: one capability, slots filled, exact engine). Layer map: 5 Resolution -> [binder feed] -> DIRECT LANE -> runner (`execute`) -> reply; every other case falls through to the legacy executor UNCHANGED. Later additions: Dialogue (asks), Planning (several steps, the 7A loop in `src/brain/mind/loop`), Verification (second path) plug in around the lane; the lane does not need to change.

## 2. The rule: the lane answers only when it is certain it answers like today, else it yields
Every yield is a trace entry with a plain reason (FL15 loud). The lane runs only when ALL hold:
1. no provider holds a conversation (a pending ask or teaching dialogue owns the message; needs `holdsConversation()` added to the legacy executor: `providers.some(...)`);
2. the switch for the tool is ON (`liveSwitches.ts`, section 4) and a runner exists;
3. the message has exactly ONE piece and exactly ONE resolution, a `match`, `mayRunAlone` true (several pieces, linked or conditional clauses: legacy, until Planning exists);
4. the Meaning reading carries no teaching, negation, relay or `needsPrevious` (a taught meaning of the same words must not be bypassed: HYPOTHESIS that local-rules would otherwise answer it; the end-to-end test in LIVE1b includes one);
5. the binder decides `run` (not `ask`, not `confirm-first`): asks and costly tools stay with legacy dialogue;
6. the tool's runner needs no stored state (`deps.state`): the 11 time-family runners keep legacy until a STATE design says who stores the state (new gap, section 6);
7. tool-specific safe-guards declared by the tool, not by the lane (Text Counter: the text holds no code region and is not "unsure", because legacy adds a code note that the runner does not; the lane uses the SAME `detectCodeRegions` (FL14) and yields).
Then: `execute()`; if the outcome is not ok, or anything throws, YIELD to legacy (the owner sees today's answer, the trace says why). Reply = runner `reply`; the binder's `understood` sentence is added ONLY when the binder used a default (`assumptions` not empty), the owner-approved "say it aloud" rule (2026-10-28). `source` = `runner:<tool id>` (the UI does not read it: grep of `.tsx`, MEASURED).

## 3. Proof (FL4)
- LIVE1a (pure lane): `tests/directLane.test.ts`: every condition in section 2 has one check that yields and one that runs; mutants: each condition removed, error swallowed to a wrong answer, `understood` always added, state tools allowed; guard `brainBoundary` still passes.
- LIVE1b (hook + end to end): stage `execution` calls the lane, `holdsConversation()` added; test through `createMind` with STUB providers on the 50 text requests: lane OFF = byte-identical replies to today for all 50; lane ON for text-counter = reply equals the legacy reply (whole text, notes included) wherever the lane runs, legacy answers elsewhere; counts derived, never targeted; wrong or different answers must be 0 before LIVE2.
- LIVE2 (go-live, behaviour changes): flip `text-counter` to `runner`; owner machine check on the phone (owner step, once a day); switch back = one line.

## 4. The switch (owner decision wanted only as a veto)
One file `src/tools/runners/liveSwitches.ts` exports `LIVE_SWITCHES` (a copy of `DEFAULT_SWITCHES` with a family's tools set to `'runner'` at its go-live), plus `tests/liveSwitches.test.ts` that PINS the list: turning any tool ON changes that test on purpose, so it is never an accident. No user-facing toggle (that belongs to 7M if the owner wants it).

## 5. Jobs (Director builds; sizes are estimates, UNMEASURED; BATCH LAW: two related)
- **LIVE1a** pure lane + switches file + 2 tests: 3 new files; size 4 of 10.
- **LIVE1b** `execution` hook, `holdsConversation()`, end-to-end test on 50 requests: 3 edited files plus 1 test; size 4 of 10. Both in one turn only if within ~12 commands, else two turns.
- **LIVE2** go-live text-counter (text-counter only first; the four other text runners follow in their own check). Size 2 of 10 plus the owner's phone check.
- **PARTS-TEXT** (RESOLVE-TC part 6, Meaning side; after LIVE2): the 4 unquoted-text requests that ask (34 -> up to 38 of 50). Causes: "how many words are in the quick brown fox": the printed structure shows `object` = "fox" and no detail, so a word such as "brown" was taken as the main verb (HYPOTHESIS from `clauseParts.ts` lines 96 to 104); "count letters of abcdef": `of` is not a marker (HYPOTHESIS: `DETAIL_WORDS` not read; adding a word to that closed set needs the owner's yes, FL13); "word count: plain words follow": a colon is not a word, so no marker; "count the words in this is plain text": cause NOT YET FOUND. Each fix measured on the same 50 plus the Resolution scoreboard (no regression).
- **Then:** REP0 + REP1; converter schema split before the numbers family; STATE design before the time family.

## 6. New gaps for the gap ledger (7L; roadmap NOT changed this turn, UPDATE LAW; add at the next roadmap turn)
(a) who stores `deps.state` for timer, stopwatch, tally counter; (b) runner replies carry no code note: lane yields (section 2 rule 7) until the note logic moves into one shared function (FL14); (c) taught-meaning bypass risk (section 2 rule 4), unmeasured; (d) several pieces in one message stay legacy until Planning.

## 7. Verdicts (rule 12; probabilities are HYPOTHESES)
- Direct lane for stateless single-step tools: WORKS ONLY IF the yield conditions hold and the end-to-end test shows identical replies; about 80%.
- Several-step messages ("count words in X and reverse it"): WILL NOT WORK in the lane; they need Planning (B06A), still unplanned (7L 2).
- Stateful tools (time family): WORKS ONLY IF the state design is approved; CANNOT JUDGE today.
- "Switch every tool on at once": WILL NOT WORK as a safe step; one family at a time, each with the machine check.

## 8. Laws touched (FL11)
FL1 map; FL4 measure before and after, Two-Strike; FL9 stage order kept; FL10 chat reaches the tool, registry declares it; FL12 the lane is stage 8 output of stage 5 input, no bypass; FL13 no phrases (tool-specific guards are declared by the tool, any new closed word needs the owner); FL14 one source (`detectCodeRegions`, descriptors); FL15 yields and failures are loud in the trace; BATCH LAW; Director care law (sized, split in two jobs).
