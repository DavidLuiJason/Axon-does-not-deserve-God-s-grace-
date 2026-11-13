# Test report — expanded branch, full-catalogue playthrough audit

Date: 2026-11-12

## Automated suite

Command: `npm test`

Result: PASS for all automated suites in this package snapshot.

- Smoke/catalogue: 171 unique entries; 20 categories; required package invariants present.
- Engine: generated and checked 171 rounds; 9 runtime challenge kinds exercised.
- Progression foundation: PASS.
- Batch 01–06 regression suites: PASS, including their documented randomized checks.
- Batch 07: PASS for 18 games × 15 tiers × 3 levels, teaching metadata, answer validation, Imagine field bounds, and 100 additional Scrambled Words checks.
- Full-catalogue playthrough simulation: PASS for 171 games × 15 tiers × 3 levels = 7,695 generated rounds. Each round was given a correct simulated player action/answer; wrong-answer rejection was checked for scored answer types. Visual selections, Imagine completion, Mastermind exact-code solution, and the Nim UI response mapping were checked.

## Defects found and corrected during the audit

1. Nim UI used zero-based heap button values even though the game answer is 1-based (and uses 0 when no winning move exists). The UI now sends heap values 1–3 and includes a selectable “No winning move (0)” response.
2. “Called but Missing” and “Which Numbers Were Never Called?” lacked teaching rules/steps in their generated rounds. Added game-specific teaching metadata.
3. “Target Number (Attention)” lacked tier/level and teaching metadata. Added them.
4. The landing-page catalogue count was hard-coded to 150 despite 171 entries. It now derives the displayed count from the actual catalogue.

## Verification boundaries

- Browser UI visual/play automation: NOT RUN. A Chromium/Playwright attempt was blocked by the execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`) before the page could load. Therefore this report does not claim that a human physically clicked through every game in a browser.
- Physical Android 11 / 4 GB behavior, touch ergonomics, rotation, and process-death testing: NOT TESTED.
- AXON integration: NOT INCLUDED; Claude approval and inspection of the current AXON source are still required.
- The 7,695-round simulation exercises generated game logic and expected interaction paths, but it is not a substitute for visual browser acceptance or a real human play session.
