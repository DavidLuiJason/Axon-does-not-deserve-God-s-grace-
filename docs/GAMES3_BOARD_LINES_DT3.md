# DT3 lines for the shared files (paste by hand; the shared files are newer than the zip this was built from)

## DIRECTOR_NAP.txt board: REPLACE the DT3 line with (under 300 characters)
DT3 (2026-11-13): AXON GAMES. Lab audited; TypeScript layer + screen contract done (src/games/). Next: registration merge (own Games group) once DT3 has the current main zip and an AI Studio screen exists. No AI Studio prompts from me.

## NOW.txt (replace the GAMES part)
GAMES: src/games/ screen contract done by DT3 (docs/GAMES_SCREEN_READINESS.md); NEXT for DT3: registration merge, needs the CURRENT main zip; owner chose Option A (Games is its own Tools group).

## MERGE_TAG.txt (new first line)
2026-11-13 | GAMES3 [src/games/interactions.ts, notes.ts (new), src/games/index.ts (changed, DT3 lane), tests/gamesScreenModel.test.ts (new), tests/gamesApi.test.ts (changed, DT3 lane), docs/GAMES_SCREEN_READINESS.md, docs/GAMES_REGISTRATION_EDITS.md, docs/GAMES3_BOARD_LINES_DT3.md, workstreams/AXON_GAMES.txt] | typed screen model for all nine round layouts, grid and code-breaker rules ported out of the old lab screen, hub sections; a perfect player finishes 6,273 rounds through the logic layer; no hot file touched; root build and test:all NOT RUN here | READ docs/GAMES_SCREEN_READINESS.md next

## docs/JOB_BOARD.md (append)
2026-11-13 | DT3 | GAMES3 (part a) | Owner chose Option A: Games is its own Tools group. Found that the old lab screen held real game logic (Mastermind scoring, grid checking, timing, Nim choices) that the TypeScript layer lacked; ported it to src/games/interactions.ts with a typed screenModel for every round (9 layouts), hub sections (12), honest game notes. Proof: tests/gamesScreenModel.test.ts: Mastermind scoring equals an independent reference on 20,000 guesses, and a perfect player finishes 6,273 rounds using only the logic layer; parity (15,390 rounds) and API tests still green; tsc --strict clean. Wrote docs/GAMES_SCREEN_READINESS.md for whoever writes the AI Studio prompts and docs/GAMES_REGISTRATION_EDITS.md for the registration merge. NOT RUN: repository build, npm run test:all, browser. OPEN: registration needs the current main zip. AXON Games is not finished after it: progress and tier unlocks (owner rules), the screen, depth waves, a second reader.
