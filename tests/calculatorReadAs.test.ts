// Director regression test (added after inspecting C19): the "read as" string must always mean the same
// as the value. A string that evaluates to something else is a silent misreading.
import { evaluate } from '../src/tools/engines/numbers/calculator';

let checks = 0;
function check(name: string, ok: boolean, detail = ''): void {
  checks++;
  if (!ok) throw new Error(`FAIL: ${name} ${detail}`);
}

// Tiny evaluator for the display notation: numbers, + − × ÷ ( ) mod ^ and unary minus. Test-only.
function evalDisplay(s: string): number {
  const js = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\^/g, '**').replace(/\bmod\b/g, '%');
  if (!/^[0-9eE+\-*/%().\s]+$/.test(js)) throw new Error('unexpected character in: ' + s);
  return Function(`"use strict"; return (${js});`)() as number;
}

// 1. Fixed cases found by the Director (each used to show a string that meant a DIFFERENT value).
const fixed: Array<[string, number, string]> = [
  ['100 - (50 + 10%)', 45, '100 − (50 + (50 × 10 ÷ 100))'],
  ['1000 - (200 + 5%)', 790, '1000 − (200 + (200 × 5 ÷ 100))'],
  ['100 + 10% + 10%', 121, '(100 + (100 × 10 ÷ 100)) + ((100 + (100 × 10 ÷ 100)) × 10 ÷ 100)'],
  ['2 * (100 + 10%)', 220, '2 × (100 + (100 × 10 ÷ 100))'],
  ['(100 + 10%) * 2', 220, '(100 + (100 × 10 ÷ 100)) × 2'],
  ['100 + (10 + 5%) of 2', 121, '100 + ((10 + (10 × 5 ÷ 100)) × 2)'],
];
for (const [expr, value, read] of fixed) {
  const r = evaluate(expr, { angle: 'deg' });
  check(`ok ${expr}`, r.ok === true);
  if (r.ok) {
    check(`value ${expr}`, Math.abs(r.value - value) < 1e-9, String(r.value));
    check(`display ${expr}`, evalDisplay(r.interpreted) === value || Math.abs(evalDisplay(r.interpreted) - value) < 1e-9, r.interpreted);
    check(`exact string ${expr}`, r.interpreted.replace(/ - /g, ' − ') === read, r.interpreted);
  }
}

// 2. Fidelity over seeded random expressions with percent, 'of', parentheses (3,000 cases).
let seed = 20261021;
const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = (n: number): number => Math.floor(rnd() * n);
const atom = (d: number): string => {
  const k = ri(10);
  if (d > 0 && k < 2) return '(' + expr(d - 1) + ')';
  if (k < 4) return String(1 + ri(200)) + '%';
  return String(1 + ri(200));
};
function expr(d: number): string {
  let s = atom(d);
  const n = 1 + ri(4);
  for (let i = 0; i < n; i++) {
    const op = ['+', '-', '*', '/', ' of ', '+', '-'][ri(7)];
    s += op === ' of ' ? op : ` ${op} `;
    s += atom(d);
  }
  return s;
}
let compared = 0;
for (let i = 0; i < 3000; i++) {
  const e = expr(2);
  const r = evaluate(e, { angle: 'deg' });
  if (!r.ok) continue;
  const v = evalDisplay(r.interpreted);
  check(`read-as fidelity: ${e} => ${r.interpreted}`, Math.abs(v - r.value) <= 1e-9 * Math.max(1, Math.abs(r.value)), `display=${v} value=${r.value}`);
  compared++;
}
check('enough comparisons ran', compared > 2900, String(compared));

console.log(`calculatorReadAs.test.ts: ${checks} checks; ${compared} random expressions compared`);
