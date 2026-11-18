/**
 * Tests for pure image effects.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVignette,
  applyGrain,
  applySharpen,
  applyBlur,
  applyColorOverlay,
} from '../src/tools/engines/images/effects';
import { applyImageEdit, clampImageEditRequest, allFilterIds } from '../src/tools/engines/images/imageOps';

function solid(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

describe('effects', () => {
  it('vignette darkens corners relative to centre', () => {
    const w = 32,
      h = 32;
    const src = solid(w, h, 200, 200, 200);
    const out = applyVignette(src, w, h, { amount: 80, size: 70, softness: 30 });
    const centre = out[((h / 2) * w + w / 2) * 4]!;
    const corner = out[0]!;
    assert.ok(centre > corner, `centre ${centre} should be brighter than corner ${corner}`);
  });

  it('grain amount 0 is identity', () => {
    const src = solid(8, 8, 100, 100, 100);
    const out = applyGrain(src, 8, 8, { amount: 0 });
    assert.deepEqual(Array.from(out), Array.from(src));
  });

  it('grain is deterministic', () => {
    const src = solid(16, 16, 80, 80, 80);
    const a = applyGrain(src, 16, 16, { amount: 40, size: 40 });
    const b = applyGrain(src, 16, 16, { amount: 40, size: 40 });
    assert.deepEqual(Array.from(a), Array.from(b));
  });

  it('sharpen amount 0 is identity', () => {
    const src = solid(16, 16, 90, 90, 90);
    const out = applySharpen(src, 16, 16, { amount: 0 });
    assert.deepEqual(Array.from(out), Array.from(src));
  });

  it('blur radius 0 is identity', () => {
    const src = solid(12, 12, 50, 60, 70);
    const out = applyBlur(src, 12, 12, { radius: 0 });
    assert.deepEqual(Array.from(out), Array.from(src));
  });

  it('blur smooths a hard edge', () => {
    const w = 20,
      h = 10;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x < 10 ? 0 : 255;
        const i = (y * w + x) * 4;
        src[i] = src[i + 1] = src[i + 2] = v;
        src[i + 3] = 255;
      }
    }
    const out = applyBlur(src, w, h, { radius: 3 });
    // Pixel just left of the edge should no longer be pure 0
    const midLeft = out[(5 * w + 8) * 4]!;
    assert.ok(midLeft > 0, `expected some bleed, got ${midLeft}`);
  });

  it('color overlay at opacity 0 is identity', () => {
    const src = solid(4, 4, 30, 40, 50);
    const out = applyColorOverlay(src, { r: 255, g: 0, b: 0 }, 0);
    assert.deepEqual(Array.from(out), Array.from(src));
  });
});

describe('imageOps', () => {
  it('allFilterIds matches catalog length', () => {
    assert.ok(allFilterIds().length >= 40);
  });

  it('clampImageEditRequest clamps extremes', () => {
    const c = clampImageEditRequest({
      color: { brightness: 999 },
      filter: { id: 'mono', strength: 200 },
      blur: { radius: 99 },
    });
    assert.equal(c.color!.brightness, 100);
    assert.equal(c.filter!.strength, 100);
    assert.equal(c.blur!.radius, 12);
  });

  it('full stack runs without throwing', () => {
    const w = 24,
      h = 24;
    const src = solid(w, h, 100, 80, 60);
    const out = applyImageEdit(src, w, h, {
      color: { brightness: 10, contrast: 15, warmth: 20 },
      filter: { id: 'portra', strength: 60 },
      sharpen: { amount: 30 },
      grain: { amount: 15 },
      vignette: { amount: 40, size: 50, softness: 40 },
    });
    assert.equal(out.length, src.length);
    // Alpha preserved
    assert.equal(out[3], 255);
  });

  it('does not mutate input on full stack', () => {
    const w = 8,
      h = 8;
    const src = solid(w, h, 40, 50, 60);
    const copy = new Uint8ClampedArray(src);
    applyImageEdit(src, w, h, {
      color: { exposure: 20 },
      filter: { id: 'teal-orange', strength: 50 },
      blur: { radius: 1 },
    });
    assert.deepEqual(Array.from(src), Array.from(copy));
  });
});
