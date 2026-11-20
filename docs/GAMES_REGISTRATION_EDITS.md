# AXON Games: the registration merge, APPLIED (DT3, GAMES5, 2026-11-13)

Done on the current main (main_44), in one merge, with the owner's Option A (Games is its own Tools group). The entry is `coming-soon`: nothing in the app lets the player open a game yet.

## What changed, file by file
1. `src/tools/toolCatalog.ts`: `'games'` added to `ToolGroupId`; `{ id: 'games', name: 'Games' }` added last in `TOOL_GROUPS`; entry `axon-games` (name AXON Games, group games, status coming-soon) added at the end of the hand-made catalog.
2. `src/components/AxonToolsScreen.tsx`: `Gamepad2` imported from lucide-react; `games` added to `GROUP_ICONS`.
3. `src/brain/mind/schema/actionSchemas.ts`: one schema row, `axon-games | c a | play practise | game:n puzzle:n |  |  | shows-result |  | quick low | not-needed`, placed after `backup-restore` so the order matches `tests/fixtures/toolFacts.json`.
4. Tests changed on purpose (each message says why): `tests/tools.test.ts` (12 groups, order ends with Games, 61 entries), `tests/liveFacts.test.ts` and `tests/fixtures/toolFacts.json` (64 facts, one new fact for axon-games, chat not-built), `tests/resolveOptionsRunner.test.ts` (statuses 9 / 31 / 19 / 5), `tests/valueEvidenceRunner.test.ts` (64 schemas).

## Still to do when the screen exists (one small merge by DT3)
- `src/components/toolScreens/GamesScreen.tsx` from the screen Director; it exports `toolScreen = { toolId: 'axon-games' }` and imports only from `src/games`.
- Flip the catalog entry to `status: 'available', opens: 'tool-screen'`.
- Add the capability record `cap.engine-tools.axon-games` and the matching `PROVEN_AVAILABLE` / chat fields (see DIRECTOR_NAP N18: tests/engineTruth.test.ts, tests/fixtures/toolFacts.json, and the word tests), then run the whole suite.
