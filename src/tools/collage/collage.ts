/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure collage geometry: layouts (cells as fractions of the canvas), canvas sizes,
 * integer pixel frames with gaps, and how a picture fits a frame. No DOM, no React.
 */
export interface Cell { x: number; y: number; w: number; h: number }
export interface Frame { x: number; y: number; w: number; h: number }
export interface Layout { id: string; label: string; count: number; cells: readonly Cell[] }
export interface CanvasPreset { id: string; label: string; ratio: number }

const c = (x: number, y: number, w: number, h: number): Cell => ({ x, y, w, h });
const T = 1 / 3, TT = 2 / 3;

export const LAYOUTS: readonly Layout[] = [
  { id: 'two-cols', label: 'Side by side', count: 2, cells: [c(0, 0, .5, 1), c(.5, 0, .5, 1)] },
  { id: 'two-rows', label: 'Stacked', count: 2, cells: [c(0, 0, 1, .5), c(0, .5, 1, .5)] },
  { id: 'two-wide-left', label: 'Wide left', count: 2, cells: [c(0, 0, TT, 1), c(TT, 0, T, 1)] },
  { id: 'three-cols', label: 'Three columns', count: 3, cells: [c(0, 0, T, 1), c(T, 0, T, 1), c(TT, 0, T, 1)] },
  { id: 'three-rows', label: 'Three rows', count: 3, cells: [c(0, 0, 1, T), c(0, T, 1, T), c(0, TT, 1, T)] },
  { id: 'big-left-two-right', label: 'Big left', count: 3, cells: [c(0, 0, .5, 1), c(.5, 0, .5, .5), c(.5, .5, .5, .5)] },
  { id: 'big-top-two-bottom', label: 'Big top', count: 3, cells: [c(0, 0, 1, .5), c(0, .5, .5, .5), c(.5, .5, .5, .5)] },
  { id: 'grid-2x2', label: 'Grid', count: 4, cells: [c(0, 0, .5, .5), c(.5, 0, .5, .5), c(0, .5, .5, .5), c(.5, .5, .5, .5)] },
  { id: 'big-left-three-right', label: 'Big left, three', count: 4, cells: [c(0, 0, .5, 1), c(.5, 0, .5, T), c(.5, T, .5, T), c(.5, TT, .5, T)] },
  { id: 'big-top-three-bottom', label: 'Big top, three', count: 4, cells: [c(0, 0, 1, .5), c(0, .5, T, .5), c(T, .5, T, .5), c(TT, .5, T, .5)] },
  { id: 'two-over-three', label: 'Two over three', count: 5, cells: [c(0, 0, .5, .5), c(.5, 0, .5, .5), c(0, .5, T, .5), c(T, .5, T, .5), c(TT, .5, T, .5)] },
  { id: 'big-left-four-right', label: 'Big left, four', count: 5, cells: [c(0, 0, .5, 1), c(.5, 0, .25, .5), c(.75, 0, .25, .5), c(.5, .5, .25, .5), c(.75, .5, .25, .5)] },
  { id: 'grid-3x2', label: 'Six, wide', count: 6, cells: [c(0, 0, T, .5), c(T, 0, T, .5), c(TT, 0, T, .5), c(0, .5, T, .5), c(T, .5, T, .5), c(TT, .5, T, .5)] },
  { id: 'grid-2x3', label: 'Six, tall', count: 6, cells: [c(0, 0, .5, T), c(.5, 0, .5, T), c(0, T, .5, T), c(.5, T, .5, T), c(0, TT, .5, T), c(.5, TT, .5, T)] },
];

