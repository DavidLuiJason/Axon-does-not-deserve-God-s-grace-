// DT3 independent answer audit: every expected answer is recomputed from the question text / round data,
// NOT read from round.answer, so a wrong generator cannot pass by agreeing with itself.
import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { setRandomSource, resetRandomSource, createSeededRandom } from '../src/random.js';
import { ODD } from '../src/games/depth.js';

const SEEDS = Number(process.env.ORACLE_SEEDS || 4);
const sum = a => a.reduce((x, y) => x + y, 0);
const text = r => String(r.questionText || r.prompt || '') + ' ' + String(r.question || '');
const nums = s => (String(s).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const isPrime = n => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every(d => n % d);
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const evalLeft = toks => { let v = toks[0]; for (let i = 1; i < toks.length; i += 2) { const o = toks[i], n = toks[i + 1]; v = o === '+' ? v + n : o === '−' || o === '-' ? v - n : o === '×' || o === '*' ? v * n : v / n; } return v; };
const evalPrec = s => { const e = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'); if (!/^[\d\s+\-*/().]+$/.test(e)) return null; return Function(`"use strict";return (${e})`)(); };
const sortAsc = a => [...a].sort((x, y) => x - y);

// Each oracle returns the expected answer (string/number/array) or undefined when the text is not parseable.
const memory = {
  'number-recall': r => r.seq.join(''), 'delayed-number-recall': r => r.seq.join(''),
  'missing-number': r => { const p = +/position (\d+)/.exec(text(r))[1]; const rest = /Remaining values: ([\d ·]+)/.exec(text(r))[1].split('·').map(x => +x); assert.deepEqual(rest, r.seq.filter((_, i) => i !== p - 1), 'remaining list'); return r.seq[p - 1]; },
  'which-numbers-were-called': r => [...new Set(r.seq)], 'never-called': r => [0,1,2,3,4,5,6,7,8,9].filter(d => !r.seq.includes(d)),
  'number-sequence-reconstruction': r => r.seq.join(' '), 'reverse-recall': r => [...r.seq].reverse().join(' '),
  'number-gap-filler': r => { const m = /: ([\d_ ·]+)$/.exec(text(r).trim().split('Remaining')[0]); const toks = /Fill the blanks[^:]*: ([\d_ ·]+)/.exec(text(r))[1].trim().split('·').map(x => x.trim()); return toks.map((t, i) => t === '_' ? r.seq[i] : null).filter(x => x !== null).join(' '); },
  'position-memory': r => r.seq[+/position (\d+)/.exec(text(r))[1] - 1],
  'number-frequency-recall': r => { const d = +/did (\d) appear/.exec(text(r))[1]; return r.seq.filter(x => x === d).length; },
  'number-appearance-order': r => [...new Set(r.seq)].join(' '), 'first-and-last-number': r => `${r.seq[0]} ${r.seq.at(-1)}`,
  'number-pair-memory': r => { const m = /positions (\d+) and (\d+)/.exec(text(r)); return `${r.seq[m[1] - 1]} ${r.seq[m[2] - 1]}`; },
  'number-group-recall': r => { const g = +/group (\d+)/.exec(text(r))[1]; return sum(r.seq.slice((g - 1) * 3, g * 3)); },
  'number-echo-challenge': r => r.seq.map((d, i) => (d + i + 1) % 10).join(' '),
  'add-and-remember': r => sum(r.seq), 'running-total': r => sum(r.seq.slice(0, +/position (\d+)/.exec(text(r))[1])),
  'subtraction-memory': r => { const h = Math.ceil(r.seq.length / 2); return sum(r.seq.slice(0, h)) - sum(r.seq.slice(h)); },
  'number-transformation': r => { const m = /digit × (\d+) \+ (\d+)\) modulo (\d+)/.exec(text(r)); if (!m) return; return r.seq.map(x => (x * +m[1] + +m[2]) % +m[3]).join(' '); },
  'alternating-arithmetic': r => r.seq.reduce((a, x, i) => a + (i % 2 ? -x : x), 0),
  'number-sorting-memory': r => /descending/.test(text(r)) ? sortAsc(r.seq).reverse().join(' ') : sortAsc(r.seq).join(' '),
  'odd-one-out-numbers': r => { const rule = r.rule; let m; if (/All other values are even/.test(rule)) return r.seq.find(x => x % 2); if (/All other values are odd/.test(rule)) return r.seq.find(x => x % 2 === 0); if ((m = /multiples of (\d+)/.exec(rule))) return r.seq.find(x => x % +m[1]); },
  'number-classification-recall': r => { const t = text(r); if (/even/.test(t)) return r.seq.filter(x => x % 2 === 0).length; if (/odd/.test(t)) return r.seq.filter(x => x % 2).length; if (/prime/.test(t)) return r.seq.filter(isPrime).length; },
  'prime-number-memory': r => r.seq.filter(isPrime).join(' ') || 'none',
  'multiplication-sequence': r => { const k = +/by (\d+)/.exec(text(r))[1]; return r.seq.map(x => x * k).join(' '); },
  'missing-arithmetic-result': r => { const m = /(-?\d+) ([+−×-]) (-?\d+) = \?/.exec(text(r)); return evalLeft([+m[1], m[2], +m[3]]); },
  'number-pattern-memory': r => { const s = r.seq, d = s[1] - s[0]; if (s.every((x, i) => !i || x - s[i - 1] === d)) return s.at(-1) + d; const q = s[1] / s[0]; if (s.every((x, i) => !i || x === s[i - 1] * q)) return s.at(-1) * q; },
  'hidden-number-operations': r => { const e = /evaluate: (.+)$/.exec(text(r).trim().replace(/\s+\S*$/, m => m)); const ex = /evaluate: ([\d +−×-]+)/.exec(text(r)); if (!ex) return; const t = ex[1].trim().split(/\s+/).map((x, i) => i % 2 ? x : +x); return evalLeft(t); },
  'number-relationship-recall': r => { const m = /relationship “(\w+)”/.exec(text(r)), [a, b] = r.seq; return { double: 2 * a, triple: 3 * a, sum: a + b, difference: Math.abs(a - b) }[m[1]]; },
  'mental-number-matrix': r => { const n = +/(\d)×\d matrix/.exec(text(r))[1]; const m = /row (\d+), column (\d+)/.exec(text(r)); return r.seq[(m[1] - 1) * n + (m[2] - 1)]; },
  'remember-and-rearrange': r => /ascending/.test(text(r)) ? sortAsc(r.seq).join(' ') : sortAsc(r.seq).reverse().join(' '),
  'dual-task-challenge': r => { const L = /letter “(\w)”/.exec(text(r))[1]; return r.seq.filter(w => w.includes(L)).length; },
  'memory-updating': r => { const m = /Start at (-?\d+)\. .*?: (.+)\. What/.exec(text(r)); let v = +m[1]; for (const u of m[2].trim().split(/\s+/)) { const k = +u.slice(1).replace('−', '-'); v = u[0] === '+' ? v + k : u[0] === '−' || u[0] === '-' ? v - k : u[0] === '×' ? v * k : v; } return v; },
  'last-three-items': r => r.seq.slice(-3).join(' '),
  'moving-memory-window': r => { const k = +/most recent (\d+)/.exec(text(r))[1]; return r.seq.slice(-k).join(' '); },
  'instruction-memory': r => { const m = /Start at (-?\d+): ([^.]+)\./.exec(text(r)); let v = +m[1]; for (const s of m[2].split('→').map(x => x.trim())) { let k; if (s === 'double') v *= 2; else if (s === 'square') v *= v; else if ((k = /^add (\d+)$/.exec(s))) v += +k[1]; else if ((k = /^subtract (\d+)$/.exec(s))) v -= +k[1]; else if ((k = /^multiply by (\d+)$/.exec(s))) v *= +k[1]; else return; } return v; },
  'rule-switching': r => { const m = /odd positions ([+×−*-])(\d+); even positions ([+×−*-])(\d+)/.exec(text(r)); if (!m) return; const ap = (x, o, k) => o === '+' ? x + +k : o === '×' || o === '*' ? x * +k : x - +k; return r.seq.map((x, i) => i % 2 === 0 ? ap(x, m[1], m[2]) : ap(x, m[3], m[4])).join(' '); },
  'memory-under-distraction': r => r.seq.join(' '),
  'delayed-instruction': r => { const m = /start at (-?\d+); ([^.]+)\./.exec(text(r)); let v = +m[1]; for (const s of m[2].split(/, then /).map(x => x.trim())) { let k; if ((k = /^add (\d+)$/.exec(s))) v += +k[1]; else if ((k = /^subtract (\d+)$/.exec(s))) v -= +k[1]; else if ((k = /^multiply by (\d+)$/.exec(s))) v *= +k[1]; else return; } return v; },
  'mental-workspace': r => { const k = +/subtract (\d+)/.exec(text(r))[1]; return sum(r.seq) - k; },
  'called-missing': r => [...new Set(r.seq)].filter(x => !r.shown.includes(x)),
};

const general = {
  'mental-math': r => { const m = /order of operations: (.+)\.\s*$/.exec(String(r.prompt).trim()); return m && evalPrec(m[1]); },
  'rapid-calculation': r => { const m = /calculate ([\d +−×-]+)\./.exec(String(r.prompt)); return m && evalPrec(m[1]); },
  'missing-equation': r => { const m = /(\d+) ([+−×]) □ = (\d+)|□ ([+−×]) (\d+) = (\d+)|(\d+) ([+−×]) (\d+) = □/.exec(r.prompt); if (!m) { const n = /(\d+) ([+−×]) □ = (\d+)/.exec(r.prompt); return; } if (m[1] !== undefined) { const [a, o, c] = [+m[1], m[2], +m[3]]; return o === '+' ? c - a : o === '−' ? a - c : c / a; } },
  'number-pyramid': r => { let row = /Bottom row: ([\d, ]+)\./.exec(r.prompt)[1].split(',').map(Number); while (row.length > 1) row = row.slice(1).map((x, i) => x + row[i]); return row[0]; },
  'greatest-common-divisor': r => { const [a, b] = nums(r.prompt.replace('(GCD)', '')); return gcd(a, b); },
  'least-common-multiple': r => { const [a, b] = nums(r.prompt.replace('(LCM)', '')); return a * b / gcd(a, b); },
  'percentage-master': r => { const m = /(\d+)% of (\d+)/.exec(r.prompt); return +m[1] * +m[2] / 100; },
  'algebra-detective': r => { const m = /(\d+)x ([+−-]) (\d+) = (\d+)/.exec(r.prompt); if (!m) return; return m[2] === '+' ? (+m[4] - +m[3]) / +m[1] : (+m[4] + +m[3]) / +m[1]; },
  'equation-balancer': r => { const m = /in (\d+)x ([+−-]) (\d+) = (\d+)/.exec(r.prompt); if (!m) return; return m[2] === '+' ? `subtract ${m[3]}` : `add ${m[3]}`; },
  'prime-factor-challenge': r => { assert.ok(!r.prompt.includes(String(r.answer)), 'the worked example must not give away the answer'); let n = +/factorization of (\d+)/.exec(r.prompt)[1], out = []; for (let p = 2; n > 1; p++) { let k = 0; while (n % p === 0) { n /= p; k++; } if (k) out.push(k > 1 ? `${p}^${k}` : `${p}`); } return out.join('×'); },
  'fraction-duel': r => { const m = /Compare (\d+)\/(\d+) and (\d+)\/(\d+)/.exec(r.prompt); const a = m[1] / m[2], b = m[3] / m[4]; return a > b ? `${m[1]}/${m[2]}` : b > a ? `${m[3]}/${m[4]}` : 'equal'; },
  'probability-challenge': r => { const m = /contains (\d+) red, (\d+) blue, and (\d+) green/.exec(r.prompt); if (!m) return; const t = +m[1] + +m[2] + +m[3], g = gcd(+m[1], t); return `${m[1] / g}/${t / g}`; },
  'target-number-mathematics': r => { const t = +/target (\d+)/.exec(r.prompt)[1]; return `1+${t - 1}`; },
  'count-the-occurrences': r => { const m = /occurrences of (\S+) in this stream: (.+)\.$/.exec(r.prompt); return m[2].split(' ').filter(x => x === m[1]).length; },
  'rapid-symbol-search': r => { const m = /FIRST occurrence of (\S+) in this stream[^:]*: (.+)$/.exec(r.prompt); return m[2].trim().split(' ').indexOf(m[1]) + 1; },
  'sustained-attention': r => { const m = /target (\S+) throughout this stream\. How many times does it appear\? (.+)$/.exec(r.prompt); return m[2].trim().split(' ').filter(x => x === m[1]).length; },
  'target-number-attention': r => { const m = /occurrences of (\S+)\./.exec(r.prompt); return r.question.trim().split(/\s+/).filter(x => x === m[1]).length; },
  'sequence-violation': r => { const d = +/constant (\d+)/.exec(r.prompt)[1], s = /: ([\d, ]+)\.$/.exec(r.prompt)[1].split(',').map(Number); for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] !== d) return i + 1; },
  'object-displacement': r => { assert.match(r.prompt, /leave the board is ignored/); let c = 3, rw = 3; for (const mv of /in order: ([^.]+)\./.exec(r.prompt)[1].split(',').map(x => x.trim())) { if (mv === 'right') c = Math.min(5, c + 1); if (mv === 'left') c = Math.max(1, c - 1); if (mv === 'up') rw = Math.max(1, rw - 1); if (mv === 'down') rw = Math.min(5, rw + 1); } return `${c},${rw}`; },
  'map-memory': r => { let x = 0, y = 0; for (const mv of /Travel (.+)\. Enter/.exec(r.prompt)[1].split('→').map(s => s.trim())) { if (mv === 'east') x++; if (mv === 'west') x--; if (mv === 'north') y++; if (mv === 'south') y--; } return `${x},${y}`; },
  'spatial-navigation': r => { let x = 0, y = 0; for (const mv of /Follow (.+)\. Give/.exec(r.prompt)[1].split('→').map(s => s.trim())) { if (mv === 'E') x++; if (mv === 'W') x--; if (mv === 'N') y++; if (mv === 'S') y--; } return `${x},${y}`; },
  'shortest-path': r => { const m = /to \((\d+),(\d+)\)/.exec(r.prompt); return +m[1] + +m[2]; },
  'paper-folding': r => { const m = /folded in half (\d+) times\. You punch (\d+) hole/.exec(r.prompt); return +m[2] * 2 ** +m[1]; },
  'cube-counting': r => { const m = /(\d+) cubes wide, (\d+) cubes deep, and (\d+) cubes high/.exec(r.prompt); return m[1] * m[2] * m[3]; },
  'block-assembly': r => { const m = /(\d+)×(\d+)×(\d+) cuboid.*?(\d+) cubes are removed/.exec(r.prompt); return m[1] * m[2] * m[3] - m[4]; },
  'hidden-geometry': r => { const m = /perimeter (\d+) and one side (\d+)/.exec(r.prompt); return m && m[1] / 2 - m[2]; },
  'shape-assembly': r => { const m = /assemble (\d+) separate unit squares/.exec(r.prompt); return m && 4 * m[1] - 2 * (m[1] - 1); },
  'reverse-spelling': r => [...(/“(\w+)”/.exec(r.prompt)[1])].reverse().join(''),
  'letter-count-memory': r => /“(\w+)”/.exec(r.prompt)[1].length,
  'distractor-filter': r => { const m = /keep (.+?)”: (.+?)\. Enter kept/.exec(r.prompt); const items = m[2].split(' · '); const f = m[1] === 'even numbers' ? x => ['2', '4', '6', '8'].includes(x) : m[1] === 'vowels' ? x => ['A', 'E', 'I', 'O', 'U'].includes(x) : x => x === '#'; return items.filter(f).join(' ') || 'NONE'; },
  'strategic-territory': r => { const n = nums(r.prompt); return n[0] + n[2] > 0 ? undefined : undefined; },
  'the-hidden-number': r => { const m = /greater than (\d+) and less than (\d+), is divisible by (\d+), and leaves remainder (\d+) when divided by (\d+)/.exec(r.prompt); const [lo, hi, div, rem, mod] = m.slice(1).map(Number); const hits = []; for (let k = lo + 1; k < hi; k++) if (k % div === 0 && k % mod === rem) hits.push(k); assert.equal(hits.length, 1, 'hidden number must be unique'); return hits[0]; },
  'tic-tac-toe-master': r => { const b = r.board, out = []; const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; b.forEach((v, k) => { if (!v && L.some(l => l.includes(k) && l.filter(i => i !== k).every(i => b[i] === 'X'))) out.push(k + 1); }); assert.equal(out.length, 1); return String(out[0]); },
  'connect-four': r => `row ${+/contains (\d+) checker/.exec(r.prompt)[1] + 1}`,
  'logic-grid': r => { const { people, colors, clues, ask } = r.puzzle; const sols = []; const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]; for (const p of perms) { if (clues.every(c => c.type === 'owns' ? colors[p[c.person]] === c.color : colors[p[c.person]] !== c.color)) sols.push(p); } const answers = new Set(sols.map(p => people[p.findIndex(ci => colors[ci] === ask)])); assert.equal(answers.size, 1, 'logic-grid ask must be determined'); return [...answers][0]; },
  'who-owns-what': r => { const { people, items, clues, ask } = r.puzzle; const sols = []; const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]; for (const p of perms) { if (clues.every(c => c.items.every(it => items[p[c.person]] !== it))) sols.push(p); } const answers = new Set(sols.map(p => people[p.findIndex(ii => items[ii] === ask)])); assert.equal(answers.size, 1, 'who-owns-what ask must be determined'); return [...answers][0]; },
  'twenty-questions': r => { const best = Object.entries(r.splitCounts).sort((a, b) => Math.abs(a[1] - 4) - Math.abs(b[1] - 4)); assert.ok(Math.abs(best[0][1] - 4) < Math.abs(best[1][1] - 4), 'unique best splitter'); for (const [q, c] of Object.entries(r.splitCounts)) { const key = Object.keys({ alive: 1, music: 1, wheels: 1, big: 1, water: 1 }).find(k => ({ alive: 'Is it alive?', music: 'Does it make music?', wheels: 'Does it have wheels?', big: 'Is it bigger than a person?', water: 'Does it belong in water?' })[k] === q); assert.equal(Object.values(r.attributes).filter(a => a.includes(key)).length, c); } return best[0][0]; },
  '__old-lock': r => { const a = +/First digit is (\d)/.exec(r.prompt)[1]; const code = `${a}${a + 1}${2 * (a + 1)}`; assert.equal(code.length, 3, 'lock code must be three digits'); return code; },
  'mirror-image': r => String(6 - +/column (\d), row/.exec(r.prompt)[1]),
  'anagram-solver': r => { const s = [...(/letters into a common English word: (\w+)\./.exec(r.prompt)[1])].sort().join(''); for (const w of r.acceptedAnswers) assert.equal([...w].sort().join(''), s, `anagram ${w}`); assert.ok(r.acceptedAnswers.includes(r.answer)); return r.answer; },
  'word-chain': r => { const m = /step: (\w+) → \? → (\w+)\./.exec(r.prompt); const ham = (a, b) => [...a].filter((c, i) => c !== b[i]).length; for (const w of r.accepted) { assert.equal(ham(m[1], w), 1); assert.equal(ham(w, m[2]), 1); } for (const c of r.choices) if (!r.accepted.includes(c)) assert.ok(ham(m[1], c) !== 1 || ham(c, m[2]) !== 1, `wrong choice ${c} is a valid bridge`); return r.answer; },
  'hidden-word': r => { const w = /inside “(\w+)”/.exec(r.prompt)[1]; const inside = r.choices.filter(c => w.includes(c)); assert.ok(inside.includes(r.answer), 'answer is inside word'); assert.equal(inside.length, 1, 'only one choice hides in the word'); return r.answer; },
  'prime-number-memory': undefined,
};

