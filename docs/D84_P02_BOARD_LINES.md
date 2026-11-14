# D84 P02 board lines (owner appends; this package does not touch NOW.txt, MERGE_TAG.txt, JOB_BOARD.md or DIRECTOR_NAP.txt)

WHAT IT IS: brain part P02 VERIFICATION (stage 9), COM-BRAIN-RESULTS-P02, built by ChatGPT from the D84 card, verified and extended by D84. A pure module with its own tests. It is NOT connected to the brain yet (no existing file changed), so no behaviour changes until the Orchestrator part wires it in.

FILES: src/brain/mind/verify/verify.ts, tests/verify.test.ts, tests/fixtures/verifyCases.json (168 cases), docs/D84_P02_BOARD_LINES.md.

WHAT IT DOES: given the clauses of a request and a record of each step (what the tool reported, its output, and a check: recompute, known answer, or observed state), it says per clause VERIFIED / UNVERIFIED / MISMATCH / FAILED / MISSING with an evidence label, the overall result (PASSED, FAILED, INCOMPLETE, UNCLEAR), whether success may be claimed (only on PASSED), and the next action (CONTINUE, RECOVER, ABSTAIN, REDESIGN on the second failure of the same assumption). A tool saying "success" is never enough.

D84 VERIFICATION (MEASURED): builder's test 165/165 under tsx and plain node strip-types; strict type check clean (erasable syntax only); the builder's 165 hand-written expectations all agree with my independent reference; 40000 random inputs compared with my reference: 0 differences; edge probes (clause id "__proto__" and "constructor", null, extra fields, wrong types) behave correctly. My 10 own mutants: 9 caught; the 10th (REDESIGN returned for INCOMPLETE when prior failures exist) was NOT caught, so I added 3 cases (D84_01 to D84_03), now caught. Builder code unchanged (same sha256). The builder's report was not given to D84, so its NOTICED list was not reviewed.

NOT RUN: Android build, cloud build, the full repository suite (new files only; no existing file changed).

NOW.txt line: 2026-11-14 | roadmap v21.3 | brain part P02 VERIFICATION merged (D84, pure module, not wired in yet) | next: P03 judgment, then wiring
MERGE_TAG.txt line (newest first): 2026-11-14 | BRAIN P02 VERIFICATION [D84; ChatGPT build; files above] | MEASURED: 168/168 own tests, 0 differences in 40000 random inputs vs independent reference | NOT RUN: Android build, cloud build
