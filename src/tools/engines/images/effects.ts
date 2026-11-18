/**
 * AXON pure image effects — vignette, grain, sharpen, blur, clarity, soft-light overlay.
 * Deterministic, no DOM required for the pixel math (callers supply width/height).
 * Phone safety: blur radius is hard-capped; large images should be downscaled first.
 */

export interface VignetteParams {
  /** 0–100, strength of darkening at edges. */
  amount: number;
  /** 0–100, size of the dark zone (higher = darkening reaches further in). */
  size: number;
  /** 0–100, softness of the edge. */
  softness: number;
}

export interface GrainParams {
  /** 0–100. */
  amount: number;
  /** 0–100, size of grain clumps (approximation). */
  size: number;
}

export interface SharpenParams {
  /** 0–100. */
  amount: number;
}

export interface ClarityParams {
  /** -100…+100. Positive adds local (mid-frequency) contrast, negative softens. */
  amount: number;
}

export interface BlurParams {
  /** Radius in pixels, clamped 0–12 for phone safety. */
  radius: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Deterministic pseudo-random from coordinates (no Math.random). */
function hashNoise(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n & 0xffff) / 0xffff; // 0..1
}

/**
 * Radial vignette. Center is the image centre.
 */
export function applyVignette(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<VignetteParams>
): Uint8ClampedArray {
  const amount = clamp01((params.amount ?? 0) / 100);
  const size = clamp01((params.size ?? 50) / 100);
  const softness = clamp01((params.softness ?? 40) / 100);
  const out = new Uint8ClampedArray(pixels);
  if (amount === 0) return out;

  const cx = width / 2;
  const cy = height / 2;
  // Higher size = darkening starts closer to the centre = larger dark zone.
  const maxDist = Math.sqrt(cx * cx + cy * cy) * (1.4 - size * 0.8);
  const inner = maxDist * (1 - softness * 0.7);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let factor = 1;
      if (dist > inner) {
        const t = clamp01((dist - inner) / (maxDist - inner + 1e-6));
        factor = 1 - t * amount;
      }
      const i = (y * width + x) * 4;
      out[i] = pixels[i]! * factor;
      out[i + 1] = pixels[i + 1]! * factor;
      out[i + 2] = pixels[i + 2]! * factor;
    }
  }
  return out;
}

/**
 * Film-style grain. Deterministic so the same image + params always look the same.
 */
export function applyGrain(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<GrainParams>
): Uint8ClampedArray {
  const amount = clamp01((params.amount ?? 0) / 100) * 40; // max ±40
  const size = Math.max(1, Math.round(((params.size ?? 30) / 100) * 3));
  const out = new Uint8ClampedArray(pixels);
  if (amount === 0) return out;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = Math.floor(x / size);
      const ny = Math.floor(y / size);
      const noise = (hashNoise(nx, ny, 42) - 0.5) * 2 * amount;
      const i = (y * width + x) * 4;
      out[i] = pixels[i]! + noise;
      out[i + 1] = pixels[i + 1]! + noise;
      out[i + 2] = pixels[i + 2]! + noise;
    }
  }
  return out;
}

/**
 * Simple unsharp-mask style sharpen (3×3 kernel approximation).
 */
export function applySharpen(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<SharpenParams>
): Uint8ClampedArray {
  const amount = clamp01((params.amount ?? 0) / 100) * 1.2;
  const out = new Uint8ClampedArray(pixels);
  if (amount === 0) return out;

  // Kernel: centre 5, neighbours -1 (approx)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * width + x) * 4 + c;
        const centre = pixels[i]!;
        const sum =
          -pixels[((y - 1) * width + (x - 1)) * 4 + c]! -
          pixels[((y - 1) * width + x) * 4 + c]! -
          pixels[((y - 1) * width + (x + 1)) * 4 + c]! -
          pixels[(y * width + (x - 1)) * 4 + c]! +
          5 * centre -
          pixels[(y * width + (x + 1)) * 4 + c]! -
          pixels[((y + 1) * width + (x - 1)) * 4 + c]! -
          pixels[((y + 1) * width + x) * 4 + c]! -
          pixels[((y + 1) * width + (x + 1)) * 4 + c]!;
        out[i] = centre + (sum - centre) * amount;
      }
    }
  }
  return out;
}

/**
 * Separable box blur, O(1) per pixel via running sums, alpha-aware
 * (colour is averaged premultiplied, so transparent edges do not darken).
 * Radius is clamped to 0–12. Edges clamp to the border pixel.
 */
