import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { canLoad, demote, findBlock, promote, SHELF_LIMITS, startupSelfCheck, validateManifest, verifyShelf, type ShelfManifest } from '../src/knowledge/shelf/shelfFormat';

const hash = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
const bytesA = new Uint8Array([65, 66, 67]);
const bytesB = new Uint8Array([68, 69]);
const manifest = (): ShelfManifest => ({
  shelfId: 'demo', title: 'Demo shelf', version: '1', state: 'CANDIDATE',
  sources: [{ name: 'Source A', licence: 'CC BY 4.0', retrieved: '2026-10-29' }],
  counts: { items: 3, blocks: 2 },
  blocks: [
    { id: 'a', file: 'a.bin', bytes: 3, sha256: hash(bytesA), items: 2 },
    { id: 'b', file: 'b.bin', bytes: 2, sha256: hash(bytesB), items: 1 },
  ],
  index: [{ blockId: 'a', firstKey: 'apple', lastKey: 'banana' }, { blockId: 'b', firstKey: 'carrot', lastKey: 'zebra' }],
  testSet: { file: 'known.json', sha256: 'a'.repeat(64) }, killSwitch: { off: false },
});
let checks = 0;
function test(name: string, fn: () => void): void { fn(); checks++; process.stdout.write(`PASS ${name}\n`); }

