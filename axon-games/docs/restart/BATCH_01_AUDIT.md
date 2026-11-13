# Batch 01 restart — source audit

Status: **AUDIT COMPLETE / IMPLEMENTATION NOT YET COMPLETE**

## Baseline

Rebuild starts from the original `AXON_Games_Lab_150.zip` source, not the rejected prior Batch 01 ZIP. The original archive has 15 files and an 85,421-byte uncompressed payload. Its package is dependency-free and uses browser modules, localStorage, and Node's built-in test runner.

## First 25 catalogue entries

All first 25 entries are tagged `engine: "memory"`. The current engine does not dispatch on their IDs. It infers a few generic modes from name fragments (`Reverse`, `First and Last`, `position`, `frequency`, `sort`) and sends most entries through ordinary digit-sequence recall. Consequently, several distinct catalogue names currently generate substantially identical gameplay. This is a functional design defect, not merely a missing description.

## Current architecture and gaps

- `src/engine.js`: one shared generator with four legacy difficulty labels (Easy, Normal, Hard, Expert); it uses randomness and name matching rather than explicit game specifications.
- `src/app.js`: one generic renderer for a small set of challenge kinds; no explicit tier/level model and only basic one-shot feedback.
- `index.html`: difficulty selector exposes four levels only.
- `tests/engine-test.mjs`: generates one round per catalogue entry and validates the known answer; it does not verify each game's unique rules or progression.
- `tests/smoke-test.cjs`: catalogue and static-file checks only.
- No browser automation dependency is declared. Chromium is present in this execution environment; browser-based inspection still needs to be established and recorded separately.

## Required restart decisions

1. Keep the first 25 original catalogue entries; do not replace or silently reorder them.
2. Implement each by explicit stable game ID, with a unique objective, input contract, scoring/validation rule, and teaching explanation.
3. Adopt 15 named difficulty tiers. Each tier can contain a game-specific number of playable levels; a tier is not itself a single round.
4. Make challenge complexity increase through distinct reasoning demands, not only longer sequences or shorter timers.
5. Preserve the standalone/offline package and avoid adding dependencies unless a demonstrated need justifies them.
6. Treat visual inspection, actual browser interaction, Android device testing, and engine unit tests as separate evidence categories.

## Baseline test status

The original tests have not yet been run in this restart checkpoint. Their results will be recorded after execution; static inspection is not reported as a passing test.

## Baseline execution evidence (2026-10-30)

- `npm test`: **PASS**. Smoke test reports 152 unique catalogue entries (150 concepts plus 2 legacy carry-forwards), 10 categories, 11 shared engine labels. Engine test generated and accepted its own canonical answer for 152 rounds across 9 runtime challenge kinds.
- Interpretation: these passing baseline tests do **not** establish 25 distinct implementations. They confirm the current generator returns a round and its own validator accepts the generated answer. This is exactly the gap the restart addresses.
- Browser visual capture attempt: **BLOCKED**. Headless Chromium was present but did not complete a 412×915 screenshot within the execution timeout and emitted zygote termination errors. No visual pass is claimed. Playwright/Puppeteer are not installed.
- Physical Android 11 testing: **NOT TESTED**.
