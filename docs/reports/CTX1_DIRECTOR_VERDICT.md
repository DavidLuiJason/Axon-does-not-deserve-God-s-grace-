# CTX1 DIRECTOR VERDICT (2026-11-07): ACCEPTED

Return: CTX1_CONTEXT_LOOKUP_DELTA.zip from ChatGPT, 3 files, unchanged in the merge: src/decision/contextLookup.ts (7,822 chars), tests/contextLookup.test.ts, docs/reports/CTX1_CONTEXT_LOOKUP_REPORT.md.

MEASURED (Director sandbox, Node 22, tsx):
- Builder test under tsx: CONTEXT_LOOKUP OK: 17,030 checks (the builder could not run tsx and said so; the Director reran it).
- Director checks (docs/director/CTX1_checks.ts.txt, now tests/ctx1DirectorChecks.test.ts, 22,112 checks incl. 35 hand-worked rows, caps, errors, link into makeActOrAskInput, 3,000-case sweep) run on the returned engine: all pass.
- Differential run, returned engine against the Director reference: 20,000 seeded cases (valid and invalid inputs, junk, extra keys, notes as a source): 0 differences in value, error and key order; every result deep-frozen.
- Strict tsc on the engine and both tests: clean. Engine has no imports, Date, random, console, storage or regex.
- The reference's 25 Director mutants were killed by the Director checks (card turn). The builder reports 10 of 10 own mutants killed (BUILDER-REPORTED).

FINDINGS: F1 the builder's tsc run used its own flags, not the repo tsconfig: the cloud lint decides (NOT RUN here). F2 package.json test:kernel gained tsx tests/contextLookup.test.ts and tsx tests/ctx1DirectorChecks.test.ts (appended by the Director; builders never edit it). F3 tools/files.lock NOT touched. F4 nothing calls lookupContext yet (FEED3).
NOT RUN: full test:kernel, cloud build, phone.
