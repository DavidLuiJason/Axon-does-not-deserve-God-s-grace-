/**
 * AXON pure color engine — advanced adjustments for the Image family.
 * Deterministic, no DOM, no React, no network. Operates on RGBA Uint8ClampedArray.
 * Phone safety: callers must already respect PIXEL_IMAGE_LIMITS / MAX_SIDE.
 *
 * Order of application (when using applyColorEngine):
 *   exposure → brightness → contrast → highlights/shadows → blacks/whites
 *   → warmth → tint → saturation → vibrance → fade
 * (Local-contrast "clarity" needs neighbouring pixels, so it lives in effects.ts.)
 *
 * All parameters are in the conventional -100 … +100 range unless noted.
 * Strength 0 leaves the image unchanged.
 */

export interface ColorParams {
  /** Linear exposure stop approximation. */
  exposure: number;
  brightness: number;
  contrast: number;
  /** Positive brightens the highlights, negative pulls them down (recovery). */
  highlights: number;
  /** Positive lifts the shadows, negative deepens them. */
  shadows: number;
  blacks: number;
  whites: number;
  /** Warmth (positive = warmer). */
  warmth: number;
  /** Tint (positive = green, negative = magenta). */
  tint: number;
  saturation: number;
  /** Vibrance protects already-saturated colors more than saturation does. */
  vibrance: number;
  /** Fade lifts blacks and softens overall. */
  fade: number;
}

export const NEUTRAL_COLOR: Readonly<ColorParams> = Object.freeze({
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  blacks: 0,
  whites: 0,
  warmth: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  fade: 0,
});

const clampParam = (n: number | undefined): number =>
  Number.isFinite(n) ? Math.max(-100, Math.min(100, n as number)) : 0;

export function clampColorParams(p: Partial<ColorParams>): ColorParams {
  return {
    exposure: clampParam(p.exposure),
    brightness: clampParam(p.brightness),
    contrast: clampParam(p.contrast),
    highlights: clampParam(p.highlights),
    shadows: clampParam(p.shadows),
    blacks: clampParam(p.blacks),
    whites: clampParam(p.whites),
    warmth: clampParam(p.warmth),
    tint: clampParam(p.tint),
    saturation: clampParam(p.saturation),
    vibrance: clampParam(p.vibrance),
    fade: clampParam(p.fade),
  };
}

export function isNeutralColor(p: ColorParams): boolean {
  return (
    p.exposure === 0 &&
    p.brightness === 0 &&
    p.contrast === 0 &&
    p.highlights === 0 &&
    p.shadows === 0 &&
    p.blacks === 0 &&
    p.whites === 0 &&
    p.warmth === 0 &&
    p.tint === 0 &&
    p.saturation === 0 &&
    p.vibrance === 0 &&
    p.fade === 0
  );
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Apply the full color engine. Returns a new Uint8ClampedArray.
 * Alpha is copied unchanged.
 */
export function applyColorEngine(
  pixels: Uint8ClampedArray,
  raw: Partial<ColorParams>
): Uint8ClampedArray {
  const p = clampColorParams(raw);
  const out = new Uint8ClampedArray(pixels);
  if (isNeutralColor(p)) return out;

  // Pre-compute coefficients
  const exp = Math.pow(2, p.exposure / 50); // mild exposure curve
  const bri = p.brightness * 1.275;
  const con = (100 + p.contrast) / 100;
  const warm = p.warmth * 0.35;
  const tintG = p.tint * 0.25;
  const sat = (100 + p.saturation) / 100;
  const vib = p.vibrance / 100;
  const fadeAmt = p.fade / 100;
  const hi = p.highlights / 100;
  const sh = p.shadows / 100;
  const blk = p.blacks / 100;
  const whi = p.whites / 100;

  for (let i = 0; i < out.length; i += 4) {
    let r = pixels[i]!;
    let g = pixels[i + 1]!;
    let b = pixels[i + 2]!;

    // Exposure
    r *= exp;
    g *= exp;
    b *= exp;

    // Brightness
    r += bri;
    g += bri;
    b += bri;

    // Contrast around mid-grey
    r = 128 + (r - 128) * con;
    g = 128 + (g - 128) * con;
    b = 128 + (b - 128) * con;

    // Highlights / shadows: additive, weighted by how deep in that tonal range
    // the pixel is. Positive = brighter for both (Lightroom convention).
    const L = luma(r, g, b);
    if (L > 128) {
      const d = hi * 60 * ((L - 128) / 127);
      r += d;
      g += d;
      b += d;
    } else {
      const d = sh * 60 * ((128 - L) / 128);
      r += d;
      g += d;
      b += d;
    }

    // Blacks / whites (crush or lift extremes)
    if (L < 64) {
      const t = (64 - L) / 64;
      r += blk * 40 * t;
      g += blk * 40 * t;
      b += blk * 40 * t;
    }
    if (L > 192) {
      const t = (L - 192) / 63;
      r += whi * 40 * t;
      g += whi * 40 * t;
      b += whi * 40 * t;
    }

    // Warmth & tint
    r += warm;
    b -= warm;
    g += tintG;

    // Saturation
    const l1 = luma(r, g, b);
    r = l1 + (r - l1) * sat;
    g = l1 + (g - l1) * sat;
    b = l1 + (b - l1) * sat;

    // Vibrance (protects already saturated pixels)
    if (vib !== 0) {
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const satNow = maxc === 0 ? 0 : (maxc - minc) / maxc;
      const protect = 1 - satNow;
      const amount = 1 + vib * protect;
      const l2 = luma(r, g, b);
      r = l2 + (r - l2) * amount;
      g = l2 + (g - l2) * amount;
      b = l2 + (b - l2) * amount;
    }

    // Fade (lift blacks + slight desat)
    if (fadeAmt !== 0) {
      r = r * (1 - fadeAmt * 0.35) + 255 * fadeAmt * 0.25;
      g = g * (1 - fadeAmt * 0.35) + 255 * fadeAmt * 0.25;
      b = b * (1 - fadeAmt * 0.35) + 255 * fadeAmt * 0.25;
    }

    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    // alpha already copied by constructor
  }

  return out;
}
