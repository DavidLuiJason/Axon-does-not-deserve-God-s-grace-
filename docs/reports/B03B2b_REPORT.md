# B03B2b — Clause Parts Report

## Result

Implemented `src/brain/mind/meaning/structure/clauseParts.ts`. The implementation imports `DETAIL_WORDS`, leaves marker meanings raw, returns one result per supplied range, does not mutate inputs, and handles malformed inputs without throwing.

## Proof results

- `node run.mjs tests/partsRunner.test.ts` — **PASS**; 167 checks, 0 failures; printed `PARTS RUNNER OK`.
- `node run.mjs tests/valuesGuard.test.ts` — **PASS**; 8 files scanned, 14 checks passed.
- `tsc -p tsconfig.values.json` — **PASS**; exit code 0.
- Speed case — passed as part of the runner's hostile-length checks (the runner reports no failures).
- Optional extra tests and mutation tests — **NOT RUN / NOT ADDED**.

## LAW CHECK (FL11)

- **FL1:** Kept this job inside the approved Meaning-stage structure layer.
- **FL2:** Read the complete roadmap and the named mini-base contract, runner, guard, and reference files only.
- **FL4:** Ran the prescribed proof and type check; no repeated failure required a second attempt.
- **FL5:** Did not remove, alter, or omit dictionary data.
- **FL9:** Reports raw clause structure; later interpretation remains outside this file.
- **FL11:** This law check is included in the report.
- **FL13:** Imports `DETAIL_WORDS`; introduces no fixed phrase list, regex literal, or array of three or more string literals.

## Known limit / uncovered clause type

A clause with coordinated main verbs sharing one object (for example, “pick up and carry the box”) is not explicitly covered by the 31-case corpus; the single-main-verb contract may assign the shared object only to the first verb.

## Files

- Created: `src/brain/mind/meaning/structure/clauseParts.ts`
- Created: `docs/reports/B03B2b_REPORT.md`
- No other files changed.

## DIRECTOR INSPECTION (2026-10-25, third Claude account): ACCEPTED

- The return held only `clauseParts.ts` and this report. The mini-base files (`partsTypes.ts`, `detailWords.ts`, the Director's 167-check `partsRunner`) were NOT attached to this account, so they were NOT re-run. The contract was rebuilt from the builder's imports (`PartFacts`, `Span`, `Detail`, `ClauseParts`, `ReadClauseParts`; `DETAIL_WORDS` = "for in to by at") and is included in this package. If the original contract files differ, the original wins; tell the Director.
- MEASURED: `tsc` strict with `noUncheckedIndexedAccess` clean; the FL13 guard `meaningNoPhrases.test.ts` passes with the file in the real tree (31 files); `structureRunner` still 313 checks OK.
- MEASURED: independent reference test `tests/partsReference.test.ts` (20 checks: set a timer / send it / tell Tom to wake me / remind me at 7 / copula / noun-verb after a determiner / empty clause / trailing marker / bad ranges / null input / no mutation / 200,000 words in about 90 ms). Six mutants of the builder's code (determiner rule, trailing-marker rule, infinitive rule, object end, empty object, copula): all caught once the reference cases covered them.
- KNOWN LIMITS (not defects of this job): (1) coordinated verbs share one object; (2) "to call" is an infinitive only when the caller's facts say `call` is a verb and NOT a noun, but the real dictionary lists `call` as both, so the glue must decide the policy before "tell Tom to call me" works; (3) a word like "please" that the dictionary lists as a verb becomes the main verb; the glue or B03B2c must treat it. NOT wired into Meaning or chat.
