# A01: Tool screen kit and the first three tool screens

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Builds the shared look and plumbing for every tool screen (so every later screen is just a new file) and three real tool screens: Calculator, Case Converter, Find and Replace. This job sets the look of every tool screen, so the owner should check it carefully in the preview.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or uploading BASE.zip, the repository downloaded from GitHub with Code, Download ZIP). Use a session that has no older work in it. It needs no ChatGPT job to be merged first. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export), and give that zip together with the BASE zip you started from to Claude (or the next Director account). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, plus AI Studio's own list of files it created and changed.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A01: THE KIT AND THREE SCREENS

FILES THAT MUST EXIST (stop and say which is missing): src/App.tsx, src/components/ScreenHeader.tsx, src/components/AxonToolsScreen.tsx, src/components/TextCounterScreen.tsx, src/components/ConverterScreen.tsx, src/tools/toolCatalog.ts, src/tools/engines/text/index.ts, src/tools/engines/numbers/index.ts, src/state (the screen state used by `useCurrentScreen`).

PART 1: THE KIT. Use EXACTLY these file names (later jobs import them):
- `src/components/tools/ToolScreenShell.tsx`: wraps every tool screen: the ScreenHeader band (tool name, one small-caps tagline), the back row under the band, a scrolling body with safe-area padding, props `{ toolName, tagline, onBack, onLogoClick, children }`.
- `src/components/tools/ToolParts.tsx`: small shared parts: a labelled multi-line text field (clear button, character count, honours a max length), a single-line field, a segmented choice row, a switch row, a number field that accepts only valid numbers, a primary button, a result box with a Copy button (clipboard with a safe fallback for Android WebView, and a quiet "Copied" confirmation), an error line, and ONE "Options" disclosure row that hides its children until tapped.
- `src/tools/screens/registry.ts`: maps a tool id to its screen component using Vite's `import.meta.glob('../../components/toolScreens/*.tsx', { eager: true })`, so adding a tool later means adding files only. Each screen is a file `src/components/toolScreens/<Name>Screen.tsx` that exports `toolScreen = { toolId: '<catalog id>' }` and a React component taking `{ onBack: () => void; onLogoClick: () => void }`, wrapped in `ToolScreenShell`.
- Routing: add ONE generic `ToolTarget` value `'tool-screen'` and make a tool with `opens: 'tool-screen'` open `ToolScreenHost`. Implement it so that `AxonToolsScreen.openTarget` calls `setCurrentScreen('tool:' + tool.id)` and `src/App.tsx` renders the host for any screen id that starts with `tool:` (extend the screen id type in the state root as needed, minimal change). Existing targets keep working exactly as before. The back control returns to the Tools screen.

PART 2: THE THREE SCREENS (flip each in `src/tools/toolCatalog.ts` from 'coming-soon' to 'available' with `opens: 'tool-screen'`; change nothing else in the catalog):
1. CALCULATOR (id `calculator`; engine `src/tools/engines/numbers/calculator.ts`). Tagline: "Type a sum, get the answer". One single-line field labelled "Calculation" with the hint "for example (12 + 8) * 3". The answer shows live under the field in large type; a bad expression shows the engine's plain message in the error line instead. Under Options: every setting the engine offers (for example angle unit). Buttons: Clear, Copy answer.
2. CASE CONVERTER (id `case-converter`; engine `.../text/caseConvert.ts`). Tagline: "Change the case of any text". A multi-line field "Text"; a wrapping row of choices, one per engine mode (`CASE_CONVERT_MODES`, shown with the engine's display names); the converted text shows live in a result box with Copy.
3. FIND AND REPLACE (id `find-replace`; engine `.../text/findReplace.ts`). Tagline: "Find and replace inside your text". Fields "Text", "Find", "Replace with". A line under them: "N matches" (or "No matches"). The result box shows the replaced text with Copy. Under Options: Match case, Whole word, and any other option the engine supports (for example pattern matching, shown as "Use a pattern" with one quiet line about what that means); invalid patterns show the engine's message.

LANE (the only files you may touch): NEW src/components/tools/ToolScreenShell.tsx, src/components/tools/ToolParts.tsx, src/tools/screens/registry.ts, src/components/toolScreens/CalculatorScreen.tsx, CaseConverterScreen.tsx, FindReplaceScreen.tsx. CHANGED (minimal edits): src/tools/toolCatalog.ts (the type and three entries), src/App.tsx, src/components/AxonToolsScreen.tsx, and the state file that defines the screen id type. Nothing else.

DONE MEANS: in the preview the Tools menu shows Calculator, Case Converter and Find and Replace as normal open rows; each opens, works, and goes back; the existing tools (Text Counter, Converter, Dictionary, Interface Capture, Background Proof) and the image editor still open and work exactly as before; adding a fourth tool would need only new files plus its catalog flip.

## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
