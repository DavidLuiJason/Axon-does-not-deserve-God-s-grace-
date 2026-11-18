/**
 * High-level pure image operations for AXON Image family.
 * Composes colorEngine + filterCatalog + effects.
 * All functions return new buffers; input is never mutated.
 */

import { applyColorEngine, clampColorParams, type ColorParams, NEUTRAL_COLOR } from './colorEngine';
import { applyFilter, isKnownFilterId, FILTER_CATALOG, type FilterDef } from './filterCatalog';
import {
  applyVignette,
  applyGrain,
  applySharpen,
  applyBlur,
  applyClarity,
  applyColorOverlay,
  type VignetteParams,
  type GrainParams,
  type SharpenParams,
  type BlurParams,
  type ClarityParams,
} from './effects';

export { FILTER_CATALOG, isKnownFilterId, type FilterDef, type ColorParams, NEUTRAL_COLOR };
export type { VignetteParams, GrainParams, SharpenParams, BlurParams, ClarityParams };

export interface ImageEditRequest {
  /** Advanced color parameters. */
  color?: Partial<ColorParams>;
  /** Filter id + strength 0–100. */
  filter?: { id: string; strength: number };
  vignette?: Partial<VignetteParams>;
  grain?: Partial<GrainParams>;
  sharpen?: Partial<SharpenParams>;
  blur?: Partial<BlurParams>;
  /** Local contrast, -100…+100. */
  clarity?: Partial<ClarityParams>;
  /** Optional solid color overlay (theme accent). */
  overlay?: { r: number; g: number; b: number; opacity: number };
}

/**
 * Apply a full edit stack in a sensible order:
 * color → filter → clarity → sharpen → blur → grain → vignette → overlay.
 * Requires width/height for spatial effects.
 */
export function applyImageEdit(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  req: ImageEditRequest
): Uint8ClampedArray {
  let buf = pixels;

  if (req.color && Object.keys(req.color).length > 0) {
    buf = applyColorEngine(buf, req.color);
  }

  if (req.filter && req.filter.id && req.filter.strength > 0) {
    buf = applyFilter(buf, req.filter.id, req.filter.strength);
  }

  if (req.clarity && (req.clarity.amount ?? 0) !== 0) {
    buf = applyClarity(buf, width, height, req.clarity);
  }

  if (req.sharpen && (req.sharpen.amount ?? 0) > 0) {
    buf = applySharpen(buf, width, height, req.sharpen);
  }

  if (req.blur && (req.blur.radius ?? 0) > 0) {
    buf = applyBlur(buf, width, height, req.blur);
  }

  if (req.grain && (req.grain.amount ?? 0) > 0) {
    buf = applyGrain(buf, width, height, req.grain);
  }

  if (req.vignette && (req.vignette.amount ?? 0) > 0) {
    buf = applyVignette(buf, width, height, req.vignette);
  }

  if (req.overlay && req.overlay.opacity > 0) {
    buf = applyColorOverlay(buf, req.overlay, req.overlay.opacity);
  }

  return buf;
}

/** Convenience: only color. */
export function colorOnly(pixels: Uint8ClampedArray, params: Partial<ColorParams>): Uint8ClampedArray {
  return applyColorEngine(pixels, params);
}

/** Convenience: only filter. */
export function filterOnly(
  pixels: Uint8ClampedArray,
  id: string,
  strength: number
): Uint8ClampedArray {
  return applyFilter(pixels, id, strength);
}

/** List of all filter ids (stable order). */
export function allFilterIds(): readonly string[] {
  return FILTER_CATALOG.map((f) => f.id);
}

/** Validate and clamp a full request. */
export function clampImageEditRequest(req: ImageEditRequest): ImageEditRequest {
  const out: ImageEditRequest = {};
  if (req.color) out.color = clampColorParams(req.color);
  // Unknown filter ids are dropped (identity), matching applyFilter — never
  // silently replaced by another look.
  if (req.filter && isKnownFilterId(req.filter.id)) {
    out.filter = {
      id: req.filter.id,
      strength: Math.max(0, Math.min(100, req.filter.strength ?? 0)),
    };
  }
  if (req.vignette) {
    out.vignette = {
      amount: Math.max(0, Math.min(100, req.vignette.amount ?? 0)),
      size: Math.max(0, Math.min(100, req.vignette.size ?? 50)),
      softness: Math.max(0, Math.min(100, req.vignette.softness ?? 40)),
    };
  }
  if (req.grain) {
    out.grain = {
      amount: Math.max(0, Math.min(100, req.grain.amount ?? 0)),
      size: Math.max(0, Math.min(100, req.grain.size ?? 30)),
    };
  }
  if (req.sharpen) {
    out.sharpen = { amount: Math.max(0, Math.min(100, req.sharpen.amount ?? 0)) };
  }
  if (req.blur) {
    out.blur = { radius: Math.max(0, Math.min(12, Math.round(req.blur.radius ?? 0))) };
  }
  if (req.clarity) {
    out.clarity = { amount: Math.max(-100, Math.min(100, req.clarity.amount ?? 0)) };
  }
  if (req.overlay) {
    out.overlay = {
      r: Math.max(0, Math.min(255, req.overlay.r ?? 0)),
      g: Math.max(0, Math.min(255, req.overlay.g ?? 0)),
      b: Math.max(0, Math.min(255, req.overlay.b ?? 0)),
      opacity: Math.max(0, Math.min(100, req.overlay.opacity ?? 0)),
    };
  }
  return out;
}
