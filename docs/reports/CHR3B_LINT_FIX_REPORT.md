# CHR3B LINT FIX REPORT (Director job, 2026-11-06)

LAW CHECK (FL11, laws touched): FL4 two-strike (not a repeat: first lint failure of this kind); FL8 export equals repository (package changes listed below); FL15/N2 truth (the cause below names the Director's own gap); N3 (no src change); BUILD VERDICT (log text decides); rule 12 (checks must cover future files: see New rule).

## What failed
Cloud lint (`tsc --noEmit`), after AXON-CHR3-merge.zip:
- tests/charterView.test.ts(62,83): TS2339 Property 'error' does not exist on type '{ ok: true; text: string; } | { ok: false; error: CharterError; message: string; }'
- tests/charterView.test.ts(63,31): same.

## Cause
S04 and S05 read `serializeCharter(x).error` without first checking `ok`. tsx does not type-check, so every run passed; the Director's earlier "tsc strict clean" did not include tests/ under the repo's settings (finding: Director gap, accepted in CHR2 and repeated in CHR3).

## Fix
One helper, two call sites (engine and src untouched):
`const errOf=(r:ReturnType<typeof serializeCharter>)=>r.ok?undefined:r.error;`
S04 and S05 now call `errOf(serializeCharter(...))`.

## Evidence (MEASURED, Director sandbox)
Config: repo tsconfig.json extended with node types; files tests/charter*.test.ts and src/mind/charter/*.ts.
- BEFORE: exactly the 2 errors above, nothing else.
- AFTER: tsc exit 0.
- Tests unchanged in count: charterView 1,001; charterViewDirectorChecks 24; charter 18; charterChange 22; charterStore 43.
- Mutant: wrong expected value on S04 is caught (1 of 1 killed).
- NOT RUN: full-repo lint (no node_modules in the sandbox; the cloud log is the proof), cloud build, phone.

## New rule
Before a package leaves, the Director runs the cloud's lint (repo tsconfig, node types) on the files in it and prints the output here.

## Package
Changed: tests/charterView.test.ts, NOW.txt, MERGE_TAG.txt, docs/JOB_BOARD.md, DIRECTOR_NAP.txt. New: docs/reports/CHR3B_LINT_FIX_REPORT.md. Not touched: package.json, tools/files.lock, src/.
