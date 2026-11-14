# D84 P03 board lines (owner appends; this package does not touch NOW.txt, MERGE_TAG.txt, JOB_BOARD.md or DIRECTOR_NAP.txt)

WHAT IT IS: brain part P03 COUNCIL AND JUDGMENT, COM-BRAIN-RESULTS-P03, built by ChatGPT from the D84 card, verified and extended by D84. Pure modules with their own tests. NOT connected to the brain yet (no existing file changed), so no behaviour changes until the Orchestrator part wires it in.

FILES: src/brain/mind/judgment/council.ts, src/brain/mind/judgment/judge.ts, tests/judgment.test.ts, tests/fixtures/judgmentCases.json (165 cases), tests/fixtures/judgmentFlagCases.json (14 cases added by D84), docs/D84_P03_BOARD_LINES.md.

WHAT IT DOES: eight review seats (PURPOSE, METHOD, ADVOCATE, CRITIC, GAPS, OUTSIDER, TIME, FAILURE) each raise flags about a proposed action; Judgment then says PROCEED, PROCEED_WITH_WARNING, ASK or STOP. There is no voting: a NEVER permission always stops, a BLOCKING flag always asks, nothing can be "agreed away". Permission itself is decided elsewhere (the Charter broker). The other-people check inside CRITIC is the proposed design the owner has not yet signed off.

D84 VERIFICATION (MEASURED): builder's test 165/165 under tsx and plain node strip-types; strict type check clean (erasable syntax only); the builder's 165 hand-written expectations agree with my independent reference; 60000 random proposals (including broken ones) compared with my reference: 0 differences in both functions, including every flag field. My 12 own mutants: all caught after my addition, but 3 of them (a flag's "next", "resolvable" and "evidence" fields) were NOT caught by the builder's original test, which compared only verdict, urgent and seat:severity pairs. I added 14 flag-detail cases and 14 checks to the test. Builder source code unchanged (same sha256). The builder's report was not given to D84.

NOT RUN: Android build, cloud build, the full repository suite (new files only; no existing file changed).

NOW.txt line: 2026-11-14 | roadmap v21.3 | brain part P03 COUNCIL+JUDGMENT merged (D84, pure modules, not wired in yet) | next: cards P04 to P07, then wiring
MERGE_TAG.txt line (newest first): 2026-11-14 | BRAIN P03 COUNCIL+JUDGMENT [D84; ChatGPT build; files above] | MEASURED: 179/179 own tests, 0 differences in 60000 random proposals vs independent reference | NOT RUN: Android build, cloud build