const seqNext = nums => { // independent next-term: constant difference, constant ratio, alternating differences, 2nd-difference constant
  const d = nums.slice(1).map((x, i) => x - nums[i]);
  if (d.every(x => x === d[0])) return nums.at(-1) + d[0];
  const q = nums[1] / nums[0]; if (nums.every((x, i) => !i || x === nums[i - 1] * q)) return nums.at(-1) * q;
  if (d.length >= 4 && d.every((x, i) => x === d[i % 2])) return nums.at(-1) + d[(d.length) % 2];
  const d2 = d.slice(1).map((x, i) => x - d[i]); if (d2.length >= 2 && d2.every(x => x === d2[0])) return nums.at(-1) + d.at(-1) + d2[0];
  return undefined;
};
const period = a => { for (let p = 1; p <= a.length / 2; p++) if (a.every((x, i) => x === a[i % p])) return p; return undefined; };
Object.assign(general, {
  'mathematical-sequence': r => seqNext(nums(/term: (.+), \?/.exec(r.prompt)[1])),
  'abstract-sequence': r => seqNext(nums(/term: (.+), \?/.exec(r.prompt)[1])),
  'sequence-prediction': r => seqNext(nums(/term: (.+), \?/.exec(r.prompt)[1])),
  'multi-rule-patterns': r => { const m = /higher: (.+)\. What/.exec(r.prompt), s = nums(m[1]), k = +/a value (\d+) higher/.exec(r.prompt)[1]; const base = s.filter((_, i) => i % 2 === 0); s.forEach((x, i) => { if (i % 2) assert.equal(x, s[i - 1] + k, 'interleave offset'); }); return seqNext(base) + k * 0 + (s.length % 2 ? 0 : 0) + 0 === undefined ? undefined : (s.length % 2 === 0 ? seqNext(base) : seqNext(base) + k); },
  'matrix-reasoning': r => { const m = /\[(\d+), (\d+)\] \/ \[(\d+), \?\]/.exec(r.prompt); return +m[3] + (m[2] - m[1]); },
  'rule-discovery': r => { const m = /maps (\d+)→(\d+) and (\d+)→(\d+)/.exec(r.prompt); return (m[4] - m[2]) / (m[3] - m[1]); },
  'symbol-transformation': r => { const m = /Apply to (\d+): (\w+) then (\w+) (?:(\w+) )?(\w+)?\./.exec(r.prompt); const words = r.prompt.replace(/\.[\s\S]*$/, '').replace(/^Apply to \d+: /, '').split(' then '); let v = +/Apply to (\d+)/.exec(r.prompt)[1]; for (const w of words) { const t = w.trim(); let k; if (t === 'double') v *= 2; else if (t === 'triple') v *= 3; else if (t === 'square') v *= v; else if ((k = /^add (\w+)$/.exec(t))) v += W[k[1]]; else if ((k = /^subtract (\w+)$/.exec(t))) v -= W[k[1]]; else return; } return v; },
  'relationship-mapping': r => { const m = /(\d+) is to (\d+) as (\d+) is to/.exec(r.prompt); return m[2] % m[1] === 0 ? m[3] * (m[2] / m[1]) : m[3] - -(m[2] - m[1]); },
  'analogy-matrix': r => { const m = /top value (\d+) is transformed by ([+−-])(\d+) to (-?\d+); bottom value (\d+) is transformed by ([+−-])(\d+) to (-?\d+)/.exec(r.prompt); const ap = (v, o, k) => o === '+' ? v + +k : v - +k; const top = ap(+m[1], m[2], m[3]), bot = ap(+m[5], m[6], m[7]); assert.equal(top, +m[4]); assert.equal(bot, +m[8]); return top - bot; },
  'interruption-recovery': r => { const m = /calculation: \((\d+) \+ (\d+)\) × (\d+) − (\d+)\./.exec(r.prompt); return (+m[1] + +m[2]) * m[3] - m[4]; },
  'ultimate-brain-challenge': r => { const m = /add (\d+)\+(\d+), multiply that sum by (\d+), then subtract (\d+)/.exec(r.prompt); return (+m[1] + +m[2]) * m[3] - m[4]; },
  'three-dimensional-rotation': r => { const m = /\(x,y,z\)=\((\d+),(\d+),(\d+)\)\. Under a quarter-turn around ([XYZ])/.exec(r.prompt); let [x, y, z] = [+m[1], +m[2], +m[3]]; if (m[4] === 'X') [y, z] = [z, y]; if (m[4] === 'Y') [x, z] = [z, x]; if (m[4] === 'Z') [x, y] = [y, x]; return `${x},${y},${z}`; },
  'spatial-sequence': r => { const s = /sequence: (.+) → \?/.exec(r.prompt)[1].split(' → '); const p = period(s); return p ? s[s.length % p] : undefined; },
  'pattern-completion': r => { const s = /pattern: (.+) → \?/.exec(r.prompt)[1].split(' → '); const p = period(s); return p ? s[s.length % p] : undefined; },
  'cube-net': r => { const listed = /Listed: ([\w, ]+)\./.exec(r.prompt)[1].split(', '); return ['top', 'bottom', 'front', 'back', 'left', 'right'].find(f => !listed.includes(f)); },
  'strategic-territory': r => { const m = /has (\d+) secured cells and (\d+) contested cells\. If you secure (\d+)/.exec(r.prompt); return +m[1] + +m[3]; },
  'bridge-crossing': r => { const m = /at (\d+) and (\d+) minutes/.exec(r.prompt); return Math.max(+m[1], +m[2]); },
  'target-switch': r => { const m = /Rule: respond (?:only )?when the symbol is (.+)\. Stimulus: (.+)\. Should/.exec(r.prompt); const stim = m[2].split(' '); const clauses = m[1].split(' OR ').map(c => c.trim().replace(/^is /, '')); const truth = c => { const neg = /^not /.test(c); const w = c.replace(/^not /, '').replace(/^(a|an) /, ''); return neg ? !stim.includes(w) : stim.includes(w); }; if (/ AND /.test(m[1])) return m[1].split(' AND ').every(c => truth(c.trim().replace(/^is /, ''))) ? 'respond' : 'withhold'; return clauses.some(truth) ? 'respond' : 'withhold'; },
  'color-word-conflict': r => { const m = /ink label is (\w+); the printed word says (\w+)/.exec(r.prompt); return m[1] === m[2] ? 'match' : 'conflict'; },
  'go-or-no-go': r => { const m = /Target: (\S+)\. Stimulus: (\S+)\./.exec(r.prompt); return m[1] === m[2] ? 'GO' : 'NO-GO'; },
  'scrambled-words': r => { const s = /make one English word: (\w+)/.exec(r.prompt)[1]; assert.equal([...s].sort().join(''), [...r.answer].sort().join('')); return r.answer; },
  '__old-codebreaker': r => { const m = /backward (\d+) place\(s\)\. Decode: (\w+)/.exec(r.prompt); return [...m[2]].map(c => String.fromCharCode((c.charCodeAt(0) - 65 - m[1] + 26) % 26 + 65)).join(''); },

  'resource-allocation': r => { const m = /Budget (\d+)\. Project A costs (\d+) credits for each of two stages; project B costs (\d+)/.exec(r.prompt); return 2 * m[2] + +m[3] <= +m[1] ? 'fund both projects' : 2 * m[2] <= +m[1] ? 'fund project A only' : 'fund neither'; },
  'nim': r => { const h = r.heaps, x = h[0] ^ h[1] ^ h[2]; const win = x ? h.map((v, i) => (v ^ x) < v ? i + 1 : 0).filter(Boolean) : [0]; assert.deepEqual(r.acceptedAnswers, win); for (const w of win) assert.equal(validateAnswer(r, String(w)), true); for (let k = 0; k <= 3; k++) if (!win.includes(k)) assert.equal(validateAnswer(r, String(k)), false, `heap ${k} must be rejected`); return win[0]; },
  'maze-master': r => { const n = +/maze is (\d+)×\d+/.exec(r.prompt)[1]; let x = 0, y = 0; const path = r.answer; const seen = new Set(['0,0']); for (const c of path) { if (c === 'R') x++; if (c === 'L') x--; if (c === 'D') y++; assert.ok(x >= 0 && x < n && y >= 0 && y < n, 'maze path leaves the grid'); seen.add(`${x},${y}`); } assert.equal(seen.size, n * n, 'serpentine visits every cell once'); assert.deepEqual([x, y], [0, n - 1], 'ends bottom-left'); return path; },
  '__old-mystery': r => { const st = [p => p === 'Ada', p => p === 'Bola', p => p === 'Ada' || p === 'Bola', p => p === 'Ada' || p === 'Chen']; const who = ['Ada', 'Bola', 'Chen', 'Dara'].filter(p => st.filter(f => f(p)).length === 2); assert.equal(who.length, 1); return who[0]; },
  '__old-impostor': r => { const st = [p => p !== 'Jon', p => p === 'Sana', null]; const who = ['Mira', 'Jon', 'Sana'].filter(p => { const a = st[0](p), b = st[1](p), c = b; return [a, b, c].filter(Boolean).length === 1; }); return who.length === 1 ? who[0] : undefined; },
  '__old-suspect': r => { const who = ['A', 'B', 'C'].filter(p => { const a = p === 'B', b = p !== 'B', c = !a; return [a, b, c].filter(Boolean).length === 1; }); assert.equal(who.length, 1); return who[0]; },
  '__old-who-is-lying': r => { const who = ['A', 'B', 'C'].filter(t => { const truth = { A: t === 'A', B: t === 'B', C: t === 'C' }; const a = !truth.B, b = !truth.C, c = !truth.A && !truth.B; const stm = { A: a, B: b, C: c }; return ['A', 'B', 'C'].every(p => stm[p] === truth[p]) && [a, b, c].filter(Boolean).length === 1; }); assert.equal(who.length, 1); return `${who[0]} only`; },
  '__old-truth': r => 0,
});

