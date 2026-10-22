# A07: Converter: Data formats, Text formats and Image kinds

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Teaches the existing Converter screen to draw three new kinds: Data formats, Text formats and Image, with the same one-look pattern as the existing kinds.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or uploading BASE.zip, the repository downloaded from GitHub with Code, Download ZIP). Use a session that has no older work in it. Needs ChatGPT jobs C06, C10 and C02 to C04 merged (and A01): BASE.zip must be the repository after all of them. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export), and give that zip together with the BASE zip you started from to Claude (or the next Director account). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, plus AI Studio's own list of files it created and changed.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A07: CONVERTER NEW KINDS (SCREEN SIDE)

FILES THAT MUST EXIST (stop and say which is missing): src/components/ConverterScreen.tsx, src/tools/converter/kinds.ts containing kinds 'data-formats', 'text-formats' and 'image' with the entry types 'block' and 'file', src/tools/converter/convert.ts, src/tools/engines/images/convertPlan.ts, src/tools/engines/files/zipTool.ts, src/services/saveFile.ts, src/tools/toolCatalog.ts, src/components/tools/ToolParts.tsx.

CONTEXT: the Converter is ONE screen with a kind picker; inside a kind a From picker and a To picker (dropdown, swap arrow), one input and one result (owner decision). Read `ConverterScreen.tsx` first and keep everything about the existing kinds exactly as it is.

THE JOB:
1. DATA FORMATS and TEXT FORMATS (entry 'block'): the same kind picker, From and To pickers and swap arrow; the input becomes a multi-line field and the result a multi-line result box with Copy; the `changes` notes returned by `convert()` show as one quiet line under the result ("Comments were dropped."); invalid input shows the engine's message with line and column when it has them; under Options the kind's settings (for data formats: "First row is a header", "Detect numbers and true/false"; for JSON output the indent). Respect the engine's size limits with a plain message.
2. IMAGE (entry 'file'): "Choose pictures" (several allowed; a count and the names); To picker (PNG, JPG, WebP; one quiet line: "Saving as SVG is not offered."); under Options: Quality (JPG and WebP only), Longest side, and "Background for see-through pictures" fixed to white with one quiet line when relevant. Convert with a canvas following `planImageConversion` exactly (decode the picture, draw at the planned size on a white background when the plan says so, encode with the plan's mime and quality); SVG inputs drawn at their natural size or the planned width. Show before and after sizes per picture. One quiet line: "Converting removes picture details such as location, and JPG and WebP lose a little quality each time." Pictures over the engine's limit are refused with its message. Release every canvas and object URL after each picture. "Save" for one result, "Save all as zip" (engine zipTool.ts) and "Share", through `src/services/saveFile.ts`; progress and Cancel for batches.
3. CATALOG: REMOVE the catalog entries `data-converter`, `text-format-converter` and `image-converter` from `src/tools/toolCatalog.ts` (they now live inside the Converter; nothing else in the catalog changes).

LANE (the only files you may touch): CHANGED (minimal edits) src/components/ConverterScreen.tsx, src/tools/toolCatalog.ts (the three removals only). NEW src/components/converter/* (new panel files you need). Nothing else.

DONE MEANS: all existing kinds still behave exactly as before; each new kind converts correctly in the preview with normal, empty, bad and large input; the three menu entries are gone and the Converter still opens from the Tools menu.

## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
