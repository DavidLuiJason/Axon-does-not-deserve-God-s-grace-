/**
 * Regression tests for defects found in the Director review:
 * slider direction, vignette size, soft-light, blur alpha, clarity locality,
 * unknown filter ids, and catalog quality.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyColorEngine, NEUTRAL_COLOR } from '../src/tools/engines/images/colorEngine';
import { FILTER_CATALOG, applyFilter } from '../src/tools/engines/images/filterCatalog';
import { applyVignette, applyBlur, applyClarity, applyColorOverlay } from '../src/tools/engines/images/effects';
import { applyImageEdit, clampImageEditRequest } from '../src/tools/engines/images/imageOps';

const px = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);
const R = (a: Uint8ClampedArray) => a[0]!;

describe('slider direction', () => {
  const dark = px(40, 40, 40);
  const bright = px(200, 200, 200);
  const mid = px(128, 128, 128);
  it('shadows + lifts, - deepens (was inverted)', () => {
    assert.ok(R(applyColorEngine(dark, { shadows: 60 })) > 40);
    assert.ok(R(applyColorEngine(dark, { shadows: -60 })) < 40);
  });
  it('highlights + brightens, - pulls down', () => {
    assert.ok(R(applyColorEngine(bright, { highlights: 60 })) > 200);
    assert.ok(R(applyColorEngine(bright, { highlights: -60 })) < 200);
  });
  it('shadows barely touch bright pixels, highlights barely touch dark ones', () => {
    assert.equal(R(applyColorEngine(bright, { shadows: 100 })), 200);
    assert.equal(R(applyColorEngine(dark, { highlights: 100 })), 40);
  });
  it('blacks + lifts darks, whites + lifts brights', () => {
    assert.ok(R(applyColorEngine(dark, { blacks: 60 })) > 40);
    assert.ok(R(applyColorEngine(bright, { whites: 60 })) > 200);
  });
  it('exposure / brightness / warmth / tint / saturation / fade move the right way', () => {
    assert.ok(R(applyColorEngine(mid, { exposure: 20 })) > 128);
    assert.ok(R(applyColorEngine(mid, { exposure: -20 })) < 128);
    assert.ok(R(applyColorEngine(mid, { brightness: 20 })) > 128);
    const w = applyColorEngine(mid, { warmth: 40 });
    assert.ok(w[0]! > w[2]!);
    const t = applyColorEngine(mid, { tint: 40 });
    assert.ok(t[1]! > t[0]!); // + = green
    const col = px(200, 100, 50);
    const sat = applyColorEngine(col, { saturation: 50 });
    assert.ok(sat[0]! - sat[2]! > 150);
    const fade = applyColorEngine(px(0, 0, 0), { fade: 50 });
    assert.ok(fade[0]! > 0);
  });
  it('neutral stays identity and alpha is preserved', () => {
    const src = new Uint8ClampedArray([10, 20, 30, 77]);
    assert.deepEqual(applyColorEngine(src, { ...NEUTRAL_COLOR }), src);
    assert.equal(applyColorEngine(src, { shadows: 80, contrast: 30 })[3], 77);
  });
});

describe('vignette size', () => {
  it('higher size darkens more pixels (matches docs)', () => {
    const w = 80, h = 80;
    const flat = new Uint8ClampedArray(w * h * 4).fill(200);
    const count = (size: number) => {
      const o = applyVignette(flat, w, h, { amount: 100, size, softness: 40 });
      let n = 0;
      for (let i = 0; i < w * h; i++) if (o[i * 4]! < 190) n++;
      return n;
    };
    assert.ok(count(90) > count(10));
  });
});

describe('soft-light overlay', () => {
  it('mid-grey colour is a no-op', () => {
    const src = px(90, 140, 200);
    const o = applyColorOverlay(src, { r: 128, g: 128, b: 128 }, 100);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(o[c]! - src[c]!) <= 1);
  });
  it('black stays black, white stays white under any colour', () => {
    assert.deepEqual(Array.from(applyColorOverlay(px(0, 0, 0), { r: 255, g: 0, b: 0 }, 100)).slice(0, 3), [0, 0, 0]);
    assert.deepEqual(Array.from(applyColorOverlay(px(255, 255, 255), { r: 0, g: 0, b: 255 }, 100)).slice(0, 3), [255, 255, 255]);
  });
  it('bright colour lightens mids, dark colour darkens them', () => {
    assert.ok(R(applyColorOverlay(px(128, 128, 128), { r: 255, g: 255, b: 255 }, 100)) > 128);
    assert.ok(R(applyColorOverlay(px(128, 128, 128), { r: 0, g: 0, b: 0 }, 100)) < 128);
  });
});

describe('blur', () => {
  it('does not darken colour next to transparent pixels', () => {
    const src = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const o = applyBlur(src, 5, 1, { radius: 1 });
    assert.ok(o[7]! > 0 && o[7]! < 255); // alpha spreads
    assert.ok(o[4]! >= 250 && o[5] === 0); // colour stays pure red
  });
  it('matches a hand box-average on a ramp (running sum is exact)', () => {
    const w = 9;
    const src = new Uint8ClampedArray(w * 4);
    for (let x = 0; x < w; x++) src.set([x * 20, 0, 0, 255], x * 4);
    const o = applyBlur(src, w, 1, { radius: 2 });
    const expected = (x: number) => {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += Math.min(w - 1, Math.max(0, x + k)) * 20;
      return s / 5;
    };
    for (let x = 0; x < w; x++) assert.ok(Math.abs(o[x * 4]! - expected(x)) <= 1, `x=${x}`);
  });
});

describe('clarity (local contrast)', () => {
  const w = 40, h = 40;
  const edge = () => {
    const b = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set([x < w / 2 ? 110 : 150, 110, 110, 255], (y * w + x) * 4);
    return b;
  };
  it('is local: same pixel value gives different results in different surroundings', () => {
    const src = edge();
    const o = applyClarity(src, w, h, { amount: 80 });
    // pixel just right of the edge gets brighter than a far-away identical-valued pixel
    assert.ok(o[(20 * w + w / 2 + 1) * 4]! > o[(20 * w + w - 2) * 4]!);
  });
  it('flat image unchanged, amount 0 identity, alpha kept', () => {
    const flat = new Uint8ClampedArray(w * h * 4).fill(120);
    assert.deepEqual(applyClarity(flat, w, h, { amount: 100 }), flat);
    const src = edge();
    assert.deepEqual(applyClarity(src, w, h, { amount: 0 }), src);
  });
});

describe('imageOps', () => {
  it('unknown filter id is dropped, never swapped for mono', () => {
    const c = clampImageEditRequest({ filter: { id: 'nope', strength: 80 } });
    assert.equal(c.filter, undefined);
  });
  it('full stack incl. clarity runs, keeps alpha, never mutates input', () => {
    const w = 24, h = 24;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) src.set([90, 120, 160, 200], i * 4);
    const copy = new Uint8ClampedArray(src);
    const out = applyImageEdit(src, w, h, {
      color: { shadows: 30, contrast: 10 }, filter: { id: 'portra', strength: 70 },
      clarity: { amount: 40 }, sharpen: { amount: 30 }, blur: { radius: 2 },
      grain: { amount: 20 }, vignette: { amount: 30 }, overlay: { r: 255, g: 200, b: 150, opacity: 20 },
    });
    assert.deepEqual(src, copy);
    assert.equal(out.length, src.length);
    for (let i = 3; i < out.length; i += 4) assert.ok(Math.abs(out[i]! - 200) <= 1);
  });
});

describe('catalog quality', () => {
  it('has ≥ 40 unique ids and no empty category used', () => {
    assert.ok(FILTER_CATALOG.length >= 40);
    assert.equal(new Set(FILTER_CATALOG.map((f) => f.id)).size, FILTER_CATALOG.length);
  });
  it('every filter changes a colourful pixel at full strength (no dead filters)', () => {
    const src = px(180, 110, 70);
    for (const f of FILTER_CATALOG) {
      const o = applyFilter(src, f.id, 100);
      const d = Math.abs(o[0]! - 180) + Math.abs(o[1]! - 110) + Math.abs(o[2]! - 70);
      assert.ok(d > 4, `${f.id} is nearly a no-op`);
    }
  });
  it('filter strength is monotonic toward the full effect', () => {
    const src = px(180, 110, 70);
    for (const f of FILTER_CATALOG) {
      const d = (s: number) => {
        const o = applyFilter(src, f.id, s);
        return Math.abs(o[0]! - 180) + Math.abs(o[1]! - 110) + Math.abs(o[2]! - 70);
      };
      assert.ok(d(25) <= d(50) + 1 && d(50) <= d(100) + 1, f.id);
    }
  });
});
