# A15: QR Code Maker, one-line choice row (tab row fix)

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Fixes the row of five choices at the top of the QR Code Maker (Text, Link, Wi-Fi, Phone, Email) so all five sit on ONE line and nothing shifts when the owner switches between them. One small screen fix; nothing else changes.
WHAT YOU DO: HOLD THIS PROMPT until the Director says the repository is merged and green (owner rule: repository first, then AI Studio). Then start a NEW AI Studio project by importing the GitHub repository LINK (no zip upload). Paste the one line below.
WHAT TO BRING BACK: export the project zip and give it to Claude (the Director) together with the repository zip you started from; also AI Studio's own list of files created and changed.
PASTE THIS ONE LINE INTO AI STUDIO: Do the job A15 in the attached file A15_FOR_AISTUDIO_QR_CHOICE_ROW.md exactly. Change only the files its LANE names, test it in the live preview, and report what you tried.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).
---

## JOB A15: QR CODE MAKER CHOICE ROW ON ONE LINE

FILES THAT MUST EXIST (stop and say which is missing): src/components/toolScreens/QrMakerScreen.tsx, src/components/tools/ToolParts.tsx (it exports `SegmentedChoice`).

WHAT THE OWNER SAW (phone screenshots, 2026-10-23): with Phone selected the five choices fit on one line. With Wi-Fi selected (and on other choices) "Email" drops to a second line and the box grows taller; switching between Phone and Email makes the screen jump. A gap is visible after "Phone" where "Email" would fit.

THE CAUSE (read the code and confirm; it is a hypothesis until you do): `SegmentedChoice` in ToolParts.tsx uses `flex flex-wrap` and gives the selected button `font-semibold` and every button `px-3.5`. The selected label is wider than the plain one, so the total width changes with the selection and the last button wraps.

WHAT TO DO:
1. Add ONE optional prop to `SegmentedChoice`, `fit?: 'wrap' | 'equal'` (default `'wrap'`, so nothing else changes). In `'equal'` mode the buttons share the row in equal parts (CSS grid with one equal column per choice, or flex with `flex-1 min-w-0`), never wrap, use the SAME font weight selected or not (the selected state is shown by the white pill only), smaller side padding, and `text-xs`. Labels must not be cut off: if a label would not fit at the weakest phone width (360 px wide), reduce side padding first, then letter spacing; never truncate and never wrap.
2. In QrMakerScreen.tsx use `fit="equal"` for the five-choice row only. Leave the Security row and the error-level row as they are unless they show the same jump.
3. Switching between any two choices must not change the row's height or the position of anything above it. The fields below may change; the row must not.
4. Keep the AXON look exactly: dark, #ECECEC text, existing white selected pill, existing radius and border. No new colours, fonts or icons. No new elements.

DESIGN CHECK (write it in your report): does the row still read at a glance? Is anything added to the screen? (The answer must be: nothing added.)

LANE (the only files you may touch): src/components/tools/ToolParts.tsx (the `SegmentedChoice` component and its props only), src/components/toolScreens/QrMakerScreen.tsx (the one `SegmentedChoice` call for the five types). FORBIDDEN: everything else, including src/tools/**, tests/**, package.json, .github, public/dictionary.

DONE MEANS: in the live preview, at a 360 px wide viewport and at a 412 px wide viewport, each of Text, Link, Wi-Fi, Phone, Email selected in turn: all five on one line, same row height every time, no label cut off, nothing above the row moves. Say what you saw at each width.

---

## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
