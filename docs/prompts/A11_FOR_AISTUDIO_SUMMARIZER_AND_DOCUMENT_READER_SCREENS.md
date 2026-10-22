# A11: Summarizer and Document Reader screens

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Builds two screens on the finished engines: the Summarizer (extractive) and the Document Reader (text, Markdown, HTML, CSV, TSV, JSON).
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or upload BASE.zip, the repository downloaded with Code, Download ZIP). Use a session with no older work in it. Needs C16 merged. BASE.zip must be the repository after it. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export) and give it together with the BASE zip you started from to Claude (the Director). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, AI Studio's own list of files created and changed. Also bring the short list of anything you could not try.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A11: SUMMARIZER AND DOCUMENT READER

FILES THAT MUST EXIST (stop and say which is missing): src/tools/engines/text/summarize.ts, src/tools/engines/files/documentRead.ts (from C16), src/services/saveFile.ts, src/components/tools/ToolParts.tsx, src/components/tools/ToolScreenShell.tsx, src/tools/screens/registry.ts, src/tools/toolCatalog.ts, and at least one finished tool screen in src/components/toolScreens/ to copy the look from (for example TextCompareScreen.tsx). A tool screen is registered by its file: it exports `toolScreen = { toolId: '...' }` and a default component taking `{ onBack, onLogoClick }`.

THE JOB:
1. SUMMARIZER (toolId 'summarizer'). A text box (paste) and "Choose a text file" (txt, md, html: decode with the Document Reader, then summarise its plain text). Length as three choices: Short (3 sentences), Medium (5), Long (8). "Summarize" runs `summarize`. The result is the chosen sentences in their original order, as plain lines, with Copy. ALWAYS show the engine's label line ("Extractive: sentences are copied from your text, never rewritten.") quietly under the result, and any warnings in plain words. Under ONE "Options" row: "Show key words" (the engine's keywords) and the count of sentences kept ("3 of 41"). Respect `SUMMARIZE_LIMITS` with a plain message. Never describe the result as understanding or rewriting.
2. DOCUMENT READER (toolId 'document-reader'). "Open a file" → the file name, format, encoding and the stats line ("1,240 words, about 7 minutes") in one quiet line. Reading view of the blocks: headings larger, list items with a marker, quotes with a left rule, code and JSON in monospace, CSV and TSV as a simple table that scrolls sideways. NEVER render raw HTML: everything is text. Pages: show one page at a time from `paginate`, with Previous and Next and "Page 3 of 12". A "Contents" row (collapsed) lists the outline; tapping an entry jumps to its page. "Find" opens a small search field with the number of hits and Previous and Next that jump and highlight (`findInDocument`). Text size A- and A+ (three steps). PDF and Office files show the engine's plain message. Truncated documents say so in one line.

LANE (the only files you may touch): NEW src/components/toolScreens/SummarizerScreen.tsx, src/components/toolScreens/DocumentReaderScreen.tsx. CHANGED (minimal) src/tools/toolCatalog.ts (flip `summarizer` and `document-reader` to available with `opens: 'tool-screen'`; nothing else).

DONE MEANS: both screens work in the preview with a short text, a long text, an empty text, a Markdown file, an HTML file with a script tag (it must show as text, nothing runs), a CSV, a JSON, a large file near the limit and a PDF (plain refusal); paging, contents, find and text size all work; no console errors.


## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
