/**
 * Tests for the expanded filter catalog.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTER_CATALOG,
  isKnownFilterId,
  getFilterDef,
  filtersByCategory,
  applyFilter,
  type FilterCategory,
} from '../src/tools/engines/images/filterCatalog';

function solid(r: number, g: number, b: number, count = 4): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

describe('filterCatalog', () => {
  it('has a substantial catalog (target ≥ 40)', () => {
    assert.ok(FILTER_CATALOG.length >= 40, `got ${FILTER_CATALOG.length}`);
  });

  it('all ids are unique', () => {
    const ids = FILTER_CATALOG.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('isKnownFilterId recognises every catalog entry and rejects unknowns', () => {
    for (const f of FILTER_CATALOG) {
      assert.equal(isKnownFilterId(f.id), true);
    }
    assert.equal(isKnownFilterId('not-a-real-filter'), false);
    assert.equal(isKnownFilterId(''), false);
  });

  it('getFilterDef returns correct labels', () => {
    const def = getFilterDef('teal-orange');
    assert.ok(def);
    assert.equal(def!.label, 'Teal & Orange');
    assert.equal(def!.category, 'cinematic');
  });

  it('filtersByCategory returns non-empty for main categories', () => {
    const cats: FilterCategory[] = ['film', 'cinematic', 'vintage', 'bw', 'mood', 'grade'];
    for (const c of cats) {
      const list = filtersByCategory(c);
      assert.ok(list.length >= 3, `${c} has only ${list.length}`);
    }
  });

  it('strength 0 leaves pixels unchanged', () => {
    const src = solid(90, 40, 20);
    for (const f of FILTER_CATALOG.slice(0, 8)) {
      const out = applyFilter(src, f.id, 0);
      assert.deepEqual(Array.from(out), Array.from(src), f.id);
    }
  });

  it('unknown id leaves pixels unchanged', () => {
    const src = solid(10, 20, 30);
    const out = applyFilter(src, 'does-not-exist', 80);
    assert.deepEqual(Array.from(out), Array.from(src));
  });

  it('mono produces equal RGB channels', () => {
    const src = solid(200, 50, 30);
    const out = applyFilter(src, 'mono', 100);
    assert.equal(out[0], out[1]);
    assert.equal(out[1], out[2]);
  });

  it('sepia is warmer than source (higher R relative to B)', () => {
    const src = solid(100, 100, 100);
    const out = applyFilter(src, 'sepia', 100);
    assert.ok(out[0]! > out[2]!);
  });

  it('does not mutate input', () => {
    const src = solid(11, 22, 33);
    const copy = new Uint8ClampedArray(src);
    applyFilter(src, 'vivid', 70);
    assert.deepEqual(Array.from(src), Array.from(copy));
  });

  it('alpha is preserved', () => {
    const src = solid(50, 50, 50);
    src[3] = 180;
    const out = applyFilter(src, 'cool', 50);
    assert.equal(out[3], 180);
  });

  it('every filter runs without throwing and stays in 0–255 range', () => {
    const src = solid(128, 64, 192);
    for (const f of FILTER_CATALOG) {
      const out = applyFilter(src, f.id, 100);
      for (let i = 0; i < out.length; i++) {
        assert.ok(out[i]! >= 0 && out[i]! <= 255, `${f.id} channel ${i}`);
      }
    }
  });
});
