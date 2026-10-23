# AXON OPEN ITEMS (everything not done; the owner's words recorded 2026-10-23; update with every merge)

Evidence labels: MEASURED, OWNER-REPORTED, DEVICE, NOT RUN, HYPOTHESIS. Nothing here is built unless it says so. Rule (roadmap section 1): nothing is added to a screen without a plan and a design check first.

## A. Look and feel (each needs a plan and a design check before any prompt)
- LIGHT AND DARK MODE (OWNER-REPORTED): the app has always been dark and the owner likes the design. Add a setting for light and dark (also "follow the phone"). The orange-red brand colour (logo and accents) stays the same; only text and background colours change.
- APP ICON (the picture under the app name on the phone's home screen; also called logo): NOT DESIGNED yet. Design it first, then build it.
- STATUS BAR (the top strip with time, notification icons, signal and battery): does not match the app's colour and theme. It must follow the page, like professional apps. In light mode it must follow the light page.
- INPUT HINT (the grey text in the empty message box): the owner liked a hint that changes, for example "/" for commands, but it must not change constantly: once per session or similar. Not decided.
- CHAT LIST (long-press on a chat): Rename, Delete, Export. No extra buttons.
- THE TOGGLE BUTTON above the message bar (the chat or web switch): its meaning depends on the page. Main chat: probably nothing (the owner already talks to AXON directly). AXON Web: dims the web page so the chat shows clearly; tapping again returns to scrolling. AXON App and other pages: to be decided page by page; some pages may share a meaning. A settings page lists each page and lets the owner choose what the button does there, from a list of possible actions.
- USER MANUAL in settings: what each button does and how AXON works.
- The owner asked that each part that should stay fixed on a screen really is fixed, and that every part is checked as "is it supposed to be this way?" (design check).

## B. Tools
- Image tools are incomplete (OWNER-REPORTED). The image view fix A09 (Image editor view) is with the owner for testing.
- Some tools are dimmed and lifeless (cannot be opened, no tool behind them). The dimmed entries are listed in `src/tools/toolCatalog.ts`; the list per tool group is NOT YET WRITTEN here.
- Most tools have not been tested on the phone, so it is not known whether they work (OWNER-REPORTED). Phone checks pending: A13 (Calculator keypad), A14 (Video Frames), A09 (image view).
- Video to Audio waits for the V1 probe and the native decision. Backup and Restore and Source hub S3 wait for the owner.

## C. Build and repository
- RED MARKS (OWNER-REPORTED, 2026-10-23): some red marks flash in the GitHub build. They have been there for a long time and the build still finishes (cloud build passed on the B03P merge). NOT shown to the Director yet; not known whether they are real errors. Action: the owner sends a screenshot or the log text; the Director classifies them. Not fixed now.
- The repository roadmap `docs/ROADMAP.md` was still v16.8 before this update; the root file `AXON_ROADMAP.md` is a stale v14.4 copy (already on `docs/CLEANUP_CANDIDATES.md` as stale).
- Measured state of the main chat screen: NOT RECORDED.

## D. Cleanup notes (stage Z; roadmap section 11)
- Cleanup is the LAST stage. Each item needs a reason and its proof; nothing is removed by name pattern.
- Example of why: `docs/prompts/` looks like clutter but holds live prompts (B03A's prompt lives there).
- The oldest roadmap v15.1 is already in `docs/archive/`; do not import it again, and do not read it unless a check names a section.
- Add every candidate to `docs/CLEANUP_CANDIDATES.md` (add only).

## E. Brain notes from the owner
- READING QUESTIONS (owner correction, 2026-10-23): for every message AXON silently asks ITSELF who it is for, what it is meant to do and what it refers to. These are internal checks in its own reading, NOT questions put to the user; it asks the user only when it cannot settle them itself (see `docs/BRAIN_PLAN.md`, addendum 2026-10-23).

## F. Added 2026-10-23 (night) from the owner's phone and cloud-build screenshots
**Red marks (MEASURED from the owner's screenshot of the cloud build, 2 errors, 4 warnings):**
- ERROR `tests/convertBlocks.test.ts` line 18: `notes.changes` possibly undefined. FIXED (fix pack TF6): `(notes.changes ?? [])`. Test runs, 1,101 assertions pass.
- ERROR `tests/batchPlan.test.ts` line 7: `message` does not exist on type `never` (the assert narrows the plan to success, so the failure branch has no type). FIXED (TF6): the failure branch reads the message through a cast. Test runs, 31 assertions plus 2,000 seeded operations pass.
- Both are slips inside TEST files, not app faults; the APK was still built because STRICT_CHECKS is false. After TF6 merges, check that the build shows 0 errors; then the owner may decide to turn the test gate on (open item "test gate").
- WARNING Node.js 20 deprecation (checkout@v4, setup-java@v4, setup-node@v4, upload-artifact@v4 are forced onto Node 24) and WARNING setup-java v4 should become v5: workflow file, changed BY HAND only (never in a zip); not urgent, no job yet.
- WARNING no AXON_DEBUG_KEYSTORE_B64 secret: each build gets a new random key, so the old app must be uninstalled first. Known; owner decides when to add the key.
- WARNING "Type check or tests failed. The APK is still built": the summary of the two errors above.

**Dimmed (unbuilt) tools, MEASURED in `src/tools/toolCatalog.ts`: 23 of 60 entries.** Media 10: Collage Maker, Picture to Table or Code (Image); Audio Converter, Text to Speech, Voice Library, Voice Cloner, Speech to Text (Audio); Video Converter, Video Maker, Video Downloader (Video). Files and Converters 2: PDF Tools, Document Converter. Text and Writing 2: Rephraser, Grammar Helper. Language 1: Translator. Web and Data 3: Content Extractor, Link Analyzer, Web Search. AXON Code 1: AXON Code. Finance 2: Currency Converter, Market Scope (owner builds Market Scope in another account). Device and System 2: AI Assistant, Backup and Restore. Note: the Video Downloader and the Voice tools are LEFT OUT by earlier owner decisions; the owner may reopen any of them.

**QR Code Maker choice row (A15, prompt written, HELD until the repository is merged and green):** the five choices (Text, Link, Wi-Fi, Phone, Email) wrap and shift because the selected button is bolder and wider. Fix: equal-width, one line, same weight, no jump. Nothing added to the screen.

**QR SCANNER (PLAN FIRST, no prompt yet; owner idea 2026-10-23):** same screen as the QR Code Maker, a quiet two-way choice at the top, "Make" and "Scan", in the existing look (no new colours, no boxed cards). Scan: "Scan with camera" and "Choose a picture". Result shown as text with Copy; a link is only opened when the owner taps it; Wi-Fi codes show the name and security, never the password in bold. Needs, in order: (1) a measurement on the owner's phone: does the app's web view offer camera access and the browser's built-in barcode detector, or is a decoder library needed (size and licence checked first); (2) the Android camera permission, a native step by the Director; (3) a pure decoder engine and tests by ChatGPT (reads pixels, returns text and a clear failure); (4) the screen by AI Studio. Honest limit: unmeasured; labelled HYPOTHESIS until step 1.

**STATUS BAR (owner, again):** the top strip (time, notifications, alarm, network, battery) has its own colour and does not match the page. This is NATIVE Android styling (theme and status-bar settings in the Android overlay), not an AI Studio screen job; plan it together with light and dark mode (section A) so that it follows the page colour in both.

**TOOLS THAT DESCRIBE THEMSELVES (owner, 2026-10-23: room to add more tools later):** every tool, now and in future, carries a short description of what it does, needs and returns, declared once in the registry (FL10). From that one place AXON (a) answers "what can you do", (b) builds the user manual in settings, and (c) shows the tool in the menu. Adding a tool then means adding its registry entry; nothing else is edited by hand. Check at the next brain job (B04) that the registry has the fields the manual needs; add only what is missing. A test keeps menu, registry and manual in step.

**AXON CODE AND HEAVY PYTHON (owner question; ideas, NOT a promise; for AC2 to AC4):** see the Director's reply of 2026-10-23: honest limits and a design of (a) streaming and chunked helpers, (b) storage-backed containers, (c) checkpoint and resume, (d) measured memory caps per phone tier. To be written as `docs/AXON_CODE_PLAN.md` addendum when AC2 starts, after measurement on the owner's phone.

**Owner is testing the other tools** and will report problems; each report becomes a line here before any fix prompt (no piling).

**CHECKED IMPORT INTO MY DICTIONARY (owner idea, 2026-10-23):** the owner imports a list of ANY size (1,000 was only an example) as txt, md, zip or pasted text. Steps: (1) the Director writes a CHECKING PROMPT for an outside AI tool (Claude, ChatGPT or Grok) that returns each entry marked right, wrong or unsure with a reason; (2) the owner imports only what passed; (3) every entry keeps source, date and checker; (4) the brain reads these entries as a second knowledge source and as the standby dictionary, never over the core dictionary. The engine (C18) already stages an import and adds nothing until the owner says yes; what is missing is the checking prompt and the "checked by" field. Plan before any screen change.
**ACCENTS AND SPEECH (owner has an accent):** the phone's recogniser writes the words; AXON cannot change how it listens. What AXON can do: a personal "heard as" list (what the recogniser wrote, what was meant), learned from the owner's own corrections and kept in My Dictionary, applied before the brain reads the message. A real accent model is NOT promised (HYPOTHESIS; needs measurement on the owner's voice).

**MY DICTIONARY WITHOUT A CAP, SHOWN IN THE DICTIONARY (owner, 2026-10-23; PLAN FIRST):** (1) MEASURED today: `USER_DICT_LIMITS` allow 20,000 entries and 3 MB in one browser store, and an import file may be 5 MB or 20,000 rows. That is a cap, against the owner's wish. A storage job (C25, engine only) moves the entries to chunked storage on the phone (many small blocks, saved and read exactly, with the same undo and export), so size is limited only by free space; the weak-phone limit on how much is loaded at once stays. (2) MEASURED: `src/components/DictionaryScreen.tsx` does not read My Dictionary at all, so words added there never appear in the Dictionary search. Wanted: a Dictionary search also returns My Dictionary entries, each with a small My Dictionary icon (or dot); tapping it shows a short note: "Added from My Dictionary, not from AXON's original." No new box, no new colours; the icon only. Needs a design check, then an AI Studio job (A19) after C25. (3) The brain already reads My Dictionary as a source (BRAIN_PLAN).
