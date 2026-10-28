# C26 Report — Picture to Table Grid Engine

## Result

**Status:** engine and tests delivered. The engine reconstructs a grid from supplied word boxes and exports CSV/Markdown. It does not read letters from pictures.

**Roadmap placement:** media tool engine (`picture-to-table`), beneath the future OCR/reading stage. Later work must supply word boxes and separately decide UI, tool registration, and OCR integration. No roadmap or catalog changes were made.

## LAW CHECK (FL11)

- **FL1 — Top view:** located C26 in the media-tool layer; OCR is a later input provider, and contract changes could affect integration.
- **FL2 — Exact scope:** used the supplied roadmap and named mini-base files only.
- **FL3 — End-to-end plan:** separated word recognition, grid reconstruction, and export.
- **FL4 — Progress and Two-Strike:** built and checked incrementally; three deliberate mutations were detected and restored.
- **FL5 — Dictionary:** untouched and not omitted from AXON.
- **FL6 — Searchable compression:** bounded boxes, text, rows, and columns for low-memory devices.
- **FL7 — Measurement:** measured seeded reconstruction, speed, and failure-path behavior.
- **FL8 — Export integrity:** packaged only the three new lane files with repository-relative paths.
- **FL9 — Plan first:** followed the requested priority and kept registration/UI out of scope.
- **FL10 — Capability truth:** descriptor says word boxes are required and OCR is not built; no registration was added.
- **FL11 — Every-stage law:** this check is recorded here and was considered during implementation.
- **FL12 — One designed brain:** pure engine only; no screen or independent chat path.
- **FL13 — Structure before vocabulary:** examples are descriptor documentation and tests only; no brain phrase list added.
- **FL14 — One source, no copies:** CSV text is produced by the existing `writeCsv`; round trips are checked with existing `parseCsv`.
- **FL15 — Verified foundation:** known-answer, hostile-input, seeded, performance, and mutation checks were run; unavailable checks are labelled NOT RUN.
- **Rule 1:** measured 5,000-box execution and bounded inputs.
- **Rule 2:** stayed within the mini-base foundation and named lane.
- **Rule 3:** built the grid engine before screens or registration.
- **Rule 4:** used one bounded engine job with reproducible tests.
- **Rule 5:** followed the specified implementation order.
- **Rule 6:** measured, designed, built, and proved the result.
- **Rule 7:** bounded input/output expansion; no unnecessary copied CSV implementation.
- **Rule 8:** measured 5,000-box performance against the 200 ms target.
- **Rule 9:** returned a relative-path zip; the return still needs Director-side base comparison.
- **Rule 10:** did not modify or retype the roadmap.
- **Rule 11:** exported typed contracts and a descriptor for future integration.
- **Rule 12:** added regression cases and performed deliberate mutation checks.
- **Rule 13:** used relative imports and documented unavailable checks.

## Files created

1. `src/tools/engines/images/tableFromBoxes.ts` — bounded pure engine, typed results/errors, grid reconstruction, uncertainty/tilt/alignment warnings, CSV and Markdown exports, descriptor.
2. `tests/tableFromBoxes.test.ts` — known answers, seeded synthetic layouts, hostile export text, error paths, performance and mutation-sensitive checks.
3. `docs/reports/C26_REPORT.md` — this report.

No existing file was changed. `package.json`, catalog, roadmap, and dictionary were not edited.

## MEASURED proof

- **Seeded synthetic tables:** 300 cases; each had 2–30 rows, 2–12 columns, empty cells, 1–4 word cells, random font heights from 10–60 px, and jitter. At 10% jitter, **300/300 exact (100%)**. At 15%, **291/300 exact (97%)**; the remaining 9 produced warnings, with 0 `not-a-table` refusals. At 25%, **236/300 exact (78.7%)**; the remaining 64 produced warnings, with 0 `not-a-table` refusals. Inaccurate higher-jitter reconstructions without a warning: **0** at both 15% and 25%.
- **Known answers independently calculated in Python:** 3×3 table expected `[['Name','Age','City'],['Ada','36','Lagos'],['Ben','29','Abuja']]`; empty middle cell expected `['A','','C']`; two-word header expected `Annual Report`; single-column `(4 rows, 1 column)` and single-line `(1 row, 4 columns)` fail the minimum 2×2 rule. Tilt angle was independently calculated as `atan(8/150) = 3.0529°`, so the warning threshold of 2° is exceeded.
- **Confidence:** low-confidence text remains in the grid and is marked uncertain at row 0, column 0 in the known-answer test.
- **CSV/Markdown:** 200 seeded hostile-text tables round-tripped exactly through the repository `parseCsv`; Markdown tests checked consistent column counts, ragged-row padding, and empty-input rejection. Hostile text included commas, quotes, line breaks, pipes, emoji, Arabic, Hebrew, 500-character cells, and leading/trailing spaces.
- **Errors:** malformed boxes, non-finite coordinates, wrong types, zero/negative dimensions, empty/whitespace/overlong text, invalid confidence, 5,001 boxes, and out-of-range options returned typed errors without throwing.
- **Speed:** 5,000 boxes completed in **35.91 ms** in the final recorded run, below 200 ms. Timing is environment-specific.
- **Mutation check:** row-overlap mutation — **FAILURE DETECTED**; column-overlap mutation — **FAILURE DETECTED**; empty-cell-padding mutation — **FAILURE DETECTED**. The original source was restored after each mutation, then the final test run passed.

