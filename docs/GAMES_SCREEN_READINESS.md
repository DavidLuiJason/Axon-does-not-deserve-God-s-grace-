# AXON Games: screen readiness (DT3, GAMES3, 2026-11-13)

For the Director who writes the AI Studio prompts (not DT3). This says what the screen can use today, what it cannot, and what it must do itself. Everything is measured on `src/games/` (strict TypeScript, tests green); nothing here is a plan to be built.

## Where it lives
Tools menu, new group "Games", one tool "AXON Games" (`opens: 'tool-screen'`, tool id `axon-games`). The screen file is `src/components/toolScreens/GamesScreen.tsx` and exports `toolScreen = { toolId: 'axon-games' }`. The screen imports ONLY from `src/games` (the index).

## Screens to design (five)
1. **Hub** (`hubSections()`): 12 sections, each with a title and its games (Memory 41, Strategy 17, Logic 17, Language 16, Visual Memory 15, Mathematics 15, Attention 10, Spatial 10, Abstract Reasoning 10, Complex Thinking 5, Critical Thinking 5, More challenges 10). A game has `id`, `name`, `description`. 171 games in total; search by name is the screen's job.
2. **Game page**: name, description, `gameNote(id)` (one honest sentence, or null), a tier picker (15 tiers), a level picker (`levelsInTier(id, tier)` levels, usually 3), a Start button.
3. **Round screen**: one of nine layouts, chosen by `screenModel(round).type` (below).
4. **Feedback**: after an answer show correct or not, `expected`, and `explanation` (from `checkAnswer`); every round also carries `rule` and `steps` (a short list) for "why".
5. **Imagine** (open layout): a prompt and a visual field, never scored, no correct answer to show.

## The nine round layouts (from `screenModel(round)`)
| type | games | draw | player does | how it is checked |
|---|---|---|---|---|
| typed-memory | about 35 | `memorize` list for `memorizeMs`, then hide it and show `question` | types an answer | `checkAnswer(round, text)` |
| select-memory | 2 | same, then `options` as toggle buttons | selects some options, presses Check | `checkAnswer(round, selected[])` |
| set-select | 1 | `memorize` for 2,200 ms, then `secondList` (or hidden), then `options` | selects, presses Check | `checkAnswer(round, selected[])` |
| choice | about 73 | `prompt`, optional `question`, one button per `options` | taps one | `checkAnswer(round, option)` |
| typed | about 49 | `prompt`, optional `question`, a text box | types, presses Check | `checkAnswer(round, text)` |
| grid | 5 | `size` x `size` squares, `litCells` lit for `showMs`, then hidden | taps the cells that were lit, presses Check | `checkTappedCells(round, tapped[])` |
| heaps | 1 (Nim) | `heaps` as three heap buttons plus "No winning move" (0) | taps one | `checkAnswer(round, '0'..'3')` |
| code | 1 (Mastermind Mini) | a four-digit box and a list of past guesses with "exact / misplaced" | types four digits, up to 8 times | `submitCodeGuess(round, guessesSoFar, text)` |
| open | 1 (Imagine) | `prompt` and a visual of `visual.count` points of `visual.type` | optional note; nothing is scored | none |

Rules for every layout: the screen owns the timers and must clear them the moment the screen closes or the round ends; the answer must never be on screen before the player answers; a "relaxed" option may multiply `memorizeMs` and `showMs` by 1.5 (the old lab did); `submitCodeGuess` returns `{ ok:false, reason:'not-four-digits' }` for bad input, so the screen shows an inline message and does not count it.

## States the screen must handle
- Round ready to start; round running; waiting for the player; feedback shown; next round.
- `startRound` throws `RangeError` for a bad game id, tier or level. The screen only offers valid ones, so this is a bug signal, not a normal state.
- "Never Called" can have an EMPTY correct answer (every digit was called). The Check button must work with nothing selected.
- Choice and typed text can be long (some prompts run several sentences); the layout must scroll, not clip.
- Typed answers: capital letters, extra spaces, "9.70" for 9.7 and digits without spaces are accepted; the screen should not pre-judge input.

## READY (usable now)
Listing and sections, descriptions, honest notes, 15 tiers and their level counts, round generation (seeded when testing), all answer checking, grid checking, code scoring, the explanation text.

## NOT AVAILABLE (do not design it, there is nothing behind it)
- **Progress, history, scores, streaks, tier unlocks:** no storage and no rules exist. The player picks any tier freely. These need the owner's rules first (GAMES4).
- **Sound, haptics, animation timing** beyond the display times above.
- **A playable chess, draughts, Go, Reversi or Hex board.** Those eleven are rules questions; show `gameNote` honestly.
- **Per-round timers or time limits:** a round has no time limit; only the memorise phase is timed.
- **Multiplayer, leaderboards, accounts.**

## Honest limits to keep out of marketing copy
Eleven board games are rules questions. Five grid games share one mechanic. 52 games draw the same questions at every tier, so higher tiers do not get harder in those. See `docs/GAMES_INVENTORY.md`.
