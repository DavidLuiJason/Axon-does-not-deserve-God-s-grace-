# D84 P01 board lines (owner appends; this package does not touch NOW.txt, MERGE_TAG.txt, JOB_BOARD.md or DIRECTOR_NAP.txt)

WHAT IT IS: brain part P01 REPAIR (COM-BRAIN-RESULTS-P01), built by ChatGPT from the D84 card, verified and extended by D84. A pure module with its own tests. It is NOT connected to the brain yet (no existing file changed), so no behaviour changes until the Orchestrator part wires it in.

FILES: src/brain/mind/repair/repair.ts, tests/repair.test.ts, tests/fixtures/repairCases.json (200 cases), docs/reports/COM_BRAIN_P01_REPORT.md (builder's report), docs/D84_P01_BOARD_LINES.md.

WHAT IT DOES: three safe repairs only: an exactly repeated sentence, the whole-sentence markers "wait" and "oops" (the sentence before is taken back), and "how much <words|letters|characters|lines|sentences|paragraphs|numbers|digits|vowels|items>" to "how many". Quoted text is never touched. A repair on a message with a risky word (delete, remove, erase, overwrite, send, pay, transfer, format) returns ASK, not REPAIRED. Anything unclear is KEEP.

D84 VERIFICATION (MEASURED): builder's test 194/194 under tsx and under plain node strip-types; strict type check clean (erasable syntax only); 30000 generated messages compared with my own independent reference: 0 differences once two ambiguous card sentences were read the cautious way; the builder's 194 hand-written expectations checked against my reference: 1 disagreement (mixed capitals "mUcH", a case the card never defined, accepted). My 6 own mutants: 5 caught; the 6th (extra marker word "hold") was NOT caught, so I added 6 cases (D84_01 to D84_06), now caught.

DECIDED by D84 (cautious readings, written into the card for later builders): a sentence ends only at . ! ? followed by a space or the end (a newline alone does not end it); a marker takes back only the sentence immediately before it in the ORIGINAL text; repeats are only neighbouring in the original text (a removed sentence between two copies breaks the neighbourhood); mixed-capital "mUcH" becomes "mAnY".

NOT RUN: Android build, cloud build, the full repository suite (new files only; no existing file changed).

NOW.txt line: 2026-11-13 | roadmap v21.3 | brain part P01 REPAIR merged (D84, pure module, not wired in yet) | next: P02 verification, P03 judgment, then wiring
MERGE_TAG.txt line (newest first): 2026-11-13 | BRAIN P01 REPAIR [D84; ChatGPT build; files above] | MEASURED: 200/200 own tests, 0 differences in 30000 generated messages vs independent reference | NOT RUN: Android build, cloud build
