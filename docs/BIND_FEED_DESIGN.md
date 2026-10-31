# BIND-FEED: DESIGN (Director, 2026-10-31). DESIGN ONLY, nothing built. Jobs BF1 + BF2.

**What:** a pure function that turns what the real stages already produce (Meaning structure, segments, values, Resolution matches) into the `BindInput` that `bindArguments` takes. Rival/gap (rule 9): chat assistants pass the raw sentence to a model; AXON must hand its binder exact, typed spans. Gap today: only the pilot test builds `BindInput`, with stand-in logic.

## 1. Where it sits (FL1)
After 5 RESOLUTION, before 7 PLANNING / 8 EXECUTION. It does not run a tool (FL12) and does not decide (act-or-ask is Dialogue/Planning). Later additions: every tool family reuses it; REP stage readings arrive as extra Resolution matches and need no change.

## 2. Contract
`buildBindInputs({ message, segments, structure, values, resolutions, choicesFor }) -> { piece, input: BindInput }[]`
- One item per Resolution result with `kind === 'match'` AND `mayRunAlone === true`. Everything else (ask, none, unavailable, negated, not-a-request, a conditional piece) yields NO item: the dialogue stage handles those; a conditional never runs alone (owner-confirmed, 7B).
- `tool`, `evidence` from the match; `toolName` from the tool facts (injected, no copy of names); `choices` from the injected `choicesFor(tool)` (the runner descriptor, FL14); the adapter itself knows NO tool (FL13).
- `message` = the whole utterance; every span is a character range into it (what `bindArguments` expects).
- `words` = the piece's `structure.words` (norm, start, end). `values` = extracted values whose range lies inside the piece. `materials` = segments of kind `material` inside the piece.
- `details` = the piece's `parts.details` converted from word ranges to character ranges, WITHOUT the marker word. OPEN FACT: whether `Detail.from` already excludes the marker is NOT yet read; BF1 checks it in `clauseParts.ts` first and a test pins it.
- `references` = each pointer of `piece.refs.pointers` (word index `at`) as a character range.

## 3. What the real run showed (MEASURED, 50 text requests, real stages and dictionary, 2026-10-31)
- The doubt was real, in a different place: the real references stage did NOT read `above` or `following` as pointer words, so "count words in the above" ran on the text "the above" (2 wrong confident answers). Fix (Director choice, owner may overrule): both words join the `earlier` group in `refWords.ts`; an `earlier` pointer is by the references rule preceded by a determiner, so the feed makes its span the whole phrase ("the above", "the last one"), no word list in the feed.
- Unquoted text after `in`, `of` or a colon is NOT exposed by the real parts (the text sits inside the object or nowhere), so 4 requests ask where the old handler ran ("how many words are in the quick brown fox", "count letters of abcdef", "count the words in this is plain text", "word count: plain words follow"). Safe (asks), not wrong. Needs a Meaning-side design (not a feed fix).

## 4. Proof (FL4)
- BF2 measures on the 50 text requests with the real stages and dictionary (`cp docs/director/resolveTcMeasure.ts.txt` style script; top-level await, so the script lives inside the repo). Report, derived never targeted: same args as the pilot's stand-in; different args; asked instead; run with WRONG text (must be 0); legacy handler agreement.
- Mutants, each must fail a named check: details keep the marker; references left empty; `mayRunAlone` ignored; a non-match resolution fed; values outside the piece kept.
- Guards: `src/brain/mind` rules (no regex literals, no arrays of 3+ string literals, no phrase lists); `brainBoundary` still passes.

## 5. Out of scope (honest)
Who calls a runner after Resolution (Planning and Execution, UNPLANNED, 7L 2) and the per-tool switch: LIVE0 design job. Phone speed of the feed: NOT MEASURED (it only walks one message's spans; expected negligible, HYPOTHESIS).

## 6. Verdict (rule 12; probability is a HYPOTHESIS)
WORKS ONLY IF the real Meaning spans carry what the stand-in carried (the pointer width above is the known doubt). About 75% that BF2 reaches the pilot's 50 of 50 on the first run without a fix to the reading stages; the rest is expected to be small span fixes inside the feed.

## 7. Laws touched (FL11)
FL1 map; FL4 measure before and after, Two-Strike; FL12 no stage bypass; FL13 no phrases, adapter knows no tool; FL14 one source (descriptor choices, tool facts injected); FL15 spans and readings stay labelled INFERRED where they are; Director care law: sized before building.
