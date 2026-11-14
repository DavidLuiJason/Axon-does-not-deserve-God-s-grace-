import test from 'node:test';
import assert from 'node:assert/strict';
import { readScreenStructure, listImageRegions, planCrops } from '../src/screen-intelligence/structure-reader.mjs';

const screen = { width: 1000, height: 2000 };
const snap = () => ({ packageName: 'p', screen, nodes: [{ className: 'LinearLayout', children: [
  { className: 'android.widget.ImageView', contentDescription: 'Product photo', bounds: { l: 0, t: 100, r: 1000, b: 700 } },
  { className: 'android.widget.ImageView', bounds: { l: 100, t: 800, r: 300, b: 1000 }, clickable: true },
  { className: 'android.widget.ImageView', bounds: { l: 10, t: 10, r: 30, b: 30 } },
  { className: 'android.widget.ImageView', bounds: { l: 0, t: 5000, r: 500, b: 5400 } },
  { className: 'android.widget.TextView', text: 'Caption', bounds: { l: 0, t: 720, r: 500, b: 780 } },
] }] });

test('images are kept as regions with position, size and the app-given label only', () => {
  const s = readScreenStructure(snap());
  assert.equal(s.imageRegions.length, 4);
  const photo = s.imageRegions.find((r) => r.label === 'Product photo');
  assert.deepEqual([photo.width, photo.height, photo.hasLabel, photo.screenShare], [1000, 600, true, 0.3]);
  const bare = s.imageRegions.find((r) => !r.hasLabel && r.tappable);
  assert.equal(bare.label, '');
});
test('nothing is recognised: no pixels, no guessed names', () => {
  const s = readScreenStructure(snap());
  assert.ok(s.imageRegions.every((r) => r.label === '' || r.label === 'Product photo'));
  assert.ok(!JSON.stringify(s).includes('data:image'));
});
test('crop plan scales to the frame, skips off-screen and tiny images, biggest first', () => {
  const s = readScreenStructure(snap());
  const { crops, reason } = planCrops(s, { frameWidth: 500, frameHeight: 1000 });
  assert.equal(reason, null);
  assert.deepEqual(crops.map((c) => [c.x, c.y, c.width, c.height]), [[0, 50, 500, 300], [50, 400, 100, 100]]);
  assert.equal(planCrops(s, { frameWidth: 500, frameHeight: 1000, minSize: 150 }).crops.length, 1);
});
test('crop plan fails safe without sizes, and caps the count', () => {
  const s = readScreenStructure(snap());
  assert.equal(planCrops(s, {}).reason, 'no-screen-size');
  assert.equal(planCrops({ imageRegions: [] }, { frameWidth: 1, frameHeight: 1 }).reason, 'no-screen-size');
  assert.equal(planCrops(s, { frameWidth: 1000, frameHeight: 2000, maxCrops: 1 }).crops.length, 1);
});
test('listImageRegions ignores non-images and empty shapes', () => {
  assert.deepEqual(listImageRegions([{ role: 'text', bounds: { l: 0, t: 0, r: 5, b: 5 }, actions: [] }, { role: 'image', bounds: { l: 5, t: 5, r: 5, b: 9 }, actions: [] }], screen), []);
  assert.deepEqual(listImageRegions(undefined, screen), []);
});
