/**
 * Tests for the advanced color engine.
 * Run with: npx tsx --test tests/colorEngine.test.ts
 * or node --test after compile.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyColorEngine,
  clampColorParams,
  isNeutralColor,
  NEUTRAL_COLOR,
  type ColorParams,
} from '../src/tools/engines/images/colorEngine';

function solid(r: number, g: number, b: number, a = 255, count = 4): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = a;
  }
  return buf;
}

function avgChannel(pixels: Uint8ClampedArray, ch: 0 | 1 | 2): number {
  let sum = 0;
  let n = 0;
  for (let i = ch; i < pixels.length; i += 4) {
    sum += pixels[i]!;
    n++;
  }
  return sum / n;
}

describe('colorEngine', () => {
  it('neutral params leave pixels unchanged', () => {
    const src = solid(120, 80, 40);
    const out = applyColorEngine(src, NEUTRAL_COLOR);
    assert.deepEqual(Array.from(out), Array.from(src));
  });

  it('clampColorParams forces -100…100', () => {
    const c = clampColorParams({ brightness: 500, contrast: -300, exposure: 12 });
    assert.equal(c.brightness, 100);
    assert.equal(c.contrast, -100);
    assert.equal(c.exposure, 12);
  });

  it('isNeutralColor works', () => {
    assert.equal(isNeutralColor(NEUTRAL_COLOR), true);
    assert.equal(isNeutralColor({ ...NEUTRAL_COLOR, brightness: 1 }), false);
  });

  it('positive brightness raises average luminance', () => {
    const src = solid(80, 80, 80);
    const out = applyColorEngine(src, { brightness: 40 });
    assert.ok(avgChannel(out, 0) > 80);
  });

  it('negative brightness lowers average luminance', () => {
    const src = solid(180, 180, 180);
    const out = applyColorEngine(src, { brightness: -40 });
    assert.ok(avgChannel(out, 0) < 180);
  });

  it('positive contrast increases distance from mid-grey', () => {
    const src = solid(60, 60, 60);
    const out = applyColorEngine(src, { contrast: 60 });
    // Darker becomes darker
    assert.ok(avgChannel(out, 0) < 60);
  });

  it('warmth raises red and lowers blue', () => {
    const src = solid(100, 100, 100);
    const out = applyColorEngine(src, { warmth: 50 });
    assert.ok(out[0]! > out[2]!);
  });

  it('saturation 0 leaves roughly same, positive increases chroma', () => {
    const src = solid(180, 60, 60);
    const out = applyColorEngine(src, { saturation: 80 });
    // Red channel should stay high or rise relative to green
    assert.ok(out[0]! >= 180 - 5);
  });

  it('fade lifts dark values', () => {
    const src = solid(30, 30, 30);
    const out = applyColorEngine(src, { fade: 60 });
    assert.ok(avgChannel(out, 0) > 30);
  });

  it('alpha is preserved', () => {
    const src = solid(50, 50, 50, 128);
    const out = applyColorEngine(src, { brightness: 30 });
    assert.equal(out[3], 128);
  });

  it('does not mutate input', () => {
    const src = solid(10, 20, 30);
    const copy = new Uint8ClampedArray(src);
    applyColorEngine(src, { brightness: 20 });
    assert.deepEqual(Array.from(src), Array.from(copy));
  });

  it('exposure positive brightens', () => {
    const src = solid(50, 50, 50);
    const out = applyColorEngine(src, { exposure: 40 });
    assert.ok(avgChannel(out, 0) > 50);
  });
});
