/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image drawing pipeline: plain TypeScript, no React.
 * Executes EditOp operations sequentially from an ImageBitmap into HTMLCanvasElement.
 * Phone safety (Rule 8): releases intermediate canvases after each step by setting
 * their width and height to 0.
 */

import type { EditOp } from '../../tools/imageEdit/history';
import { applyAdjust } from '../../tools/imageEdit/adjust';
import { applyFilter, isKnownFilterId } from '../../tools/imageEdit/filters';

/**
 * Starts from the bitmap and, for each op in order, draws into a NEW canvas:
 * rotate (90 degrees either way), flip, crop (copy the rectangle x, y, width, height),
 * resize (draw scaled to width by height, with imageSmoothingQuality = 'high').
 * After each step the previous intermediate canvas is released (width = 0, height = 0).
 */
export function renderOps(
  bitmap: ImageBitmap,
  ops: readonly EditOp[]
): HTMLCanvasElement {
  let curCanvas = document.createElement('canvas');
  curCanvas.width = bitmap.width;
  curCanvas.height = bitmap.height;
  const initCtx = curCanvas.getContext('2d');
  if (initCtx) {
    initCtx.drawImage(bitmap, 0, 0);
  }

  for (const op of ops) {
    const nextCanvas = document.createElement('canvas');

    if (op.type === 'rotate') {
      nextCanvas.width = curCanvas.height;
      nextCanvas.height = curCanvas.width;
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
        ctx.save();
        if (op.quarterTurns === 1) {
          ctx.translate(nextCanvas.width, 0);
          ctx.rotate(Math.PI / 2);
        } else {
          ctx.translate(0, nextCanvas.height);
          ctx.rotate(-Math.PI / 2);
        }
        ctx.drawImage(curCanvas, 0, 0);
        ctx.restore();
      }
    } else if (op.type === 'flip') {
      nextCanvas.width = curCanvas.width;
      nextCanvas.height = curCanvas.height;
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
        ctx.save();
        if (op.axis === 'horizontal') {
          ctx.translate(nextCanvas.width, 0);
          ctx.scale(-1, 1);
        } else {
          ctx.translate(0, nextCanvas.height);
          ctx.scale(1, -1);
        }
        ctx.drawImage(curCanvas, 0, 0);
        ctx.restore();
      }
    } else if (op.type === 'crop') {
      const cw = Math.max(1, Math.round(op.width));
      const ch = Math.max(1, Math.round(op.height));
      nextCanvas.width = cw;
      nextCanvas.height = ch;
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          curCanvas,
          Math.round(op.x),
          Math.round(op.y),
          cw,
          ch,
          0,
          0,
          cw,
          ch
        );
      }
    } else if (op.type === 'adjust' || op.type === 'filter') {
      nextCanvas.width = curCanvas.width;
      nextCanvas.height = curCanvas.height;
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(curCanvas, 0, 0);
        try {
          if (op.type === 'adjust') {
            const data = ctx.getImageData(0, 0, nextCanvas.width, nextCanvas.height);
            data.data.set(applyAdjust(data.data, op));
            ctx.putImageData(data, 0, 0);
          } else if (isKnownFilterId(op.id)) {
            const data = ctx.getImageData(0, 0, nextCanvas.width, nextCanvas.height);
            data.data.set(applyFilter(data.data, op.id, op.strength));
            ctx.putImageData(data, 0, 0);
          }
        } catch {
          // Unreadable canvas: the unmodified drawing is already present.
        }
      }
    } else if (op.type === 'resize') {
      const rw = Math.max(1, Math.round(op.width));
      const rh = Math.max(1, Math.round(op.height));
      nextCanvas.width = rw;
      nextCanvas.height = rh;
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          curCanvas,
          0,
          0,
          curCanvas.width,
          curCanvas.height,
          0,
          0,
          rw,
          rh
        );
      }
    }

    // Release previous intermediate canvas memory
    curCanvas.width = 0;
    curCanvas.height = 0;
    curCanvas = nextCanvas;
  }

  return curCanvas;
}
