/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * runConversion: Shared conversion runner for data, text, and image conversions.
 * Reuses pure engines (convert, planImageConversion) without re-implementing logic.
 * Manages canvas execution, scaling, quality encoding, and resource cleanup.
 */

import {
  convert,
  type ConvertOutcome,
  type ImageConversionRequest,
} from '../../tools/converter/convert';
import type { BlockOptions } from '../../tools/converter/blocks';
import {
  planImageConversion,
  type ImageConversionPlan,
  type ImageOutputFormat,
} from '../../tools/engines/images/convertPlan';

export interface ImageConversionResultSuccess {
  ok: true;
  outputName: string;
  outputMime: string;
  bytes: Uint8Array;
  blob: Blob;
  width: number;
  height: number;
  warnings: string[];
  sizeBefore: number;
  sizeAfter: number;
}

export interface ImageConversionResultFailure {
  ok: false;
  error: string;
  message: string;
}

export type ImageConversionResult =
  | ImageConversionResultSuccess
  | ImageConversionResultFailure;

/**
 * Formats a byte count in human-readable notation (B, KB, MB).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * Executes a pure unit, base, data, or text conversion through convert().
 */
export function runConversion(request: {
  kind: string;
  from: string;
  to: string;
  input: string;
  options?: BlockOptions;
  imageRequest?: ImageConversionRequest;
}): ConvertOutcome {
  return convert(request);
}

/**
 * Runs a complete browser-side image conversion according to planImageConversion:
 * 1. Loads image to obtain real natural dimensions.
 * 2. Plans conversion (dimensions, background, quality, unique output name).
 * 3. Draws to offscreen canvas with background fill if needed.
 * 4. Encodes to target format (PNG, JPG, WebP) with specified quality.
 * 5. Promptly releases all canvases, Image elements, and object URLs.
 */
export async function runImageConversion(
  file: Blob | File,
  options: {
    name: string;
    toFormat: ImageOutputFormat;
    quality?: number;
    maxSide?: number;
    mime?: string;
  }
): Promise<ImageConversionResult> {
  let objectUrl: string | null = null;
  let img: HTMLImageElement | null = null;
  let canvas: HTMLCanvasElement | null = null;

  try {
    const url = URL.createObjectURL(file);
    objectUrl = url;
    img = new Image();

    const loaded = await new Promise<boolean>((resolve) => {
      if (!img) return resolve(false);
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

    if (!loaded || !img.naturalWidth || !img.naturalHeight) {
      return {
        ok: false,
        error: 'invalid-image',
        message: 'Could not decode image or read dimensions.',
      };
    }

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const detectedMime =
      options.mime ||
      file.type ||
      (options.name.toLowerCase().endsWith('.png')
        ? 'image/png'
        : options.name.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : options.name.toLowerCase().endsWith('.gif')
        ? 'image/gif'
        : options.name.toLowerCase().endsWith('.bmp')
        ? 'image/bmp'
        : 'image/jpeg');

    const plan = planImageConversion({
      name: options.name,
      width,
      height,
      mime: detectedMime,
      toFormat: options.toFormat,
      quality: options.quality,
      maxSide: options.maxSide,
    });

    if (!plan.ok) {
      return {
        ok: false,
        error: plan.error,
        message: plan.message,
      };
    }

    // Canvas drawing steps
    canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return {
        ok: false,
        error: 'canvas-error',
        message: 'Could not obtain 2D rendering context.',
      };
    }

    if (plan.background === 'white') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, plan.width, plan.height);
    }

    ctx.drawImage(img, 0, 0, plan.width, plan.height);

    const targetMime = plan.outputMime;
    const qualityParam =
      plan.quality !== null && Number.isFinite(plan.quality)
        ? plan.quality
        : undefined;

    const outBlob = await new Promise<Blob | null>((resolve) => {
      if (!canvas) return resolve(null);
      canvas.toBlob((b) => resolve(b), targetMime, qualityParam);
    });

    if (!outBlob) {
      return {
        ok: false,
        error: 'encoding-failed',
        message: 'Canvas failed to encode image blob.',
      };
    }

    const arrayBuffer = await outBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    return {
      ok: true,
      outputName: plan.outputName,
      outputMime: plan.outputMime,
      bytes,
      blob: outBlob,
      width: plan.width,
      height: plan.height,
      warnings: plan.warnings,
      sizeBefore: file.size,
      sizeAfter: bytes.byteLength,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: 'conversion-failed',
      message: err?.message || 'An unexpected error occurred during image conversion.',
    };
  } finally {
    // Release resources promptly
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
      objectUrl = null;
    }
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img = null;
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
    }
  }
}
