# C25 Report — Collage Engine V2

## Delivery status

The two engine modules and their repeatable test scripts are included. Core planning and shape operations are implemented, and the local compiled test runs pass. This is **not a full acceptance claim**: the complete prompt's ten independently derived exact layout cases, independent 9×9 shape-containment proof, maximal-cell brute-force proof, all requested polygon fuzz cases, speed benchmark, and mutation/restore exercise were not completed. The required `tsx` commands could not be run because `tsx` was not available in the mini-base and the attempted no-install invocation did not complete. See exact evidence below.

## LAW CHECK (FL11)

- FL1 top view: roadmap layer placement reviewed; collage geometry precedes rendering.
- FL2 exact scope: used the supplied roadmap, C25 prompt, and mini-base only.
- FL3 end-to-end plan: engines separate geometry from future image rendering and saving.
- FL4 progress/no repeats: fixed a failing tile-crop test and a mosaic-boundary failure; no third attempt was made at either failure.
- FL5 dictionary core: no dictionary files changed or omitted from the project.
- FL6 searchable compression: no large assets or dependencies added.
- FL7 measure: seeded tests and strict TypeScript check were run; unrun proof items are labelled below.
- FL8 export: deliverable paths are repository-relative.
- FL9 plan first: implemented only the specified planning and shape scope.
- FL10 chat control surface: exported `COLLAGE_DESCRIPTOR`; no catalog or registry wiring was attempted.
- FL11 every-stage: this check is repeated in the report.
- FL12 one designed brain: no screen, provider, or independent brain route added.
- FL13 structure before vocabulary: no phrase matching or fixed phrase list added.
- FL14 one source: geometry is held in the new pure engine modules.
- FL15 verified foundation: invalid-input paths, deterministic seeded runs, and polygon checks exist; full admission/integration checks remain outside this mini-base.
- Rule 1 capacity: used the bounded mini-base.
- Rule 2 foundation before scale: capped images, dimensions, gaps, margins and polygon vertices.
- Rule 3 foundation-up: geometry and shape functions only; no drawing layer.
- Rule 4 one builder/proof: this package contains the engine and tests for this job.
- Rule 5 plan before work: followed the named file lane and priority.
- Rule 6 measure/design/build/prove: ran compiled tests and strict type check; see NOT RUN list.
- Rule 7 compression: no data compression or asset degradation introduced.
- Rule 8 weakest phone: loops and input sizes are bounded by stated limits.
- Rule 9 verify return: package contains only new lane files and this report.
- Rule 10 roadmap: roadmap was not edited.
- Rule 11 compatibility: exported types and relative imports are used.
- Rule 12 tests: repeatable test scripts added; mutation coverage remains incomplete.
- Rule 13 migration: no hidden project dependencies were added; commands and limitations are listed.

## Files created

- `src/tools/engines/images/collagePlan.ts` — limits, styles, descriptor, and `planCollage`.
- `src/tools/engines/images/collageShapes.ts` — presets, polygon validation/simplification, and `planShapeCollage`.
- `tests/collagePlan.test.ts` — layout styles, malformed inputs, crop checks, deterministic seeded requests, bounds and overlap checks.
- `tests/collageShapes.test.ts` — all seven presets, basic polygon errors, simplification, and shape-size errors.
- `docs/reports/C25_REPORT.md` — this report.

## Commands and measured results

1. `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler src/tools/engines/images/collagePlan.ts src/tools/engines/images/collageShapes.ts` — **PASS**, exit 0.
2. `tsc --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --strict --outDir /tmp/c25compiled /tmp/node-shim.d.ts src/tools/engines/images/collagePlan.ts src/tools/engines/images/collageShapes.ts tests/collagePlan.test.ts tests/collageShapes.test.ts` — **PASS**, exit 0. `/tmp/node-shim.d.ts` was a temporary local declaration for `node:assert/strict` because the mini-base has no installed Node type declarations.
3. `node /tmp/c25compiled/tests/collagePlan.test.js` — **PASS**, 532 checks reported, including 500 seeded requests.
4. `node /tmp/c25compiled/tests/collageShapes.test.js` — **PASS**, 31 checks reported.
5. `tsc --noEmit -p tsconfig.json` — **FAIL / environment and pre-existing mini-base issues**: `node:assert/strict` types are missing for the existing `convertPlan.test.ts` and both new tests; existing `convertPlan.test.ts` also has TS2339 at line 12 (`error` not narrowed on `ImageConversionPlan`). This does not pass the mini-base-wide type-check requirement.
6. `npx tsx tests/collagePlan.test.ts` and `npx tsx tests/collageShapes.test.ts` — **NOT RUN**: `tsx` is not installed in the mini-base; the no-install availability attempt did not complete. The tests were compiled with global `tsc` and executed with Node instead.

## Existing repository tests

**NOT RUN**, as required for mini-base jobs: the repository-wide test files are not included in the mini-base. No `package.json` edits were made.

## Exact `test:kernel` lines to add

```text
tsx tests/collagePlan.test.ts
tsx tests/collageShapes.test.ts
```

## Not done / honest limits

- The engine plans rectangles only: it does not decode or draw pictures, save output, or create screens.
- No overlapping or rotated pictures are supported; custom shapes do not support holes.
- The full specified proof matrix is incomplete: the ten exact independently derived cases, independent 9×9 shape-containment checks, brute-force maximal-cell comparison, 30 random freehand polygon cases, speed measurements, and deliberate mutation/restore tests remain NOT RUN.
- The mini-base-wide type check and required `tsx` test commands remain NOT PASSING / NOT RUN as described above.

## DIRECTOR REVIEW (Claude, 2026-10-28) — result: ACCEPTED WITH DIRECTOR FIXES

The builder's own report was honest that proofs were missing. My independent audit (overlap, bounds, no crop, no stretch across all 8 styles and 7 shapes) found real defects, now fixed in this package:
1. Shape collages overlapped (56 of 70 audit cases): cells came from 16 different grid offsets mixed together. Now one grid offset only.
2. Fixed-height canvases (full, hero, columns, strip) squeezed the finished layout after the fact and pictures left the canvas or overlapped. `collagePlan.ts` is rewritten: the layout is recomputed at a narrower width until it fits, then centred. Gaps stay exact.
3. `hero` with one picture crashed. Grid and tiles with no canvas height always chose one tall column. Stack/others errored on fixed height. All fixed.
4. Mosaic is now an aspect-balanced tree (whole pictures, far less empty space) instead of equal-count halves.
5. Every plan is checked before it is returned (inside margins, no overlap, no empty cell); a bad plan becomes an honest error. A warning appears when pictures come out under 24 px.
Added `tests/collageAudit.test.ts` (1,033 checks). MEASURED here: all three collage tests pass under `tsx`; strict `tsc` clean on both engine files; shape planning at 100 pictures about 0.2 to 0.3 s on this machine (phone time NOT MEASURED).
Not proven: phone speed; the builder's missing items (ten hand-derived layouts, brute-force maximal-cell proof, mutation run); full repository test run and cloud build NOT RUN.
Note: an older collage engine exists at `src/tools/collage/collage.ts`; the screen job must use the new engines only (FL14, one source). Pictures are still never cropped except in `tiles`.
