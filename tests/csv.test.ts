import { parseCsv, writeCsv, rowsToObjects, objectsToRows } from '../src/tools/engines/data/csv';
let checks = 0; function ok(v: unknown, m: string) { checks++; if (!v) throw new Error(`FAIL ${m}`); }
function equal(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
const parsed = parseCsv('\uFEFFname,quote,lines\r\nAlice,"say ""hi""","a\r\nb"\r\nBob,x,🙂\n', { delimiter: ',', header: true });
ok(parsed.ok && parsed.rows.length === 3 && parsed.rows[1][1] === 'say "hi"' && parsed.rows[1][2] === 'a\r\nb', 'parses BOM, doubled quotes and embedded CRLF');
const semi = parseCsv('a;b\n1;2', { delimiter: ';', header: false }); ok(semi.ok && semi.rows.length === 2, 'parses semicolon delimiter and missing final newline');
const tsv = parseCsv('a\tb\n1\t2', { delimiter: '\t', header: false }); ok(tsv.ok && tsv.rows[1][1] === '2', 'parses TSV');
const bad = parseCsv('a,b\n"bad,x', { delimiter: ',', header: false }); ok(!bad.ok && bad.error === 'malformed-quote', 'rejects unterminated quote');
const warning = parseCsv('a,b\n1\n2,3,4', { delimiter: ',', header: false }); ok(warning.ok && warning.warnings.map(w => w.row).join(',') === '2,3', 'reports irregular row lengths by row number without padding');
const typed = parseCsv('12,true,false,null,001,1e3,hello', { delimiter: ',', header: false, detectTypes: true }); ok(typed.ok && typed.rows[0][0] === 12 && typed.rows[0][1] === true && typed.rows[0][2] === false && typed.rows[0][3] === null && typed.rows[0][4] === '001' && typed.rows[0][5] === 1000 && typed.rows[0][6] === 'hello', 'detects only exact number and literal values');
const rng = (() => { let x = 0xC15C15; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0x100000000; }; })(); const alphabet = ['plain', 'with,comma', 'say "hello"', 'line\nbreak', '🙂', 'مرحبا', '', '0', 'true', ' a '];
for (let i = 0; i < 300; i++) { const n = 1 + Math.floor(rng() * 7), rows: string[][] = []; for (let r = 0; r < n; r++) { const cols = 1 + Math.floor(rng() * 6); rows.push(Array.from({ length: cols }, () => alphabet[Math.floor(rng() * alphabet.length)])); } const w = writeCsv(rows, { delimiter: ',', header: false }); ok(w.ok, `random table ${i} writes`); if (w.ok) { const p = parseCsv(w.text, { delimiter: ',', header: false }); ok(p.ok && equal(p.rows, rows), `random table ${i} round-trips`); } }
const objs = objectsToRows([{ a: 1, b: 2 }, { b: 3, c: 4 }]); ok(objs.ok && equal(objs.rows, [['a', 'b', 'c'], [1, 2, ''], ['', 3, 4]]), 'objects use union of keys in first-seen order');
const back = rowsToObjects([['a', 'b'], [1, 2], [3]]); ok(back.ok && equal(back.rows, [{ a: 1, b: 2 }, { a: 3, b: '' }]), 'rows convert to objects with empty missing cells');
ok(!parseCsv('x'.repeat(1024 * 1024 + 1), { delimiter: ',', header: false }).ok, 'caps input bytes');
ok(!writeCsv([['x']], { delimiter: 'x' as ',' , header: false }).ok, 'rejects invalid writer delimiter at runtime');
console.log(`csv.test.ts: ${checks} checks passed`);
