/** DOWNSCALE: shrinks a decoded RGBA image so it fits the shared pixel contract (pixelImage.ts).
 * Phone photos (12 to 50 million pixels) are larger than the analysis engines accept (4,000,000);
 * this is the one door between them. Pure, new file, no screen or brain wiring.
 * Method: area averaging (every output pixel is the exact weighted mean of the source area it covers,
 * fractional edges included) on alpha-premultiplied colour, so hidden colour under transparent pixels never bleeds.
 * The input is never changed. An image that already fits is returned as the SAME object, unchanged. */
import { IMAGE_CONVERT_LIMITS } from './convertPlan';
import { PIXEL_IMAGE_LIMITS, type PixelBox, type PixelImage } from './pixelImage';

/** Largest image this engine will read: the same ceiling as file conversion (one number, FL14). */
export const DOWNSCALE_INPUT_LIMITS = Object.freeze({
  maxPixels: IMAGE_CONVERT_LIMITS.maxPixels,
  maxSide: IMAGE_CONVERT_LIMITS.maxSide,
});

export type DownscaleOptions = Readonly<{
  /** Target pixel ceiling, 4 to PIXEL_IMAGE_LIMITS.maxPixels. Default: PIXEL_IMAGE_LIMITS.maxPixels. */
  maxPixels?: number;
  /** Target side ceiling, 2 to PIXEL_IMAGE_LIMITS.maxSide. Default: PIXEL_IMAGE_LIMITS.maxSide. */
  maxSide?: number;
}>;

export type DownscaleError = 'invalid-image' | 'image-too-large' | 'invalid-options';

export type DownscaleResult =
  | Readonly<{
      ok: true;
      image: PixelImage;
      /** false: the image already fitted and `image` is the input object itself. */
      changed: boolean;
      sourceWidth: number;
      sourceHeight: number;
      /** Output size divided by source size, per axis (they differ slightly because sizes are whole numbers). */
      scaleX: number;
      scaleY: number;
    }>
  | Readonly<{ ok: false; error: DownscaleError; message: string }>;

