# BATCH 6 - J5 Manifest Compare report

**Placement:** layer 0 ground; finish-line stage Ground (N3 source integrity / FL8 export comparison); dependency: none.
**Files:** `src/export/manifestCompare.ts`, `tests/manifestCompare.test.ts`, `docs/reports/BATCH6_J5_REPORT.md`.

## LAW CHECK (FL11)
- FL1: comparison engine only; no export or filesystem operations.
- FL2: created only the three named new files.
- FL4: ran the test and eight deliberate breakages; each mutation was restored.
- FL7: compares supplied paths, hashes and byte counts; it does not infer integrity.
- FL8: computes missing, extra and different paths for an export/repository comparison.
- FL11: exact validation and first-failing-check order follow the card.
- FL13: no phrase or word lists; validation uses only the specified path/hash formats.
- N3: does not write or modify source; comparison is read-only.

## Result
BUILT; ISOLATED TEST RUN: PASS

Printed test line: `MANIFEST_COMPARE OK: 127 checks`

Commands and output:
- `tsc --noEmit --strict --target ES2020 --module commonjs src/decision/deepDiveStop.ts src/learning/learningGate.ts src/export/manifestCompare.ts tests/deepDiveStop.test.ts tests/learningGate.test.ts tests/manifestCompare.test.ts` — `PASS: strict type-check`.
- `rm -rf out && tsc --strict --target ES2020 --module commonjs --outDir out src/decision/deepDiveStop.ts src/learning/learningGate.ts src/export/manifestCompare.ts tests/deepDiveStop.test.ts tests/learningGate.test.ts tests/manifestCompare.test.ts` — `PASS: compile to out`.
- `node out/tests/manifestCompare.test.js` — `MANIFEST_COMPARE OK: 127 checks`.
- `test:kernel` addition: `tsx tests/manifestCompare.test.ts` (not added to package.json; package.json was not changed).

## Hand-worked oracle

Card cases were worked before execution:
- H1: before has a/x, a/y, b; after has a/x, changed a/y, c → missing [b], extra [c], different [a/y], same 1, identical false.
- A same hash with a different byte count is different.
- Reordered equal entries remain identical; same equals the number of matching entries.
- Two empty lists → identical true, same 0.
- Missing paths sort by plain code-unit order: B.txt, a.txt, b.txt.
- Every specified invalid path form, invalid hash form, invalid byte count, non-array list and 100,001-entry list → bad-manifest; 100,000 entries are accepted.
- Duplicate path within either list → duplicate-path; a bad entry plus a duplicate reports bad-manifest first.
- touchedUnder: a/ selects a/y.ts; a/ plus c.txt/ selects a/y.ts once; src/ selects none; a/ does not match ab/z; duplicate matching prefixes return a path once; malformed prefixes → bad-prefixes; missing comparison array → bad-comparison.

Two additional hand-worked cases:
- X1: before contains p.ts with hash H1 and 12 bytes; after contains p.ts with hash H1 and 12 bytes → missing/extra/different all empty, same 1, identical true.
- X2: missing contains aa/file.ts and ba/file.ts; prefix aa/ returns only aa/file.ts because the prefix must match from the start of the path, including its slash.

## Deliberate breakages and test detection

1. Reversed leading-slash path validation — CAUGHT by the main manifest oracle.
2. Allowed uppercase SHA-256 characters — CAUGHT by uppercase hash case.
3. Allowed negative byte counts — CAUGHT by bytes -1 case.
4. Disabled duplicate-path detection — CAUGHT by duplicate-before case.
5. Ignored byte-size differences — CAUGHT by size mismatch case.
6. Replaced missing-path sort with reverse insertion order — CAUGHT by missing code-unit sort case.
7. Changed prefix matching from startsWith to includes — CAUGHT by prefix-must-start-at-path-beginning case.
8. Removed freezing of touchedUnder's returned array — CAUGHT by touched result array frozen case.

All eight mutations failed the test and were restored. No mutation was left in the delivered engine.

## Questions for the Director

none

## What I could not check

- `tsx` execution and package.json integration; the equivalent compiled Node test was run.
- Actual export collection, filesystem access, repository-vs-export equality, hashes or phone behavior; this engine accepts two already-collected manifests only.
- Full AXON integration and the cold-start/source-export re-proof; outside this isolated batch.
