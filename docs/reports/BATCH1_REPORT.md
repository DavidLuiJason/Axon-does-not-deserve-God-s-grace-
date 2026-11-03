# AXON Plan B — Batch 1 build report

**Base repository:** `Axon-does-not-deserve-God-s-grace--main` from the owner's upload dated 2026-11-03.

**Scope source:** `docs/V21_2_PLAN.md`, P1, Batch 1 (J1–J6). The six requested engines were built as independent new files, with one shared RGBA contract for J3–J6. No prompt files were created.

**Status:** BUILT IN ISOLATION — awaiting independent Director verdict. This is a candidate return only; nothing was merged into the owner's source repository.

## Files delivered

| Job | Engine | Test | Report |
|---|---|---|---|
| J1 | `src/tools/engines/text/findReplaceMany.ts` | `tests/batch1J1FindReplaceMany.test.ts` | `docs/reports/BATCH1_J1_REPORT.md` |
| J2 | `src/tools/engines/data/dataUseLedger.ts` | `tests/batch1J2DataUseLedger.test.ts` | `docs/reports/BATCH1_J2_REPORT.md` |
| J3 | `src/tools/engines/images/collageSplitter.ts` | `tests/batch1J3CollageSplitter.test.ts` | `docs/reports/BATCH1_J3_REPORT.md` |
| J4 | `src/tools/engines/images/focusCrop.ts` | `tests/batch1J4FocusCrop.test.ts` | `docs/reports/BATCH1_J4_REPORT.md` |
| J5 | `src/tools/engines/images/shapeLocator.ts` | `tests/batch1J5ShapeLocator.test.ts` | `docs/reports/BATCH1_J5_REPORT.md` |
| J6 | `src/tools/engines/images/plainBackground.ts` | `tests/batch1J6PlainBackground.test.ts` | `docs/reports/BATCH1_J6_REPORT.md` |

Shared contract: `src/tools/engines/images/pixelImage.ts`.

## LAW CHECK (FL11)

- **FL1 / FL3 / FL9:** the six engines are located in their existing text/data/image engine families. The image jobs share one RGBA contract. This batch does not claim the higher-level tool is live.
- **FL4:** bounded inputs, deterministic APIs, explicit failure results and targeted regression tests are included. Same-failure retry loops were not used.
- **FL5 / FL6:** dictionary and knowledge archive files are untouched.
- **FL7:** synthetic known-answer fixtures and explicit no-match/cannot outcomes are used; no real-device performance claim is made.
- **FL8:** no source-export code or export baseline is changed.
- **FL10 / FL12:** no tool catalogue, runner registry, brain schema, chat action or UI file is changed. These engines are not yet reachable through chat.
- **FL11:** this law check is repeated in each per-job report.
- **FL13:** no fixed phrase or pattern lists are added to the brain.
- **FL14:** no shared engine duplication migration is attempted.
- **FL15:** no knowledge or archive material is admitted or changed.
- **N3:** source changes remain in this isolated candidate return. The owner's original repository and uploaded zip are not changed; the owner controls integration.

## Test evidence

| Check | Result |
|---|---|
| Six Batch 1 tests via `node run.mjs` | PASS |
| Strict TypeScript check of all seven new engine/contract files | PASS |
| Existing `tests/runnersText.test.ts` | PASS — 920 checks |
| Existing `tests/collage.test.ts` | PASS — 4,676 checks |
| Existing `tests/collagePlan.test.ts` | PASS — 532 checks |
| Existing `tests/collageShapes.test.ts` | PASS — 31 checks |
| Existing `tests/collageAudit.test.ts` | PASS — 1,033 checks |
| Existing `tests/tableFromBoxes.test.ts` | PASS — 1,035 checks |
| Existing `tests/tableFromBoxesAudit.test.ts` | PASS — 16 checks |

The exact stdout from these commands is in `BATCH1_TEST_LOG.txt`.

The Director structural/lane script was also run without `--run-tests`: **MEASURED** 22 returned files, 22 new, 0 changed existing, 0 out-of-lane, 0 placeholder hits; it reported `NO PROBLEMS FOUND BY THIS SCRIPT`. This is a packaging/lane check, not an independent code verdict or a project test run.

### Important measured outcomes

- J1: 19 assertions; sequential pair order and overlapping matches are explicit.
- J2: 400 consecutive daily records; received 80,200 bytes, sent 160,400 bytes, combined 240,600 bytes; month/year boundaries, leap day and 30-day retention exercised.
- J3: four synthetic grid panel boxes matched exactly.
- J4: synthetic subject box `{ x: 8, y: 5, width: 11, height: 10 }`; 64 edge pixels; relative confidence 0.9623.
- J5: circle, rectangle and irregular blob found at known centres; colour-example match, weak noise and no-match cases exercised.
- J6: 216 flat-background pixels and 376 linear-gradient-background pixels removed; textured-border hard case returned `cannot`; original input remained unchanged.

## Boundaries and NOT RUN

- No `package.json`, `tools/`, `.github/`, dictionary, roadmap, existing neighbour, hot file or app screen was modified.
- No chat/brain wiring was attempted. P1 explicitly says Plan B cannot wire tools into the brain.
- The image pixel contract sets a 4,000,000-pixel analysis ceiling to bound extra buffers. This is a conservative **HYPOTHESIS**, not a measured per-tier Android budget. It should be reviewed against the current 24 MP image-conversion path and weak/mid/strong device measurements before any live UI promise.
- J3 detects regular grids with full-span background gutters, not free-form comic panel segmentation.
- J4 is edge-density focus, not semantic subject recognition.
- J5 classifies by connected-component geometry; find-by-example uses same-image RGB similarity, not semantic identity or persistent learning.
- J6 supports flat/linear-gradient backgrounds and may refuse complex backgrounds; its output requires visual review.
- NOT RUN: full `test:kernel`, full `test:all`, Vite/app build, GitHub/cloud build, APK, phone/device measurements, real-photo benchmark, UI/brain integration and independent Director mutants.
- No claim of ACCEPTED is made. Claude must independently run verification, mutate the engines to challenge the tests, and decide ACCEPTED or NOT ACCEPTED per card/batch.

## Suggested independent verification sequence

1. Compare the return zip against the original repository and confirm every entry is new and in the Batch 1 lane.
2. Run the six new tests using the repository's Node 22 `run.mjs` runner.
3. Run the strict engine type-check and the named neighbouring regression tests.
4. Mutate pair order, ledger aggregation/retention, gutter detection, edge-component selection, shape classification/example matching and background-model refusal. Confirm the relevant tests fail.
5. Review the provisional 4 MP pixel limit and algorithmic limitations; then issue the Director verdict. Do not merge until the owner-approved merge process is followed.
