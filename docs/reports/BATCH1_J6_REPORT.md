# Batch 1 — J6 report: plain-background remover

**Result:** BUILT; targeted test passed. Independent Director verdict remains pending.

**Files**
- Shared pixel contract: `src/tools/engines/images/pixelImage.ts`
- Engine: `src/tools/engines/images/plainBackground.ts`
- Test: `tests/batch1J6PlainBackground.test.ts`

**What it does**
- Fits a per-channel RGB plane from border pixels, supporting a flat colour or a smooth linear gradient.
- Measures border-model residual and returns `cannot` if the border is too inconsistent for the supported model.
- Flood-fills only model-matching pixels connected to the image border and sets their alpha to zero.
- Returns a new pixel buffer, removed-pixel count, residual, confidence, fitted background model, mode and warnings. The input is not mutated.

**Measured checks**
- `node run.mjs tests/batch1J6PlainBackground.test.ts` — PASS.
- Flat 18×14 scene: 216 background pixels removed; 36 foreground pixels preserved.
- Linear-gradient 24×18 scene: 376 background pixels removed; 56 foreground pixels preserved.
- Textured checkerboard border exceeded the residual limit and returned `cannot`.
- Original input pixels remained byte-identical after processing.

**Important limits / interpretation**
- Supported background model is flat or linear RGB gradient. Non-linear, textured or strongly varying backgrounds are refused when the border residual is too high.
- The subject should not touch the image border; the border is the model source.
- Foreground pixels close in colour to the predicted background and connected to the edge can be removed. Output requires visual review before use.
- Pixel contract cap is 4,000,000 pixels; this is a conservative memory safeguard, not a measured device-tier limit.

**Law check (FL11; laws touched)**
- FL1/FL3/FL9: pure pixel engine is isolated in the image-analysis layer.
- FL4/FL7: bounded buffers, explicit model residual and hard `cannot` path prevent unsupported claims.
- FL10/FL12: no catalogue, screen, brain or runner wiring changed.
- FL13: no phrase/pattern lists added.
- FL5/FL6/FL8/FL15/N3: dictionary, archives, export and original source untouched.

**NOT RUN:** broad natural-photo benchmark, hair/transparency quality study, device-tier memory/speed, UI integration, full suite, app/cloud build, independent Director mutants.
