# SLOT2 board lines (append to docs/JOB_BOARD.md; the board is not in the package)

- SLOT2 DONE (D471, 2026-11-16): Find and Replace ON (8th live tool). New binder rule 4a (src/brain/mind/bind/bindRoles.ts): quoted texts get their role from the single word before the quote. Optional slots may take a declared default (`fillOptional`). Defaults 'replacing every match' and 'matching case exactly' are DIRECTOR DECISIONS, OVERRULABLE.
- SLOT1 OUT (ChatGPT): Password, Percentage, Date, Converter, Calculator, Random Picker (choice words and declared defaults; binder untouched). Prompt: AXON_FASTER_SLOT1_PROMPT.md.
- NEXT (D471): Text Compare (needs roles too: 'compare X with Y', then a resolver gap) and the other RESOLVER GAPS; then STATE3; then Round 2.
- If another Director adds a tool with several quoted texts: add its marker words to TEXT_ROLE_MARKERS in bindRoles.ts (single lowercase words, no word in two roles) and test it like tests/bindRoles.test.ts.
- N18 ADDENDUM (D471): switching a tool ON also moves the status counts in tests/resolveOptionsRunner.test.ts (ready +1, built -1; now 10 / 30 / 18 / 5). A tool's switch-on therefore needs 4 test edits besides its own tests, plus tests/liveSwitches.test.ts, tests/wireGenerated.test.ts and the golden help lists.