export function applyBlur(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<BlurParams>
): Uint8ClampedArray {
  const radius = Math.max(0, Math.min(12, Math.round(params.radius ?? 0)));
  if (radius === 0 || width <= 0 || height <= 0) return new Uint8ClampedArray(pixels);

  const n = width * height;
  // Premultiplied channels: r*a, g*a, b*a (0..255 scale) and a.
  const src = new Float32Array(n * 4);
  for (let p = 0; p < n; p++) {
    const a = pixels[p * 4 + 3]! / 255;
    src[p * 4] = pixels[p * 4]! * a;
    src[p * 4 + 1] = pixels[p * 4 + 1]! * a;
    src[p * 4 + 2] = pixels[p * 4 + 2]! * a;
    src[p * 4 + 3] = pixels[p * 4 + 3]!;
  }
  const tmp = new Float32Array(n * 4);
  const inv = 1 / (radius * 2 + 1);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (let k = -radius; k <= radius; k++) {
      const i = (row + Math.min(width - 1, Math.max(0, k))) * 4;
      s0 += src[i]!; s1 += src[i + 1]!; s2 += src[i + 2]!; s3 += src[i + 3]!;
    }
    for (let x = 0; x < width; x++) {
      const o = (row + x) * 4;
      tmp[o] = s0 * inv; tmp[o + 1] = s1 * inv; tmp[o + 2] = s2 * inv; tmp[o + 3] = s3 * inv;
      const add = (row + Math.min(width - 1, x + radius + 1)) * 4;
      const rem = (row + Math.max(0, x - radius)) * 4;
      s0 += src[add]! - src[rem]!;
      s1 += src[add + 1]! - src[rem + 1]!;
      s2 += src[add + 2]! - src[rem + 2]!;
      s3 += src[add + 3]! - src[rem + 3]!;
    }
  }

  // Vertical pass + un-premultiply
  const out = new Uint8ClampedArray(pixels.length);
  for (let x = 0; x < width; x++) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (let k = -radius; k <= radius; k++) {
      const i = (Math.min(height - 1, Math.max(0, k)) * width + x) * 4;
      s0 += tmp[i]!; s1 += tmp[i + 1]!; s2 += tmp[i + 2]!; s3 += tmp[i + 3]!;
    }
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      const a = s3 * inv;
      if (a > 0.0001) {
        const k = 255 / a;
        out[o] = s0 * inv * k;
        out[o + 1] = s1 * inv * k;
        out[o + 2] = s2 * inv * k;
      }
      out[o + 3] = a;
      const add = (Math.min(height - 1, y + radius + 1) * width + x) * 4;
      const rem = (Math.max(0, y - radius) * width + x) * 4;
      s0 += tmp[add]! - tmp[rem]!;
      s1 += tmp[add + 1]! - tmp[rem + 1]!;
      s2 += tmp[add + 2]! - tmp[rem + 2]!;
      s3 += tmp[add + 3]! - tmp[rem + 3]!;
    }
  }
  return out;
}

/**
 * Local-contrast "clarity": unsharp mask on luma using a wide blur (radius 8),
 * so mid-frequency structure is boosted while fine noise and flat areas are not.
 * Positive amount = clearer, negative = softer. Alpha untouched.
 */
export function applyClarity(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<ClarityParams>
): Uint8ClampedArray {
  const raw = Number.isFinite(params.amount) ? (params.amount as number) : 0;
  const k = (Math.max(-100, Math.min(100, raw)) / 100) * 0.8;
  const out = new Uint8ClampedArray(pixels);
  if (k === 0 || width <= 0 || height <= 0) return out;

  const blurred = applyBlur(pixels, width, height, { radius: 8 });
  for (let i = 0; i < pixels.length; i += 4) {
    const l = 0.2126 * pixels[i]! + 0.7152 * pixels[i + 1]! + 0.0722 * pixels[i + 2]!;
    const lb = 0.2126 * blurred[i]! + 0.7152 * blurred[i + 1]! + 0.0722 * blurred[i + 2]!;
    // Weight toward midtones so blacks/whites are not clipped by the boost.
    const mid = 1 - Math.abs(l - 128) / 128;
    const d = (l - lb) * k * (0.4 + 0.6 * mid);
    out[i] = pixels[i]! + d;
    out[i + 1] = pixels[i + 1]! + d;
    out[i + 2] = pixels[i + 2]! + d;
  }
  return out;
}

/**
 * True soft-light blend (W3C compositing formula) of a solid colour, then mixed
 * with the original by opacity (0–100). A mid-grey colour is a no-op; black
 * stays black under a bright colour. Alpha untouched.
 */
export function applyColorOverlay(
  pixels: Uint8ClampedArray,
  color: { r: number; g: number; b: number },
  opacity: number
): Uint8ClampedArray {
  const t = clamp01((Number.isFinite(opacity) ? opacity : 0) / 100);
  const out = new Uint8ClampedArray(pixels);
  if (t === 0) return out;
  const cs = [color.r, color.g, color.b].map((v) => clamp01((Number.isFinite(v) ? v : 0) / 255));
  for (let i = 0; i < pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const cb = pixels[i + c]! / 255;
      const s = cs[c]!;
      let blended: number;
      if (s <= 0.5) {
        blended = cb - (1 - 2 * s) * cb * (1 - cb);
      } else {
        const d = cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb);
        blended = cb + (2 * s - 1) * (d - cb);
      }
      out[i + c] = (cb + (blended - cb) * t) * 255;
    }
  }
  return out;
}
