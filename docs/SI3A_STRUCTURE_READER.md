# SI3a STRUCTURE READER (D47, 2026-11-11)
PLAIN: the part of Screen Intelligence that understands a screen as buttons, text and fields (from the Android accessibility tree), not as a picture. It is what AXON Apps reads to know what it can tap.
FILES (new only; nothing existing is edited): src/screen-intelligence/structure-reader.mjs, tests/screen-structure-reader.test.mjs, docs/SI3A_STRUCTURE_READER.md.
RULES BUILT IN: hidden nodes dropped; password and typed text redacted (typed text kept only on explicit option, passwords never); blocked apps return nothing; money, send, delete, sign-in controls flagged ASK-FIRST (7R); output capped.
STATUS: ISOLATED-TESTED on made-up snapshots. No caller, no Java feeder yet (SI3b). Real phone trees NOT RUN.
BOARD LINE: SI3a (D47): structure reader merged, new files only, isolated, no caller. Next SI3b: Android accessibility service feeding it (needs current main).
