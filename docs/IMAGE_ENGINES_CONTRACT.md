# AXON Image Engines Expansion — Temporary Director Proposal

**Role:** Temporary Director + Builder (Grok), reviewed and corrected by Claude.  
**Status:** Reviewed + fixed (rev 2). Still must be sized against the repo and merged by the real Director.  
**Scope:** Pure engines only. No screens, no catalog changes, no brain wiring, no roadmap edit.

## What was delivered

New pure TypeScript modules (additive, new files):

| File | Purpose |
|------|---------|
| `src/tools/engines/images/colorEngine.ts` | Professional color adjustments: exposure, brightness, contrast, highlights, shadows, blacks, whites, warmth, tint, saturation, vibrance, fade (+ = shadows lift / highlights brighten / tint green / warmth orange) |
| `src/tools/engines/images/filterCatalog.ts` | 42 deterministic filters (about 25–30 visually distinct; several are intentional near-variants, e.g. golden-hour/amber, vivid/velvia) across basic, film, cinematic, vintage, B&W, mood, grade, vivid |
| `src/tools/engines/images/effects.ts` | Vignette (higher size = larger dark zone), deterministic grain, sharpen, **local clarity**, alpha-aware running-sum blur (radius ≤ 12), true soft-light color overlay |
| `src/tools/engines/images/imageOps.ts` | High-level composer + clamp helpers |

Tests (node:test style):

- `tests/colorEngine.test.ts`
- `tests/filterCatalog.test.ts`
- `tests/regression.test.ts` (slider direction, vignette size, soft-light, blur alpha, clarity locality, unknown filter id, catalog quality)
- `tests/effects.test.ts`

## Design decisions (for the real Director)

1. **Additive only.** Existing `src/tools/imageEdit/*` and current 7 filters are left untouched. The new modules can replace or sit beside them.
2. **Contract.** All pixel work is on `Uint8ClampedArray` (RGBA). Spatial effects take explicit `width` / `height`. No DOM required for the pure path.
3. **Phone safety.** Blur radius hard-capped at 12. Callers remain responsible for MAX_SIDE / PIXEL_IMAGE_LIMITS from existing `pixelImage.ts`.
4. **Determinism.** Grain uses a coordinate hash, never `Math.random`. Same image + same params → identical output.
5. **Extensibility.** New filter ids can be added to `FILTER_CATALOG` + `targetRgb` without changing the public apply signatures.
6. **Honest limits (N2).** This does not clone every proprietary LUT or AI model in InShot / Canva. It provides a professional-grade, expandable pure engine that already covers the main commercial categories and is far richer than the previous 7-filter set. More presets, true 3D LUTs, or ML background removal remain future work under the Placement Law.

## How to integrate (real Director)

- Import from the new modules.
- Optionally extend `EditOp` in `history.ts` with richer color / effect ops, or keep a parallel path that the pipeline calls.
- Wire chat actions / registry later (FL10) only after the engines are ACCEPTED.
- AI Studio screens stay separate (A09 lineage).

## Rev 2 changes (review fixes)

- **Shadows were inverted** (+ darkened). Fixed; highlights/shadows are now additive and tone-weighted.
- **Clarity** was a global contrast curve. Removed from `ColorParams`; real local-contrast `applyClarity` added to `effects.ts` and `ImageEditRequest.clarity`.
- **Vignette `size`** was inverted vs its docs. Fixed.
- **Overlay** was a 50%-capped lerp, not soft-light. Now the real soft-light formula.
- **`clampImageEditRequest`** swapped unknown filter ids for `mono`. Now drops them (identity), consistent with `applyFilter`.
- **Blur** is O(1)/pixel (running sums) and alpha-aware (no dark fringes on transparent PNGs): ~2.4× faster at radius 12.
- Strict-TS (`noUncheckedIndexedAccess`) compile error in `teal-orange` fixed.
- Filter count corrected (45 → 42).

## Known limits (unchanged, for the Director)

- Pixel math is on gamma-encoded sRGB, not linear light.
- Filters are per-channel formulas, not 3D LUTs; the per-pixel string switch is not yet optimised.
- Not checked against the real repo (`imageEdit/*`, `history.ts`, `pixelImage.ts`, tsconfig module settings, legacy 7-filter formulas).
- Speed (desktop Node, 12MP): blur r12 ≈ 1.0s, clarity ≈ 1.0s, full stack ≈ 3.5s. Phones are several times slower, so keep MAX_SIDE downscaling (~2MP: full stack ≈ 0.6s desktop).

## Suggested acceptance tests for the real Director

- All four test files pass (54 tests) under `tsx --test` or equivalent.
- Mutants: zero strength / zero amount / unknown filter id must be identity.
- Alpha channel never altered.
- Input buffers never mutated.
- Filter count ≥ 40 and all categories non-empty.
- Full stack (`applyImageEdit`) runs on a 24×24 solid without throwing.

## Brain note (already stated)

The brain is not complete. See Temporary Director message for the open stages (Verification, Judgment, Decision Dimensions, Repair, Multi-reply, etc.).

## Interface question (already answered)

Yes, the Temporary Director/Builder can write screen code as a proposal. Project process still routes final screens through AI Studio + real Director verification.
