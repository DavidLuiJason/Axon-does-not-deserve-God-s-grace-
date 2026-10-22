# A02: Six text and number tool screens

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Builds six tool screens on the kit: Text Cleaner, Sort Lines, Text Compare, Percentage Helper, Number to Words, Date Calculator.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or uploading BASE.zip, the repository downloaded from GitHub with Code, Download ZIP). Use a session that has no older work in it. Needs job A01 merged first: attach nothing else; BASE.zip must be the repository AFTER the A01 delta was merged. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export), and give that zip together with the BASE zip you started from to Claude (or the next Director account). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, plus AI Studio's own list of files it created and changed.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A02: SIX TEXT AND NUMBER TOOL SCREENS

FILES THAT MUST EXIST (stop and say which is missing): src/components/tools/ToolScreenShell.tsx, src/components/tools/ToolParts.tsx, src/tools/screens/registry.ts, src/tools/toolCatalog.ts (with the 'tool-screen' target), src/tools/engines/text/textCleaner.ts, sortLines.ts, textCompare.ts, src/tools/engines/numbers/percentage.ts, numberToWords.ts, src/tools/engines/time/dateCalc.ts, src/components/toolScreens/CalculatorScreen.tsx. Read the kit's code and one finished screen (for example src/components/toolScreens/CalculatorScreen.tsx) first and follow them exactly; do not change the kit except to add a part it truly lacks (say so). Each screen is a file `src/components/toolScreens/<Name>Screen.tsx` that exports `toolScreen = { toolId: '<catalog id>' }` and a React component taking `{ onBack: () => void; onLogoClick: () => void }`, wrapped in `ToolScreenShell`. Flip each tool in `src/tools/toolCatalog.ts` from 'coming-soon' to 'available' with `opens: 'tool-screen'`.

SCREENS (use these exact titles and taglines; labels in sentence case):

1. TEXT CLEANER (id `text-cleaner`; engine textCleaner.ts). Tagline: "Tidy up messy text". Field "Text". The common cleanups (for example trim lines, collapse spaces, remove blank lines) are switches on the screen; the rest of the engine's options sit under Options. The result box with Copy, and one line saying what was removed using the engine's counts ("Removed 4 blank lines and 12 extra spaces").
2. SORT LINES (id `sort-lines`; engine sortLines.ts). Tagline: "Put your lines in order". Field "Lines". One choice row built from the engine's modes (`SORT_LINE_MODES`, with display names); under Options: the engine's other settings (for example ignore case, remove duplicates, a seed for shuffle if the engine takes one). Result box with Copy and a line with the number of lines in and out.
3. TEXT COMPARE (id `text-compare`; engine textCompare.ts). Tagline: "See what changed between two texts". Two fields "Original" and "Changed". A choice row for the engine's compare modes. The result is the difference drawn as readable lines: added parts marked with "+" and removed parts with "-" AND coloured using colours the app already has; a summary line with the engine's counts above it ("3 added, 1 removed"); "The texts are the same" when equal. Must stay readable on a small screen (wrap, no sideways scrolling of the page).
4. PERCENTAGE HELPER (id `percentage-helper`; engine percentage.ts). Tagline: "Percentages without the head-scratching". A choice row of the engine's questions (for example "X% of Y", "X is what % of Y", "Change from X to Y", "Add or take off X%"); under it the number fields for the chosen question, each labelled in plain words for that question; the answer in large type with one sentence that spells it out ("15% of 80 is 12").
5. NUMBER TO WORDS (id `number-to-words`; engine numberToWords.ts). Tagline: "Write a number out in words". A number field (accepts what the engine accepts, shows the engine's limit message); the words in a result box with Copy; under Options: every style the engine offers (for example ordinal, currency).
6. DATE CALCULATOR (id `date-calculator`; engine dateCalc.ts). Tagline: "Work with dates". A choice row of the engine's operations (for example "Days between two dates", "Add or take away time", "Day of the week"); native date inputs (type=date) and number fields as needed; the answer in plain words ("There are 142 days between these dates (20 weeks and 2 days)"). Invalid dates show the engine's message.

LANE (the only files you may touch): NEW src/components/toolScreens/TextCleanerScreen.tsx, SortLinesScreen.tsx, TextCompareScreen.tsx, PercentageHelperScreen.tsx, NumberToWordsScreen.tsx, DateCalculatorScreen.tsx. CHANGED (minimal edits): src/tools/toolCatalog.ts (flip the listed tools only), and src/components/tools/ToolParts.tsx only if a part is truly missing. Nothing else.

DONE MEANS: every screen above opens from the Tools menu, works for normal, empty, bad and very large input, and returns with the back control; all earlier screens still work exactly as before.

## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
