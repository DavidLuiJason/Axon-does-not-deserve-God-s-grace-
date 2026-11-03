// DIRECTOR guard test for Batch 1 (written by the Director after mutants survived the builder's tests).
import assert from 'node:assert/strict';
import { findReplaceMany, parseFindReplacePairs } from '../src/tools/engines/text/findReplaceMany';
import { isUsageDate, applyUsageRetention, rollupUsage } from '../src/tools/engines/data/dataUseLedger';
import { splitCollage } from '../src/tools/engines/images/collageSplitter';
import { focusCrop } from '../src/tools/engines/images/focusCrop';

// J1: overlapping matches are consumed left to right; default is case-insensitive; blank lines are skipped
const o = findReplaceMany('aaa', [{ find: 'aa', replace: 'b' }]);
assert.ok(o.ok && o.text === 'ba' && o.replacements === 1);
const c = findReplaceMany('Cat cat CAT', [{ find: 'cat', replace: 'x' }]);
assert.ok(c.ok && c.text === 'x x x');
const cs = findReplaceMany('Cat cat', [{ find: 'cat', replace: 'x' }], { caseSensitive: true });
assert.ok(cs.ok && cs.text === 'Cat x');
const chain = findReplaceMany('a', [{ find: 'a', replace: 'b' }, { find: 'b', replace: 'c' }]);
assert.ok(chain.ok && chain.text === 'c');
const p = parseFindReplacePairs('a=b\n\nc=d\r\ne=f=g', '=');
assert.ok(p.ok && p.pairs.length === 3 && p.pairs[2]!.replace === 'f=g');

// J2: leap rule, future records, source filter
assert.equal(isUsageDate('2000-02-29'), true);
assert.equal(isUsageDate('1900-02-29'), false);
assert.equal(isUsageDate('2100-02-29'), false);
assert.equal(isUsageDate('2024-02-29'), true);
assert.equal(isUsageDate('2023-02-29'), false);
const rows = [
  { date: '2024-03-01', source: 'chat', receivedBytes: 10, sentBytes: 1 },
  { date: '2024-03-05', source: 'web', receivedBytes: 20, sentBytes: 2 },
  { date: '2024-03-09', source: 'chat', receivedBytes: 40, sentBytes: 4 },
];
const kept = applyUsageRetention(rows, '2024-03-06', 10);
assert.ok(kept.ok && kept.value.length === 2 && kept.value.every((r) => r.date <= '2024-03-06'));
const only = rollupUsage(rows, 'month', 'chat');
assert.ok(only.ok && only.value.length === 1 && only.value[0]!.receivedBytes === 50 && only.value[0]!.recordCount === 2);

// J3: a 21x21 collage with a 1-pixel bg border and one-pixel gutters
function collage(gutter: [number, number, number]) {
  const w = 21; const h = 21; const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    let col: [number, number, number] = [50, 50, 50];
    if (x === 0 || y === 0 || x === 20 || y === 20) col = [255, 255, 255];
    else if (x === 10 || y === 10) col = gutter;
    data.set([col[0], col[1], col[2], 255], (y * w + x) * 4);
  }
  return { width: w, height: h, data };
}
const want = [{ x: 1, y: 1, width: 9, height: 9 }, { x: 11, y: 1, width: 9, height: 9 }, { x: 1, y: 11, width: 9, height: 9 }, { x: 11, y: 11, width: 9, height: 9 }];
const g1 = splitCollage(collage([255, 255, 255]), { lineCoverage: 1 });
assert.ok(g1.ok); if (g1.ok) assert.deepEqual(g1.panels, want);
const g2 = splitCollage(collage([245, 255, 255]), { backgroundTolerance: 10 });
assert.ok(g2.ok); if (g2.ok) assert.deepEqual(g2.panels, want);

// J4: strong subject (exact box), weaker second object, margin, relative threshold
function scene() {
  const w = 40; const h = 30; const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) data.set([0, 0, 0, 255], i * 4);
  const paint = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) data.set([v, v, v, 255], (y * w + x) * 4);
  };
  paint(10, 8, 19, 17, 255);
  paint(28, 20, 29, 21, 60);
  return { width: w, height: h, data };
}
const f = focusCrop(scene());
assert.ok(f.ok);
if (f.ok) {
  assert.deepEqual(f.box, { x: 9, y: 7, width: 12, height: 12 });
  assert.ok(Math.abs(f.threshold - 510 * 0.08) < 1e-9);
}
const fm = focusCrop(scene(), { marginPixels: 2 });
assert.ok(fm.ok); if (fm.ok) assert.deepEqual(fm.box, { x: 7, y: 5, width: 16, height: 16 });