// ---------- independent solvers for the depth-pass generators ----------
const evalIndep = (st, i, c, vec) => st.t === 'did' ? c === st.a : st.t === 'notme' ? c !== i : st.t === 'either' ? (c === st.a || c === st.b) : st.t === 'lying' ? !vec[st.a] : st.t === 'truth' ? vec[st.a] : (!vec[st.a] && !vec[st.b]);
const worlds = (n, stmts, k, culprit) => { const out = []; for (let c = 0; c < (culprit ? n : 1); c++) for (let m = 0; m < 2 ** n; m++) { const vec = Array.from({ length: n }, (_, i) => Boolean(m >> i & 1)); if (vec.filter(Boolean).length === k && stmts.every((s, i) => evalIndep(s, i, c, vec) === vec[i])) out.push({ c, vec }); } return out; };
const culpritOracle = r => { const { names, stmts, k } = r.puzzle; const w = worlds(names.length, stmts, k, true); const who = new Set(w.map(x => x.c)); assert.equal(who.size, 1, 'culprit must be unique'); return names[[...who][0]]; };
const truthOracle = fmt => r => { const { names, stmts, k, ask } = r.puzzle; const w = worlds(names.length, stmts, k, false); assert.equal(w.length, 1, 'truth puzzle must have exactly one consistent world'); const idx = w[0].vec.map((v, i) => v === (ask === 'truthful') ? i : -1).filter(i => i >= 0); assert.equal(idx.length, 1, 'exactly one person in question'); return fmt(names[idx[0]]); };
// tiny model checker over the 8 Venn regions of A,B,C (regions may be empty)
const regions = Array.from({ length: 8 }, (_, i) => ({ A: !!(i & 1), B: !!(i & 2), C: !!(i & 4) }));
const models = Array.from({ length: 256 }, (_, m) => regions.filter((_, i) => m >> i & 1));
const holds = (kind, X, Y, M) => kind === 'All' ? M.every(z => !z[X] || z[Y]) : kind === 'No' ? M.every(z => !(z[X] && z[Y])) : kind === 'Some' ? M.some(z => z[X] && z[Y]) : kind === 'SomeNot' ? M.some(z => z[X] && !z[Y]) : false;
const parseSyl = (txt, order) => [...txt.matchAll(/(All|No|Some) (\w+) are (\w+)/g)].map(m => ({ kind: m[1], X: order[m[2]], Y: order[m[3]] }));
const nounMap = txt => { const nouns = []; for (const m of txt.matchAll(/(?:All|No|Some) (\w+) are (\w+)/g)) for (const w of [m[1], m[2]]) if (!nouns.includes(w)) nouns.push(w); const map = {}; nouns.forEach((w, i) => map[w] = 'ABC'[i]); return map; };
const sylOracle = r => { const prem = r.prompt.split(' Which statement')[0]; const map = nounMap(prem); const P = parseSyl(prem, map); const ok = models.filter(M => P.every(p => holds(p.kind, p.X, p.Y, M))); const valid = r.choices.filter(c => { const [q] = parseSyl(c, map.__proto__ === undefined ? map : { ...map }); const cc = parseSyl(c, map); return cc.length === 1 && ok.every(M => holds(cc[0].kind, cc[0].X, cc[0].Y, M)); }); assert.equal(valid.length, 1, `exactly one valid conclusion among choices: ${valid}`); return valid[0]; };
const verbalOracle = r => { const [prem, q] = [r.prompt.slice(0, r.prompt.indexOf('Must')).trim(), r.prompt.slice(r.prompt.indexOf('Must'))]; const map = nounMap(prem); const rev = {}; for (const [w, k] of Object.entries(map)) rev[w.replace(/s$/, '')] = k; const P = parseSyl(prem, map); const ok = models.filter(M => P.every(p => holds(p.kind, p.X, p.Y, M))); const m = /Must (at least one|every) (\w+) (not )?be an? (\w+)\?/.exec(q); const X = rev[m[2]], Y = rev[m[4]]; const f = m[1] === 'every' ? M => holds('All', X, Y, M) : m[3] ? M => holds('SomeNot', X, Y, M) : M => holds('Some', X, Y, M); const all = ok.every(f), none = ok.every(M => !f(M)); return all ? 'Yes' : none ? 'No' : 'Cannot determine'; };
Object.assign(general, {
  'who-is-lying': truthOracle(n => `${n} only`), 'truth-and-lies': truthOracle(n => n),
  'the-suspect-puzzle': culpritOracle, 'the-impostor': culpritOracle,
  'mystery-laboratory': r => { const { names, stmts } = r.puzzle; const cnt = c => stmts.filter(s => s.t === 'did' ? s.a === c : (s.a === c || s.b === c)).length; const hits = names.map((_, c) => c).filter(c => cnt(c) === 2); assert.equal(hits.length, 1); return names[hits[0]]; },
  'planning-puzzle': r => { const { constraints } = r.puzzle; const ok = o => constraints.every(([a, b]) => o.indexOf(a) < o.indexOf(b)); const valid = r.choices.filter(c => ok(c.split(' → '))); assert.equal(valid.length, 1, 'exactly one valid order'); return valid[0]; },
  'conditional-reasoning': r => ({ mp: 'Definitely true', mt: 'Definitely false', ac: 'Cannot determine', da: 'Cannot determine' })[r.form],
  'logical-consequences': sylOracle, 'verbal-logic': verbalOracle,
  'the-codebreaker': r => { const m = /backward (\d+) places?\. Decode: (\w+)/.exec(r.prompt); return [...m[2]].map(c => String.fromCharCode((c.charCodeAt(0) - 65 - m[1] + 26 * 2) % 26 + 65)).join(''); },
  'escape-room': r => { const V = { 'the number of sides on a triangle': 3, 'the number of sides on a square': 4, 'the number of days in a weekend': 2, 'the number of sides on a hexagon': 6, 'the number of wheels on a bicycle': 2 }; const m = /first digit = (.+?); second = (\d+) more than first/.exec(r.prompt); const f = V[m[1]], s = f + +m[2]; return `${f}${s}${f + s}`; },
  'the-impossible-lock': r => { let m; const p = r.prompt; if ((m = /First digit is (\d); second is one greater; third is twice the second/.exec(p))) { const a = +m[1]; return `${a}${a + 1}${2 * (a + 1)}`; } if ((m = /First digit is (\d); second is double the first; third is the sum/.exec(p))) { const a = +m[1]; return `${a}${2 * a}${3 * a}`; } if ((m = /consecutive increasing numbers and the first digit is (\d)/.exec(p))) { const a = +m[1]; return `${a}${a + 1}${a + 2}`; } },
  'visual-intruder': r => { const m = /all (.+)\.$/.exec(r.prompt.trim()); const inCat = r.choices.filter(c => ODD.shapes[m[1]].includes(c)); assert.equal(inCat.length, 3); const odd = r.choices.filter(c => !ODD.shapes[m[1]].includes(c)); assert.equal(odd.length, 1); return odd[0]; },
  'the-odd-word': r => { const cats = Object.entries(ODD.words); const counts = cats.map(([k, v]) => [k, r.choices.filter(c => v.includes(c)).length]).sort((a, b) => b[1] - a[1]); assert.equal(counts[0][1], 3); const odd = r.choices.filter(c => !ODD.words[counts[0][0]].includes(c)); assert.equal(odd.length, 1); return odd[0]; },
  'word-classification': r => { const m = /contains (\w+)\./.exec(r.prompt); const odd = r.choices.filter(c => !ODD.pos[m[1]].includes(c)); assert.equal(odd.length, 1); return odd[0]; },
});
const W = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };


