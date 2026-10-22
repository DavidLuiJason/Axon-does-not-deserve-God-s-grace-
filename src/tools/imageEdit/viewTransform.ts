/** Pure picture-view geometry. Scale is relative to the fit-to-stage size. */
export interface ViewSize { width: number; height: number }
export interface ViewPoint { x: number; y: number }
export interface ViewState { scale: number; tx: number; ty: number }
export type ViewErrorCode = 'invalid-size' | 'invalid-point' | 'invalid-view' | 'invalid-scale' | 'invalid-factor';
export type ViewResult<T> = { ok: true; value: T } | { ok: false; error: ViewErrorCode; message: string };
export const VIEW_TRANSFORM_LIMITS = Object.freeze({ minScale: 1, minMaxScale: 4, maxScale: 16, targetPicturePixelCssPixels: 4 });
const fail = <T>(error: ViewErrorCode, message: string): ViewResult<T> => ({ ok: false, error, message });
const ok = <T>(value: T): ViewResult<T> => ({ ok: true, value });
const finitePositive = (n: number) => Number.isFinite(n) && n > 0;
const validSize = (s: ViewSize) => !!s && finitePositive(s.width) && finitePositive(s.height);
const validPoint = (p: ViewPoint) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const validView = (v: ViewState) => !!v && Number.isFinite(v.scale) && v.scale > 0 && Number.isFinite(v.tx) && Number.isFinite(v.ty);

export function fitScale(stage: ViewSize, picture: ViewSize): ViewResult<number> {
  if (!validSize(stage) || !validSize(picture)) return fail('invalid-size', 'Stage and picture dimensions must be finite and positive.');
  const scale = Math.min(stage.width / picture.width, stage.height / picture.height);
  return finitePositive(scale) ? ok(scale) : fail('invalid-size', 'The fit scale is not representable.');
}
export function maxViewScale(stage: ViewSize, picture: ViewSize): ViewResult<number> {
  const fit = fitScale(stage, picture);
  if (fit.ok === false) return fit;
  return ok(Math.max(VIEW_TRANSFORM_LIMITS.minMaxScale, Math.min(VIEW_TRANSFORM_LIMITS.maxScale, VIEW_TRANSFORM_LIMITS.targetPicturePixelCssPixels / fit.value)));
}
export function clampScale(scale: number, maxScale: number): ViewResult<number> {
  if (!Number.isFinite(scale) || !Number.isFinite(maxScale) || maxScale < 1) return fail('invalid-scale', 'Scale and maximum scale must be finite, with maximum at least one.');
  return ok(Math.max(1, Math.min(maxScale, scale)));
}
export function clampView(view: ViewState, stage: ViewSize, picture: ViewSize): ViewResult<ViewState> {
  if (!validView(view)) return fail('invalid-view', 'View values must be finite.');
  const fit = fitScale(stage, picture); if (fit.ok === false) return fit;
  const max = maxViewScale(stage, picture); if (max.ok === false) return max;
  const s = clampScale(view.scale, max.value); if (s.ok === false) return s;
  const w = picture.width * fit.value * s.value;
  const h = picture.height * fit.value * s.value;
  const tx = w <= stage.width ? (stage.width - w) / 2 : Math.max(stage.width - w, Math.min(0, view.tx));
  const ty = h <= stage.height ? (stage.height - h) / 2 : Math.max(stage.height - h, Math.min(0, view.ty));
  if (![w, h, tx, ty].every(Number.isFinite)) return fail('invalid-view', 'Clamped view is outside the supported numeric range.');
  return ok({ scale: s.value, tx, ty });
}
export function fitView(stage: ViewSize, picture: ViewSize): ViewResult<ViewState> {
  const fit = fitScale(stage, picture); if (fit.ok === false) return fit;
  return clampView({ scale: 1, tx: (stage.width - picture.width * fit.value) / 2, ty: (stage.height - picture.height * fit.value) / 2 }, stage, picture);
}
/** Keep the picture-space point beneath focal fixed while changing relative scale. */
export function zoomAt(view: ViewState, stage: ViewSize, picture: ViewSize, focal: ViewPoint, factor: number): ViewResult<ViewState> {
  if (!validPoint(focal)) return fail('invalid-point', 'Focal point must be finite.');
  if (!Number.isFinite(factor) || factor <= 0) return fail('invalid-factor', 'Zoom factor must be finite and positive.');
  const fit = fitScale(stage, picture); if (fit.ok === false) return fit;
  if (!validView(view)) return fail('invalid-view', 'View values must be finite.');
  const max = maxViewScale(stage, picture); if (max.ok === false) return max;
  const scaled = clampScale(view.scale * factor, max.value); if (scaled.ok === false) return scaled;
  const ratio = scaled.value / view.scale;
  const next = { scale: scaled.value, tx: focal.x - (focal.x - view.tx) * ratio, ty: focal.y - (focal.y - view.ty) * ratio };
  return clampView(next, stage, picture);
}
export function panBy(view: ViewState, stage: ViewSize, picture: ViewSize, dx: number, dy: number): ViewResult<ViewState> {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return fail('invalid-point', 'Pan deltas must be finite.');
  return clampView({ ...view, tx: view.tx + dx, ty: view.ty + dy }, stage, picture);
}
export function stageToPicture(point: ViewPoint, view: ViewState, stage: ViewSize, picture: ViewSize): ViewResult<ViewPoint> {
  if (!validPoint(point) || !validView(view)) return fail('invalid-point', 'Point and view must be finite.');
  const fit = fitScale(stage, picture); if (fit.ok === false) return fit;
  const denom = fit.value * view.scale;
  if (!finitePositive(denom)) return fail('invalid-view', 'View scale is not representable.');
  return ok({ x: (point.x - view.tx) / denom, y: (point.y - view.ty) / denom });
}
export function pictureToStage(point: ViewPoint, view: ViewState, stage: ViewSize, picture: ViewSize): ViewResult<ViewPoint> {
  if (!validPoint(point) || !validView(view)) return fail('invalid-point', 'Point and view must be finite.');
  const fit = fitScale(stage, picture); if (fit.ok === false) return fit;
  const scale = fit.value * view.scale;
  const result = { x: view.tx + point.x * scale, y: view.ty + point.y * scale };
  return [result.x, result.y].every(Number.isFinite) ? ok(result) : fail('invalid-point', 'Converted point is outside the supported numeric range.');
}
/** Refit for new dimensions while preserving the picture point at the old stage centre. */
export function refitKeepingCentre(view: ViewState, oldStage: ViewSize, oldPicture: ViewSize, newStage: ViewSize, newPicture: ViewSize): ViewResult<ViewState> {
  const oldCentre = { x: oldStage.width / 2, y: oldStage.height / 2 };
  const centrePicture = stageToPicture(oldCentre, view, oldStage, oldPicture);
  if (centrePicture.ok === false) return centrePicture;
  const fit = fitView(newStage, newPicture); if (fit.ok === false) return fit;
  const max = maxViewScale(newStage, newPicture); if (max.ok === false) return max;
  const scale = clampScale(view.scale, max.value); if (scale.ok === false) return scale;
  const fitFactor = fitScale(newStage, newPicture); if (fitFactor.ok === false) return fitFactor;
  const next = { scale: scale.value, tx: newStage.width / 2 - centrePicture.value.x * fitFactor.value * scale.value, ty: newStage.height / 2 - centrePicture.value.y * fitFactor.value * scale.value };
  return clampView(next, newStage, newPicture);
}
