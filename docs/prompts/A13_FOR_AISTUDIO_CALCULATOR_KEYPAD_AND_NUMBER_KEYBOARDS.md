# A13: Calculator keypad, scientific panel, "read as" line, and number keyboards on every number field

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Gives the calculator a real keypad (with a scientific panel, memory and history) and makes every number-only field open the phone's number keyboard instead of the letter keyboard.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or upload BASE.zip, the repository downloaded with Code, Download ZIP). Use a session with no older work in it. Needs C19 merged. BASE.zip must be the repository after it. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip and give it together with the BASE zip you started from to Claude (the Director). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, AI Studio's own list of files created and changed, and the short list of anything it could not try.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A13: CALCULATOR KEYPAD AND NUMBER KEYBOARDS

FILES THAT MUST EXIST (stop and say which is missing): src/components/toolScreens/CalculatorScreen.tsx, src/tools/engines/numbers/calculator.ts (from C19: results carry `interpreted` and `hint`; `evaluate(expression, { angle, ans })`), src/components/tools/ToolParts.tsx (SingleLineField and the shared parts), src/components/tools/ToolScreenShell.tsx, and the screens that have number fields (find them: Percentage, Loan, Split Bill, Timer, Random Picker, Number to Words, Password, the Converter, and any other in src/components/toolScreens). READ CalculatorScreen.tsx first: today it has ONE text field (SingleLineField with a letter keyboard), a result line, a Copy button and a degree or radian choice.

OWNER'S WORDS (binding): the calculator needs a visible keypad you can open and close with an arrow, with the number buttons, plus, minus, times, divide, percent, clear and the rest; an advanced set (square root, sin, cos and so on); and anything that needs only numbers must show the NUMBER keyboard, not the letters.

THE JOB:
1. KEYPAD (new reusable `src/components/tools/NumericKeypad.tsx`, used by the calculator): a panel under the expression that opens and closes with an arrow button (open by default). Basic keys: 0 to 9, `.`, `( )`, `+`, `−`, `×`, `÷`, `%`, `⌫` (delete before the caret), `C` (clear all), `Ans`, `=`. Every key at least 48 dp tall and wide enough for a thumb on a 320 px wide phone; no key text smaller than 16 px; keys have a pressed state; no layout shift when the panel opens.
2. SCIENTIFIC PANEL behind a "More" key in the keypad: `sin cos tan asin acos atan`, `ln log √ x² xʸ x! π e 1/x`, `ncr npr`, the Deg or Rad toggle (moved here from the page; its state is shown on the main line as a small label), and memory keys `MC MR M+ M−` (memory kept for the session; the memory value shown). Keys insert the text the engine understands (for example `sin(`, `√(`, `^2`, `!`, `pi`).
3. FIELD AND CARET: the expression field keeps a visible caret; keys insert and delete AT THE CARET. While the keypad is open the phone's keyboard must NOT pop up (use `inputMode="none"`); a small keyboard button switches to the normal text keyboard (for typing words like `of`) and back. Pasting works.
4. LIVE RESULT AND "READ AS": under the field show the result as you type (a quiet preview while valid, never an error while the expression is incomplete) and ONE quiet line "Read as: ..." using the engine's `interpreted`. On a real error show the engine's plain `hint`. `=` commits the result to a HISTORY (last 20, tap to reuse the expression or the result, a Clear action, Copy). `Ans` inserts the last committed result and is passed to the engine as `ans`.
5. NUMBER KEYBOARDS EVERYWHERE: add an optional prop to the shared field in ToolParts.tsx (additive, nothing existing changes), for example `numeric?: 'decimal' | 'integer'`, that sets `inputMode` (`decimal` or `numeric`) and a matching `pattern`. Go through EVERY screen in src/components/toolScreens and the Converter and apply it to every field that takes ONLY a number (Percentage, Loan, Split Bill, Timer, Random Picker min and max, Number to Words, Password length, unit values and the like). NOT to fields that may hold letters (hex numbers, text). Some phones' decimal keyboards have no minus sign: where a negative is valid (for example some unit values) keep the normal keyboard or add a small "±" button, and say which you chose. REPORT an AUDIT TABLE: screen, field, number-only (yes or no), what you applied, why.
6. Keep the Tool screen look (ToolScreenShell, one quiet style, no description text under names). Dark and light themes both work.

