# Batch 1 — J3 report: grid/collage splitter

**Result:** BUILT; targeted test passed. Independent Director verdict remains pending.

**Files**
- Shared pixel contract: `src/tools/engines/images/pixelImage.ts`
- Engine: `src/tools/engines/images/collageSplitter.ts`
- Test: `tests/batch1J3CollageSplitter.test.ts`

**What it does**
- Detects full-span horizontal and vertical gutters by comparing rows and columns with a corner-sampled background colour.
- Splits regular grid collages into deterministic panel rectangles, ordered top-to-bottom and left-to-right.
- Exposes `cropPanel` to copy a panel's RGBA pixels into an independent pixel buffer.
- Returns detected gutter bands, row/column counts, confidence and warnings; rejects invalid/oversized images and invalid options.

**Measured checks**
- `node run.mjs tests/batch1J3CollageSplitter.test.ts` — PASS.
- A synthetic 2×2 collage returned all four known boxes exactly: `(1,1,4,3)`, `(7,1,4,3)`, `(1,6,4,3)`, `(7,6,4,3)`.
- A single-panel image, actual crop pixel contents and invalid input/crop bounds were exercised.
- Existing neighbouring `collage.test.ts`, `collagePlan.test.ts`, `collageShapes.test.ts` and `collageAudit.test.ts` also passed.

**Important limits / interpretation**
- This detects grid-style collages with gutters that run across an entire row or column. It is not a free-form panel-boundary detector; the roadmap's P6 placement describes collage splitting as working for grids, not free-form layouts.
- The inferred background is sampled from the four corners; images with non-uniform corner backgrounds may need an explicit background option in a later contract revision.
- Pixel contract cap is 4,000,000 pixels per image. This is a conservative memory safeguard for analysis operations, not a measured Android device-tier limit; Claude should review it against the existing 24 MP image-conversion contract and later per-tier measurements.

**Law check (FL11; laws touched)**
- FL1/FL3/FL9: new detector is placed in the image-engine layer and reuses one shared pixel contract.
- FL4: bounded pixel dimensions and deterministic synthetic geometry tests.
- FL6/FL8: no archive packing or source-export logic changed.
- FL10/FL12: no catalogue, screen, registry or brain wiring changed.
- FL13: no phrase/pattern lists added.
- FL5/FL15/N3: dictionary, knowledge admission and original source untouched.

**NOT RUN:** free-form comic/manhwa page detection, screen UI, full test suite, app/cloud build, device memory/speed measurement, independent Director mutants.
