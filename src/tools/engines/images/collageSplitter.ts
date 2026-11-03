import { cornerMedianColor, rgbDistance, validatePixelImage, type PixelBox, type PixelImage, type PixelRgb } from './pixelImage';

export type CollageSplitOptions = Readonly<{
  backgroundTolerance?: number;
  lineCoverage?: number;
  minGutterSize?: number;
  minPanelPixels?: number;
  maxPanels?: number;
}>;
export type CollageSplitResult =
  | { ok: true; panels: PixelBox[]; rows: number; columns: number; background: PixelRgb; horizontalGutters: PixelBox[]; verticalGutters: PixelBox[]; confidence: number; warnings: string[] }
  | { ok: false; error: 'invalid-image' | 'image-too-large' | 'invalid-options' | 'no-panels' | 'too-many-panels'; message: string };

export const COLLAGE_SPLITTER_LIMITS = Object.freeze({ defaultTolerance: 18, minLineCoverage: 0.8, maxLineCoverage: 1, maxPanels: 100 });

type Run = { start: number; end: number };
function runs(flags: Uint8Array, minimum: number): Run[] {
  const found: Run[] = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i += 1) {
    const active = i < flags.length && flags[i] === 1;
    if (active && start < 0) start = i;
    if (!active && start >= 0) {
      if (i - start >= minimum) found.push({ start, end: i });
      start = -1;
    }
  }
  return found;
}
function segments(length: number, gaps: Run[]): Run[] {
  if (gaps.length === 0) return [{ start: 0, end: length }];
  const output: Run[] = [];
  let cursor = 0;
  for (const gap of gaps) {
    if (gap.start > cursor) output.push({ start: cursor, end: gap.start });
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < length) output.push({ start: cursor, end: length });
  return output.filter((segment) => segment.end > segment.start);
}

export function splitCollage(value: unknown, options: CollageSplitOptions = {}): CollageSplitResult {
  const checked = validatePixelImage(value);
  if (!checked.ok) return { ok: false, error: checked.error, message: checked.message };
  if (options === null || typeof options !== 'object') return { ok: false, error: 'invalid-options', message: 'Options must be an object.' };
  const tolerance = options.backgroundTolerance ?? COLLAGE_SPLITTER_LIMITS.defaultTolerance;
  const coverage = options.lineCoverage ?? 0.94;
  const minGutter = options.minGutterSize ?? 1;
  const minPanelPixels = options.minPanelPixels ?? 4;
  const maxPanels = options.maxPanels ?? COLLAGE_SPLITTER_LIMITS.maxPanels;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 441 || !Number.isFinite(coverage)
      || coverage < COLLAGE_SPLITTER_LIMITS.minLineCoverage || coverage > COLLAGE_SPLITTER_LIMITS.maxLineCoverage
      || !Number.isInteger(minGutter) || minGutter < 1 || !Number.isInteger(minPanelPixels) || minPanelPixels < 1
      || !Number.isInteger(maxPanels) || maxPanels < 1 || maxPanels > COLLAGE_SPLITTER_LIMITS.maxPanels) {
    return { ok: false, error: 'invalid-options', message: 'Tolerance, line coverage, gutter size, panel size or panel limit is invalid.' };
  }
  const image = checked.image;
  const background = cornerMedianColor(image);
  const horizontal = new Uint8Array(image.height);
  const vertical = new Uint8Array(image.width);
  const detectedCoverage: number[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let matches = 0;
    for (let x = 0; x < image.width; x += 1) {
      if (rgbDistance(image.data, (y * image.width + x) * 4, background) <= tolerance) matches += 1;
    }
    const lineCoverage = matches / image.width;
    if (lineCoverage >= coverage) { horizontal[y] = 1; detectedCoverage.push(lineCoverage); }
  }
  for (let x = 0; x < image.width; x += 1) {
    let matches = 0;
    for (let y = 0; y < image.height; y += 1) {
      if (rgbDistance(image.data, (y * image.width + x) * 4, background) <= tolerance) matches += 1;
    }
    const lineCoverage = matches / image.height;
    if (lineCoverage >= coverage) { vertical[x] = 1; detectedCoverage.push(lineCoverage); }
  }
  const horizontalRuns = runs(horizontal, minGutter);
  const verticalRuns = runs(vertical, minGutter);
  const rowSegments = segments(image.height, horizontalRuns);
  const columnSegments = segments(image.width, verticalRuns);
  const panels: PixelBox[] = [];
  for (const row of rowSegments) {
    for (const column of columnSegments) {
      let nonBackground = 0;
      for (let y = row.start; y < row.end && nonBackground < minPanelPixels; y += 1) {
        for (let x = column.start; x < column.end && nonBackground < minPanelPixels; x += 1) {
          if (rgbDistance(image.data, (y * image.width + x) * 4, background) > tolerance) nonBackground += 1;
        }
      }
      if (nonBackground >= minPanelPixels) panels.push({ x: column.start, y: row.start, width: column.end - column.start, height: row.end - row.start });
    }
  }
  if (panels.length === 0) return { ok: false, error: 'no-panels', message: 'No non-background panels were found.' };
  if (panels.length > maxPanels) return { ok: false, error: 'too-many-panels', message: `Detected ${panels.length} panels; the limit is ${maxPanels}.` };
  const confidence = detectedCoverage.length === 0 ? 0.5 : detectedCoverage.reduce((sum, value) => sum + value, 0) / detectedCoverage.length;
  const warnings: string[] = [];
  if (horizontalRuns.length === 0 && verticalRuns.length === 0) warnings.push('No full-span gutter was detected; the non-background image is treated as one panel.');
  if (panels.length === 1 && (horizontalRuns.length > 0 || verticalRuns.length > 0)) warnings.push('Only one non-background panel remained after gutter detection; review the source image.');
  return {
    ok: true,
    panels,
    rows: rowSegments.length,
    columns: columnSegments.length,
    background,
    horizontalGutters: horizontalRuns.map((r) => ({ x: 0, y: r.start, width: image.width, height: r.end - r.start })),
    verticalGutters: verticalRuns.map((r) => ({ x: r.start, y: 0, width: r.end - r.start, height: image.height })),
    confidence,
    warnings,
  };
}

/** Crop one detected panel without changing or copying pixel data. */
export function cropPanel(image: PixelImage, box: PixelBox): PixelImage | null {
  if (!validatePixelImage(image).ok) return null;
  if (!Number.isInteger(box.x) || !Number.isInteger(box.y) || !Number.isInteger(box.width) || !Number.isInteger(box.height)
      || box.x < 0 || box.y < 0 || box.width < 1 || box.height < 1 || box.x + box.width > image.width || box.y + box.height > image.height) return null;
  const data = new Uint8ClampedArray(box.width * box.height * 4);
  for (let row = 0; row < box.height; row += 1) {
    const from = ((box.y + row) * image.width + box.x) * 4;
    data.set(image.data.subarray(from, from + box.width * 4), row * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}
