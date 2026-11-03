import assert from 'node:assert/strict';
import { cropPanel, splitCollage } from '../src/tools/engines/images/collageSplitter';
import type { PixelImage } from '../src/tools/engines/images/pixelImage';

function image(width: number, height: number, color: [number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) { data[i * 4] = color[0]; data[i * 4 + 1] = color[1]; data[i * 4 + 2] = color[2]; data[i * 4 + 3] = 255; }
  return { width, height, data };
}
function paint(target: PixelImage, x: number, y: number, width: number, height: number, color: [number, number, number]): void {
  for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) {
    const i = (py * target.width + px) * 4;
    target.data[i] = color[0]; target.data[i + 1] = color[1]; target.data[i + 2] = color[2]; target.data[i + 3] = 255;
  }
}
const collage = image(12, 10, [250, 250, 250]);
paint(collage, 1, 1, 4, 3, [220, 20, 20]);
paint(collage, 7, 1, 4, 3, [20, 200, 20]);
paint(collage, 1, 6, 4, 3, [20, 20, 220]);
paint(collage, 7, 6, 4, 3, [220, 180, 20]);
const result = splitCollage(collage, { backgroundTolerance: 8, lineCoverage: 0.95, minPanelPixels: 3 });
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.rows, 2);
  assert.equal(result.columns, 2);
  assert.deepEqual(result.panels, [
    { x: 1, y: 1, width: 4, height: 3 },
    { x: 7, y: 1, width: 4, height: 3 },
    { x: 1, y: 6, width: 4, height: 3 },
    { x: 7, y: 6, width: 4, height: 3 },
  ]);
  const crop = cropPanel(collage, result.panels[2]!);
  assert.ok(crop);
  assert.equal(crop.width, 4);
  assert.equal(crop.height, 3);
  assert.equal(crop.data[2], 220);
  assert.equal(crop.data[3], 255);
}
const single = image(8, 6, [255, 255, 255]);
paint(single, 1, 1, 6, 4, [30, 90, 150]);
const one = splitCollage(single, { backgroundTolerance: 5, lineCoverage: 0.98 });
assert.equal(one.ok, true);
if (one.ok) assert.deepEqual(one.panels, [{ x: 1, y: 1, width: 6, height: 4 }]);
assert.equal(splitCollage({ width: 2, height: 2, data: new Uint8ClampedArray(3) }).ok, false);
assert.equal(cropPanel(collage, { x: -1, y: 0, width: 2, height: 2 }), null);
console.log('BATCH1 J3: four synthetic panel boxes matched exactly; single-panel and invalid-input cases passed');