// ---- J5 shape locator guards ----
import { locateShapes, findByExample } from '../src/tools/engines/images/shapeLocator';
import { removePlainBackground } from '../src/tools/engines/images/plainBackground';
type Img = { width: number; height: number; data: Uint8ClampedArray };
function canvas(w: number, h: number, bg: [number, number, number]): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) data.set([bg[0], bg[1], bg[2], 255], i * 4);
  return { width: w, height: h, data };
}
function put(img: Img, x: number, y: number, c: [number, number, number], a = 255): void { img.data.set([c[0], c[1], c[2], a], (y * img.width + x) * 4); }
function rect(img: Img, x0: number, y0: number, x1: number, y1: number, c: [number, number, number], a = 255): void {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) put(img, x, y, c, a);
}
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [200, 30, 30];
// sort order: largest first; minimum area 4 is included (>=)
const s1 = canvas(40, 30, WHITE); rect(s1, 2, 2, 13, 9, RED); rect(s1, 20, 20, 23, 23, RED); rect(s1, 30, 3, 31, 4, RED);
const r1 = locateShapes(s1);
assert.ok(r1.ok && r1.matches.length === 3 && r1.matches[0]!.areaPixels === 96 && r1.matches[1]!.areaPixels === 16 && r1.matches[2]!.areaPixels === 4);
// transparent pixels are never foreground
const s2 = canvas(20, 20, WHITE); rect(s2, 5, 5, 8, 8, RED, 0);
const r2 = locateShapes(s2); assert.ok(r2.ok && r2.matches.length === 0);
// diagonal-only contact joins one component (8-neighbour)
const s3 = canvas(20, 20, WHITE); for (let i = 0; i < 6; i += 1) put(s3, 4 + i, 4 + i, RED);
const r3 = locateShapes(s3); assert.ok(r3.ok && r3.matches.length === 1 && r3.matches[0]!.areaPixels === 6);
// an L-shaped region (aspect 2, fill 0.75) is a blob, not a rectangle or circle
const s4 = canvas(30, 20, WHITE); rect(s4, 4, 4, 15, 6, RED); rect(s4, 4, 7, 9, 9, RED);
const r4 = locateShapes(s4); assert.ok(r4.ok && r4.matches.length === 1 && r4.matches[0]!.kind === 'blob');
// a wide ellipse (aspect 2) is a blob, not a circle
const s5 = canvas(40, 24, WHITE);
for (let y = 0; y < 24; y += 1) for (let x = 0; x < 40; x += 1) if (((x - 20) / 10) ** 2 + ((y - 12) / 5) ** 2 <= 1) put(s5, x, y, RED);
const r5 = locateShapes(s5); assert.ok(r5.ok && r5.matches.length === 1 && r5.matches[0]!.kind === 'blob');
// find by example: a colour 24 away (the default tolerance) matches, 40 away does not; example pixels with alpha 0 are ignored
const s6 = canvas(30, 20, [0, 0, 0]); rect(s6, 0, 0, 1, 1, [100, 100, 100]); rect(s6, 10, 10, 13, 13, [100, 100, 124]); rect(s6, 20, 10, 23, 13, [100, 100, 140]);
const r6 = findByExample(s6, { x: 0, y: 0, width: 2, height: 2 });
assert.ok(r6.ok && r6.matches.some((m) => m.box.x === 10 && m.box.y === 10) && !r6.matches.some((m) => m.box.x === 20));

// ---- J6 plain-background remover guards ----
const b1 = canvas(20, 20, [240, 240, 240]); rect(b1, 7, 7, 12, 12, RED); put(b1, 1, 1, [240, 240, 265 > 255 ? 255 : 265]); // distance 15 from model
rect(b1, 3, 3, 3, 3, [240, 240, 240]);
const o1 = removePlainBackground(b1);
assert.ok(o1.ok && o1.removedPixels === 400 - 36 && o1.image.data[3] === 0 && o1.image.data[(10 * 20 + 10) * 4 + 3] === 255 && o1.mode === 'flat');
assert.equal(b1.data[3], 255); // the input is never changed
// just inside tolerance is removed, just outside is kept
const b2 = canvas(20, 20, [200, 200, 200]); put(b2, 5, 5, [200, 200, 225]); put(b2, 9, 9, [200, 200, 228]);
const o2 = removePlainBackground(b2);
assert.ok(o2.ok && o2.image.data[(5 * 20 + 5) * 4 + 3] === 0 && o2.image.data[(9 * 20 + 9) * 4 + 3] === 255);
// a textured border must say cannot, because of the border, not for another reason
const b3 = canvas(20, 20, WHITE);
for (let x = 0; x < 20; x += 1) for (const y of [0, 19]) put(b3, x, y, x % 2 === 0 ? [0, 0, 0] : [255, 255, 255]);
for (let y = 0; y < 20; y += 1) for (const x of [0, 19]) put(b3, x, y, y % 2 === 0 ? [0, 0, 0] : [255, 255, 255]);
const o3 = removePlainBackground(b3);
assert.ok(!o3.ok && o3.error === 'cannot' && o3.message.includes('varies too much') && (o3.borderResidual ?? 0) > 12);
// nothing visible to remove: cannot
const b4 = canvas(20, 20, WHITE); for (let i = 0; i < 400; i += 1) b4.data[i * 4 + 3] = 0;
const o4 = removePlainBackground(b4); assert.ok(!o4.ok && o4.error === 'cannot');
// background that is reachable only by moving left (a hollow box open on its right side) is still removed
const b5 = canvas(20, 20, WHITE); rect(b5, 4, 4, 9, 9, RED); rect(b5, 5, 5, 8, 8, WHITE); put(b5, 9, 6, WHITE);
const o5 = removePlainBackground(b5); assert.ok(o5.ok && o5.image.data[(6 * 20 + 6) * 4 + 3] === 0);
console.log('BATCH1 DIRECTOR GUARDS: passed');
