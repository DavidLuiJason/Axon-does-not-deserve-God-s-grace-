import assert from 'node:assert/strict';
import { fitView, maxViewScale, type ViewSize } from '../src/tools/imageEdit/viewTransform.ts';
import { createGestureState, reduceGesture, type GestureEvent, type GestureState } from '../src/tools/imageEdit/gesture.ts';
let checks = 0;
function check(condition: unknown, message: string) { checks++; assert.ok(condition, message); }
function near(a: number, b: number, eps = 1e-6) { check(Math.abs(a - b) <= eps, `${a} not near ${b}`); }
const stage = { width: 400, height: 600 }, picture = { width: 1200, height: 800 };
const fit = fitView(stage, picture); if (!fit.ok) throw new Error('fit failed');
const fitVal = fit.value;
function fresh(view = fitVal, st: ViewSize = stage, pic: ViewSize = picture): GestureState { const r = createGestureState(view, st, pic); if (!r.ok) throw new Error(r.message); return r.state; }
function send(s: GestureState, e: GestureEvent): GestureState { const r = reduceGesture(s, e); if (!r.ok) throw new Error(r.message); return r.state; }
function effects(s: GestureState, e: GestureEvent) { const r = reduceGesture(s, e); if (!r.ok) throw new Error(r.message); return { state: r.state, effects: r.effects }; }
let s = fresh();
s = send(s, { type: 'down', id: 1, x: 100, y: 100, time: 0 });
s = send(s, { type: 'down', id: 2, x: 200, y: 100, time: 10 });
s = send(s, { type: 'move', id: 2, x: 260, y: 100, time: 20 });
near(s.view.scale, 1.6); // 160 px / 100 px pinch-distance ratio, derived independently.
check(s.view.scale > 1, 'two-finger pinch zooms');
s = send(s, { type: 'move', id: 1, x: 120, y: 130, time: 30 });
check(Number.isFinite(s.view.tx) && Number.isFinite(s.view.ty), 'pinch also pans');
const beforeLift = { ...s.view };
s = send(s, { type: 'up', id: 2, x: 260, y: 100, time: 40 });
near(s.view.scale, beforeLift.scale); near(s.view.tx, beforeLift.tx); near(s.view.ty, beforeLift.ty);
const one = s.pointers[0];
s = send(s, { type: 'move', id: one.id, x: one.x + 25, y: one.y + 10, time: 50 });
check(s.view.tx !== beforeLift.tx || s.view.ty !== beforeLift.ty, 'remaining finger continues as pan');
s = send(s, { type: 'cancel', time: 60 }); check(s.pointers.length === 0 && s.mode === 'idle', 'cancel clears active pointers');
// Third pointer ignored, including its moves and up.
s = fresh(); s = send(s, { type: 'down', id: 1, x: 100, y: 100, time: 0 }); s = send(s, { type: 'down', id: 2, x: 200, y: 100, time: 1 }); const two = s;
s = send(s, { type: 'down', id: 3, x: 300, y: 100, time: 2 }); check(s.pointers.length === 2, 'third pointer ignored');
s = send(s, { type: 'move', id: 3, x: 350, y: 100, time: 3 }); near(s.view.scale, two.view.scale);
// Tap, drag, slow press, tiny wiggle.
let r = effects(send(fresh(), { type: 'down', id: 9, x: 20, y: 20, time: 100 }), { type: 'up', id: 9, x: 20, y: 20, time: 200 });
check(r.effects.includes('toggle-full'), 'short stationary tap toggles full view');
let t = send(fresh(), { type: 'down', id: 4, x: 20, y: 20, time: 0 }); t = send(t, { type: 'move', id: 4, x: 40, y: 20, time: 30 }); r = effects(t, { type: 'up', id: 4, x: 40, y: 20, time: 40 }); check(!r.effects.includes('toggle-full'), 'drag does not tap');
t = send(fresh(), { type: 'down', id: 5, x: 20, y: 20, time: 0 }); r = effects(t, { type: 'up', id: 5, x: 20, y: 20, time: 251 }); check(!r.effects.includes('toggle-full'), 'slow press does not tap');
t = send(fresh(), { type: 'down', id: 6, x: 20, y: 20, time: 0 }); t = send(t, { type: 'move', id: 6, x: 25, y: 23, time: 30 }); r = effects(t, { type: 'up', id: 6, x: 25, y: 23, time: 50 }); check(r.effects.includes('toggle-full'), 'tiny wiggle below 8 px is still a tap');
// Pointer ids can be reused after release.
t = send(fresh(), { type: 'down', id: 7, x: 1, y: 1, time: 0 }); t = send(t, { type: 'up', id: 7, x: 1, y: 1, time: 20 }); t = send(t, { type: 'down', id: 7, x: 2, y: 2, time: 30 }); check(t.pointers.length === 1 && t.pointers[0].id === 7, 'pointer id reusable');
// Wheel zooms about the cursor, including ctrl-wheel; invalid inputs return errors.
t = fresh(); const wheel = reduceGesture(t, { type: 'wheel', x: 120, y: 130, deltaY: -120, time: 1, ctrlKey: true }); check(wheel.ok && wheel.state.view.scale > 1, 'ctrl-wheel zooms');
check(!reduceGesture(t, { type: 'wheel', x: 1, y: 1, deltaY: Number.NaN, time: 1 }).ok, 'NaN wheel rejected');
check(!reduceGesture(t, { type: 'down', id: 1, x: Infinity, y: 1, time: 1 }).ok, 'infinite coordinate rejected');
check(!createGestureState(null as never, stage, picture).ok, 'wrong view type rejected without throwing');
check(!reduceGesture(null as never, { type: 'cancel', time: 1 }).ok, 'wrong state type rejected without throwing');
// Seeded property test: 5,000 events, bounded and repeatable.
let seed = 0xC07A11;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
t = fresh(); let time = 1000; const ids = [11, 12, 13];
for (let i = 0; i < 5000; i++) {
  time += Math.floor(rand() * 30);
  const k = Math.floor(rand() * 5);
  let e: GestureEvent;
  if (k === 0) e = { type: 'down', id: ids[Math.floor(rand() * ids.length)], x: rand() * 500 - 50, y: rand() * 700 - 50, time };
  else if (k === 1) e = { type: 'move', id: ids[Math.floor(rand() * ids.length)], x: rand() * 500 - 50, y: rand() * 700 - 50, time };
  else if (k === 2) e = { type: 'up', id: ids[Math.floor(rand() * ids.length)], x: rand() * 500 - 50, y: rand() * 700 - 50, time };
  else if (k === 3) e = { type: 'wheel', x: rand() * 400, y: rand() * 600, deltaY: rand() * 800 - 400, ctrlKey: rand() > 0.5, time };
  else e = { type: 'cancel', time };
  const next = reduceGesture(t, e); check(next.ok, `random event ${i} accepted`); if (next.ok === false) continue; t = next.state;
  check([t.view.scale, t.view.tx, t.view.ty].every(Number.isFinite), `random state ${i} finite`);
  const mx = maxViewScale(t.stage, t.picture); check(mx.ok && t.view.scale >= 1 && t.view.scale <= mx.value + 1e-9, `random scale ${i} in range`);
  const fitScaleValue = Math.min(t.stage.width / t.picture.width, t.stage.height / t.picture.height);
  const w = t.picture.width * fitScaleValue * t.view.scale, h = t.picture.height * fitScaleValue * t.view.scale;
  if (w <= t.stage.width) near(t.view.tx, (t.stage.width - w) / 2, 1e-5); else check(t.view.tx <= 1e-5 && t.view.tx + w >= t.stage.width - 1e-5, `random x bounds ${i}`);
  if (h <= t.stage.height) near(t.view.ty, (t.stage.height - h) / 2, 1e-5); else check(t.view.ty <= 1e-5 && t.view.ty + h >= t.stage.height - 1e-5, `random y bounds ${i}`);
}
console.log(`gesture.test.ts: PASS (${checks} checks; 5,000 seeded events)`);
