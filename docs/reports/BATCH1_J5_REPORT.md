# Batch 1 — J5 report: shape locator and find-by-example

**Result:** BUILT; targeted test passed. Independent Director verdict remains pending.

**Files**
- Shared pixel contract: `src/tools/engines/images/pixelImage.ts`
- Engine: `src/tools/engines/images/shapeLocator.ts`
- Test: `tests/batch1J5ShapeLocator.test.ts`

**What it does**
- Estimates a background from the four corners unless the caller supplies one.
- Finds connected foreground components above a colour-distance threshold.
- Classifies components heuristically as circles, rectangles or blobs using their bounding-box aspect and fill ratio.
- Returns pixel bounds, centre, area, fill ratio, mean RGB colour and a heuristic confidence.
- `findByExample` samples the mean RGB of a patch and finds connected regions within a caller-supplied colour tolerance.

**Measured checks**
- `node run.mjs tests/batch1J5ShapeLocator.test.ts` — PASS.
- Synthetic circle, rectangle and irregular blob all found; measured centres were exactly `(8,9)`, `(24,8.5)` and `(35,17)`.
- A 2×2 sample inside the red rectangle found its exact 9×8 component.
- Isolated noise below the minimum area was ignored; an unmatched sample returned an empty match list.

**Important limits / interpretation**
- Shape class is geometric heuristics, not a trained classifier; perspective, hollow outlines, occlusion and touching objects can be misclassified or merged.
- Find-by-example currently means same-image RGB patch similarity. It does not compare semantic object identity, learn a model or persist exemplars. The separate user-data exemplar store described in P6 is not part of this engine job.
- Pixel contract cap is 4,000,000 pixels; this is a conservative memory safeguard, not a measured device-tier limit.

**Law check (FL11; laws touched)**
- FL1/FL3/FL9: one pure engine under the existing image family, using the shared pixel contract.
- FL4: bounded image processing and synthetic shapes/noise/no-match tests.
- FL7: classifications are explicitly heuristic and expose their geometry.
- FL10/FL12: no app catalogue, brain schema, screen or registry changed.
- FL13: no phrase/pattern lists added.
- FL5/FL6/FL8/FL15/N3: dictionary, knowledge and original source untouched.

**NOT RUN:** diverse real-photo benchmark, perspective/occlusion dataset, exemplar persistence, device-tier performance, full suite, app/cloud build, independent Director mutants.
