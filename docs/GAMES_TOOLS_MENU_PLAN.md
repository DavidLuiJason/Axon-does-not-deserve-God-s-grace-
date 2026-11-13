# AXON Games: Tools-menu registration plan (DT3, GAMES2, 2026-11-13)

## Who did GAMES2, and why
The Director did it, not a builder. The port had to be proven identical to a lab that was already audited, and only a runner of tests could prove that. Registration edits hot shared files, which builders must not touch.

## What GAMES2 delivers (merge order matters)
1. FIRST merge `AXON-GAMES-AUDIT-merge.zip` (it brings `axon-games/`, the audited JavaScript lab).
2. THEN merge `AXON-GAMES2-merge.zip` (this one). It adds only new files plus the updated workstream file:
   - `src/games/` the logic layer in strict TypeScript: engine, 171-game catalogue, 15-tier profiles, round generators, one injectable random source, and `index.ts` (the only file a screen imports).
   - `tests/gamesParity.test.ts` runs the TypeScript layer and the audited JavaScript on the same seeds for every game, tier and level (15,390 rounds) and requires identical rounds; it also fails if `Math.random` is ever called.
   - `tests/gamesApi.test.ts` lists games, starts and answers 6,273 rounds, enforces bounds, checks seeded replay.
   - No hot file was touched. No screen. No storage. No timers.

## How a game reaches the Tools menu (measured on the repository zip, read 2026-11-13; the zip was a few merges old, so GAMES3 re-checks each line against current main)
| Step | File | What | Note |
|---|---|---|---|
| 1 | `src/tools/toolCatalog.ts` | One catalog entry: `{ id: 'axon-games', name: 'AXON Games', description, groupId, status, opens: 'tool-screen' }` (copy id, name and description from `AXON_GAMES_CATALOG_ENTRY` in `src/games/index.ts`) | `tests/tools.test.ts` pins exactly eleven groups in a decided order (lines 42-47, 97). |
| 2 | same file + `src/components/AxonToolsScreen.tsx` | Group placement (OWNER DECISION below) | A twelfth group also needs an entry in `GROUP_ICONS`. |
| 3 | `src/components/toolScreens/GamesScreen.tsx` | The screen. Export `toolScreen = { toolId: 'axon-games' }`; `src/tools/screens/registry.ts` picks it up by itself (import.meta.glob) and the Tools list opens it as `tool:axon-games` | Screens come from AI Studio; the prompt is another Director's job. |
| 4 | capability registry | `cap.engine-tools.axon-games` | `tests/engineTruth.test.ts` (lines 62-72) refuses an `available` tool without a registry entry. |
| 5 | catalog entry | `status: 'coming-soon'` until steps 3 and 4 are merged together, then `'available'` | The chat's "what can you do" reads the catalog live, so it stays truthful with no extra work. |

OWNER DECISION (Director recommendation: A). A) New twelfth group "Games" at the end of the menu: costs three changed assertions in `tests/tools.test.ts` and one icon. B) Put the entry in an existing group such as "Create and Encode": no test change, but the placement is less honest. Nothing is applied until you choose.

## The contract a screen can rely on
Everything below is exported from `src/games/index.ts`: `listGames()`, `listCategories()`, `gamesInCategory(category)`, `getGame(id)`, `levelsInTier(gameId, tier)`, `startRound(gameId, tier, level)`, `checkAnswer(round, input)` returning `{ correct, expected, explanation }`, and the random-source functions. `startRound` throws `RangeError` for an unknown game, a tier outside 1 to 15 or a level the tier does not have.

Round kinds measured over every game (fields that are always present in that kind; the screen must not rely on others):
| kind | games | the screen shows | fields always present |
|---|---|---|---|
| memory | 40 | `seq` for `delay` ms, then hides it and asks `questionText` (typed answer) | seq, delay, mode, questionText, answer |
| choice | 73 | `prompt` and one button per entry of `choices` | prompt, choices, answer |
| input | 47 | `prompt` and a text box | prompt, answer |
| text | 2 | `prompt`, a text box (word answers, not case-sensitive) | prompt, answer |
| visual | 5 | a grid of `size` x `size` with `cells` lit for `delay` ms, then the player taps them back | size, cells, delay |
| set-memory | 1 | `seq`, then `shown`, then `choices` to select (several) | seq, shown, choices |
| strategy | 1 | Nim: `heaps`, the player names a heap | heaps |
| mastermind | 1 | a four-digit code breaker: `code` is hidden, `guesses` fills | code, guesses |
| imagine | 1 | an open prompt, never scored | prompt |

Rules the screen owns: it runs the `delay` timer and must clear it when the screen closes; it never shows `answer` before the player answers; every game has a `rule` and `steps` for the feedback; `tier` and `level` are chosen by the player (15 tiers; `levelsInTier` levels each). Not every round repeats `tier`, `level` or `levelsInTier`, so the screen keeps its own.

## Honest limits that reach the screen
Eleven board games are rules questions, not playable boards. Five grid games share one mechanic. 52 games draw the same questions at every tier. See `docs/GAMES_INVENTORY.md`.

## Verified here
`tsc --strict` clean on the layer, its two tests and the JavaScript reference together; parity PASS on 15,390 rounds; API test PASS; a deliberately broken random helper made the parity test fail on 3,294 rounds (the test has teeth). Not run: the real repository build and `npm run test:all` (the sandbox has no `node_modules`), a browser, a phone.

## Next
GAMES3 (a): the screen-readiness list for the AI Studio prompt writer, from the table above. GAMES3 (b): after the owner picks A or B and a screen exists, one Director merge that changes the catalog, adds the capability entry and flips the status, with `npm run test:all` green. Later: progress rules (tier unlocks) and AXON storage, which need your decision first.
