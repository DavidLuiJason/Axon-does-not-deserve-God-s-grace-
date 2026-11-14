# AXON Games: the registration merge (GAMES3-b), written down so it can be done in one careful pass (DT3)

STATUS: NOT APPLIED. Owner chose Option A (own group "Games") on 2026-11-13. This merge edits hot shared files, so DT3 needs the CURRENT main zip first: the zip these edits were measured on is a few merges old, and a stale copy would overwrite other Directors' work. DT3 makes the edits on the current files, runs `npm run test:all`, and ships them in one merge.

Measured on the older zip (line numbers will move):
1. `src/tools/toolCatalog.ts`: add `'games'` to `ToolGroupId` (line 14); add `{ id: 'games', name: 'Games' }` to `TOOL_GROUPS` (line 61), last, after Device and System; add one catalog entry `{ id: 'axon-games', name: 'AXON Games', description, groupId: 'games', status: 'coming-soon' }` (copy name and description from `AXON_GAMES_CATALOG_ENTRY`). Flip to `status: 'available', opens: 'tool-screen'` ONLY in the same merge as the screen file.
2. `src/components/AxonToolsScreen.tsx`: add `games:` to `GROUP_ICONS` (line 79), for example a Gamepad2 icon from lucide-react.
3. `tests/tools.test.ts` (changed on purpose, with the reason in each message): groups 11 to 12 (lines 42, 43, 124); the decided-order string gets `|Games` at the end (line 46); entries 60 to 61 (lines 63, 90); check lines 91 and 115 to 129 for counts that include every group or every tool.
4. Anything else that counts groups or tools: run `npm run test:all` and fix each failure at its source, never by loosening a test. Likely: `tests/engineTruth.test.ts` (an `available` tool needs a capability record, lines 55 to 72), `tests/liveFacts.test.ts`, `tests/needCases.test.ts`, `tests/toolRequestAccuracy.test.ts`.
5. `src/components/toolScreens/GamesScreen.tsx` comes from AI Studio. Until it exists the entry stays `coming-soon`, and the chat's "what can you do" stays truthful because it reads the catalog live.

Order: (1) merge `AXON-GAMES-AUDIT-merge.zip` and `AXON-GAMES2-merge.zip` (done by the owner), (2) merge `AXON-GAMES3-merge.zip`, (3) AI Studio screen, (4) the registration merge above.