export function layoutsFor(count: number): Layout[] {
  return LAYOUTS.filter((l) => l.count === count);
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { id: 'square', label: '1:1', ratio: 1 },
  { id: 'landscape-4-3', label: '4:3', ratio: 4 / 3 },
  { id: 'portrait-3-4', label: '3:4', ratio: 3 / 4 },
  { id: 'wide-16-9', label: '16:9', ratio: 16 / 9 },
  { id: 'tall-9-16', label: '9:16', ratio: 9 / 16 },
];

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function canvasSize(presetId: string, longSide: number): { width: number; height: number } {
  const L = Math.round(clamp(Number.isNaN(longSide) ? 1080 : longSide, 256, 4096));
  const ratio = (CANVAS_PRESETS.find((p) => p.id === presetId) ?? CANVAS_PRESETS[0]).ratio;
  if (ratio >= 1) return { width: L, height: Math.max(1, Math.round(L / ratio)) };
  return { width: Math.max(1, Math.round(L * ratio)), height: L };
}

const EPS = 1e-9;

export function computeFrames(layoutId: string, canvasW: number, canvasH: number, gapPx: number, outerPx: number): Frame[] | null {
  const layout = LAYOUTS.find((l) => l.id === layoutId);
  if (!layout) return null;
  const W = Math.max(1, Math.round(Number.isNaN(canvasW) ? 1 : canvasW));
  const H = Math.max(1, Math.round(Number.isNaN(canvasH) ? 1 : canvasH));
  const m = Math.min(W, H);
  const cap = Math.floor(m * 0.1);
  const outer = Math.round(clamp(Number.isNaN(outerPx) ? 0 : outerPx, 0, cap));
  const gap = Math.round(clamp(Number.isNaN(gapPx) ? 0 : gapPx, 0, cap));
  const ix = outer, iy = outer;
  const iw = Math.max(1, W - 2 * outer), ih = Math.max(1, H - 2 * outer);
  return layout.cells.map((cell) => {
    let left = Math.round(ix + cell.x * iw);
    let right = Math.round(ix + (cell.x + cell.w) * iw);
    let top = Math.round(iy + cell.y * ih);
    let bottom = Math.round(iy + (cell.y + cell.h) * ih);
    if (cell.x > EPS) left += Math.ceil(gap / 2);
    if (cell.x + cell.w < 1 - EPS) right -= Math.floor(gap / 2);
    if (cell.y > EPS) top += Math.ceil(gap / 2);
    if (cell.y + cell.h < 1 - EPS) bottom -= Math.floor(gap / 2);
    return { x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
  });
}

export function fitPicture(
  picW: number, picH: number, frame: Frame, mode: 'cover' | 'contain', panX = 0, panY = 0,
): { source: Frame } | { dest: Frame } {
  const pw = Math.max(1, Math.round(Number.isNaN(picW) ? 1 : picW));
  const ph = Math.max(1, Math.round(Number.isNaN(picH) ? 1 : picH));
  const px = clamp(Number.isNaN(panX) ? 0 : panX, -1, 1);
  const py = clamp(Number.isNaN(panY) ? 0 : panY, -1, 1);
  if (mode === 'cover') {
    const scale = Math.max(frame.w / pw, frame.h / ph);
    const sw = Math.min(pw, Math.max(1, Math.round(frame.w / scale)));
    const sh = Math.min(ph, Math.max(1, Math.round(frame.h / scale)));
    const roomX = pw - sw, roomY = ph - sh;
    const sx = clamp(Math.round(roomX / 2 + (px * roomX) / 2), 0, roomX);
    const sy = clamp(Math.round(roomY / 2 + (py * roomY) / 2), 0, roomY);
    return { source: { x: sx, y: sy, w: sw, h: sh } };
  }
  const scale = Math.min(frame.w / pw, frame.h / ph);
  const dw = Math.min(frame.w, Math.max(1, Math.round(pw * scale)));
  const dh = Math.min(frame.h, Math.max(1, Math.round(ph * scale)));
  return { dest: { x: frame.x + Math.floor((frame.w - dw) / 2), y: frame.y + Math.floor((frame.h - dh) / 2), w: dw, h: dh } };
}
