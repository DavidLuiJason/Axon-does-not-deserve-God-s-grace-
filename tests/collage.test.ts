import { LAYOUTS, layoutsFor, CANVAS_PRESETS, canvasSize, computeFrames, fitPicture, type Frame } from '../src/tools/collage/collage';
let checks = 0;
function assert(v: boolean, m: string): void { checks++; if (!v) { throw new Error('FAIL: ' + m); } }
const overlap = (a: Frame, b: Frame): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

assert(LAYOUTS.length === 14, '14 layouts');
assert(new Set(LAYOUTS.map((l) => l.id)).size === LAYOUTS.length, 'ids unique');
for (let n = 2; n <= 6; n++) assert(layoutsFor(n).length >= 2, `count ${n} has two or more layouts`);
assert(layoutsFor(0).length === 0 && layoutsFor(1).length === 0 && layoutsFor(7).length === 0 && layoutsFor(NaN).length === 0, 'unsupported counts give none');
for (const l of LAYOUTS) {
  assert(l.cells.length === l.count, `${l.id} cell count`);
  const area = l.cells.reduce((s, c) => s + c.w * c.h, 0);
  assert(Math.abs(area - 1) < 1e-9, `${l.id} area sums to 1`);
  for (let i = 0; i < l.cells.length; i++) {
    const a = l.cells[i];
    assert(a.x >= -1e-9 && a.y >= -1e-9 && a.x + a.w <= 1 + 1e-9 && a.y + a.h <= 1 + 1e-9, `${l.id} cell ${i} inside`);
    for (let j = i + 1; j < l.cells.length; j++) {
      const b = l.cells[j];
      const ov = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      assert(ov < 1e-9, `${l.id} cells ${i},${j} do not overlap`);
    }
  }
}
for (const p of CANVAS_PRESETS) {
  for (const L of [1080, 100, 9999]) {
    const s = canvasSize(p.id, L), want = Math.min(4096, Math.max(256, L));
    assert(Math.max(s.width, s.height) === want, `${p.id} long side ${L}`);
    assert(Math.abs(s.width / s.height - p.ratio) < 0.01, `${p.id} ratio at ${L}`);
  }
}
assert(canvasSize('nope', 1000).width === 1000 && canvasSize('nope', 1000).height === 1000, 'unknown preset is square');
assert(canvasSize('square', NaN).width === 1080, 'NaN long side');
for (const [W, H] of [[1080, 1080], [1920, 1080], [1080, 1920]]) {
  for (const gap of [0, 12, 9999]) for (const outer of [0, 24, 9999]) for (const l of LAYOUTS) {
    const fr = computeFrames(l.id, W, H, gap, outer)!;
    assert(fr.length === l.count, 'frame count');
    for (const f of fr) assert(f.x >= 0 && f.y >= 0 && f.x + f.w <= W && f.y + f.h <= H && f.w >= 1 && f.h >= 1, `${l.id} inside ${W}x${H} g${gap} o${outer}`);
    for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) assert(overlap(fr[i], fr[j]) === 0, `${l.id} no overlap g${gap} o${outer}`);
    if (gap === 0 && outer === 0) assert(fr.reduce((s, f) => s + f.w * f.h, 0) === W * H, `${l.id} areas sum to the canvas`);
  }
}
{ const fr = computeFrames('two-cols', 1000, 1000, 20, 0)!; assert(fr[1].x - (fr[0].x + fr[0].w) === 20, 'neighbours are exactly the gap apart'); }
{ const fr = computeFrames('two-cols', 1000, 1000, 21, 0)!; assert(fr[1].x - (fr[0].x + fr[0].w) === 21, 'odd gap is exact too'); }
{ const fr = computeFrames('grid-2x2', 1000, 1000, 10, 0)!; assert(fr[2].y - (fr[0].y + fr[0].h) === 10, 'vertical neighbours gap'); }
assert(computeFrames('nope', 100, 100, 0, 0) === null, 'unknown layout null');
{ const fr = computeFrames('grid-2x2', NaN, NaN, NaN, NaN)!; assert(fr.length === 4 && fr.every((f) => f.w >= 1 && f.h >= 1), 'NaN inputs'); }
const frames: Frame[] = [{ x: 0, y: 0, w: 400, h: 300 }, { x: 10, y: 10, w: 300, h: 400 }, { x: 5, y: 5, w: 200, h: 200 }, { x: 0, y: 0, w: 3, h: 2 }];
for (const [pw, ph] of [[4000, 3000], [3000, 4000], [2000, 2000], [1, 1], [50, 10]]) for (const f of frames) for (const pan of [-1, 0, 1, 5, NaN]) {
  const r = fitPicture(pw, ph, f, 'cover', pan, pan) as { source: Frame };
  const s = r.source;
  assert(s.x >= 0 && s.y >= 0 && s.x + s.w <= pw && s.y + s.h <= ph && s.w >= 1 && s.h >= 1, `cover inside picture ${pw}x${ph}`);
  const fa = f.w / f.h;
  assert(Math.abs(s.w / s.h - fa) <= Math.max(1 / s.h, 1 / s.w) * (1 + fa) + 1e-9 || s.w === pw || s.h === ph, 'cover aspect within rounding');
  const d = (fitPicture(pw, ph, f, 'contain') as { dest: Frame }).dest;
  assert(d.x >= f.x && d.y >= f.y && d.x + d.w <= f.x + f.w && d.y + d.h <= f.y + f.h && d.w >= 1 && d.h >= 1, 'contain inside frame');
  assert(Math.abs(d.w / d.h - pw / ph) <= (1 / Math.min(d.w, d.h)) * (1 + pw / ph) + 1e-9 || Math.min(d.w, d.h) <= 2, 'contain keeps aspect within rounding');
}
{ const a = (fitPicture(4000, 1000, { x: 0, y: 0, w: 100, h: 100 }, 'cover', -1, 0) as { source: Frame }).source; assert(a.x === 0 && a.w === 1000 && a.h === 1000, 'pan -1 sticks to the left'); }
{ const a = (fitPicture(4000, 1000, { x: 0, y: 0, w: 100, h: 100 }, 'cover', 1, 0) as { source: Frame }).source; assert(a.x === 3000, 'pan +1 sticks to the right'); }
{ const a = (fitPicture(4000, 1000, { x: 0, y: 0, w: 100, h: 100 }, 'cover', 0, 0) as { source: Frame }).source; assert(a.x === 1500, 'pan 0 is centred'); }
console.log(`=== all collage tests passed (${checks} checks) ===`);