function fail(error: DownscaleError, message: string): DownscaleResult {
  return { ok: false, error, message };
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** True when an image of this declared size is above the pixel contract and needs DOWNSCALE first. */
export function needsDownscale(width: number, height: number, options: DownscaleOptions = {}): boolean {
  const maxPixels = options.maxPixels ?? PIXEL_IMAGE_LIMITS.maxPixels;
  const maxSide = options.maxSide ?? PIXEL_IMAGE_LIMITS.maxSide;
  return width * height > maxPixels || width > maxSide || height > maxSide;
}

export function downscalePixelImage(value: unknown, options: DownscaleOptions = {}): DownscaleResult {
  const maxPixels = options.maxPixels ?? PIXEL_IMAGE_LIMITS.maxPixels;
  const maxSide = options.maxSide ?? PIXEL_IMAGE_LIMITS.maxSide;
  if (!isWholeNumber(maxPixels) || maxPixels < 4 || maxPixels > PIXEL_IMAGE_LIMITS.maxPixels) {
    return fail('invalid-options', `maxPixels must be a whole number from 4 to ${PIXEL_IMAGE_LIMITS.maxPixels}.`);
  }
  if (!isWholeNumber(maxSide) || maxSide < 2 || maxSide > PIXEL_IMAGE_LIMITS.maxSide) {
    return fail('invalid-options', `maxSide must be a whole number from 2 to ${PIXEL_IMAGE_LIMITS.maxSide}.`);
  }
  if (value === null || typeof value !== 'object') return fail('invalid-image', 'An image object is required.');
  const image = value as PixelImage;
  if (!isWholeNumber(image.width) || !isWholeNumber(image.height) || image.width < 2 || image.height < 2
      || !(image.data instanceof Uint8ClampedArray)) {
    return fail('invalid-image', 'Image dimensions must be whole numbers of at least 2, with Uint8ClampedArray RGBA pixels.');
  }
  const { width, height } = image;
  // Size is judged from the declared dimensions before the buffer length, so an oversized image is refused cheaply.
  if (width > DOWNSCALE_INPUT_LIMITS.maxSide || height > DOWNSCALE_INPUT_LIMITS.maxSide
      || !Number.isSafeInteger(width * height) || width * height > DOWNSCALE_INPUT_LIMITS.maxPixels) {
    return fail('image-too-large', `Images above ${DOWNSCALE_INPUT_LIMITS.maxPixels.toLocaleString('en-US')} pixels or ${DOWNSCALE_INPUT_LIMITS.maxSide.toLocaleString('en-US')} pixels on a side are not shrunk here.`);
  }
  if (image.data.length !== width * height * 4) return fail('invalid-image', 'RGBA data length must equal width × height × 4.');

  if (!needsDownscale(width, height, { maxPixels, maxSide })) {
    return { ok: true, image, changed: false, sourceWidth: width, sourceHeight: height, scaleX: 1, scaleY: 1 };
  }

  // Largest uniform scale that satisfies both ceilings; whole-number sizes are rounded DOWN so the ceilings always hold.
  const scale = Math.min(Math.sqrt(maxPixels / (width * height)), maxSide / Math.max(width, height), 1);
  const outW = Math.max(2, Math.min(maxSide, Math.floor(width * scale + 1e-9)));
  const outH = Math.max(2, Math.min(maxSide, Math.floor(height * scale + 1e-9)));
  const out = new Uint8ClampedArray(outW * outH * 4);
  const src = image.data;
  const stepX = width / outW;
  const stepY = height / outH;
  const area = stepX * stepY;
  // One accumulator row (premultiplied R, G, B and A, weighted by vertical coverage): memory stays one row wide.
  const row = new Float64Array(width * 4);

  for (let oy = 0; oy < outH; oy += 1) {
    const y0 = oy * stepY;
    const y1 = Math.min(height, (oy + 1) * stepY);
    row.fill(0);
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy += 1) {
      const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
      if (wy <= 0) continue;
      let offset = sy * width * 4;
      for (let sx = 0; sx < width; sx += 1, offset += 4) {
        const a = src[offset + 3]! * wy;
        const i = sx * 4;
        row[i] = row[i]! + src[offset]! * a / 255;
        row[i + 1] = row[i + 1]! + src[offset + 1]! * a / 255;
        row[i + 2] = row[i + 2]! + src[offset + 2]! * a / 255;
        row[i + 3] = row[i + 3]! + a;
      }
    }
    for (let ox = 0; ox < outW; ox += 1) {
      const x0 = ox * stepX;
      const x1 = Math.min(width, (ox + 1) * stepX);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx += 1) {
        const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
        if (wx <= 0) continue;
        const i = sx * 4;
        r += row[i]! * wx;
        g += row[i + 1]! * wx;
        b += row[i + 2]! * wx;
        a += row[i + 3]! * wx;
      }
      const o = (oy * outW + ox) * 4;
      if (a > 0) {
        // r, g, b hold colour x (alpha/255); dividing by the alpha share restores the straight colour.
        const share = a / 255;
        out[o] = Math.round(r / share);
        out[o + 1] = Math.round(g / share);
        out[o + 2] = Math.round(b / share);
      }
      out[o + 3] = Math.round(a / area);
    }
  }
  return { ok: true, image: { width: outW, height: outH, data: out }, changed: true, sourceWidth: width, sourceHeight: height, scaleX: outW / width, scaleY: outH / height };
}

/** Maps a box found on the shrunk image back onto the original image. Rounds OUTWARD (never loses an edge pixel)
 * and clamps to the original. Results from the Batch 1 engines (focus crop, shape locator, collage splitter)
 * are in shrunk coordinates until mapped here. */
export function boxToSource(box: PixelBox, result: Extract<DownscaleResult, { ok: true }>): PixelBox {
  const x0 = Math.max(0, Math.floor(box.x / result.scaleX + 1e-9));
  const y0 = Math.max(0, Math.floor(box.y / result.scaleY + 1e-9));
  const x1 = Math.min(result.sourceWidth, Math.ceil((box.x + box.width) / result.scaleX - 1e-9));
  const y1 = Math.min(result.sourceHeight, Math.ceil((box.y + box.height) / result.scaleY - 1e-9));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}
