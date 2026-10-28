import assert from 'node:assert/strict';
import { boxesToTable } from '../src/tools/engines/images/tableFromBoxes';
// Director audit: tables with left/right/centred columns, multi-word cells, empty cells and TIGHT gutters. A wrong table must never come back without a warning.
let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32; const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const words = ['Ada', 'Lagos', '36', 'Total', 'North', '1,250.50', 'Q3', 'Invoice', 'Paid', 'x', 'Revenue', '2026-10-28', 'Abuja', 'N/A', 'ok'];
function make(gutterH: number, jit: number) {
  const R = ri(3, 15), C = ri(2, 7), h = ri(12, 40), colW = Array.from({ length: C }, () => ri(4, 14) * h * 0.55), align = Array.from({ length: C }, () => ri(0, 2));
  const truth: string[][] = [], boxes: any[] = [], colX: number[] = []; let x0 = 20; for (let c = 0; c < C; c++) { colX.push(x0); x0 += colW[c] + gutterH * h; }
  for (let r = 0; r < R; r++) { const row: string[] = []; for (let c = 0; c < C; c++) {
    if (rnd() < 0.12 && r > 0) { row.push(''); continue; } const nw = ri(1, 2), ws = Array.from({ length: nw }, () => words[ri(0, words.length - 1)]), tw = ws.map(w => w.length * h * 0.55), total = tw.reduce((a, b) => a + b, 0) + (nw - 1) * h * 0.3;
    if (total > colW[c]) { row.push(''); continue; }
    let sx = colX[c] + (align[c] === 0 ? 0 : align[c] === 1 ? colW[c] - total : (colW[c] - total) / 2);
    ws.forEach((w, k) => { boxes.push({ text: w, x: sx, y: 20 + r * h * 2.2 + (rnd() - .5) * jit * h, w: tw[k], h: h * (1 + (rnd() - .5) * .1) }); sx += tw[k] + h * 0.3; }); row.push(ws.join(' ')); }
    truth.push(row); }
  return { boxes, truth };
}
let checks = 0;
for (const g of [3, 1.6, 1.2, 0.9]) for (const jit of [0, 0.2]) {
  let exact = 0, silent = 0; const N = 150;
  for (let t = 0; t < N; t++) { const { boxes, truth } = make(g, jit), keep = truth[0].map((_, c) => c).filter(c => truth.some(r => r[c] !== '')), exp = truth.map(r => keep.map(i => r[i])).filter(r => r.some(v => v !== ''));
    const res = boxesToTable(boxes); if (!res.ok) continue; if (JSON.stringify(res.rows) === JSON.stringify(exp)) exact++; else if (res.warnings.length === 0) silent++; }
  assert.equal(silent, 0, `silent wrong tables at gutter ${g}h jitter ${jit}`); assert.ok(exact >= N * 0.9, `exact ${exact}/${N} at gutter ${g}h jitter ${jit}`); checks += 2;
}
console.log(`tableFromBoxesAudit: PASS (${checks} checks; 1,200 tables incl. tight gutters, none wrong without a warning)`);
