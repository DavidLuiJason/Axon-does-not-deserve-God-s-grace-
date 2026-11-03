# DOWNSCALE report (Director, 2026-11-03)

**Result:** BUILT and tested by the Director. Engine only: not wired to the brain, a catalogue entry or any screen.

**Files:** `src/tools/engines/images/downscale.ts` (new), `tests/downscaleEngine.test.ts` (new, in `test:kernel`). `pixelImage.ts` and `convertPlan.ts` are unchanged.

**Why:** the shared pixel contract refuses images above 4,000,000 pixels; phone photos are 12 to 50 million. Without this, the six Batch 1 engines can never see a real photo.

**What it does**
- `downscalePixelImage(image, options?)`: shrinks to at most 4,000,000 pixels and 8,192 per side (callers may ask for smaller, never larger). Exact area averaging with fractional edge weights, on alpha-premultiplied colour. Input never changed. Already-fitting image: same object back, `changed: false`.
- Reads up to 24 MP and 16,384 per side (the file-conversion ceiling, imported, not copied); refuses more with `image-too-large` before touching the buffer.
- `boxToSource(box, result)`: maps a box found on the shrunk image back to the original (outward rounding, clamped).
- `needsDownscale(width, height)`: tells a caller whether the step is needed.

**Measured (Director sandbox)**
- Test passes. 3000x2000 becomes 2449x1632 (3,996,768 pixels).
- Hand-computed: 4x4 to 2x2 exact; 3x3 to 2x2 gives red 13, 27, 53, 67.
- Transparency: opaque pixels keep their exact colour, nothing leaks from hidden colour under alpha 0.
- Flat colour stays flat; a hard edge lands on the exact share; limits checked at 4,000,000 and 4,002,000 pixels.
- End to end: `removePlainBackground` refuses the 3000x2000 scene, and works after DOWNSCALE.
- 21 of 22 deliberate breakages caught; the survivor is equivalent (NaN in a clamped array becomes 0).
- Strict tsc: no error in the new files.

**Limits and findings (honest)**
- NOT RUN: full `test:kernel` in one go, full suite, cloud build, phone. Speed and memory per device tier are UNMEASURED: a 50 MP photo is about 200 MB as RGBA before it is shrunk, so a screen should shrink while decoding where the phone allows.
- Averaging is a smooth, even shrink; it is not a sharpening or high-quality photo resampler.
- The six Batch 1 tests are still outside `test:kernel` (small job).

**Law check (FL11):** FL1/FL3 whole-plan place: image layer, below J3 to J6 screens. FL4 sized small, proven by script and breakages. FL10/FL12 no chat or brain wiring. FL13 no phrase lists. FL14 one limit number imported, no copy. FL5/FL6/FL8/FL15/N3 dictionary, export and source untouched. Roadmap not edited.
