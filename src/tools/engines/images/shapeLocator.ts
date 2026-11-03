import { cornerMedianColor, rgbDistance, validatePixelImage, type PixelBox, type PixelImage, type PixelRgb } from './pixelImage';

export type ShapeKind = 'circle' | 'rectangle' | 'blob' | 'example';
export type LocatedShape = Readonly<{ kind: ShapeKind; box: PixelBox; center: { x: number; y: number }; areaPixels: number; fillRatio: number; confidence: number; color: PixelRgb }>;
export type ShapeLocateOptions = Readonly<{ backgroundColor?: PixelRgb; backgroundTolerance?: number; minAreaPixels?: number; maxMatches?: number }>;
export type ShapeLocateResult =
  | { ok: true; matches: LocatedShape[]; background: PixelRgb; examinedPixels: number; warnings: string[] }
  | { ok: false; error: 'invalid-image' | 'image-too-large' | 'invalid-options' | 'invalid-example'; message: string };
export type ExampleRegion = Readonly<{ x: number; y: number; width: number; height: number }>;
export type FindExampleOptions = Readonly<{ colorTolerance?: number; minAreaPixels?: number; maxMatches?: number }>;
export const SHAPE_LOCATOR_LIMITS = Object.freeze({ defaultBackgroundTolerance: 36, defaultColorTolerance: 24, defaultMinAreaPixels: 4, maxMatches: 500 });

