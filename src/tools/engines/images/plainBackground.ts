import { validatePixelImage, type PixelImage } from './pixelImage';

export type BackgroundRemovalOptions = Readonly<{ colorTolerance?: number; maxBorderResidual?: number }>;
export type BackgroundRemovalResult =
  | { ok: true; image: PixelImage; removedPixels: number; confidence: number; borderResidual: number; backgroundModel: { red: [number, number, number]; green: [number, number, number]; blue: [number, number, number] }; mode: 'flat' | 'linear-gradient'; warnings: string[] }
  | { ok: false; error: 'invalid-image' | 'image-too-large' | 'invalid-options' | 'cannot'; message: string; borderResidual?: number };
export const PLAIN_BACKGROUND_LIMITS = Object.freeze({ defaultColorTolerance: 26, defaultMaxBorderResidual: 12, maxTolerance: 100, maxBorderSamples: 100_000 });

type Sample = { x: number; y: number; offset: number };
type Plane = [number, number, number];

function solve3(matrix: number[][], rhs: number[]): Plane | null {
  const a = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    if (Math.abs(a[pivot]![col]!) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const divisor = a[col]![col]!;
    for (let j = col; j < 4; j += 1) a[col]![j] = a[col]![j]! / divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = a[row]![col]!;
      for (let j = col; j < 4; j += 1) a[row]![j] = a[row]![j]! - factor * a[col]![j]!;
    }
  }
  return [a[0]![3]!, a[1]![3]!, a[2]![3]!];
}

function predicted(plane: Plane, x: number, y: number, width: number, height: number): number {
  const nx = (x / (width - 1) - 0.5) * 2;
  const ny = (y / (height - 1) - 0.5) * 2;
  return Math.max(0, Math.min(255, plane[0] + plane[1] * nx + plane[2] * ny));
}

function fitBackground(image: PixelImage): { planes: [Plane, Plane, Plane]; residual: number } | null {
  const samples: Sample[] = [];
  const stride = Math.max(1, Math.ceil((2 * (image.width + image.height) - 4) / PLAIN_BACKGROUND_LIMITS.maxBorderSamples));
  // Take evenly spaced points around all four borders, including corners.
  for (let x = 0; x < image.width; x += stride) {
    samples.push({ x, y: 0, offset: x * 4 });
    samples.push({ x, y: image.height - 1, offset: ((image.height - 1) * image.width + x) * 4 });
  }
  for (let y = stride; y < image.height - 1; y += stride) {
    samples.push({ x: 0, y, offset: y * image.width * 4 });
    samples.push({ x: image.width - 1, y, offset: (y * image.width + image.width - 1) * 4 });
  }
  if (samples.length < 6) return null;
  let s1 = samples.length; let sx = 0; let sy = 0; let sxx = 0; let syy = 0; let sxy = 0;
  for (const sample of samples) {
    const nx = (sample.x / (image.width - 1) - 0.5) * 2;
    const ny = (sample.y / (image.height - 1) - 0.5) * 2;
    sx += nx; sy += ny; sxx += nx * nx; syy += ny * ny; sxy += nx * ny;
  }
  const matrix = [[s1, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]];
  const planes: Plane[] = [];
  for (let channel = 0; channel < 3; channel += 1) {
    let sum = 0; let sumX = 0; let sumY = 0;
    for (const sample of samples) {
      const nx = (sample.x / (image.width - 1) - 0.5) * 2;
      const ny = (sample.y / (image.height - 1) - 0.5) * 2;
      const value = image.data[sample.offset + channel]!;
      sum += value; sumX += value * nx; sumY += value * ny;
    }
    const plane = solve3(matrix, [sum, sumX, sumY]);
    if (plane === null) return null;
    planes.push(plane);
  }
  let squared = 0;
  for (const sample of samples) {
    const r = image.data[sample.offset]! - predicted(planes[0]!, sample.x, sample.y, image.width, image.height);
    const g = image.data[sample.offset + 1]! - predicted(planes[1]!, sample.x, sample.y, image.width, image.height);
    const b = image.data[sample.offset + 2]! - predicted(planes[2]!, sample.x, sample.y, image.width, image.height);
    squared += r * r + g * g + b * b;
  }
  const residual = Math.sqrt(squared / samples.length / 3);
  return { planes: planes as [Plane, Plane, Plane], residual };
}

