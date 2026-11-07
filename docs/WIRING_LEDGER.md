# WIRING LEDGER (Director, 2026-11-07; snapshot MEASURED from the live registries of the main zip, tests NOT RUN on a phone)

WHO IT IS FOR: the owner and every Director. It answers: for each tool, which parts that connect it to the brain exist, and what is still missing before it may be switched ON.

## 1. HOW A TOOL IS CONNECTED TO THE BRAIN (the system that already exists)
A tool reaches the brain through ONE chain of registered parts. Nothing is "plugged in" by hand-typing a phrase (FL13). The parts, in order:
1. CATALOG entry (`toolCatalog.ts`): name, group, available or coming soon.
2. SCHEMA ROW (`actionSchemas.ts`): what the tool means, its typed slots, effects, undo. Resolution (stage 5) reads it. All 60 tools have one.
3. BIND DEFAULTS (`bindDefaults.ts`): owner-approved defaults for a missing slot, always said aloud.
4. RUNNER (`src/tools/runners/*`): the pure function that runs the exact engine. 19 tools have one.
5. CLOSED CHOICE WORDS (`LIVE_CHOICES`): the owner-approved words for a choice slot (needs the owner's yes, FL13).
6. KERNEL TASK ACTION (`src/tools/text*Action.ts`, registered in `axonEngine.ts`): records each run as a task.
7. CHAT ACTION (`act.<tool>` in `registerAxonTools.ts`): the registry truth, so "what can you do" is honest (FL10).
8. LANE GUARD (`laneGuards.ts`): the tool's own list of cases where the lane must YIELD instead of risking a wrong answer.
9. LIVE SWITCH (`liveSwitches.ts`): OFF means the old handler answers; ON means the runner answers. `tests/liveSwitches.test.ts` pins the ON list.
Parts 1, 2, 3, 4-live (switch, choices, task) can be produced from one WIRE CARD (`wiring/<tool>.wire.json`, written by `node tools/wire-write.mjs`); parts 5 to 8 still need new files and measurement per tool.

NEW IN THIS PACKAGE (CONNECT0): `src/tools/runners/liveAdmission.ts` + `tests/liveAdmission.test.ts`. The ADMISSION GATE: a tool cannot be ON unless parts 2, 4, 5 (when it has a choice slot), 6, 7, 8 and its task record all exist, and chat can never claim a tool whose switch is OFF. Switching `calculator` ON today fails the test and names exactly what it lacks. This is what keeps wrong or half-wired things out of the brain.

## 2. COUNTS (MEASURED from the registries)
60 tools in the catalog: 37 available, 23 coming soon. All 60 have a schema row. 19 have a runner. 3 are ON through the brain.

## 3. ON TODAY (3)
text-counter, case-converter, sort-lines

## 4. A RUNNER EXISTS, THE REST OF THE CONNECTION IS MISSING (16)
- converter: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- find-replace: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard
- text-cleaner: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard
- text-compare: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- calculator: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- number-to-words: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard
- percentage-helper: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- timer (state tool): missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- stopwatch (state tool): missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- date-calculator: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- tally-counter (state tool): missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- qr-maker: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- password-generator: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard
- random-picker: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- encoder-decoder: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices
- hash-tool: missing no-task-record, kernel-action-not-registered, no-available-chat-action, no-lane-guard, no-live-choices

## 5. AVAILABLE (SCREEN) BUT NO RUNNER YET (18): a runner must be written first
interface-capture, background-proof, video-frames, file-converter, zip-tool, batch-convert, file-inspector, file-compare, dictionary, my-dictionary, document-reader, summarizer, json-viewer, code-formatter, pattern-tester, loan-calculator, split-bill, device-profile
Some of these cannot be answered in a chat line at all (file, picture, video or screen tools); they need the brain to hand a file or ask for one. The Interface Capture shell is counted "available" by the catalog but does not work.

## 6. COMING SOON (23): no screen, see `docs/TOOLPLAN1_COMING_SOON_PLAN_LINES.md`
content-extractor, link-analyzer, ai-assistant, collage-maker, picture-to-table, audio-converter, text-to-speech, voice-library, voice-cloner, speech-to-text, video-converter, video-maker, video-downloader, pdf-tools, document-converter, rephraser, grammar-helper, translator, web-search, axon-code, currency-converter, market-scope, backup-restore

## 7. WHY NOT FLIP ALL OF SECTION 4 ON AT ONCE
The Sort Lines go-live measured WRONG answers before its guard existed (`sort "b a" in reverse alphabetical order` sorted A to Z; `how do I sort a list in python` sorted the word "python"). Every tool has its own such cases. A blanket switch would put exactly those wrong answers into the brain. So each tool is admitted only with its choice words (owner yes), its guard from measured wrong cases, its task record and chat action, and the gate above.
