import { validatePixelImage, type PixelBox } from './pixelImage';

export type FocusCropOptions = Readonly<{ edgeThreshold?: number; marginPixels?: number; minEdgePixels?: number }>;
export type FocusCropResult =
  | { ok: true; box: PixelBox; edgePixels: number; edgeEnergy: number; confidence: number; threshold: number }
  | { ok: false; error: 'invalid-image' | 'image-too-large' | 'invalid-options' | 'no-subject'; message: string };
export const FOCUS_CROP_LIMITS = Object.freeze({ defaultThreshold: 24, minEdgePixels: 5, maxMarginPixels: 1_024 });

function luminance(data: Uint8ClampedArray, pixel: number): number {
  const offset = pixel * 4;
  return 0.2126 * data[offset]! + 0.7152 * data[offset + 1]! + 0.0722 * data[offset + 2]!;
}

/** Locate the strongest connected edge region and return its tight pixel bounds. */
export function focusCrop(value: unknown, options: FocusCropOptions = {}): FocusCropResult {
  const checked = validatePixelImage(value);
  if (!checked.ok) return { ok: false, error: checked.error, message: checked.message };
  if (options === null || typeof options !== 'object') return { ok: false, error: 'invalid-options', message: 'Options must be an object.' };
  const edgeThreshold = options.edgeThreshold ?? FOCUS_CROP_LIMITS.defaultThreshold;
  const marginPixels = options.marginPixels ?? 0;
  const minEdgePixels = options.minEdgePixels ?? FOCUS_CROP_LIMITS.minEdgePixels;
  if (!Number.isFinite(edgeThreshold) || edgeThreshold < 1 || edgeThreshold > 510 || !Number.isInteger(marginPixels)
      || marginPixels < 0 || marginPixels > FOCUS_CROP_LIMITS.maxMarginPixels || !Number.isInteger(minEdgePixels) || minEdgePixels < 1) {
    return { ok: false, error: 'invalid-options', message: 'Edge threshold, margin or minimum edge count is invalid.' };
  }
  const image = checked.image;
  const count = checked.pixelCount;
  const magnitudes = new Uint16Array(count);
  let maximum = 0;
  let totalEnergy = 0;
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const index = y * image.width + x;
      const gx = Math.abs(luminance(image.data, index + 1) - luminance(image.data, index - 1));
      const gy = Math.abs(luminance(image.data, index + image.width) - luminance(image.data, index - image.width));
      const magnitude = Math.min(510, Math.round(gx + gy));
      magnitudes[index] = magnitude;
      if (magnitude > maximum) maximum = magnitude;
      totalEnergy += magnitude;
    }
  }
  const threshold = Math.max(edgeThreshold, maximum * 0.08);
  if (maximum < edgeThreshold) return { ok: false, error: 'no-subject', message: 'No sufficiently strong subject edges were found; no crop was guessed.' };
  // 0 = inactive, 1 = active/unvisited, 2 = visited.
  const active = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) if (magnitudes[i]! >= threshold) active[i] = 1;
  const queue = new Int32Array(count);
  let best: { minX: number; minY: number; maxX: number; maxY: number; pixels: number; energy: number } | null = null;
  for (let seed = 0; seed < count; seed += 1) {
    if (active[seed] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    active[seed] = 2;
    const firstX = seed % image.width;
    const firstY = Math.floor(seed / image.width);
    const component = { minX: firstX, minY: firstY, maxX: firstX, maxY: firstY, pixels: 0, energy: 0 };
    while (head < tail) {
      const current = queue[head++]!;
      const x = current % image.width;
      const y = Math.floor(current / image.width);
      component.pixels += 1;
      component.energy += magnitudes[current]!;
      component.minX = Math.min(component.minX, x);
      component.minY = Math.min(component.minY, y);
      component.maxX = Math.max(component.maxX, x);
      component.maxY = Math.max(component.maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const neighbour = ny * image.width + nx;
          if (active[neighbour] === 1) { active[neighbour] = 2; queue[tail++] = neighbour; }
        }
      }
    }
    if (component.pixels >= minEdgePixels && (best === null || component.energy > best.energy)) best = component;
  }
  if (best === null) return { ok: false, error: 'no-subject', message: 'Edge activity was too small or fragmented to identify a subject confidently.' };
  const x = Math.max(0, best.minX - marginPixels);
  const y = Math.max(0, best.minY - marginPixels);
  const right = Math.min(image.width, best.maxX + 1 + marginPixels);
  const bottom = Math.min(image.height, best.maxY + 1 + marginPixels);
  return {
    ok: true,
    box: { x, y, width: right - x, height: bottom - y },
    edgePixels: best.pixels,
    edgeEnergy: best.energy,
    confidence: totalEnergy > 0 ? Math.min(1, best.energy / totalEnergy) : 0,
    threshold,
  };
}
