import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScreenStructure } from '../src/screen-intelligence/structure-reader.mjs';
import { cleanPictureText, readPictures } from '../src/screen-intelligence/picture-reader.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const structure = (extra = []) => readScreenStructure({ packageName: 'p', screen: { width: 1000, height: 2000 }, nodes: [{ className: 'LinearLayout', children: [
  { className: 'android.widget.ImageView', contentDescription: 'Sign', bounds: { l: 0, t: 100, r: 1000, b: 700 } },
  { className: 'android.widget.TextView', text: 'Hello', bounds: { l: 0, t: 800, r: 300, b: 860 } }, ...extra] }] });
const source = (reply) => ({ recognizeRegions: async (regions) => (typeof reply === 'function' ? reply(regions) : reply) });

test('cleanPictureText tidies, removes card-like numbers, keeps other numbers, and cuts long text', () => {
  assert.equal(cleanPictureText('  SALE \n  50%  OFF '), 'SALE 50% OFF');
  assert.equal(cleanPictureText('Card 4111 1111 1111 1111 end'), 'Card [number removed] end');
  assert.equal(cleanPictureText('Order 1234 5678 9012 3456'), 'Order 1234 5678 9012 3456');
  assert.equal(cleanPictureText('x'.repeat(400), 300).length, 301);
});
test('text found in a picture is attached to the element, the region and the outline', async () => {
  const sent = [];
  const out = await readPictures(source((r) => { sent.push(...r); return { ok: true, regions: [{ ref: r[0].ref, text: 'OPEN 24 HOURS' }] }; }), structure());
  assert.deepEqual([out.pictureReading.ok, out.pictureReading.read, out.pictureReading.withText], [true, 1, 1]);
  assert.equal(out.elements[0].pictureText, 'OPEN 24 HOURS'); assert.equal(out.imageRegions[0].text, 'OPEN 24 HOURS');
  assert.match(out.outline, /Text found inside pictures:\n\[e1\] "OPEN 24 HOURS"/);
  assert.deepEqual(Object.keys(sent[0]).sort(), ['height', 'ref', 'width', 'x', 'y']);
});
test('card-like numbers in picture text never reach the outline', async () => {
  const out = await readPictures(source({ ok: true, regions: [{ ref: 'e1', text: 'Pay 4111111111111111' }] }), structure());
  assert.ok(!out.outline.includes('4111111111111111')); assert.match(out.outline, /\[number removed\]/);
});
test('no pictures, blocked or missing screens, and recogniser failures are reported, never thrown', async () => {
  const none = readScreenStructure({ packageName: 'p', screen: { width: 10, height: 10 }, nodes: [{ className: 'TextView', text: 'x' }] });
  assert.equal((await readPictures(source({}), none)).pictureReading.code, 'no-pictures');
  assert.equal((await readPictures(source({}), readScreenStructure({ packageName: 'p', nodes: [] }, { blockedPackages: ['p'] }))).pictureReading.code, 'no-screen');
  assert.equal((await readPictures(source({}), { ok: false })).pictureReading.code, 'no-screen');
  assert.equal((await readPictures(source({ ok: false, code: 'screen-protected' }), structure())).pictureReading.code, 'screen-protected');
  assert.equal((await readPictures(source(undefined), structure())).pictureReading.code, 'recognize-failed');
  const noSize = readScreenStructure({ packageName: 'p', nodes: [{ className: 'ImageView', bounds: { l: 0, t: 0, r: 500, b: 500 } }] });
  assert.equal((await readPictures(source({}), noSize)).pictureReading.code, 'no-screen-size');
});
test('only the biggest pictures are sent, up to the cap', async () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ className: 'ImageView', bounds: { l: 0, t: 900 + i * 90, r: 100 + i * 10, b: 980 + i * 90 } }));
  let sent = 0;
  await readPictures(source((r) => { sent = r.length; return { ok: true, regions: [] }; }), structure(many), { maxPictures: 5 });
  assert.equal(sent, 5);
});
test('Android OCR code never stores or sends pixels, and is wired into the build', () => {
  const dir = 'android-overlay/app/src/main/java/com/axon/app/screenstructure/';
  const ocr = read(`${dir}PictureTextReader.java`); const svc = read(`${dir}AxonAccessibilityService.java`); const plug = read(`${dir}ScreenStructurePlugin.java`);
  for (const bad of ['FileOutputStream', 'compress(', 'openFileOutput', 'Base64', 'getAbsolutePath']) assert.ok(!ocr.includes(bad) && !svc.includes(bad), `no ${bad}`);
  assert.match(ocr, /crop\.recycle\(\)/); assert.match(ocr, /recognizer\.close\(\)/); assert.match(svc, /ERROR_TAKE_SCREENSHOT_SECURE_WINDOW/);
  assert.match(plug, /public void recognizeRegions/);
  assert.match(read('android-overlay/app/src/main/res/xml/axon_accessibility_service.xml'), /canTakeScreenshot="true"/);
  const sh = read('scripts/apply-android-overlay.sh');
  assert.ok(sh.includes('PictureTextReader.java')); assert.ok(sh.includes('com.google.mlkit:text-recognition'));
});
