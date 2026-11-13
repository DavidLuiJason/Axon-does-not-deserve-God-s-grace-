# Batch 07 — Expanded Games Branch

**Branch label:** `games-lab/expanded-games`  
**Base:** user's Library copy of `AXON_Games_Lab_Batch_06.zip`  
**Catalogue:** 171 entries (153 existing entries + 18 additions)  
**AXON integration:** NOT INCLUDED; AXON does not yet have a built-in Games Lab.

## Added games

1. Imagine
2. Scrambled Words
3. What Would You Do?
4. Find a Way to Escape
5. Escape Room
6. The Detective
7. The Interrogator
8. The Negotiator
9. The Strategist
10. The Impostor
11. The Paradox
12. The Architect
13. The Survival Planner
14. The Investigator
15. The Codebreaker
16. The Experimenter
17. The Deceiver
18. The Systems Breaker

`Find the Loophole` was already present as an additional catalogue entry (not re-added). `Maze Master` remains the existing Game 130. `Anagram Solver` and `Sentence Reconstruction` remain distinct from Scrambled Words.

## Implementation scope

- Added a separate `src/games/expanded-games.js` module and routed the 18 new IDs through the existing round factory.
- Every new game generates rounds across 15 tier labels and three level variants, with game-specific rules, teaching steps, and a tier-focus progression statement.
- Imagine has an open-ended completion flow, optional description field, and a generated SVG field with dots / shapes / lines / abstract points. No image description is required and the user's imagination is not graded.
- Scrambled Words has category hints and case-insensitive word checking.
- Scenario/deduction games use structured prompts, choices, explanations, and validation. This is a first playable implementation, not a deep narrative simulator or a general-purpose AI opponent.
- No new runtime dependencies, network services, or AXON host APIs were introduced.
- Existing catalogue games, shared history mechanism, and theme system were retained.

## Automated verification

`npm test` passed after changes. It ran:
- smoke/catalogue checks: 171 unique IDs and names;
- engine round validation: 171 generated catalogue rounds;
- progression foundation tests;
- Batch 01 through Batch 06 regression suites;
- expanded suite: 18 games × 15 tiers × 3 levels, checking generation, teaching metadata, expected-answer acceptance, deliberate wrong-answer rejection, and Imagine visual-field bounds;
- 100 additional randomized Scrambled Words answer checks, including uppercase input.

The final package must be clean-extracted and retested by the receiving reviewer; this is recorded separately below.

## Full-catalogue playthrough audit (2026-11-12)

A further audit exercised every catalogue entry across all 15 tier labels and three level settings: 171 × 15 × 3 = 7,695 generated rounds. Each generated challenge was given a simulated correct player action/answer, with deliberate wrong-answer rejection checked for scored answer kinds. Special paths for visual-grid selection, open-ended Imagine completion, Mastermind exact-code completion, and Nim heap selection were checked.

The audit found and corrected four defects: Nim's UI heap numbering / missing zero option; missing teaching metadata in Called but Missing and Which Numbers Were Never Called; missing teaching metadata in Target Number (Attention); and the stale hard-coded “150 playable” landing-page count. The new `tests/full-playthrough-test.mjs` is included in `npm test` so this coverage is repeatable.

## Honest limitations / approval gates

- Browser visual inspection and browser-based interaction: NOT RUN. A Playwright/Chromium attempt was blocked before page load by the environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). The simulation is not represented as a human browser playthrough.
- Physical Android 11 / 4 GB touch, memory, rotation, and process-death testing: NOT TESTED.
- Simulated correct-action playthrough: PASS for all 171 entries × 15 tiers × 3 levels (7,695 rounds). Full human/browser playthrough: NOT RUN; actual device interaction remains unverified.
- The 18 additions are playable challenge prototypes using the existing choice/input renderer plus the dedicated Imagine view. Several scenario families currently have a small curated scenario pool; they are not yet expansive branching campaigns.
- The 15-tier labels and tier-focus prompts are present, but some new scenario games do not yet have 15 independently authored, increasingly complex scenario banks. Do not describe this as fully proven cognitive progression.
- Chess, Draughts, Go, and Reversi remain reasoning/position challenges rather than complete board-rule engines, as already documented in Batch 02.
- Maze Master remains a guaranteed-solvable serpentine route, not a general maze generator.
- This is a standalone Games Lab package for Claude's review. It does not implant itself into AXON, which currently has no built-in Games Lab.

## Recommended next approval work

1. Claude reviews the architecture and each new game's mechanics for genuine distinction and scope adequacy.
2. Add richer tier-specific scenario banks and branching state where approved.
3. Run browser visual/touch review at narrow phone widths.
4. Run physical Android 11 / low-memory tests.
5. Map the module to AXON's actual navigation, overlay, persistence, theme, export, and resource APIs only after source evidence is available.
