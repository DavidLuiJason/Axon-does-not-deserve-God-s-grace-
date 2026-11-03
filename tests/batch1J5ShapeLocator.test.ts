import assert from 'node:assert/strict';
import { findByExample, locateShapes } from '../src/tools/engines/images/shapeLocator';
import type { PixelImage } from '../src/tools/engines/images/pixelImage';

function image(width: number, height: number, color: [number, number, number] = [0, 0, 0]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([color[0], color[1], color[2], 255], i * 4);
  return { width, height, data };
}
function paintPixel(target: PixelImage, x: number, y: number, color: [number, number, number]): void {
  const i = (y * target.width + x) * 4;
  target.data.set([color[0], color[1], color[2], 255], i);
}
function rectangle(target: PixelImage, x: number, y: number, width: number, height: number, color: [number, number, number]): void {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) paintPixel(target, px, py, color);
}
function circle(target: PixelImage, cx: number, cy: number, radius: number, color: [number, number, number]): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) for (let x = cx - radius; x <= cx + radius; x += 1) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) paintPixel(target, x, y, color);
  }
}
const scene = image(42, 28);
circle(scene, 8, 9, 4, [245, 245, 245]);
rectangle(scene, 20, 5, 9, 8, [220, 25, 25]);
// Irregular plus-shaped blue blob.
for (let d = -2; d <= 2; d += 1) { paintPixel(scene, 35 + d, 17, [20, 80, 230]); paintPixel(scene, 35, 17 + d, [20, 80, 230]); }
// Noise below the default component area must be ignored.
paintPixel(scene, 15, 23, [250, 100, 40]);
const located = locateShapes(scene, { backgroundTolerance: 32, minAreaPixels: 4 });
assert.equal(located.ok, true);
if (located.ok) {
  assert.equal(located.matches.length, 3);
  assert.deepEqual(located.matches.map((shape) => shape.kind).sort(), ['blob', 'circle', 'rectangle']);
  const foundCircle = located.matches.find((shape) => shape.kind === 'circle');
  const foundRectangle = located.matches.find((shape) => shape.kind === 'rectangle');
  const foundBlob = located.matches.find((shape) => shape.kind === 'blob');
  assert.ok(foundCircle);
  assert.ok(foundRectangle);
  assert.ok(foundBlob);
  assert.deepEqual(foundCircle.center, { x: 8, y: 9 });
  assert.deepEqual(foundRectangle.center, { x: 24, y: 8.5 });
  assert.deepEqual(foundBlob.center, { x: 35, y: 17 });
}
const example = findByExample(scene, { x: 22, y: 7, width: 2, height: 2 }, { colorTolerance: 8, minAreaPixels: 4 });
assert.equal(example.ok, true);
if (example.ok) {
  assert.equal(example.matches.length, 1);
  assert.deepEqual(example.matches[0]?.box, { x: 20, y: 5, width: 9, height: 8 });
}
paintPixel(scene, 17, 25, [7, 9, 11]);
const noMatch = findByExample(scene, { x: 17, y: 25, width: 1, height: 1 }, { colorTolerance: 0, minAreaPixels: 2 });
assert.equal(noMatch.ok, true);
if (noMatch.ok) assert.equal(noMatch.matches.length, 0);
assert.equal(locateShapes(image(8, 8)).ok, true);
if (locateShapes(image(8, 8)).ok) assert.equal((locateShapes(image(8, 8)) as { ok: true; matches: unknown[] }).matches.length, 0);
assert.equal(findByExample(scene, { x: -1, y: 0, width: 2, height: 2 }).ok, false);
console.log('BATCH1 J5:', located.ok ? JSON.stringify(located.matches.map((shape) => ({ kind: shape.kind, center: shape.center, box: shape.box }))) : located, '; colour example, noise and no-match cases passed');