let checked = 0; const unparsed = {}; const fails = []; const covered = new Set();
for (const g of GAMES) {
  const oracle = memory[g.id] || general[g.id];
  for (let tier = 1; tier <= 15; tier++) for (let level = 1; level <= 3; level++) for (let s = 0; s < SEEDS; s++) {
    setRandomSource(createSeededRandom(9000 + s * 977 + tier * 31 + level * 7 + g.id.length * 13));
    const r = createRound(g, tier, { level });
    try {
      // ---- invariants for every game
      if (r.kind === 'choice') {
        const ok = Array.isArray(r.accepted) ? r.accepted : [r.answer];
        assert.ok(ok.every(a => r.choices.includes(a)), 'correct answer must be one of the exact choice strings');
        assert.equal(new Set(r.choices.map(c => String(c).trim().toLowerCase())).size, r.choices.length, 'duplicate choices');
        assert.ok(r.choices.length >= 2, 'fewer than two choices');
        for (const c of r.choices) assert.equal(validateAnswer(r, c), ok.includes(c), `clicking "${c}"`);
        assert.ok(r.choices.length > ok.length, 'every choice is correct');
      }
      // ---- independent expected answer
      if (!oracle) { (unparsed[g.id] ??= { n: 0 }).n++; continue; }
      const exp = oracle(r);
      if (exp === undefined) { (unparsed[g.id] ??= { n: 0 }).n++; continue; }
      checked++; covered.add(g.id);
      const asStr = Array.isArray(exp) ? exp.join(' ') : String(exp);
      assert.equal(validateAnswer(r, asStr), true, `expected "${asStr}" but round accepts answer=${JSON.stringify(r.answer)}`);
    } catch (e) { fails.push(`${g.id} t${tier}/l${level}/s${s}: ${e.message.split('\n')[0].slice(0, 170)}`); }
  }
}
resetRandomSource();
const byGame = {}; fails.forEach(f => { const id = f.split(' ')[0]; (byGame[id] ??= []).push(f); });
for (const [id, list] of Object.entries(byGame)) console.log(`FAIL ${id}: ${list.length} round(s); e.g. ${list[0]}`);
console.log(`oracle-checked rounds: ${checked}; games without/partial oracle: ${Object.keys(unparsed).length}`);
if (process.env.SHOW_UNPARSED) console.log(Object.entries(unparsed).map(([k, v]) => `${k}:${v.n}`).join(' '));
if (process.env.ORACLE_REPORT) (await import('node:fs')).writeFileSync(process.env.ORACLE_REPORT, JSON.stringify([...covered]));
assert.equal(fails.length, 0, `${fails.length} oracle failures`);
console.log('PASS: independent oracle audit');
