import assert from 'node:assert/strict';
import { removePlainBackground } from '../src/tools/engines/images/plainBackground';
import type { PixelImage } from '../src/tools/engines/images/pixelImage';

function flat(width: number, height: number, color: [number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([color[0], color[1], color[2], 255], i * 4);
  return { width, height, data };
}
function paint(target: PixelImage, x: number, y: number, width: number, height: number, color: [number, number, number]): void {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
    const offset = (py * target.width + px) * 4;
    target.data.set([color[0], color[1], color[2], 255], offset);
  }
}
const flatScene = flat(18, 14, [245, 245, 245]);
paint(flatScene, 6, 4, 6, 6, [30, 60, 180]);
const original = new Uint8ClampedArray(flatScene.data);
const flatResult = removePlainBackground(flatScene, { colorTolerance: 8, maxBorderResidual: 2 });
assert.equal(flatResult.ok, true);
if (flatResult.ok) {
  assert.equal(flatResult.mode, 'flat');
  assert.equal(flatResult.removedPixels, 18 * 14 - 6 * 6);
  assert.equal(flatResult.image.data[((0 * 18 + 0) * 4) + 3], 0);
  assert.equal(flatResult.image.data[((5 * 18 + 8) * 4) + 3], 255);
  assert.equal(flatResult.image.data[((5 * 18 + 8) * 4)], 30);
}
assert.deepEqual(flatScene.data, original, 'input pixels must remain unchanged');
const gradient = flat(24, 18, [0, 0, 0]);
for (let y = 0; y < gradient.height; y += 1) for (let x = 0; x < gradient.width; x += 1) {
  const offset = (y * gradient.width + x) * 4;
  gradient.data[offset] = 190 + x * 2;
  gradient.data[offset + 1] = 200 + y * 2;
  gradient.data[offset + 2] = 205 + x + y;
  gradient.data[offset + 3] = 255;
}
paint(gradient, 8, 6, 8, 7, [35, 25, 15]);
const gradientResult = removePlainBackground(gradient, { colorTolerance: 12, maxBorderResidual: 2 });
assert.equal(gradientResult.ok, true);
if (gradientResult.ok) {
  assert.equal(gradientResult.mode, 'linear-gradient');
  assert.equal(gradientResult.removedPixels, 24 * 18 - 8 * 7);
  assert.equal(gradientResult.image.data[((0 * 24 + 0) * 4) + 3], 0);
  assert.equal(gradientResult.image.data[((8 * 24 + 11) * 4) + 3], 255);
}
const difficult = flat(16, 12, [0, 0, 0]);
for (let y = 0; y < difficult.height; y += 1) for (let x = 0; x < difficult.width; x += 1) {
  const c = ((x + y) % 2 === 0) ? [245, 245, 245] : [20, 120, 210];
  const offset = (y * difficult.width + x) * 4;
  difficult.data.set([c[0]!, c[1]!, c[2]!, 255], offset);
}
const cannot = removePlainBackground(difficult, { maxBorderResidual: 8 });
assert.equal(cannot.ok, false);
if (!cannot.ok) {
  assert.equal(cannot.error, 'cannot');
  assert.ok((cannot.borderResidual ?? 0) > 8);
}
assert.equal(removePlainBackground({ width: 4, height: 4, data: new Uint8ClampedArray(10) }).ok, false);
assert.equal(removePlainBackground(flat(8, 8, [255, 255, 255]), { colorTolerance: -1 }).ok, false);
console.log('BATCH1 J6:', flatResult.ok ? `flat removed ${flatResult.removedPixels}` : flatResult, ';', gradientResult.ok ? `gradient removed ${gradientResult.removedPixels}` : gradientResult, '; textured hard case refused; input preserved');
