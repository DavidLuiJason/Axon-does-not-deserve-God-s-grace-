import JSZip from 'jszip';
import { createZip, listZip, extractEntry, validateEntryName, ZIP_TOOL_LIMITS } from '../src/tools/engines/files/zipTool';
let checks = 0; function ok(v: unknown, m: string) { checks++; if (!v) throw new Error(`FAIL ${m}`); }
async function main() {
 for (const name of ['../evil.txt', 'a/../evil', '/root', '\\root', 'C:/x', 'a\\b', '', 'a\u0001b']) ok(!validateEntryName(name).ok, `rejects unsafe name ${JSON.stringify(name)}`);
 ok(validateEntryName('folder/file.txt').ok, 'accepts safe relative path');
 const made = await createZip([{ name: 'hello.txt', bytes: new TextEncoder().encode('hello world') }, { name: 'folder/empty.txt', bytes: new Uint8Array() }], { store: false }); ok(made.ok, 'creates compressed ZIP'); if (!made.ok) throw new Error(made.message);
 const listed = await listZip(made.value); ok(listed.ok && listed.value.length === 2 && listed.value.find(e => e.name === 'hello.txt')?.size === 11, 'lists archive entries and sizes');
 const extracted = await extractEntry(made.value, 'hello.txt'); ok(extracted.ok && new TextDecoder().decode(extracted.value) === 'hello world', 'extracts selected entry bytes');
 const missing = await extractEntry(made.value, 'missing.txt'); ok(!missing.ok && missing.error === 'entry-not-found', 'missing entry is typed error');
 const store = await createZip([{ name: 'a.txt', bytes: new TextEncoder().encode('a') }], { store: true }); ok(store.ok, 'creates stored ZIP');
 const dup = await createZip([{ name: 'a//b.txt', bytes: new Uint8Array([1]) }, { name: 'a/b.txt', bytes: new Uint8Array([2]) }], { store: true }); ok(!dup.ok && dup.error === 'duplicate-name', 'reports duplicate normalized names');
 const bad = await listZip(new Uint8Array([1, 2, 3, 4])); ok(!bad.ok && bad.error === 'invalid-input', 'rejects too-short non-ZIP input');
 const corrupt = new Uint8Array(made.value); corrupt[0] = 0; const corruptResult = await listZip(corrupt); ok(!corruptResult.ok, 'rejects corrupt archive');
 const bombZip = new JSZip(); bombZip.file('bomb.txt', new Uint8Array(50000), { binary: true, compression: 'DEFLATE' }); const bomb = await bombZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
 // Alter the central and local declared uncompressed sizes to lie; actual inflation must still be checked.
 const lied = new Uint8Array(bomb); const view = new DataView(lied.buffer); for (let i = 0; i + 30 < lied.length; i++) { const sig = view.getUint32(i, true); if (sig === 0x04034b50) view.setUint32(i + 22, 1, true); else if (sig === 0x02014b50) view.setUint32(i + 24, 1, true); }
 const liedResult = await extractEntry(lied, 'bomb.txt', { maxBytes: 1000, maxCompressionRatio: 200 }); ok(!liedResult.ok, 'archive with lying declared size does not extract successfully');
 const ratioZip = new JSZip(); ratioZip.file('repeat.txt', 'A'.repeat(50000)); const ratioBytes = await ratioZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }); const ratio = await listZip(ratioBytes); ok(!ratio.ok && ratio.error === 'compression-ratio', 'rejects declared compression ratio above 200:1');
 ok(ZIP_TOOL_LIMITS.maxEntries === 5000 && ZIP_TOOL_LIMITS.maxUncompressedBytes === 200 * 1024 * 1024, 'publishes explicit resource caps');
 // Director additions: the streaming cap must stop a lying archive EARLY (the header says 1 byte, the data is 60 MB) and files must not gain folder entries.
 { const big = new JSZip(); big.file('bomb.bin', new Uint8Array(60 * 1024 * 1024), { binary: true, compression: 'DEFLATE' }); const bz = await big.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const liar = new Uint8Array(bz); const dv = new DataView(liar.buffer); for (let i = 0; i + 30 < liar.length; i++) { const sig = dv.getUint32(i, true); if (sig === 0x04034b50) dv.setUint32(i + 22, 1, true); else if (sig === 0x02014b50) dv.setUint32(i + 24, 1, true); }
  const t0 = Date.now(); const r = await extractEntry(liar, 'bomb.bin', { maxBytes: 1024 * 1024, maxCompressionRatio: 200 }); const ms = Date.now() - t0;
  ok(!r.ok && (r.error === 'too-large' || r.error === 'compression-ratio'), 'a 60 MB lying archive is stopped by the streaming cap (' + (r.ok ? 'extracted' : r.error) + ')'); ok(ms < 5000, 'the lying archive is stopped quickly (' + ms + ' ms)');
  const honest = await extractEntry(bz, 'bomb.bin', { maxBytes: 1024 * 1024 }); ok(!honest.ok && honest.error === 'too-large', 'an honest 60 MB archive is refused by the declared size'); }
 { const m = await createZip([{ name: 'x/y/z.txt', bytes: new Uint8Array([1]) }], { store: false }); ok(m.ok, 'nested name creates'); if (m.ok) { const l = await listZip(m.value); ok(l.ok && l.value.length === 1 && l.value[0].name === 'x/y/z.txt', 'no automatic folder entries'); } }
 { const m = await createZip([{ name: 'big.txt', bytes: new Uint8Array(1000).fill(65) }, { name: 'rand.bin', bytes: Uint8Array.from({ length: 2000 }, (_, i) => (i * 7919 + 13) % 256) }], { store: false }); ok(m.ok, 'creates for round trip'); if (m.ok) { const a = await extractEntry(m.value, 'rand.bin'); ok(a.ok && a.value.length === 2000 && a.value[5] === (5 * 7919 + 13) % 256, 'round trip keeps every byte'); const e0 = await extractEntry(m.value, 'big.txt'); ok(e0.ok && e0.value.length === 1000, 'compressible entry within the ratio cap extracts'); } }
 // Director additions (2): encrypted flag, zip-slip inside a hand-made archive, entry-count cap, garbage input.
 { const e = new JSZip(); e.file('secret.txt', 'hello hello hello hello'); const eb = await e.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }); const enc = new Uint8Array(eb); const v = new DataView(enc.buffer);
  for (let i = 0; i + 30 < enc.length; i++) { const sig = v.getUint32(i, true); if (sig === 0x04034b50) v.setUint16(i + 6, v.getUint16(i + 6, true) | 1, true); else if (sig === 0x02014b50) v.setUint16(i + 8, v.getUint16(i + 8, true) | 1, true); }
  const x = await extractEntry(enc, 'secret.txt'); ok(!x.ok && x.error === 'encrypted-entry', 'encrypted entry refused in plain terms'); const l = await listZip(enc); ok(l.ok && l.value[0].encrypted === true, 'listing marks the entry as encrypted'); }
 { const s = new JSZip(); s.file('../evil.txt', 'x'); const sb = await s.generateAsync({ type: 'uint8array' }); const l = await listZip(sb); ok(!l.ok && l.error === 'invalid-name', 'a hand-made zip-slip archive is refused when listed'); const x = await extractEntry(sb, '../evil.txt'); ok(!x.ok && x.error === 'invalid-name', 'zip-slip names cannot be extracted'); }
 { const many = new JSZip(); for (let i = 0; i < 5001; i++) many.file('f' + i, '', { createFolders: false }); const mb = await many.generateAsync({ type: 'uint8array', compression: 'STORE' }); const l = await listZip(mb); ok(!l.ok && l.error === 'too-many-entries', 'more than 5,000 entries refused'); }
 { for (const junk of [new Uint8Array(100), new Uint8Array(100).fill(0x50), crypto.getRandomValues(new Uint8Array(500))]) { const l = await listZip(junk); ok(!l.ok, 'garbage is refused when listed'); const x = await extractEntry(junk, 'a'); ok(!x.ok, 'garbage is refused when extracted'); } }
 console.log(`zipTool.test.ts: ${checks} checks passed`);
}
main().catch(e => { console.error(e); throw e; });
