import assert from 'node:assert/strict';
import { focusCrop } from '../src/tools/engines/images/focusCrop';
import type { PixelImage } from '../src/tools/engines/images/pixelImage';

function image(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([0, 0, 0, 255], i * 4);
  return { width, height, data };
}
function rect(target: PixelImage, x: number, y: number, width: number, height: number, value: number): void {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
    const i = (py * target.width + px) * 4;
    target.data[i] = value; target.data[i + 1] = value; target.data[i + 2] = value;
  }
}
const scene = image(30, 22);
rect(scene, 9, 6, 9, 8, 240);
// Isolated low-intensity pixels must not displace the connected subject.
for (const [x, y] of [[2, 2], [26, 3], [4, 18], [25, 19]]) {
  const i = (y * scene.width + x) * 4;
  scene.data[i] = 40; scene.data[i + 1] = 40; scene.data[i + 2] = 40;
}
const found = focusCrop(scene, { edgeThreshold: 24, minEdgePixels: 8 });
assert.equal(found.ok, true);
if (found.ok) {
  assert.ok(found.box.x >= 7 && found.box.x <= 9, `left edge near subject: ${JSON.stringify(found.box)}`);
  assert.ok(found.box.y >= 4 && found.box.y <= 6, `top edge near subject: ${JSON.stringify(found.box)}`);
  assert.ok(found.box.x + found.box.width >= 17 && found.box.x + found.box.width <= 20);
  assert.ok(found.box.y + found.box.height >= 13 && found.box.y + found.box.height <= 16);
  assert.ok(found.confidence > 0.8);
  assert.ok(found.edgePixels >= 20);
}
const blank = image(20, 15);
assert.equal(focusCrop(blank).ok, false, 'blank image must not invent a focus box');
assert.equal(focusCrop(scene, { edgeThreshold: -1 }).ok, false);
assert.equal(focusCrop({ width: 3, height: 3, data: new Uint8ClampedArray(4) }).ok, false);
console.log('BATCH1 J4:', found.ok ? JSON.stringify({ box: found.box, edgePixels: found.edgePixels, confidence: found.confidence }) : found, '; blank/no-subject case passed');