function distanceToModel(image: PixelImage, pixel: number, x: number, y: number, planes: [Plane, Plane, Plane]): number {
  const offset = pixel * 4;
  const r = image.data[offset]! - predicted(planes[0], x, y, image.width, image.height);
  const g = image.data[offset + 1]! - predicted(planes[1], x, y, image.width, image.height);
  const b = image.data[offset + 2]! - predicted(planes[2], x, y, image.width, image.height);
  return Math.sqrt(r * r + g * g + b * b);
}

/** Remove a flat or smooth linear-gradient background connected to the image border. */
export function removePlainBackground(value: unknown, options: BackgroundRemovalOptions = {}): BackgroundRemovalResult {
  const checked = validatePixelImage(value);
  if (!checked.ok) return { ok: false, error: checked.error, message: checked.message };
  if (options === null || typeof options !== 'object') return { ok: false, error: 'invalid-options', message: 'Options must be an object.' };
  const tolerance = options.colorTolerance ?? PLAIN_BACKGROUND_LIMITS.defaultColorTolerance;
  const maxResidual = options.maxBorderResidual ?? PLAIN_BACKGROUND_LIMITS.defaultMaxBorderResidual;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > PLAIN_BACKGROUND_LIMITS.maxTolerance
      || !Number.isFinite(maxResidual) || maxResidual <= 0 || maxResidual > 100) {
    return { ok: false, error: 'invalid-options', message: 'Colour tolerance and maximum border residual must be within their supported ranges.' };
  }
  const image = checked.image;
  const fitted = fitBackground(image);
  if (fitted === null) return { ok: false, error: 'cannot', message: 'The border did not provide enough independent samples to estimate a background.' };
  if (fitted.residual > maxResidual) {
    return { ok: false, error: 'cannot', message: `The border varies too much for a plain or linear-gradient background model (residual ${fitted.residual.toFixed(2)} > ${maxResidual}).`, borderResidual: fitted.residual };
  }
  const count = checked.pixelCount;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number): void => {
    const index = y * image.width + x;
    if (visited[index] !== 0 || image.data[index * 4 + 3]! === 0) return;
    if (distanceToModel(image, index, x, y, fitted.planes) > tolerance) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < image.width; x += 1) { enqueue(x, 0); enqueue(x, image.height - 1); }
  for (let y = 1; y < image.height - 1; y += 1) { enqueue(0, y); enqueue(image.width - 1, y); }
  while (head < tail) {
    const current = queue[head++]!;
    const x = current % image.width;
    const y = Math.floor(current / image.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < image.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < image.height) enqueue(x, y + 1);
  }
  const output = new Uint8ClampedArray(image.data);
  let removedPixels = 0;
  for (let i = 0; i < count; i += 1) {
    if (visited[i] === 1) { output[i * 4 + 3] = 0; removedPixels += 1; }
  }
  if (removedPixels === 0) return { ok: false, error: 'cannot', message: 'No connected background pixels matched the estimated border model.', borderResidual: fitted.residual };
  const gradientMagnitude = Math.hypot(fitted.planes[0][1], fitted.planes[0][2], fitted.planes[1][1], fitted.planes[1][2], fitted.planes[2][1], fitted.planes[2][2]);
  const warnings: string[] = [];
  if (removedPixels === count) warnings.push('Every visible pixel matched the background; inspect the result before keeping it.');
  return {
    ok: true,
    image: { width: image.width, height: image.height, data: output },
    removedPixels,
    confidence: Math.max(0, Math.min(1, 1 - fitted.residual / maxResidual)),
    borderResidual: fitted.residual,
    backgroundModel: { red: fitted.planes[0], green: fitted.planes[1], blue: fitted.planes[2] },
    mode: gradientMagnitude < 1 ? 'flat' : 'linear-gradient',
    warnings,
  };
}