test('valid manifest and independent Node SHA-256', () => {
  assert.deepEqual(validateManifest(manifest()), []);
  assert.equal(hash(bytesA), 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78');
  assert.equal(hash(bytesB), '6814ef46f686990cf4e946f966167b0507e1d642c44e51f61bffb0bba2d4672b');
});
test('valid blocks verify; missing and size mismatch are named', () => {
  const m = manifest(); const r = verifyShelf(m, f => f === 'a.bin' ? bytesA : f === 'b.bin' ? bytesB : null, hash);
  assert.equal(r.ok, true); assert.equal(r.blocks.length, 2);
  const missing = verifyShelf(m, f => f === 'a.bin' ? bytesA : null, hash);
  assert.equal(missing.blocks[1].missing, true); assert.match(missing.blocks[1].message, /b/);
  const size = verifyShelf(m, f => f === 'a.bin' ? new Uint8Array([1]) : bytesB, hash);
  assert.equal(size.blocks[0].sizeDiffers, true); assert.match(size.blocks[0].message, /a/);
});
test('one flipped byte is detected as tampering', () => {
  const m = manifest(); const flipped = new Uint8Array([65, 66, 64]);
  const r = verifyShelf(m, f => f === 'a.bin' ? flipped : bytesB, hash);
  assert.equal(r.blocks[0].tampered, true); assert.match(r.blocks[0].message, /a\.bin/);
});
test('findBlock binary search and misses', () => {
  const ix = manifest().index;
  assert.equal(findBlock(ix, 'apple'), 'a'); assert.equal(findBlock(ix, 'banana'), 'a');
  assert.equal(findBlock(ix, 'carrot'), 'b'); assert.equal(findBlock(ix, 'cabbage'), null); assert.equal(findBlock(ix, ''), null);
});
test('wrong counts, duplicate ids, missing index, overlapping and unsorted ranges are caught', () => {
  const wrong = manifest(); wrong.counts.items = 999; wrong.blocks[1].id = 'a';
  wrong.index = [{ blockId: 'a', firstKey: 'apple', lastKey: 'carrot' }, { blockId: 'ghost', firstKey: 'banana', lastKey: 'zebra' }];
  const codes = validateManifest(wrong).map(g => g.code);
  for (const c of ['items-count-mismatch', 'duplicate-block-id', 'index-missing-block', 'overlapping-or-unsorted-index']) assert.ok(codes.includes(c), `missing ${c}`);
  const gap = manifest(); gap.index.pop(); assert.ok(validateManifest(gap).some(g => g.code === 'index-gap'));
  const unsorted = manifest(); unsorted.index.reverse(); assert.ok(validateManifest(unsorted).some(g => g.code === 'overlapping-or-unsorted-index'));
});
test('empty, malformed, hostile, oversized manifests never throw', () => {
  for (const hostile of [null, undefined, '', 4, [], {}, { ...manifest(), sources: [] }, { ...manifest(), sources: [{ name: 'x', licence: '', retrieved: 'x' }] }, { ...manifest(), blocks: Array.from({ length: SHELF_LIMITS.maxBlocks + 1 }, () => ({})) }, { ...manifest(), title: 'x'.repeat(SHELF_LIMITS.maxStringLength + 1) }]) {
    assert.doesNotThrow(() => validateManifest(hostile));
    assert.ok(validateManifest(hostile).length > 0);
  }
  assert.equal(validateManifest({ ...manifest(), blocks: Array.from({ length: 10_000 }, (_, i) => ({ id: `b${i}`, file: 'x', bytes: 0, sha256: '0'.repeat(64), items: 0 })), counts: { items: 0, blocks: 10_000 }, index: [] }).length > 0, true);
});
test('promotion requires independent confirmation and passed known-answer test', () => {
  const m = manifest();
  assert.equal(promote(m, 'ADMITTED', {}).ok, false);
  assert.equal(promote(m, 'CHECKED', { independentConfirmation: { sourceName: 'Source A', recordId: 'confirm-1', confirmed: true } }).ok, false);
  const result = promote(m, 'CHECKED', { independentConfirmation: { sourceName: 'Source A', recordId: 'confirm-1', confirmed: true }, knownAnswerTest: { testSetFile: 'known.json', passed: true, resultId: 'test-1' } });
  assert.equal(result.ok, true); if (result.ok) assert.equal(result.manifest.state, 'CHECKED');
  assert.equal(m.state, 'CANDIDATE'); assert.equal(promote(m, 'ADMITTED', {}).ok, false);
});
test('owner approval required for admission; legal promotion is immutable', () => {
  const m = manifest(); const c = promote(m, 'CHECKED', { independentConfirmation: { sourceName: 'Source A', recordId: 'confirm-1', confirmed: true }, knownAnswerTest: { testSetFile: 'known.json', passed: true, resultId: 'test-1' } });
  assert.equal(c.ok, true); if (!c.ok) return;
  assert.equal(promote(c.manifest, 'ADMITTED', {}).ok, false);
  const a = promote(c.manifest, 'ADMITTED', { ownerApproval: { sourceName: 'Source A', recordId: 'owner-1', approved: true } });
  assert.equal(a.ok, true); assert.equal(c.manifest.state, 'CHECKED'); if (a.ok) assert.equal(a.manifest.state, 'ADMITTED');
  assert.equal(promote(m, 'ADMITTED', { ownerApproval: { sourceName: 'Source A', recordId: 'owner-1', approved: true } }).ok, false);
});
test('kill switch blocks loading; demotion records reason in a new manifest', () => {
  const m = manifest(); m.state = 'ADMITTED'; assert.equal(canLoad(m), true);
  m.killSwitch = { off: true, reason: 'incident' }; assert.equal(canLoad(m), false);
  const d = demote(m, 'integrity concern'); assert.equal(d.ok, true); assert.equal(m.state, 'ADMITTED');
  if (d.ok) { assert.equal(d.manifest.state, 'CANDIDATE'); assert.equal(d.manifest.killSwitch.off, true); assert.equal(d.manifest.killSwitch.reason, 'integrity concern'); }
});
test('startup reports loaded, blocked, damaged and missing shelves by name', () => {
  const m = manifest(); m.state = 'ADMITTED';
  const good = verifyShelf(m, f => f === 'a.bin' ? bytesA : bytesB, hash);
  const off = { ...m, shelfId: 'paused', killSwitch: { off: true, reason: 'owner pause' } };
  const damaged = { ...m, shelfId: 'damaged', blocks: [{ ...m.blocks[0], sha256: '0'.repeat(64) }, m.blocks[1]] };
  const lines = startupSelfCheck([
    { name: 'good shelf', manifest: m, verify: good }, { name: 'paused shelf', manifest: off },
    { name: 'damaged shelf', manifest: damaged, verify: verifyShelf(damaged, f => f === 'a.bin' ? bytesA : bytesB, hash) },
    { name: 'missing shelf', manifest: null },
  ]);
  assert.match(lines[0], /good shelf loaded/); assert.match(lines[1], /paused shelf blocked/);
  assert.match(lines[2], /damaged shelf damaged/); assert.match(lines[3], /missing shelf blocked/);
});
test('mutant: ignoring kill switch fails; mutant: skipping hash comparison fails', () => {
  const m = manifest(); m.state = 'ADMITTED'; m.killSwitch.off = true;
  const mutantCanLoad = (x: ShelfManifest) => x.state === 'ADMITTED';
  assert.equal(mutantCanLoad(m), true); assert.equal(canLoad(m), false, 'kill-switch regression guard');
  const bad = manifest();
  const mutantVerify = (x: ShelfManifest) => x.blocks.every(b => b.bytes >= 0);
  assert.equal(mutantVerify(bad), true);
  const actual = verifyShelf(bad, f => f === 'a.bin' ? new Uint8Array([0, 0, 0]) : bytesB, hash);
  assert.equal(actual.blocks[0].tampered, true, 'hash regression guard');
});
// Director addition (C30 check): the quarantine rules themselves were untested (a broken build could load or promote a shelf in any state).
test('Director: only ADMITTED loads; promotion cannot skip a state', () => {
  const ev = { independentConfirmation: { sourceName: 'Source A', recordId: 'r1', confirmed: true }, knownAnswerTest: { testSetFile: 'known.json', passed: true, resultId: 't1' }, ownerApproval: { sourceName: 'Source A', recordId: 'o1', approved: true } };
  const c = manifest();
  assert.equal(canLoad(c), false, 'CANDIDATE must not load');
  assert.equal(promote(c, 'ADMITTED', ev).ok, false, 'CANDIDATE cannot jump to ADMITTED');
  assert.equal(promote(c, 'CHECKED', {}).ok, false, 'no evidence, no promotion');
  const p1 = promote(c, 'CHECKED', ev); if (!p1.ok) throw new Error('legal promotion refused');
  assert.equal(canLoad(p1.manifest), false, 'CHECKED must not load');
  assert.equal(promote(p1.manifest, 'ADMITTED', {}).ok, false, 'admission needs owner approval');
  const p2 = promote(p1.manifest, 'ADMITTED', ev); if (!p2.ok) throw new Error('legal admission refused');
  assert.equal(canLoad(p2.manifest), true, 'ADMITTED loads');
  assert.equal(promote(p2.manifest, 'CHECKED', ev).ok, false, 'no backwards promotion');
  assert.equal(c.state, 'CANDIDATE', 'the original manifest is unchanged');
});
process.stdout.write(`\nC30 shelfFormat: ${checks}/${checks} tests passed.\n`);
