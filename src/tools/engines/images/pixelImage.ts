/** Shared pixel contract for the Batch 1 pure image engines. Pixels are RGBA, row-major. */
export type PixelImage = Readonly<{
  width: number;
  height: number;
  data: Uint8ClampedArray;
}>;
export type PixelBox = Readonly<{ x: number; y: number; width: number; height: number }>;
export type PixelRgb = Readonly<{ r: number; g: number; b: number }>;
export type PixelImageError = 'invalid-image' | 'image-too-large';
export type PixelImageValidation =
  | { ok: true; image: PixelImage; pixelCount: number }
  | { ok: false; error: PixelImageError; message: string };

/** Kept below the general 24 MP file-conversion ceiling because these analysis
 * engines allocate masks/queues in addition to the input image on a phone. */
export const PIXEL_IMAGE_LIMITS = Object.freeze({ maxSide: 8_192, maxPixels: 4_000_000 });

export function validatePixelImage(value: unknown): PixelImageValidation {
  if (value === null || typeof value !== 'object') {
    return { ok: false, error: 'invalid-image', message: 'An image object is required.' };
  }
  const image = value as PixelImage;
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 2 || image.height < 2
      || image.width > PIXEL_IMAGE_LIMITS.maxSide || image.height > PIXEL_IMAGE_LIMITS.maxSide
      || !(image.data instanceof Uint8ClampedArray)) {
    return { ok: false, error: 'invalid-image', message: 'Image dimensions must be integers of at least 2, with Uint8ClampedArray RGBA pixels.' };
  }
  const pixelCount = image.width * image.height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > PIXEL_IMAGE_LIMITS.maxPixels) {
    return { ok: false, error: 'image-too-large', message: `Image analysis is limited to ${PIXEL_IMAGE_LIMITS.maxPixels.toLocaleString('en-US')} pixels to bound memory use.` };
  }
  if (image.data.length !== pixelCount * 4) {
    return { ok: false, error: 'invalid-image', message: 'RGBA data length must equal width × height × 4.' };
  }
  return { ok: true, image, pixelCount };
}

export function pixelOffset(image: PixelImage, x: number, y: number): number {
  return (y * image.width + x) * 4;
}

export function rgbDistance(data: Uint8ClampedArray, offset: number, color: PixelRgb): number {
  const dr = data[offset]! - color.r;
  const dg = data[offset + 1]! - color.g;
  const db = data[offset + 2]! - color.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Median of the four corner RGB values; callers use it only when the corners are expected background. */
export function cornerMedianColor(image: PixelImage): PixelRgb {
  const points = [
    pixelOffset(image, 0, 0),
    pixelOffset(image, image.width - 1, 0),
    pixelOffset(image, 0, image.height - 1),
    pixelOffset(image, image.width - 1, image.height - 1),
  ];
  const channel = (index: number): number => {
    const values = points.map((offset) => image.data[offset + index]!).sort((a, b) => a - b);
    return Math.round((values[1]! + values[2]!) / 2);
  };
  return { r: channel(0), g: channel(1), b: channel(2) };
}
