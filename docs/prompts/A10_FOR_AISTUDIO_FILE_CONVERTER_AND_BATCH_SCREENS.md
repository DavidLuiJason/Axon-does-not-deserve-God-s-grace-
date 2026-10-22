# A10: File Converter and Batch Convert screens (and retire three converter entries)

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Builds two screens, File Converter and Batch Convert, on the finished planners, and retires the three converter menu entries that now live inside the Converter.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or upload BASE.zip, the repository downloaded with Code, Download ZIP). Use a session with no older work in it. Needs C17 merged, and the Converter (units, base, data, text and image kinds) working. BASE.zip must be the repository after both. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export) and give it together with the BASE zip you started from to Claude (the Director). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, AI Studio's own list of files created and changed. Also bring the short list of anything you could not try.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A10: FILE CONVERTER AND BATCH CONVERT

FILES THAT MUST EXIST (stop and say which is missing): src/tools/engines/files/fileConvertPlan.ts, src/tools/engines/files/batchPlan.ts (from C17), src/tools/converter/convert.ts, src/tools/converter/kinds.ts, src/tools/engines/images/convertPlan.ts, src/tools/engines/files/zipTool.ts, src/services/saveFile.ts, src/components/ConverterScreen.tsx, src/components/tools/ToolParts.tsx, src/components/tools/ToolScreenShell.tsx, src/tools/screens/registry.ts, src/tools/toolCatalog.ts, and at least one finished tool screen in src/components/toolScreens/ to copy the look from (for example QrMakerScreen.tsx).

CONTEXT: read `ConverterScreen.tsx` first. Whatever it already does to run a data, text or image conversion (calling `convert()`, the canvas steps for pictures following `planImageConversion`) is REUSED, never copied by hand: if that logic lives only inside the screen, move the smallest part you need into a NEW file `src/components/converter/runConversion.ts` and make ConverterScreen call it, with its behaviour unchanged. Screens never re-implement an engine. A tool screen is registered by its file: it exports `toolScreen = { toolId: '...' }` and a default component taking `{ onBack, onLogoClick }` (see src/tools/screens/registry.ts and any existing screen).

THE JOB:
1. FILE CONVERTER (toolId 'file-converter'). One file in, one file out. "Choose a file" (one) → one quiet line says what it is ("JSON file, 4 KB"), from `detectConvertible`; a warning line when name and content disagree; unsupported files say so in plain words. A To picker lists only `targetsFor(...)`. Under ONE "Options" row: the options the chosen kind has (header row, detect numbers, JSON indent; picture quality, longest side). "Convert" runs through the reused conversion code; the result shows as text (first 2,000 characters, with Copy) or a picture (with before and after sizes); under it ONE quiet line from `losses`. "Save" and "Share" through `saveFile.ts`. Release canvases and object URLs after every conversion.
2. BATCH CONVERT (toolId 'batch-convert'). "Choose files" (several): shows a count and the first names. A To picker (one target for all). A single line says "12 will convert, 2 will be skipped" with the skipped reasons behind a quiet "See why" row (from `planBatch`). "Convert all" drives `createBatchRun`: one file at a time, progress bar with the count, Cancel at all times, never freezing the phone (yield between files). When `complete` answers 'memory-cap', save what is held into the zip part and `drain()`, then continue. At the end: the counts, a short results list behind "See results", then "Save all as zip" (`zipEntries` and `createZip`) and "Share". Pictures follow the same canvas steps as the Converter and release everything after each one.
3. CATALOG (src/tools/toolCatalog.ts, minimal edits): flip `file-converter` and `batch-convert` to available with `opens: 'tool-screen'`; REMOVE the entries `data-converter`, `text-format-converter` and `image-converter` if they are still present. Nothing else changes.

LANE (the only files you may touch): NEW src/components/toolScreens/FileConverterScreen.tsx, src/components/toolScreens/BatchConvertScreen.tsx, src/components/converter/runConversion.ts (only if needed). CHANGED (minimal) src/components/ConverterScreen.tsx (only to use runConversion.ts), src/tools/toolCatalog.ts (the two flips and three removals only).

DONE MEANS: every control works in the preview with a normal file, an empty selection, an unsupported file, a too-large file and a mixed batch (some convertible, some not); the Converter's existing kinds behave exactly as before; the two new entries open from the Tools menu; the three retired entries are gone; no console errors.


## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
