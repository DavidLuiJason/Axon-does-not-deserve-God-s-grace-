# A04: Timer, Stopwatch, Tally Counter and Device Profile screens

WHO THIS IS FOR: Google AI Studio (the screen builder).
WHAT THIS DOES: Builds four tool screens on the kit: Timer, Stopwatch, Tally Counter, Device Profile. Timer, Stopwatch and Tally keep working when the person leaves the screen and comes back.
WHAT YOU DO: Start a NEW AI Studio project by importing the GitHub repository (or uploading BASE.zip, the repository downloaded from GitHub with Code, Download ZIP). Use a session that has no older work in it. Needs job A01 merged and ChatGPT job C11 merged: BASE.zip must be the repository after both. Paste the whole text of this file as your message. When AI Studio finishes, export the project zip (the AXON source export), and give that zip together with the BASE zip you started from to Claude (or the next Director account). Never push from AI Studio.
WHAT TO BRING BACK: the exported zip, plus AI Studio's own list of files it created and changed.

---

## STANDARD PROMPT PREAMBLE (unchanged)

Before you do anything: read the AXON roadmap (all of it, not a part), then read Part 00 again. AXON is a foundation-first project and its foundation is being reopened. Do not choose a direction until you have looked at the whole project from above. Answer in one short paragraph: (1) what the finished AXON contains (Part 5E), (2) where this job sits in it, (3) what could break later because of this job. Then do ONLY the job below. Never delete, rename or shorten a file unless this prompt names it. The dictionary is core to AXON: never remove it or leave it out. If anything in this prompt conflicts with the roadmap, stop and say so. If the same problem fails twice, stop and report; do not try a third fix. Before you build, write the LAW CHECK (FL11): list every law that applies (FL1 to FL13 and Rules 1 to 13, by number) and say how the job complies; repeat it in your report; if any law conflicts with the job, stop and say so. Never add a fixed phrase list to the brain (FL13).

---

## JOB A04: TIMER, STOPWATCH, TALLY COUNTER AND DEVICE PROFILE SCREENS

FILES THAT MUST EXIST (stop and say which is missing): src/components/tools/ToolScreenShell.tsx, src/components/tools/ToolParts.tsx, src/tools/screens/registry.ts, src/tools/toolCatalog.ts (with the 'tool-screen' target), src/tools/engines/time/timer.ts, stopwatch.ts, tally.ts, src/tools/shared/toolStore.ts, src/tools/engines/device/deviceProfile.ts, src/components/buildDetails.ts, src/components/toolScreens/CalculatorScreen.tsx. Read the kit's code and one finished screen (for example src/components/toolScreens/CalculatorScreen.tsx) first and follow them exactly; do not change the kit except to add a part it truly lacks (say so). Each screen is a file `src/components/toolScreens/<Name>Screen.tsx` that exports `toolScreen = { toolId: '<catalog id>' }` and a React component taking `{ onBack: () => void; onLogoClick: () => void }`, wrapped in `ToolScreenShell`. Flip each tool in `src/tools/toolCatalog.ts` from 'coming-soon' to 'available' with `opens: 'tool-screen'`.

SCREENS (use these exact titles and taglines; labels in sentence case):

1. TIMER (id `timer`; engine timer.ts). Tagline: "Count down to zero". Hours, minutes, seconds fields (within the engine's limits); Start, Pause, Reset; the remaining time in very large type. It keeps time from the engine's timestamps, never by counting ticks, so it stays correct when the phone sleeps or the person leaves the screen and returns; its running state is saved with `src/tools/shared/toolStore.ts`. When it reaches zero the screen says "Time is up" and the phone vibrates with `navigator.vibrate` only if it exists. No sound. One quiet line under the controls: "Alerts only while AXON is open."
2. STOPWATCH (id `stopwatch`; engine stopwatch.ts). Tagline: "Time anything". Start, Stop, Lap, Reset; elapsed time in very large type with tenths of a second; the laps listed newest first, showing the lap time and the total, at most 100 kept with the engine's limit message; same timestamp rule and the same saving as the Timer.
3. TALLY COUNTER (id `tally-counter`; engine tally.ts). Tagline: "Count anything, as many as you like". A list of named counters (plain rows); each shows its name and number with large "-" and "+" buttons; "Add a counter" asks for a name; renaming and deleting (with a confirmation) under Options; "Reset all" with a confirmation; saved with toolStore; the engine's limits shown honestly.
4. DEVICE PROFILE (id `device-profile`; engine deviceProfile.ts; the environment values come from the browser: user agent, screen size, pixel ratio, orientation, touch points, deviceMemory, hardwareConcurrency, languages, time zone, online state, `navigator.storage.estimate()`, and the app name, version and build from buildDetails.ts). Tagline: "What this phone and this app are". The engine's report as plain label and value rows; a "Measure speed" button that runs the engine's speed probe and shows the result with the engine's one honest line; a "Copy report" button (plain text). One quiet line: "Nothing leaves your phone." Unknown values read "unknown".

LANE (the only files you may touch): NEW src/components/toolScreens/TimerScreen.tsx, StopwatchScreen.tsx, TallyCounterScreen.tsx, DeviceProfileScreen.tsx. CHANGED (minimal edits): src/tools/toolCatalog.ts (flip the listed tools only), and src/components/tools/ToolParts.tsx only if a part is truly missing. Nothing else.

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