type Component = { minX: number; minY: number; maxX: number; maxY: number; pixels: number; red: number; green: number; blue: number };
function components(image: PixelImage, mask: Uint8Array, minArea: number, maxMatches: number): Component[] {
  const queue = new Int32Array(image.width * image.height);
  const found: Component[] = [];
  for (let seed = 0; seed < mask.length; seed += 1) {
    if (mask[seed] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    mask[seed] = 2;
    const firstX = seed % image.width;
    const firstY = Math.floor(seed / image.width);
    const item: Component = { minX: firstX, minY: firstY, maxX: firstX, maxY: firstY, pixels: 0, red: 0, green: 0, blue: 0 };
    while (head < tail) {
      const current = queue[head++]!;
      const x = current % image.width;
      const y = Math.floor(current / image.width);
      const offset = current * 4;
      item.pixels += 1;
      item.red += image.data[offset]!;
      item.green += image.data[offset + 1]!;
      item.blue += image.data[offset + 2]!;
      item.minX = Math.min(item.minX, x);
      item.minY = Math.min(item.minY, y);
      item.maxX = Math.max(item.maxX, x);
      item.maxY = Math.max(item.maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const next = ny * image.width + nx;
          if (mask[next] === 1) { mask[next] = 2; queue[tail++] = next; }
        }
      }
    }
    if (item.pixels >= minArea) found.push(item);
  }
  return found.sort((a, b) => b.pixels - a.pixels || a.minY - b.minY || a.minX - b.minX).slice(0, maxMatches);
}
function shapeFromComponent(item: Component): LocatedShape {
  const width = item.maxX - item.minX + 1;
  const height = item.maxY - item.minY + 1;
  const fillRatio = item.pixels / (width * height);
  const aspect = width / height;
  let kind: ShapeKind = 'blob';
  let confidence = 0.55;
  if (aspect >= 0.72 && aspect <= 1.38 && fillRatio >= 0.58 && fillRatio <= 0.9) {
    kind = 'circle';
    confidence = Math.max(0.5, 1 - Math.abs(fillRatio - Math.PI / 4) / 0.5 - Math.abs(aspect - 1) / 2);
  } else if (fillRatio >= 0.88) {
    kind = 'rectangle';
    confidence = Math.min(1, 0.75 + (fillRatio - 0.88) * 2);
  }
  return {
    kind,
    box: { x: item.minX, y: item.minY, width, height },
    center: { x: (item.minX + item.maxX) / 2, y: (item.minY + item.maxY) / 2 },
    areaPixels: item.pixels,
    fillRatio,
    confidence: Math.max(0, Math.min(1, confidence)),
    color: { r: Math.round(item.red / item.pixels), g: Math.round(item.green / item.pixels), b: Math.round(item.blue / item.pixels) },
  };
}
function validColor(value: unknown): value is PixelRgb {
  if (value === null || typeof value !== 'object') return false;
  const color = value as PixelRgb;
  return [color.r, color.g, color.b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
}
function validateLocateOptions(options: ShapeLocateOptions): { ok: true; background: PixelRgb; tolerance: number; minArea: number; maxMatches: number } | { ok: false; message: string } {
  const background = options.backgroundColor;
  const tolerance = options.backgroundTolerance ?? SHAPE_LOCATOR_LIMITS.defaultBackgroundTolerance;
  const minArea = options.minAreaPixels ?? SHAPE_LOCATOR_LIMITS.defaultMinAreaPixels;
  const maxMatches = options.maxMatches ?? SHAPE_LOCATOR_LIMITS.maxMatches;
  if ((background !== undefined && !validColor(background)) || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 441
      || !Number.isInteger(minArea) || minArea < 1 || !Number.isInteger(maxMatches) || maxMatches < 1 || maxMatches > SHAPE_LOCATOR_LIMITS.maxMatches) {
    return { ok: false, message: 'Background colour, tolerance, minimum area or match limit is invalid.' };
  }
  return { ok: true, background: background ?? { r: 0, g: 0, b: 0 }, tolerance, minArea, maxMatches };
}

/** Find connected foreground components against an explicit or corner-sampled background. */
export function locateShapes(value: unknown, options: ShapeLocateOptions = {}): ShapeLocateResult {
  const checked = validatePixelImage(value);
  if (!checked.ok) return { ok: false, error: checked.error, message: checked.message };
  if (options === null || typeof options !== 'object') return { ok: false, error: 'invalid-options', message: 'Options must be an object.' };
  const parsed = validateLocateOptions(options);
  if (!parsed.ok) return { ok: false, error: 'invalid-options', message: parsed.message };
  const image = checked.image;
  const background = options.backgroundColor ?? cornerMedianColor(image);
  const mask = new Uint8Array(checked.pixelCount);
  for (let i = 0; i < checked.pixelCount; i += 1) {
    const offset = i * 4;
    if (image.data[offset + 3]! > 0 && rgbDistance(image.data, offset, background) > parsed.tolerance) mask[i] = 1;
  }
  const matches = components(image, mask, parsed.minArea, parsed.maxMatches).map(shapeFromComponent);
  return { ok: true, matches, background, examinedPixels: checked.pixelCount, warnings: matches.length === 0 ? ['No foreground shapes matched the chosen background threshold.'] : [] };
}

/** Locate regions whose RGB colour resembles a supplied example patch. This is colour matching, not semantic recognition. */
export function findByExample(value: unknown, example: ExampleRegion, options: FindExampleOptions = {}): ShapeLocateResult {
  const checked = validatePixelImage(value);
  if (!checked.ok) return { ok: false, error: checked.error, message: checked.message };
  if (example === null || typeof example !== 'object' || ![example.x, example.y, example.width, example.height].every(Number.isInteger)
      || example.x < 0 || example.y < 0 || example.width < 1 || example.height < 1
      || example.x + example.width > checked.image.width || example.y + example.height > checked.image.height) {
    return { ok: false, error: 'invalid-example', message: 'Example patch must be a positive rectangle inside the image.' };
  }
  if (options === null || typeof options !== 'object') return { ok: false, error: 'invalid-options', message: 'Options must be an object.' };
  const tolerance = options.colorTolerance ?? SHAPE_LOCATOR_LIMITS.defaultColorTolerance;
  const minArea = options.minAreaPixels ?? SHAPE_LOCATOR_LIMITS.defaultMinAreaPixels;
  const maxMatches = options.maxMatches ?? SHAPE_LOCATOR_LIMITS.maxMatches;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 441 || !Number.isInteger(minArea) || minArea < 1
      || !Number.isInteger(maxMatches) || maxMatches < 1 || maxMatches > SHAPE_LOCATOR_LIMITS.maxMatches) {
    return { ok: false, error: 'invalid-options', message: 'Example colour tolerance, minimum area or match limit is invalid.' };
  }
  const image = checked.image;
  let red = 0; let green = 0; let blue = 0; let samples = 0;
  for (let y = example.y; y < example.y + example.height; y += 1) {
    for (let x = example.x; x < example.x + example.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3]! === 0) continue;
      red += image.data[offset]!; green += image.data[offset + 1]!; blue += image.data[offset + 2]!; samples += 1;
    }
  }
  if (samples === 0) return { ok: false, error: 'invalid-example', message: 'The example patch contains no visible pixels.' };
  const target = { r: red / samples, g: green / samples, b: blue / samples };
  const mask = new Uint8Array(checked.pixelCount);
  for (let i = 0; i < checked.pixelCount; i += 1) {
    const offset = i * 4;
    if (image.data[offset + 3]! > 0 && rgbDistance(image.data, offset, target) <= tolerance) mask[i] = 1;
  }
  const matches = components(image, mask, minArea, maxMatches).map((item) => ({ ...shapeFromComponent(item), kind: 'example' as const }));
  return { ok: true, matches, background: { r: Math.round(target.r), g: Math.round(target.g), b: Math.round(target.b) }, examinedPixels: checked.pixelCount, warnings: matches.length === 0 ? ['No regions matched the example colour and tolerance.'] : ['Find-by-example matches colour similarity, not object identity or meaning.'] };
}
