import assert from 'node:assert/strict';
import { boxToSource, downscalePixelImage, needsDownscale, DOWNSCALE_INPUT_LIMITS } from '../src/tools/engines/images/downscale';
import { validatePixelImage, type PixelImage } from '../src/tools/engines/images/pixelImage';
import { removePlainBackground } from '../src/tools/engines/images/plainBackground';

function solid(width: number, height: number, rgba: [number, number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set(rgba, i * 4);
  return { width, height, data };
}
function px(image: PixelImage, x: number, y: number): number[] {
  const o = (y * image.width + x) * 4;
  return [image.data[o]!, image.data[o + 1]!, image.data[o + 2]!, image.data[o + 3]!];
}
function must(result: ReturnType<typeof downscalePixelImage>) {
  assert.equal(result.ok, true, result.ok ? '' : result.message);
  if (!result.ok) throw new Error('unreachable');
  assert.equal(validatePixelImage(result.image).ok, true, 'every output must pass the shared pixel contract');
  return result;
}

// 1. Whole-number factor, hand-computed: 4x4 -> 2x2; each 2x2 block becomes its exact mean (green = 255 - red).
const grid = solid(4, 4, [0, 0, 0, 255]);
[10, 20, 100, 110, 30, 40, 120, 130, 50, 60, 140, 150, 70, 80, 160, 170].forEach((v, i) => {
  grid.data[i * 4] = v;
  grid.data[i * 4 + 1] = 255 - v;
});
const gridCopy = new Uint8ClampedArray(grid.data);
const r1 = must(downscalePixelImage(grid, { maxPixels: 4 }));
assert.equal(r1.changed, true);
assert.equal(r1.image.width, 2);
assert.equal(r1.image.height, 2);
assert.deepEqual(px(r1.image, 0, 0), [25, 230, 0, 255]); // (10+20+30+40)/4
assert.deepEqual(px(r1.image, 1, 0), [115, 140, 0, 255]); // (100+110+120+130)/4
assert.deepEqual(px(r1.image, 0, 1), [65, 190, 0, 255]); // (50+60+70+80)/4
assert.deepEqual(px(r1.image, 1, 1), [155, 100, 0, 255]); // (140+150+160+170)/4
assert.deepEqual(grid.data, gridCopy, 'the input must not change');
assert.notEqual(r1.image.data, grid.data, 'a shrunk image is a new buffer');
assert.equal(r1.scaleX, 0.5);
assert.equal(r1.scaleY, 0.5);

// 2. Fractional edges, hand-computed: 3x3 -> 2x2, each output pixel covers 1.5 x 1.5 source pixels (area 2.25).
const nine = solid(3, 3, [0, 0, 0, 255]);
[0, 10, 20, 30, 40, 50, 60, 70, 80].forEach((v, i) => {
  nine.data[i * 4] = v;
  nine.data[i * 4 + 1] = 255 - v;
});
const r2 = must(downscalePixelImage(nine, { maxPixels: 4 }));
assert.equal(r2.image.width, 2);
assert.equal(r2.image.height, 2);
assert.deepEqual(px(r2.image, 0, 0), [13, 242, 0, 255]); // 30 / 2.25 = 13.33
assert.deepEqual(px(r2.image, 1, 0), [27, 228, 0, 255]); // 60 / 2.25 = 26.67
assert.deepEqual(px(r2.image, 0, 1), [53, 202, 0, 255]); // 120 / 2.25 = 53.33
assert.deepEqual(px(r2.image, 1, 1), [67, 188, 0, 255]); // 150 / 2.25 = 66.67

// 3. Transparency: colour hidden under transparent pixels must not bleed (premultiplied averaging).
const ghost = solid(4, 4, [200, 100, 255, 0]); // hidden colour under alpha 0
ghost.data.set([100, 50, 0, 255], 0);
ghost.data.set([100, 50, 0, 255], 4);
const r3 = must(downscalePixelImage(ghost, { maxPixels: 4 }));
assert.deepEqual(px(r3.image, 0, 0), [100, 50, 0, 128]); // two opaque pixels of four: alpha 127.5 -> 128, colour stays exactly theirs (nothing from the hidden colour)
assert.deepEqual(px(r3.image, 1, 0), [0, 0, 0, 0]); // fully transparent stays fully transparent, no hidden colour
assert.deepEqual(px(r3.image, 1, 1), [0, 0, 0, 0]);

// 4. A phone-sized image fits the contract, and a flat colour stays exactly flat.
const big = solid(3000, 2000, [12, 200, 99, 255]);
const r4 = must(downscalePixelImage(big));
assert.equal(r4.image.width, 2449); // floor(3000 * sqrt(4,000,000 / 6,000,000))
assert.equal(r4.image.height, 1632);
assert.ok(r4.image.width * r4.image.height <= 4_000_000);
let flatOk = true;
for (let i = 0; i < r4.image.data.length; i += 4) {
  if (r4.image.data[i] !== 12 || r4.image.data[i + 1] !== 200 || r4.image.data[i + 2] !== 99 || r4.image.data[i + 3] !== 255) { flatOk = false; break; }
}
assert.equal(flatOk, true, 'a flat colour must stay exactly flat');

// 5. A hard edge lands on exactly the right share: left half 0, right half 255 on a 3000-wide image.
const split = solid(3000, 2000, [0, 0, 0, 255]);
for (let y = 0; y < 2000; y += 1) for (let x = 1500; x < 3000; x += 1) split.data[(y * 3000 + x) * 4] = 255;
const r5 = must(downscalePixelImage(split));
const stepX = 3000 / 2449;
const edge = Math.floor(1500 / stepX); // 1224: the one output column that straddles x = 1500
assert.equal(px(r5.image, edge - 1, 7)[0], 0);
assert.equal(px(r5.image, edge, 7)[0], Math.round(255 * ((edge + 1) * stepX - 1500) / stepX));
assert.equal(px(r5.image, edge + 1, 1500)[0], 255);

// 6. The side ceiling applies on its own (a long thin image), in both directions.
const wide = solid(16384, 2, [0, 0, 0, 255]);
for (let x = 1; x < 16384; x += 2) { wide.data[x * 4] = 200; wide.data[(16384 + x) * 4] = 200; }
const r6 = must(downscalePixelImage(wide));
assert.equal(r6.image.width, 8192);
assert.equal(r6.image.height, 2);
assert.deepEqual(px(r6.image, 100, 1), [100, 0, 0, 255]);
const tall = must(downscalePixelImage(solid(2, 16384, [5, 6, 7, 255])));
assert.equal(tall.image.width, 2);
assert.equal(tall.image.height, 8192);

// 7. Images that already fit are returned as the same object; one pixel row over is shrunk to fit.
const fits = solid(2000, 2000, [1, 2, 3, 255]);
const r7 = must(downscalePixelImage(fits));
assert.equal(r7.changed, false);
assert.equal(r7.image, fits);
assert.equal(r7.scaleX, 1);
const over = must(downscalePixelImage(solid(2001, 2000, [1, 2, 3, 255])));
assert.equal(over.changed, true);
assert.equal(over.image.width, 2000);
assert.equal(over.image.height, 1999);
assert.equal(needsDownscale(2000, 2000), false);
assert.equal(needsDownscale(2001, 2000), true);
assert.equal(needsDownscale(8193, 2), true);
assert.equal(needsDownscale(4000, 3000), true);

// 8. Caller targets: smaller pixel or side ceilings.
const hundred = must(downscalePixelImage(solid(100, 100, [9, 9, 9, 255]), { maxPixels: 2500 }));
assert.equal(hundred.image.width, 50);
assert.equal(hundred.image.height, 50);
const sideOnly = must(downscalePixelImage(solid(100, 40, [9, 9, 9, 255]), { maxSide: 50 }));
assert.equal(sideOnly.image.width, 50);
assert.equal(sideOnly.image.height, 20);

// 9. Refusals: oversized input is refused before the buffer is touched; bad images and bad options are named.
assert.equal(DOWNSCALE_INPUT_LIMITS.maxPixels, 24_000_000);
assert.equal(DOWNSCALE_INPUT_LIMITS.maxSide, 16_384);
const tooBig = downscalePixelImage({ width: 5000, height: 5000, data: new Uint8ClampedArray(4) });
assert.equal(tooBig.ok, false);
if (!tooBig.ok) assert.equal(tooBig.error, 'image-too-large');
const tooWide = downscalePixelImage({ width: 16385, height: 2, data: new Uint8ClampedArray(4) });
assert.equal(tooWide.ok === false && tooWide.error, 'image-too-large');
const badImages: unknown[] = [null, 'text', { width: 1, height: 4, data: new Uint8ClampedArray(16) }, { width: 2.5, height: 4, data: new Uint8ClampedArray(40) },
  { width: 4, height: 4, data: [1, 2, 3] }, { width: 4, height: 4, data: new Uint8ClampedArray(10) }];
for (const bad of badImages) {
  const result = downscalePixelImage(bad);
  assert.equal(result.ok === false && result.error, 'invalid-image');
}
for (const options of [{ maxPixels: 3 }, { maxPixels: 4_000_001 }, { maxPixels: 100.5 }, { maxPixels: Number.NaN }, { maxSide: 1 }, { maxSide: 8193 }]) {
  const result = downscalePixelImage(solid(8, 8, [0, 0, 0, 255]), options);
  assert.equal(result.ok === false && result.error, 'invalid-options');
}

// 10. Boxes found on the shrunk image map back onto the original, rounded outward and clamped.
assert.deepEqual(boxToSource({ x: 0, y: 1, width: 1, height: 1 }, r1), { x: 0, y: 2, width: 2, height: 2 });
assert.deepEqual(boxToSource({ x: 1, y: 1, width: 1, height: 1 }, r2), { x: 1, y: 1, width: 2, height: 2 });
assert.deepEqual(boxToSource({ x: 0, y: 0, width: 2, height: 2 }, r2), { x: 0, y: 0, width: 3, height: 3 });
assert.deepEqual(boxToSource({ x: 1, y: 1, width: 5, height: 5 }, r2), { x: 1, y: 1, width: 2, height: 2 });

// 11. End to end: a 6-megapixel photo-sized scene is refused by a Batch 1 engine until it passes through DOWNSCALE.
const scene = solid(3000, 2000, [245, 245, 245, 255]);
for (let y = 600; y < 1400; y += 1) for (let x = 1000; x < 2000; x += 1) scene.data.set([30, 60, 180, 255], (y * 3000 + x) * 4);
const direct = removePlainBackground(scene, { colorTolerance: 8, maxBorderResidual: 2 });
assert.equal(direct.ok === false && direct.error, 'image-too-large');
const small = must(downscalePixelImage(scene));
const cut = removePlainBackground(small.image, { colorTolerance: 8, maxBorderResidual: 2 });
assert.equal(cut.ok, true, cut.ok ? '' : cut.message);
if (cut.ok) {
  assert.equal(cut.mode, 'flat');
  assert.ok(cut.removedPixels > 2_000_000, 'the background around the square is removed');
  assert.equal(px(cut.image, 0, 0)[3], 0);
  assert.equal(px(cut.image, 1224, 816)[3], 255);
  assert.deepEqual(px(cut.image, 1224, 816).slice(0, 3), [30, 60, 180]);
}
console.log('DOWNSCALE:', `${r4.sourceWidth}x${r4.sourceHeight} -> ${r4.image.width}x${r4.image.height}`, '; hand-computed 4x4 and 3x3 exact; transparency kept; flat stays flat; edge share exact; side ceiling; limits at 4,000,000 / 4,002,000; refusals named; boxes map back; end to end through the plain-background engine');
