import assert from 'node:assert/strict';
import { detectConvertible, targetsFor, planFileConversion, FILE_CONVERTER_DESCRIPTOR } from '../src/tools/engines/files/fileConvertPlan';
const bytes = (s: string) => new TextEncoder().encode(s);
const file = (name: string, head: Uint8Array, size = head.length) => ({ name, head, size });
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
assert.equal(FILE_CONVERTER_DESCRIPTOR.toolId, 'file-converter');
assert.deepEqual(targetsFor('data-formats','json').sort(), ['csv','tsv','xml','yaml']);
assert.ok(!targetsFor('image','png').includes('svg'));
let d = detectConvertible(file('hello.json', bytes('{"a":1}')));
assert.equal(d.ok, true); if (d.ok) { assert.equal(d.family, 'data'); assert.equal(d.formatId, 'json'); }
d = detectConvertible(file('wrong.json', png));
assert.equal(d.ok, true); if (d.ok) { assert.equal(d.family, 'image'); assert.equal(d.formatId, 'png'); assert.ok(d.warnings.length > 0); }
d = detectConvertible(file('document.pdf', bytes('%PDF-1.7')));
assert.equal(d.ok, true); if (d.ok) { assert.equal(d.family, 'unsupported'); assert.match(d.reason, /PDF.*cannot convert/i); }
assert.equal(detectConvertible(file('x.json', new Uint8Array(4097))).ok, false);
assert.equal(detectConvertible(file('x.json', bytes('{}'), -1)).ok, false);
let p = planFileConversion(file('report.final.json', bytes('{"x":1}')), 'yaml');
assert.equal(p.ok, true); if (p.ok) { assert.equal(p.outputName, 'report.final.yaml'); assert.equal(p.outputMime, 'application/yaml'); assert.equal(p.mode, 'text'); assert.ok(p.losses.length > 0); }
p = planFileConversion(file('..\\bad\u0000name.json', bytes('{}')), 'csv');
assert.equal(p.ok, true); if (p.ok) { assert.ok(!/[\\/\u0000-\u001f]/.test(p.outputName)); assert.notEqual(p.outputName, '..\\bad\u0000name.json'); }
assert.equal(planFileConversion(file('a.json', bytes('{}')), 'json').ok, false);
assert.equal(planFileConversion(file('a.pdf', bytes('%PDF-')), 'txt').ok, false);
assert.equal(planFileConversion(file('a.csv', bytes('x'), 1_048_577), 'json').ok, false);
assert.equal(planFileConversion(file('x.png', png), 'webp', { width: 6000, height: 5000 }).ok, false);
console.log('fileConvertPlan: 14 assertions passed');