LANE (the only files you may touch): CHANGED src/components/toolScreens/CalculatorScreen.tsx; NEW src/components/tools/NumericKeypad.tsx; CHANGED (additive, minimal) src/components/tools/ToolParts.tsx; CHANGED (one prop each, nothing else) the other screens' number fields. FORBIDDEN: every engine file.

DONE MEANS (in the preview): `50% of 100 times 10` typed with the keypad and with the keyboard shows 500 and "Read as: ((50 ÷ 100) × 100) × 10" (or the engine's exact string); `100 + 10%` shows 110; the keypad opens and closes; the scientific panel, memory, history, Ans, caret insertion and delete work; at 320 px width nothing overflows or hides; the number fields in the audit table carry `inputMode` as reported (state plainly that the real keyboard layout must be checked on a phone); no console errors.


## STANDING RULES FOR GOOGLE AI STUDIO (apply to every step)

PROJECT RULES (pasted once per project): never delete, rename, move or shorten a file unless this prompt names it. Never touch `.github`, `tools`, `public/dictionary`, `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, or anything under `tests/` unless this prompt names it (the Director updates the tests). List every file you created, changed or deleted at the end. If the project has FEWER files than at the start, stop and say so. NEVER push to GitHub; the owner exports a zip instead.

LANE: change or create ONLY the files named in the LANE section of the job. If you believe another file must change, STOP and say which and why instead of changing it.

WHAT YOU ARE: the screen builder. The engines (pure logic) already exist and are tested; the screens call them directly and NEVER re-implement, copy or "improve" engine logic. First READ each engine's exported API, limit constants and types (the file paths are in the job) and use exactly what is there. If an engine's real API differs from this prompt's description, follow the engine and mention the difference in your report. Never add words or phrases to the brain.

LOOK (the owner's design philosophy, binding on every screen): simple, clear, organised, professional. A person must understand the screen at a glance: what it does, what they can do, where to go next. Show the few main controls first; put everything else behind ONE quiet "Options" row (progressive disclosure). No floods of text, no long lists, no boxed cards, no per-row "Coming soon" badges. A pretty screen that is hard to read is a failed screen. Reuse what exists: `src/components/ScreenHeader.tsx` (the header band; the back row sits UNDER the band), and the look of `src/components/TextCounterScreen.tsx`, `ConverterScreen.tsx` and `DictionaryScreen.tsx`. Same colours (#ECECEC text on the dark calm background), same fonts, lucide icons only; add no colours, fonts or icon sets. Mark anything by symbol or text as well as colour (for example + and - for added and removed). Tap targets at least 44 px. Use sentence case for labels, short verbs on buttons. Do not restyle the Source, Build or Interface Capture screens.

EVERY CONTROL REALLY WORKS: no placeholder buttons, no fake results, no "TODO". Every error is a plain honest line. Empty states say what to do in one short line. Inputs are limited by the engine's own limit constants, with a plain message when a limit is hit. Long work must not freeze the phone (the weakest phone is an Infinix Note 10): chunk it or show progress. Release canvases, object URLs and large buffers when done.

CHAT HONESTY: nothing on a screen says or implies that AXON's chat can run the tool (the chat gets this ability only when the brain's Resolution stage exists).

PROOF BEFORE YOU REPORT: run the app preview, open EVERY screen you built from the Tools menu, try the normal case, an empty case, a bad-input case and a very large input, and fix anything that breaks. Check the browser console for errors and fix them. Your report says, per screen, what you tried and what you saw, and anything that does NOT work. Never write "works" for something you did not try.

RETURN: when finished, list the files created and changed. The owner will export the project zip and give it, together with the base zip, to the Director, who compares them and builds the delta.
