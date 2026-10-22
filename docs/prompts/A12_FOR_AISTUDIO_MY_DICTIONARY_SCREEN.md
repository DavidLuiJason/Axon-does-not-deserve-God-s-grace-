# A12: My Dictionary screen

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Builds the My Dictionary screen on the finished engine: the owner's own words, add, edit, delete, a staged import that adds nothing until confirmed, undo, export and erase.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or upload BASE.zip, the repository downloaded with Code, Download ZIP). Use a session with no older work in it. Needs C18 merged. BASE.zip must be the repository after it. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export) and give it together with the BASE zip you started from to Claude (the Director). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, AI Studio's own list of files created and changed. Also bring the short list of anything you could not try.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A12: MY DICTIONARY SCREEN

FILES THAT MUST EXIST (stop and say which is missing): src/tools/engines/dictionary/userDictionary.ts, userDictionaryImport.ts (from C18), src/brain/dictionaryAccess.ts (getDictionary: the English dictionary opens only when asked), src/services/saveFile.ts, src/components/tools/ToolParts.tsx, src/components/tools/ToolScreenShell.tsx, src/tools/screens/registry.ts, src/tools/toolCatalog.ts, and the finished DictionaryScreen.tsx and one tool screen to copy the look from. READ how the Dictionary screen asks the English dictionary for a word: the `coreHas` function the import needs is built from it (a lookup that only asks).

OWNER RULES (binding): the English dictionary is core and is never changed by this screen; the owner's words are labelled "from your dictionary"; NOTHING is added by an import until the owner taps the confirm button; every import keeps an undo copy; the owner can export and erase everything. Nothing on the screen says or implies that the chat uses these words yet (the chat gets this later).

THE JOB (toolId 'my-dictionary'):
1. HOME: a search field, then plain rows (word, part of speech small, meaning on one line, no boxed cards). Empty state: "Your dictionary is empty. Add a word or import a file." Buttons: "Add word", "Import", and behind a quiet "More" row: "Export", "Undo last change" (shown only when an undo copy exists), "Erase all".
2. ADD AND EDIT: one simple form: word, part of speech (picker: noun, verb, adjective, adverb, other), meaning, and behind "More details": example, synonyms. Engine limits shown as plain messages. Tapping a row opens it for edit with "Delete".
3. IMPORT: "Choose a file" (txt, csv, tsv, json, zip) → progress with Cancel (`parseImportChunks`) → a REPORT screen, nothing stored yet: "Will add 120 words. Already yours: 4. Also in the main dictionary: 18 (it stays untouched). Problems: 3." with "See problems" listing where and why. Two buttons: "Add 120 words" (calls `applyImport` with confirm) and "Cancel". After adding: "Added 120 words" and the Undo option.
4. EXPORT: JSON or CSV through `saveFile.ts`. ERASE ALL: a confirm step that makes the owner type the word ERASE; undo copy kept.
5. STORAGE: the engine needs an injected storage adapter: create it in a NEW file `src/services/userDictionaryStorage.ts` backed by `localStorage` with try and catch around every call (missing or full storage gives the engine's plain error, never a crash).
6. CATALOG: flip `my-dictionary` to available with `opens: 'tool-screen'` (minimal edit). If the Dictionary screen already shows a "My Dictionary" section or link, leave it exactly as it is and mention it in your report.

LANE (the only files you may touch): NEW src/components/toolScreens/MyDictionaryScreen.tsx, src/services/userDictionaryStorage.ts. CHANGED (minimal) src/tools/toolCatalog.ts (the one flip). Nothing else.

DONE MEANS: add, edit, delete, search, import of a txt, a csv, a json and a zip (each with good rows, duplicates and bad rows), the report screen, confirm, undo, export and erase all work in the preview; the English dictionary files and lookups are untouched; with storage blocked the screen says so plainly; no console errors.


## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
