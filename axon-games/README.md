# AXON Games Lab — Expanded Branch 07

Offline-first, dependency-free browser prototype for the AXON Games Lab catalogue. This branch starts from the user's Batch 06 package, preserves its existing games and regression suites, and adds 18 new playable challenge prototypes (171 catalogue entries total).

**This is a separate Games Lab project. AXON does not yet have a built-in Games Lab, and this package is not integrated into AXON.** It is prepared for Claude Director review and approval.

## Run locally

Requires Node.js for automated tests. To run the browser app, serve this directory with a static HTTP server:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Verify

```bash
npm test
```

## Batch 07 additions

Imagine; Scrambled Words; What Would You Do?; Find a Way to Escape; Escape Room; The Detective; The Interrogator; The Negotiator; The Strategist; The Impostor; The Paradox; The Architect; The Survival Planner; The Investigator; The Codebreaker; The Experimenter; The Deceiver; The Systems Breaker.

`Find the Loophole` was already present and was not duplicated. Maze Master remains the existing maze game. See `docs/restart/BATCH_07_REPORT.md` for mechanics, test evidence, and limitations.

## Acceptance status

- Automated suites for existing Batches 01–06, new Batch 07, and full-catalogue simulated playthrough: PASS.
- Browser visual inspection: NOT TESTED.
- Physical Android 11 / 4 GB testing: NOT TESTED.
- Simulated player playthrough: PASS for 171 games × 15 tiers × 3 levels (7,695 rounds). Browser-based human/UI playthrough: NOT RUN because Chromium navigation was blocked by the execution environment.
- AXON integration: NOT INCLUDED; requires Claude's review against the real AXON source and APIs.
- Chess, Draughts, Go, and Reversi are not complete board engines; Maze Master is a guaranteed-solvable serpentine route challenge. These limits are documented, not hidden.

See `docs/BRANCH_INFO.md`, `docs/CLAUDE_HANDOFF_PROMPT.md`, `docs/TEST_REPORT.md`, and `docs/restart/BATCH_07_REPORT.md`.

## DT3 audit (2026-11-13)
Run `npm test` (14 suites). New: `tests/oracle-audit.test.mjs` (answers recomputed independently), `tests/depth-floor.test.mjs` (no one-question games), `audit/` (dev tools). Read `docs/GAMES_AUDIT_REPORT.md` and `docs/GAMES_INVENTORY.md` (copies live under the repository docs/ folder). Randomness goes through `src/random.js` so a host can inject a governed source.
