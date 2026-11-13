# Claude Director review — AXON Games Lab expanded branch

You are the architecture authority and approval gate. Review the attached `AXON_Games_Lab_Expanded_Branch_07.zip` as a separate Games Lab project. AXON itself does not yet have a built-in Games Lab; do not assume integration has occurred.

## Required review
1. Inspect the full source tree, package manifest, catalogue, all game modules, and all tests. Do not rely only on this handoff.
2. Run `npm test` from the package root and record exact output, including the full-catalogue simulated playthrough suite.
3. Review the 18 Batch 07 additions individually for duplicate mechanics, correctness, teaching quality, and meaningful tier progression.
4. Specifically inspect Imagine's open-ended mental-imagination flow; Scrambled Words versus Anagram Solver and Sentence Reconstruction; Maze Master versus Escape Room versus Find a Way to Escape; and the existing Find the Loophole.
5. Verify the 171-entry catalogue count and unique IDs/names.
6. Identify shallow scenario pools, fixed answers, incorrect premises, and any game that is only a renamed generic quiz. Require repair where needed.
7. Do not claim all 171 games are bespoke engines. Existing documented limitations remain, including incomplete named board-game engines and the serpentine-only Maze Master.
8. Do not integrate into AXON until you inspect the actual current AXON source and map real navigation, overlay, persistence, theme, export, resource-governor, and capability APIs. No invented APIs.
9. Keep all additions on the review branch until approved. Preserve existing visuals, dependencies, and unrelated files.

## Evidence and status
The package's test suite passed when assembled. A 7,695-round simulated player playthrough passed across all 171 entries, 15 tiers, and three levels. Browser visual/interaction testing was NOT RUN because Chromium navigation was blocked by the execution environment. Physical Android 11 / 4 GB testing remains NOT TESTED. Report PASS / FAIL / BLOCKED / NOT TESTED separately. Do not promise perfection or release readiness without evidence.

## Owner's required outcomes
- A clear implemented-vs-planned inventory.
- A game-by-game Batch 07 review and corrections.
- A truthful test report.
- A safe, separately reviewable Games Lab package.
- An AXON integration plan only after source/API inspection and approval.
