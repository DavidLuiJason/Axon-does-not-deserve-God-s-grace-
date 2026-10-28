import assert from 'node:assert/strict';
import { planCollage, COLLAGE_STYLES, type CollageImage } from '../src/tools/engines/images/collagePlan';
import { planShapeCollage, SHAPE_PRESETS } from '../src/tools/engines/images/collageShapes';
// Director audit (independent of the builder's tests): no overlap, nothing outside the margins, whole pictures never cropped or stretched, 100 pictures work.
let seed = 4242; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const mk = (n: number): CollageImage[] => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, width: 200 + Math.floor(rnd() * 3800), height: 200 + Math.floor(rnd() * 3800) }));
const overlap = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
let checks = 0, built = 0;
for (const style of COLLAGE_STYLES.split(' ')) for (let t = 0; t < 120; t++) {
  const n = [1, 2, 3, 7, 12, 38, 100][t % 7], images = mk(n), W = [900, 1080, 2000][t % 3], H = t % 2 ? [1080, 1500, 2000][t % 3] : undefined, gap = [0, 4, 8][t % 3], margin = [0, 8, 20][(t >> 1) % 3];
  const r = planCollage({ canvasWidth: W, canvasHeight: H, images, style: style as any, gap, margin }); checks++;
  if (!r.ok) continue; built++;
  const tag = `${style} n=${n} W=${W} H=${H} gap=${gap} margin=${margin}`;
  assert.equal(r.cells.length, n, tag); assert.deepEqual(r.cells.map(c => c.id), images.map(i => i.id), tag);
  if (H !== undefined) assert.equal(r.canvasHeight, H, tag);
  for (let a = 0; a < n; a++) {
    const c = r.cells[a], im = images[a];
    assert.ok(c.w >= 1 && c.h >= 1 && c.x >= margin && c.y >= margin && c.x + c.w <= W - margin && c.y + c.h <= r.canvasHeight - margin, 'bounds ' + tag);
    if (style !== 'tiles') { assert.deepEqual(c.crop, { sx: 0, sy: 0, sw: im.width, sh: im.height }, 'crop ' + tag); if (Math.min(c.w, c.h) >= 24) assert.ok(Math.abs(c.w * im.height - c.h * im.width) <= Math.max(im.width, im.height) * 1.0001, 'aspect ' + tag); }
    for (let b = a + 1; b < n; b++) assert.equal(overlap(c, r.cells[b]), false, 'overlap ' + tag);
  }
}
assert.ok(built > 700, 'most requests must succeed, got ' + built);
// the default style keeps all 100 pictures whole on a free-height canvas
const hundred = planCollage({ canvasWidth: 2400, images: mk(100) }); assert.equal(hundred.ok, true); checks++;
// a single picture works in every style (the hero style used to crash)
for (const style of COLLAGE_STYLES.split(' ')) { assert.equal(planCollage({ canvasWidth: 800, canvasHeight: 600, images: mk(1), style: style as any }).ok, true, style); checks++; }
// grid and tiles with no height must not collapse to one tall column
const g = planCollage({ canvasWidth: 1000, images: mk(12), style: 'grid' }); assert.ok(g.ok && new Set(g.cells.map(c => c.x)).size > 1); checks++;
// shapes: every preset holds 100 pictures without overlap, all inside the outline's canvas
for (const sh of SHAPE_PRESETS.split(' ')) for (const n of [1, 12, 100]) {
  const images = mk(n), r = planShapeCollage({ canvasWidth: 1200, canvasHeight: 1200, images, shape: { preset: sh }, gap: 6, margin: 10 }); assert.equal(r.ok, true, sh + ' ' + n); if (!r.ok) continue;
  assert.equal(r.cells.length, n);
  for (let a = 0; a < n; a++) { const c = r.cells[a]; assert.ok(c.x >= 10 && c.y >= 10 && c.x + c.w <= 1190 && c.y + c.h <= 1190, 'shape bounds'); assert.deepEqual(c.crop, { sx: 0, sy: 0, sw: images[a].width, sh: images[a].height }); for (let b = a + 1; b < n; b++) assert.equal(overlap(c, r.cells[b]), false, `shape overlap ${sh} ${n}`); }
  const o = r.outline, inside = (px: number, py: number) => { let k = false; for (let i = 0, j = o.length - 1; i < o.length; j = i++) { const p = o[i], q = o[j]; if ((p.y > py) !== (q.y > py) && px < (q.x - p.x) * (py - p.y) / (q.y - p.y) + p.x) k = !k; } return k; };
  for (const c of r.cells) for (const [px, py] of [[c.x + .01, c.y + .01], [c.x + c.w - .01, c.y + .01], [c.x + .01, c.y + c.h - .01], [c.x + c.w - .01, c.y + c.h - .01]]) assert.ok(inside(px, py), `outside outline ${sh} ${n}`);
  checks += 3;
}
console.log(`collageAudit: PASS (${checks} checks; ${built} layouts verified for overlap, bounds, no crop, no stretch)`);
