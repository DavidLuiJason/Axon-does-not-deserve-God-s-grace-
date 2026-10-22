import assert from 'node:assert/strict';
import { compareBytes, compareStreams, hexContext, compareText, comparePixels, overlay, FILE_COMPARE_LIMITS } from '../src/tools/engines/files/fileCompare';

function independent(a: Uint8Array, b: Uint8Array) { let n = Math.abs(a.length - b.length), first: number | null = null; const ranges: number[][] = []; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) { n++; if (first === null) first = i; const last = ranges[ranges.length - 1]; if (last && last[1] === i - 1) last[1] = i; else ranges.push([i, i]); } if (first === null && a.length !== b.length) first = Math.min(a.length, b.length); return { n, first, ranges }; }
function rng(seed: number) { let x = seed >>> 0; return () => { x = (1664525 * x + 1013904223) >>> 0; return x; }; }
const a = new Uint8Array(70_000), b = new Uint8Array(70_000); assert.equal((compareBytes(a, b) as any).identical, true);
for (const i of [65535, 65536, 69999]) b[i] = 1; const planted: any = compareBytes(a, b); assert.equal(planted.firstDifference, 65535); assert.equal(planted.differingBytes, 3); assert.deepEqual(planted.ranges, [{ start: 65535, end: 65536, length: 2 }, { start: 69999, end: 69999, length: 1 }]);
assert.equal((compareBytes(new Uint8Array(), new Uint8Array()) as any).identical, true); assert.equal((compareBytes(new Uint8Array(), new Uint8Array([1, 2])) as any).differingBytes, 2); assert.equal((compareBytes(new Uint8Array([1, 2]), new Uint8Array()) as any).tail.side, 'a'); assert.equal((compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3])) as any).differingBytes, 1);
const manyA = new Uint8Array(3000), manyB = new Uint8Array(3000); for (let i = 0; i < 2500; i += 2) manyB[i] = 1; const many: any = compareBytes(manyA, manyB); assert.equal(many.ranges.length, 1000); assert.equal(many.moreRanges, 250);
const seeded = rng(0xC06); for (let t = 0; t < 250; t++) { const al = seeded() % 100, bl = seeded() % 100, aa = new Uint8Array(al), bb = new Uint8Array(bl); for (let i = 0; i < al; i++) aa[i] = seeded() & 255; for (let i = 0; i < bl; i++) bb[i] = seeded() & 255; const expected = independent(aa, bb), got: any = compareBytes(aa, bb); assert.equal(got.differingBytes, expected.n); assert.equal(got.firstDifference, expected.first); assert.equal(got.identical, expected.n === 0); assert.deepEqual(got.ranges.map((r: any) => [r.start, r.end]), expected.ranges); }
const mkReader = (data: Uint8Array) => ({ size: data.length, read: async (o: number, l: number) => data.slice(o, o + l) });
(async () => {
 const stream = await compareStreams(mkReader(a), mkReader(b), { chunkSize: 65536 }); assert.equal((stream as any).differingBytes, 3); let calls = 0; const cancelled = await compareStreams(mkReader(a), mkReader(b), { chunkSize: 1000, shouldCancel: () => ++calls > 1 }); assert.equal((cancelled as any).error, 'cancelled'); const broken = await compareStreams({ size: 1, read: async () => { throw new Error('x'); } }, mkReader(new Uint8Array([0]))); assert.equal((broken as any).error, 'reader-failed');
 const ctx: any = hexContext(new Uint8Array([1]), new Uint8Array([2]), 0, 1, 0); assert.equal(ctx[0].different[0], true); const txt: any = compareText('a\nb\n', 'a\nc\nd\n'); assert.equal(txt.ok, true); assert.equal(txt.changedLines, 1); assert.equal(txt.addedLines, 1); assert.equal(txt.differences[0].positionA.line, 2); assert.equal(txt.differences[0].positionA.column, 1); assert.equal((compareText('x'.repeat(100_001), '') as any).error, 'too-large');
 const img = (data: number[]) => ({ width: 2, height: 2, data: new Uint8ClampedArray(data) }); const px: any = comparePixels(img(Array(16).fill(0)), img([0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0])); assert.equal(px.differingPixels, 1); assert.deepEqual(px.boundingBox, { x: 1, y: 1, width: 1, height: 1 }); assert.equal((comparePixels(img(Array(16).fill(0)), img([1,0,0,0,...Array(12).fill(0)]), { tolerance: 1 }) as any).differingPixels, 0); assert.equal((overlay(img(Array(16).fill(0)), px.diffMask) as Uint8ClampedArray)[12], 255); assert.equal((comparePixels({ width: 5000, height: 5000, data: new Uint8ClampedArray(0) }, img(Array(16).fill(0))) as any).error, 'too-large'); assert.equal(FILE_COMPARE_LIMITS.maxPixels, 24_000_000); 
// Director additions: text positions and counts for multi-line changed blocks (the returned version paired only one line per block).
// Expected values are built from the plan below, not from the engine: unique line texts, blocks of r removed and a added lines between equal lines.
{
  let seed = 4242; const rnd = (n: number): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return Math.floor(seed / 2 ** 32 * n); };
  for (let round = 0; round < 200; round++) {
    const A: string[] = [], B: string[] = []; const expected: string[] = []; let counter = 0, ca = 0, cr = 0, cd = 0;
    const same = (): void => { const n = 1 + rnd(3); for (let i = 0; i < n; i++) { const t = `S${counter++}`; A.push(t); B.push(t); } };
    same();
    for (let b = rnd(5); b >= 0; b--) {
      let r = rnd(4), a = rnd(4); if (r === 0 && a === 0) a = 1;
      const startA = A.length, startB = B.length; const rl: string[] = [], al: string[] = [];
      for (let i = 0; i < r; i++) rl.push(`R${counter++}`); for (let i = 0; i < a; i++) al.push(`N${counter++}`);
      A.push(...rl); B.push(...al); const n = Math.min(r, a);
      for (let k = 0; k < n; k++) { expected.push(`change ${startA + k + 1} ${startB + k + 1}`); cd++; }
      for (let k = n; k < r; k++) { expected.push(`remove ${startA + k + 1} ${startB + n + 1}`); cr++; }
      for (let k = n; k < a; k++) { expected.push(`add ${startA + n + 1} ${startB + k + 1}`); ca++; }
      same();
    }
    const got = compareText(A.join('\n'), B.join('\n'));
    assert.equal(got.ok, true);
    if (got.ok) { assert.deepEqual(got.differences.map(d => `${d.type} ${d.positionA.line} ${d.positionB.line}`), expected); assert.equal(got.addedLines, ca); assert.equal(got.removedLines, cr); assert.equal(got.changedLines, cd); }
  }
  const moved = compareText('x\ny\nz', 'y\nz\nx'); assert.equal(moved.ok && moved.removedLines, 1); assert.equal(moved.ok && moved.addedLines, 1); assert.equal(moved.ok && moved.changedLines, 0);
  const col = compareText('l1\nl2\nl3\nl4', 'l1\nl2x\nl3x\nl4'); assert.equal(col.ok && col.changedLines, 2); assert.deepEqual(col.ok && col.differences.map(d => [d.positionA.line, d.positionA.column, d.positionB.line, d.positionB.column]), [[2, 3, 2, 3], [3, 3, 3, 3]]);
}
console.log('fileCompare: PASS (250 seeded independent pairs plus boundary, cancellation, reader, text and pixel cases)');
})();
