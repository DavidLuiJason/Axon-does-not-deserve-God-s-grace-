/**
 * Pure RGBA adjustments, applied in this order, rounding/clamping only on output:
 * warmth: R += warmth/100*30, B -= warmth/100*30.
 * brightness: each RGB channel += brightness/100*255*0.5.
 * contrast: each RGB channel = 128 + (channel-128)*(100+contrast)/100
 *   for both positive and negative contrast.
 * saturation: each channel = luma + (channel-luma)*(100+saturation)/100,
 *   where luma = .2126*R + .7152*G + .0722*B.
 * Alpha is copied unchanged. Uint8ClampedArray performs integer rounding.
 */
export interface AdjustParams { brightness: number; contrast: number; saturation: number; warmth: number }
export const NEUTRAL_ADJUST: AdjustParams = Object.freeze({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 });
const clamp = (n: number | undefined): number => Number.isNaN(n) || n === undefined ? 0 : Math.max(-100, Math.min(100, n));
export function clampAdjust(p: Partial<AdjustParams>): AdjustParams {
  return { brightness: clamp(p.brightness), contrast: clamp(p.contrast), saturation: clamp(p.saturation), warmth: clamp(p.warmth) };
}
export function isNeutralAdjust(p: AdjustParams): boolean {
  return p.brightness === 0 && p.contrast === 0 && p.saturation === 0 && p.warmth === 0;
}
export function applyAdjust(pixels: Uint8ClampedArray, p: Partial<AdjustParams>): Uint8ClampedArray {
  const a = clampAdjust(p);
  const out = new Uint8ClampedArray(pixels);
  if (isNeutralAdjust(a)) return out;
  const w = a.warmth * 0.3, b = a.brightness * 1.275, c = (100 + a.contrast) / 100, s = (100 + a.saturation) / 100;
  for (let i = 0; i < out.length; i += 4) {
    const r = 128 + (pixels[i] + w + b - 128) * c;
    const g = 128 + (pixels[i + 1] + b - 128) * c;
    const blue = 128 + (pixels[i + 2] - w + b - 128) * c;
    const l = .2126 * r + .7152 * g + .0722 * blue;
    out[i] = l + (r - l) * s;
    out[i + 1] = l + (g - l) * s;
    out[i + 2] = l + (blue - l) * s;
  }
  return out;
}
