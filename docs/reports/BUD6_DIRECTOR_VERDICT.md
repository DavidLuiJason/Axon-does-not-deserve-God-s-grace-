# BUD6 Director verdict (2026-11-07)

VERDICT: ACCEPTED (Director's evidence verdict; the owner's CONFIRMED mark is separate).

## What was checked (Director sandbox, Node 22, tsx)
- Returned test, run under tsx: `BATCH_PLAN OK: 16423 checks` (the builder had reported tsx NOT RUN; the count matches its Node run).
- Director checks written before the return: 86 hand-derived checks pass on the returned engine.
- Differential run, returned engine against the Director reference: identical results on 6,000 random packings and 3,000 random vectors.
- Mutants: 32 deliberate breaks of the engine. First run: 29 of 32 killed; survivors: the two boundary characters of the date check (the characters just after 9 and just before 0) and `Reflect.ownKeys` swapped for `Object.keys` (killed only by the builder's test). Five checks were added to `tests/bud6DirectorChecks.test.ts` (91 total); all 32 now killed by the Director checks.
- Cloud lint command (repo tsconfig extended, node types, strict, the three TypeScript files): exit 0; a control probe with a deliberate type error fails as it should.
- Real-log figures match `docs/BUD6_CASES.md`: ChatGPT promptChars 16000 (ESTIMATE), miniBaseFiles 10 (ESTIMATE), filesReturned 22 (OBSERVED), Claude directorCommands CONFLICT.

## The one change to the return
The returned test file `tests/batchPlan.test.ts` collides with an existing test of the same name (File Converter batch engine, C17). It is now `tests/budgetBatchPlan.test.ts`, content unchanged. The collision was the Director's card error (the prompt named the path), not the builder's.

## Not run
Full `test:kernel`, the cloud build, the phone. Nothing calls the two functions yet; where log rows are stored and who calls them stay UNDECIDED.

`package.json`: `test:kernel` gained `tsx tests/budgetBatchPlan.test.ts && tsx tests/bud6DirectorChecks.test.ts` (appended). `tools/files.lock` not touched.
