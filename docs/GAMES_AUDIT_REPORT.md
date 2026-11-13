# AXON Games Lab — audit and fixes (DT3, 2026-11-13)

Scope: verify that all 171 games and the game engine work, fix what is wrong, report what is missing. Games will live in the Tools menu later; AI Studio prompts are another Director's job and are not part of this report.

## Method (what was actually run)
1. Read the package's own tests first. They only check that a round accepts the answer the round itself stores, so a wrong stored answer passes. They cannot find wrong games.
2. Generic audit (`audit/audit.mjs`): 46,170 seeded rounds across all games, tiers and levels: structure, duplicate or missing choices, correct answer rejected, wrong answer accepted, NaN/undefined, answer leaked in the prompt.
3. Read one live round of every one of the 171 games and checked the answer by hand.
4. Independent oracle test (`tests/oracle-audit.test.mjs`): recomputes the expected answer from the question text or round data without reading the stored answer. Covers 120 of 171 games (64,302 rounds at 12 seeds per cell). Logic puzzles are re-solved by brute force; syllogisms by a model checker over all Venn-region models.
5. Mutation check: five of the original bugs were put back one at a time; the new tests failed each time (Tic-Tac-Toe answer, Hex answer case, Hidden Number remainder, Nim accepted heaps, Prime Factor example leak).
6. Cloud-side safety: the root `tsc --strict` was run with this folder inside a repository shaped like AXON (exit 0), so no shared config needs to change.

## Defects found and fixed
| # | Game / part | What was wrong | Fix |
|---|---|---|---|
| 1 | Screen code (`app.js`) | Choice buttons compared exact text and ignored the engine's checker; Nim ignored it too | All buttons now call `validateAnswer` |
| 2 | Hex, Mastermind (rules question) | The stored answer was lower-case while the button said "Connect top to bottom": the right answer could never be accepted | Answer text matches; checker also ignores case |
| 3 | Tic-Tac-Toe Master | Stored answer 6; the winning square is 9 (diagonal) | Rewritten; 8 board orientations; answer computed |
| 4 | Connect Four | Row counted from the top while the steps said from the bottom | Rows numbered from the bottom, stated in the prompt; stack height 0 to 5 |
| 5 | The Hidden Number | Remainder used the wrong modulus; answer not unique | Rewritten; uniqueness checked by search |
| 6 | Twenty Questions | "Best question" for a bicycle was "Does it produce music?" | New engine: candidates, yes-counts, closest to half wins |
| 7 | Who Owns What | Stored answer Cy; the clues force Ben | Randomised puzzle solved by brute force |
| 8 | The Impossible Lock | First digit up to 8 gave four-digit codes such as 7816 | Three clue templates, digits always 0-9 |
| 9 | Mirror Image | Centre column does not change; question ambiguous | Centre excluded; asks for the reflected number |
| 10 | Logic Grid | Had to type "Cy = green" | Now a choice puzzle that needs a real deduction |
| 11 | Anagram Solver | Only one of several valid anagrams accepted (listen/silent, rescue/secure, angel/angle/glean) | All valid anagrams accepted |
| 12 | Word Chain | Only one choice offered | Three wrong options built from a word list; four more chains |
| 13 | Target Number Maths | Any valid a+b rejected except one pair; `acceptedAnswers` was ignored by the checker | Checker honours `acceptedAnswers`; sum rule added |
| 14 | Distractor Filter | Rule "symbols #" ambiguous | "the symbol #" |
| 15 | Fraction Duel | Two identical options when fractions matched | Equal pairs removed |
| 16 | Prime Factor Challenge | The worked example 2^2×3 was the answer for 12 | Neutral example |
| 17 | Find the Loophole | Required typing an exact phrase; a dead duplicate block held an impossible scenario | Now a choice; dead block deleted |
| 18 | Percentage Master | "9.70" rejected for 9.7 | Numeric equality |
| 19 | Nim | Other winning heaps rejected | Every winning heap accepted |
| 20 | Number Relationship Recall | "triple" undefined for a pair | Each relationship is spelled out |
| 21 | Subtraction Memory | Odd lengths undefined | Middle digit rule stated |
| 22 | Object Displacement | Edge rule and "up" direction unstated | Both stated |
| 23 | Visual Rotation, Paper Folding, Mental Workspace | "A arrow", "1 holes", vague "combine" | Wording fixed |
| 24 | 18 scenario games | Prompts claimed "Level 2 adds one extra constraint" and a tier focus that were not implemented | Claim removed; kept as data only |
| 25 | Engine fallbacks | A fallback with the answer fixed at 0; lock digits above 9 | Computed answers |
| 26 | Randomness | `Math.random` in 9 files | One shared source: `setRandomSource()`, `createSeededRandom()` (AXON can govern it) |
| 27 | Memory answers | Digits typed without spaces rejected | Accepted |
| 28 | 27 games asked one fixed question for every tier and level | e.g. all seven chess games, Who Is Lying, The Impostor, the scenario games | Puzzle generators (truth/culprit puzzles, planning, syllogisms, conditionals, Caesar, escape room) plus 25 curated banks of 6 or more questions. Floor test: at least 6 distinct rounds per game |

## Evidence at hand-over
`npm test` (14 suites, including the two new ones) exits 0. Independent oracle audit: PASS. Variety floor: PASS. Not run: a real browser, a phone, or any AXON integration.

## Still limited (not fixed, stated plainly)
- Eleven board games (Chess, Chess Tactics, Checkmate in One/Two, Chess Position Memory, Blindfold Chess, Chess Endgame, Draughts, Go, Reversi, Hex) are rules questions, not playable boards.
- Five grid games (Flash Grid, Pattern Reproduction, Shape Sequence, Spot the Difference, Image Recall) share one mechanic.
- 52 games draw the same questions at every tier (see GAMES_INVENTORY.md), so their tiers do not get harder.
- 51 games are checked by reading their question pools, not by calculation. The curated banks are plain facts, but they have no second reader yet.
- Maze Master has three sizes, Connect Four one question type, so both sit below the variety floor by design.
- Code is plain JavaScript with its own storage key (`axon.games.lab.v2`) and its own screen. The AXON version needs TypeScript, AXON storage and tokens, and a Tools-menu entry (GAMES2).
