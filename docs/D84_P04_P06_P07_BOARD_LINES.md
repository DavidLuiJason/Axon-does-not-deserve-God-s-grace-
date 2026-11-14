# D84 brain parts P04, P06, P07 board lines (owner appends; this package does not touch NOW.txt, MERGE_TAG.txt, JOB_BOARD.md or DIRECTOR_NAP.txt)

WHAT IT IS: three brain parts built directly by Director D84 (no outside builder): P04 GOAL AND PLANNER, P06 REFLECTION, P07 EXTERNAL-AI CONTRACT. Pure modules with their own tests. NOT connected to the brain yet (no existing file changed), so no behaviour changes until the orchestrator part wires them in.

FILES: src/brain/mind/plan/plan.ts, src/brain/mind/reflect/reflect.ts, src/brain/mind/external/external.ts, tests/plan.test.ts, tests/reflect.test.ts, tests/external.test.ts, tests/fixtures/planCases.json (48 cases), tests/fixtures/reflectCases.json (28), tests/fixtures/externalCases.json (36, plus 4 size-limit cases written in the test itself), docs/BRAIN_BUILD_STATE_D84.md, docs/D84_P04_P06_P07_BOARD_LINES.md.

P04: forms a goal with a success test (a state key and value), validates a plan (unique steps, no cycles, no unknown needs, the plan must reach the goal, size limit), and decides ONE next step at a time. A step counts as finished only when the real state shows it, never because a tool said "done". The same step is never tried a third time with the same input: it asks the owner instead. Its planner has the same shape as the existing step loop's Planner (state and journal in, a decision out).
P06: after a task, produces only CANDIDATES (never trusted knowledge): mistakes (each needs a regression test), tool notes (failed or never verified), owner preferences (only if memory is allowed for that task) and a lesson on failure. Cannot touch the Charter, permissions or source.
P07: rules for talking to an outside AI: registry check, NEVER blocks, ASK needs approval, only allowed data kinds, a known secret anywhere in a request blocks it, a response is always UNTRUSTED evidence "REPORTED" and can never instruct AXON, and agreement between AIs is never "verified".

VERIFICATION (MEASURED): 16308 + 19608 + 6756 checks, 0 failed (hand-derived cases plus seeded random invariant checks); 12 + 10 + 10 deliberate breaks on the code, every one caught; strict type check clean, erasable syntax only, also runs under plain node strip-types; in a copy of the current repository all 7 relevant tests (these 3, repair, verify, judgment, brain golden) pass together; no path collisions. LIMIT: written and tested by the same director (D84); the expected values were derived by hand from the rules, but there is no second implementation. Another director should spot-check.

NOT RUN: Android build, cloud build, the full repository suite (new files only; no existing file changed).

NOW.txt line: 2026-11-14 | roadmap v21.3 | brain parts P04 planner, P06 reflection, P07 external-AI contract merged (D84, pure modules, not wired in yet) | next: dialogue questions (D2b), per-tool verifiers, orchestrator, end-to-end tests
MERGE_TAG.txt line (newest first): 2026-11-14 | BRAIN P04+P06+P07 [D84, built directly; files above] | MEASURED: 42672 checks 0 failed; 32 mutants all caught | NOT RUN: Android build, cloud build
