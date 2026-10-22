/** Deterministic pointer gesture reducer for the image editor. */
import { panBy, zoomAt, type ViewPoint, type ViewSize, type ViewState, type ViewErrorCode } from './viewTransform.ts';
export type GestureEvent =
  | { type: 'down' | 'move' | 'up'; id: number; x: number; y: number; time: number }
  | { type: 'cancel'; time: number; id?: number }
  | { type: 'wheel'; x: number; y: number; deltaY: number; ctrlKey?: boolean; time: number };
export interface TrackedPointer { id: number; x: number; y: number; startX: number; startY: number; startTime: number; moved: boolean }
export interface GestureState { view: ViewState; stage: ViewSize; picture: ViewSize; pointers: TrackedPointer[]; mode: 'idle' | 'pan' | 'pinch'; panAnchor?: { x: number; y: number; view: ViewState }; pinchDistance?: number; pinchMidpoint?: ViewPoint; tapEligible: boolean }
export type GestureEffect = 'toggle-full';
export type GestureErrorCode = ViewErrorCode | 'invalid-event' | 'invalid-state';
export type GestureResult = { ok: true; state: GestureState; effects: GestureEffect[] } | { ok: false; error: GestureErrorCode; message: string };
export const GESTURE_LIMITS = Object.freeze({ maxPointers: 2, tapMilliseconds: 250, tapMovementPixels: 8, wheelExponent: 0.002 });
const error = (code: GestureErrorCode, message: string): GestureResult => ({ ok: false, error: code, message });
const good = (state: GestureState, effects: GestureEffect[] = []): GestureResult => ({ ok: true, state, effects });
const distance = (a: ViewPoint, b: ViewPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: ViewPoint, b: ViewPoint): ViewPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const point = (p: TrackedPointer): ViewPoint => ({ x: p.x, y: p.y });
const validState = (s: GestureState) => !!s && !!s.view && Number.isFinite(s.view.scale) && s.view.scale > 0 && Number.isFinite(s.view.tx) && Number.isFinite(s.view.ty) && Array.isArray(s.pointers) && s.pointers.length <= 2 && !!s.stage && Number.isFinite(s.stage.width) && Number.isFinite(s.stage.height) && !!s.picture && Number.isFinite(s.picture.width) && Number.isFinite(s.picture.height);
export function createGestureState(view: ViewState, stage: ViewSize, picture: ViewSize): GestureResult {
  if (!view || !stage || !picture || !Number.isFinite(view.scale) || view.scale < 1 || !Number.isFinite(view.tx) || !Number.isFinite(view.ty) || !Number.isFinite(stage.width) || !Number.isFinite(stage.height) || !Number.isFinite(picture.width) || !Number.isFinite(picture.height) || stage.width <= 0 || stage.height <= 0 || picture.width <= 0 || picture.height <= 0) return error('invalid-state', 'Gesture state requires finite view values and positive dimensions.');
  return good({ view: { ...view }, stage: { ...stage }, picture: { ...picture }, pointers: [], mode: 'idle', tapEligible: false });
}
export function reduceGesture(state: GestureState, event: GestureEvent): GestureResult {
  if (!validState(state)) return error('invalid-state', 'Gesture state is invalid.');
  if (!event || !Number.isFinite(event.time)) return error('invalid-event', 'Event timestamp must be finite.');
  if (event.type !== 'cancel' && event.type !== 'wheel' && (!Number.isFinite(event.id) || !Number.isFinite(event.x) || !Number.isFinite(event.y))) return error('invalid-event', 'Pointer id and coordinates must be finite.');
  if (event.type === 'wheel') {
    if (![event.x, event.y, event.deltaY].every(Number.isFinite)) return error('invalid-event', 'Wheel coordinates and delta must be finite.');
    const factor = Math.exp(-event.deltaY * GESTURE_LIMITS.wheelExponent);
    if (!Number.isFinite(factor) || factor <= 0) return error('invalid-event', 'Wheel delta is outside the supported range.');
    const next = zoomAt(state.view, state.stage, state.picture, { x: event.x, y: event.y }, factor);
    if (next.ok === false) return error(next.error, next.message);
    return good({ ...state, view: next.value }, []);
  }
  if (event.type === 'cancel') return good({ ...state, pointers: [], mode: 'idle', panAnchor: undefined, pinchDistance: undefined, pinchMidpoint: undefined, tapEligible: false });
  const existingIndex = state.pointers.findIndex((p) => p.id === event.id);
  if (event.type === 'down') {
    if (existingIndex >= 0 || state.pointers.length >= GESTURE_LIMITS.maxPointers) return good(state);
    const p: TrackedPointer = { id: event.id, x: event.x, y: event.y, startX: event.x, startY: event.y, startTime: event.time, moved: false };
    if (state.pointers.length === 0) return good({ ...state, pointers: [p], mode: state.view.scale > 1 ? 'pan' : 'idle', panAnchor: { x: p.x, y: p.y, view: { ...state.view } }, tapEligible: true });
    const first = state.pointers[0];
    const pointers = [first, p];
    return good({ ...state, pointers, mode: 'pinch', pinchDistance: Math.max(0.001, distance(point(first), point(p))), pinchMidpoint: midpoint(point(first), point(p)), panAnchor: undefined, tapEligible: false });
  }
  if (existingIndex < 0) return good(state);
  const pointers = state.pointers.map((p, i) => i === existingIndex ? { ...p, x: event.x, y: event.y, moved: p.moved || distance({ x: p.startX, y: p.startY }, { x: event.x, y: event.y }) >= GESTURE_LIMITS.tapMovementPixels } : p);
  if (event.type === 'move') {
    if (state.mode === 'pinch' && pointers.length === 2) {
      const oldA = point(state.pointers[0]), oldB = point(state.pointers[1]);
      const newA = point(pointers[0]), newB = point(pointers[1]);
      const oldMid = midpoint(oldA, oldB), newMid = midpoint(newA, newB);
      const oldDistance = Math.max(0.001, distance(oldA, oldB));
      const factor = Math.max(0.0001, distance(newA, newB)) / oldDistance;
      const zoomed = zoomAt(state.view, state.stage, state.picture, oldMid, factor);
      if (zoomed.ok === false) return error(zoomed.error, zoomed.message);
      const panned = panBy(zoomed.value, state.stage, state.picture, newMid.x - oldMid.x, newMid.y - oldMid.y);
      if (panned.ok === false) return error(panned.error, panned.message);
      return good({ ...state, pointers, view: panned.value, pinchDistance: distance(newA, newB), pinchMidpoint: newMid, tapEligible: false });
    }
    if (state.mode === 'pan' && pointers.length === 1 && state.panAnchor && state.view.scale > 1) {
      const panned = panBy(state.panAnchor.view, state.stage, state.picture, event.x - state.panAnchor.x, event.y - state.panAnchor.y);
      if (panned.ok === false) return error(panned.error, panned.message);
      return good({ ...state, pointers, view: panned.value, tapEligible: state.tapEligible && !pointers[0].moved });
    }
    return good({ ...state, pointers, tapEligible: state.tapEligible && !pointers.some((p) => p.moved) });
  }
  // up: only a single, short, stationary pointer can toggle full-picture view.
  const lifted = pointers[existingIndex];
  const remaining = state.pointers.filter((p) => p.id !== event.id);
  if (state.mode === 'pinch' && remaining.length === 1) {
    const p = remaining[0];
    return good({ ...state, pointers: [{ ...p, startX: p.x, startY: p.y, startTime: event.time, moved: true }], mode: state.view.scale > 1 ? 'pan' : 'idle', panAnchor: { x: p.x, y: p.y, view: { ...state.view } }, pinchDistance: undefined, pinchMidpoint: undefined, tapEligible: false });
  }
  const isTap = state.pointers.length === 1 && state.mode !== 'pinch' && state.tapEligible && !lifted.moved && event.time - lifted.startTime >= 0 && event.time - lifted.startTime <= GESTURE_LIMITS.tapMilliseconds && distance({ x: lifted.startX, y: lifted.startY }, { x: event.x, y: event.y }) < GESTURE_LIMITS.tapMovementPixels;
  return good({ ...state, pointers: remaining, mode: 'idle', panAnchor: undefined, pinchDistance: undefined, pinchMidpoint: undefined, tapEligible: false }, isTap ? ['toggle-full'] : []);
}