## Commands and results

- `tsc --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --strict --outDir /tmp/c26-run src/tools/engines/images/tableFromBoxes.ts src/tools/engines/data/csv.ts tests/tableFromBoxes.test.ts && node /tmp/c26-run/tests/tableFromBoxes.test.js` — **MEASURED PASS**, `tableFromBoxes: PASS (1035 checks)`; synthetic and speed results printed above.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler src/tools/engines/images/tableFromBoxes.ts src/tools/engines/data/csv.ts tests/tableFromBoxes.test.ts` — **MEASURED PASS**, exit 0.
- `tsc --noEmit -p tsconfig.json` — **MEASURED FAIL**, exit 2, due to mini-base baseline issues in `tests/convertPlan.test.ts`: missing `node:assert/strict` type declarations and an existing union-narrowing error at line 12. The new C26 test had no remaining errors in this check. No existing files were changed to mask these errors.
- Existing style test fallback: `tsc --noCheck --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --outDir /tmp/c26-convert node-shim.d.ts src/tools/engines/images/convertPlan.ts tests/convertPlan.test.ts && node /tmp/c26-convert/tests/convertPlan.test.js` — **MEASURED PASS**, `convertPlan: PASS (dimensions, naming, format, quality and hostile inputs)`. `--noCheck` was needed because the supplied mini-base's baseline type issues prevent the ordinary project check.
- Mutation checks — **MEASURED**: each of the three intentional mutations caused the test command to fail; source restored and final tests rerun successfully.
- `npx tsx tests/tableFromBoxes.test.ts` — **NOT RUN**: `tsx` is not installed in the mini-base and the `npx --no-install tsx --version` availability probe timed out. Used the prompt's permitted global-`tsc` temporary-output and `node` fallback instead.
- Full repository `test:kernel` — **NOT RUN**: the mini-base does not contain the repository's full kernel suite, as the prompt notes.
- `npx tsc --noEmit -p tsconfig.json` — **NOT RUN under npx** because no local toolchain was installed; the equivalent available global `tsc --noEmit -p tsconfig.json` was run and its failure is recorded above.

## Exact `test:kernel` line to add

Append this command to the existing `test:kernel` chain in `package.json` (do not replace the existing commands):

`tsx tests/tableFromBoxes.test.ts`

## Not done / limits

- **No letter reading/OCR:** the engine only accepts pre-existing word boxes; the reading step is not built here.
- **No rotation:** tilted input is warned about, never rotated.
- **No merged cells:** cells are inferred from nearby word boxes; merged-cell semantics are not reconstructed.
- **No SVG:** drawing-to-SVG is a separate job.
- No catalog registration, capability registration, screen, package manifest edit, or roadmap edit.
- Full repository kernel suite and the requested direct `tsx` invocation remain NOT RUN due to mini-base/environment limits.

## DIRECTOR REVIEW (Claude, 2026-10-28) — result: ACCEPTED WITH ONE DIRECTOR FIX

Re-run against the real repository `csv.ts`: builder's test PASS (1,035 checks), strict tsc clean. My independent test (left/right/centred columns, multi-word and empty cells, 3,000 tables) found one silent failure: the fixed cell-gap rule (1.5 x letter height) merged neighbouring columns with no warning when gutters were under 1.5 x letter height (128 of 300 tables wrong at 1.2h). Fix: the cell break is now learned from the gaps actually present (largest jump between word-spacing and gutters; an explicit `cellGapFactor` from the caller is still respected), and a warning appears when the gaps cannot be told apart. MEASURED after the fix: gutters 0.9h to 3h: 293 to 298 of 300 exact, 0 wrong without a warning. Added `tests/tableFromBoxesAudit.test.ts`. NOT RUN: full repository test run, cloud build. Limits unchanged: no letter reading (OCR), no rotation, no merged cells.
