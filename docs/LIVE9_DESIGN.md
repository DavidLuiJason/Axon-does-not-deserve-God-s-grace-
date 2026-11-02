# LIVE9 DESIGN: Sort Lines goes live, the third tool ON (Director, 2026-11-02; notes only, NO code; roadmap 7E stage 8, 7L 2)

**What:** the same road Case Converter took (LIVE8): kernel task action, closed mode words, live choices, switch ON, proof. Rival/gap (rule 9): chat assistants sort lines by guessing in a model; AXON sorts with the exact engine `sortLines.ts` and shows the line count. Layer 5 (reach), on top of Resolution and the direct lane. Builder: the Director (hot files `axonEngine.ts`, `registerAxonTools.ts`, `liveSwitches.ts`, `package.json`, golden regeneration, real-dictionary measurements; builders cannot run these). Roadmap not changed (no law, direction or item changed).

## 1. Facts read from the code (MEASURED by reading, 2026-11-02; runtime NOT RUN)
- Runner `sort-lines` exists in `textRunners.ts`; engine modes: ascending, descending, by-length, natural, reverse, shuffle; options `ignoreCase`, `removeDuplicates`, `ignoreBlankLines`; `mode` is already an ENGINE-DEFAULT slot (ascending when not given).
- No kernel action `text.sort`, no chat action, no `LIVE_CHOICES` entry, no mode-word file: the same four gaps LIVE8 found for Case Converter.
- Shuffle needs an injected random function; the lane must pass a real one and the test a seeded one (HYPOTHESIS: `deps.random01` exists in the lane; part 2 checks).
- Sort Lines has no old chat handler, so the proof is known-answer replies plus "0 changes to any other reply", not "identical to today".

## 2. OWNER DECISION NEEDED (FL13: a new word in a closed set needs your yes). Word on the left, engine mode on the right
ascending, alphabetical, alphabetically = ascending | descending = descending | length = by-length | natural = natural | reverse = reverse | shuffle, random, randomize = shuffle.
Open points: (a) "reverse alphabetical" would read as `reverse`, which flips the lines and does not sort: the design says AXON ASKS when `reverse` comes next to `alphabetical`, never guesses (HYPOTHESIS, part 2 measures); (b) "numerically" and "a to z" are NOT proposed, they can be added later one group at a time; (c) the three yes/no options are not filled from chat words; their defaults (off) are SAID aloud (owner rule 2026-10-28). Answer: "yes" (as written), "yes, but change ..." or "no". (For Case Converter you said "choose it yourself": the same answer is fine here.)

## 3. Parts (one turn each; each ends with a deliverable; cost of each in commands and jobs is written on the board, which is the honest answer to the speed question)
- LIVE9-1: `src/tools/textSortAction.ts` (kernel action `text.sort`, NOT registered yet, as LIVE8-1), its test with a seeded random; size 2 of 10.
- LIVE9-2: `src/tools/runners/sortModeWords.ts` (closed set), `LIVE_CHOICES` entry, fold word to engine mode; measure with the real brain how many of 40 sort requests Resolution reads as Sort Lines; fix at the source if the reading is wrong, never with phrase lists (FL13); size 4 of 10.
- LIVE9-3: register `text.sort`, chat action `act.sort-lines` (FL10), `LIVE_TASKS` entry, switch ON, pin test `['case-converter','sort-lines','text-counter']`, regenerate `brainGolden.json` on purpose (only the "what can you do" lists should change), real-brain run of about 60 messages (answers right, task record present, 0 other replies changed), deliberate breakages caught; then the owner's phone check of four messages; size 4 of 10.
- Then Text Compare the same way (it also needs a `mode` word set and an owner yes).

## 4. Verdicts (rule 12; probabilities are HYPOTHESES)
Sort Lines through the lane: WORKS ONLY IF Resolution reads the sort verbs correctly (about 75%; the Case Converter reading needed one source fix). "sort these and remove duplicates": WORKS DIFFERENTLY (two options; it asks or says the default it used). Several tools in one message: WILL NOT WORK in the lane (Planning, 7L 2).

## 5. Laws touched (FL11)
FL1 map; FL4 measure first, Two-Strike; FL10 chat action declared with the switch; FL12 the lane is stage 8 of stage 5; FL13 closed set needs the owner's word; FL14 one engine for screen, runner and task; FL15 yields loud in the trace; BATCH LAW (parts one per turn); Director care law.

## 6. LIVE9-2 MEASURED (Director sandbox, real brain and dictionary, lane ON for Sort Lines in a scratch run; 30 requests; 0 answered, as expected before LIVE9-3)
Why the lane yielded (counted from the run): the BINDER SAYS ASK for plain requests such as `sort the lines "b\na"`, `please sort "b\na"`, `sort "b\na" naturally`: Resolution matches Sort Lines (1 match, router fast or ask) but the binder asks because Sort Lines has no declared default for `mode` in `bindDefaults.ts` (CAUSE read, HYPOTHESIS until fixed). NO SINGLE SURE TOOL for `by length`, `reverse the lines`, `alphabetize`, `order ... alphabetically`, `randomize`: Resolution reads 1 question, 0 matches (a reading problem, NOT yet measured why; `length` and `reverse` are also words of other tools). `shuffle the lines` went to the Random Picker (its switch is OFF, so it yielded). `descending` and `ascending` reach the end and yield only because `LIVE_TASKS` has no `sort-lines` entry (LIVE9-3). FIXED in this part: the runner now folds the mode word (`alphabetically` was refused as "Choose one of the available options"); closed set file, `LIVE_CHOICES` entry (inert while the switch is OFF) and 33 checks. SWITCH STAYS OFF.
**OWNER DECISION NEEDED #2 (FL13, `bindDefaults.ts` is owner-approved): the default for `mode` is `ascending` (A to Z), always SAID aloud ("I sorted A to Z because you did not say how").** Answer "yes" or "no".
NEXT (LIVE9-2b, Director, own turn): add that default, then measure WHY Resolution gives no match for `by length`, `reverse`, `alphabetize` and fix at the source (never phrase lists, FL13); then LIVE9-3.
