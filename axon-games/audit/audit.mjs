import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
import { setRandomSource, createSeededRandom } from '../src/random.js';
const issues = new Map(); // key -> {game->count, sample}
const add = (code, g, info) => { const k = code; if (!issues.has(k)) issues.set(k, new Map()); const m = issues.get(k); if (!m.has(g.id)) m.set(g.id, { n: 0, sample: info }); m.get(g.id).n++; };
const BAD = /undefined|NaN|\[object|Infinity|\bnull\b/;
const strs = (o, out = []) => { if (o == null) return out; if (typeof o === 'string') out.push(o); else if (typeof o === 'number') { if (!Number.isFinite(o)) out.push('NaN'); } else if (Array.isArray(o)) o.forEach(x => strs(x, out)); else if (typeof o === 'object') Object.values(o).forEach(x => strs(x, out)); return out; };
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const R = 6; let rounds = 0; const kindCount = {}; const pool = {};
for (const g of GAMES) {
  for (let tier = 1; tier <= 15; tier++) for (let level = 1; level <= 3; level++) for (let i = 0; i < R; i++) {
    setRandomSource(createSeededRandom(1000 + i * 7919 + tier * 131 + level * 17 + g.id.length));
    let r; try { r = createRound(g, tier, { level }); } catch (e) { add('THROWS', g, `${tier}/${level}: ${e.message}`); continue; }
    rounds++; kindCount[r.kind] = (kindCount[r.kind] || 0) + 1;
    const all = strs(r);
    if (all.some(s => BAD.test(s))) add('BAD_TOKEN', g, all.find(s => BAD.test(s)).slice(0, 120));
    const text = String((r.prompt || '') + ' ' + (r.question || '') + ' ' + (r.questionText || ''));
    if (!String(r.prompt || r.questionText || '').trim()) add('NO_PROMPT', g, `${tier}/${level}`);
    if (!r.rule || !Array.isArray(r.steps) || r.steps.length < 2) add('NO_TEACHING', g, `${tier}/${level} kind=${r.kind}`);
    if (r.kind === 'choice') {
      const ch = r.choices || [];
      if (ch.length < 2) add('CHOICE_LT2', g, JSON.stringify(ch));
      if (new Set(ch.map(norm)).size !== ch.length) add('CHOICE_DUPLICATE', g, JSON.stringify(ch));
      const acc = Array.isArray(r.accepted) ? r.accepted : [r.answer];
      if (!acc.every(a => ch.includes(a))) add('ANSWER_NOT_IN_CHOICES', g, `answer=${JSON.stringify(acc)} choices=${JSON.stringify(ch)}`);
      if (!validateAnswer(r, acc[0])) add('CORRECT_REJECTED', g, String(acc[0]));
      for (const c of ch) if (!acc.includes(c) && validateAnswer(r, c)) add('WRONG_ACCEPTED', g, c);
      if (ch.length && acc.length === ch.length) add('ALL_CHOICES_CORRECT', g, JSON.stringify(ch));
    }
    if (['input', 'text'].includes(r.kind)) {
      if (String(r.answer).trim() === '') add('EMPTY_ANSWER', g, `${tier}/${level}`);
      if (!validateAnswer(r, String(r.answer))) add('CORRECT_REJECTED', g, String(r.answer));
      if (validateAnswer(r, '__x__')) add('WRONG_ACCEPTED', g, '__x__');
      if (r.kind === 'input' && typeof r.answer === 'number') {
        if (!Number.isFinite(r.answer)) add('ANSWER_NOT_FINITE', g, String(r.answer));
        else if (!Number.isInteger(r.answer)) add('DECIMAL_ANSWER_EXACT_STRING', g, `${text.slice(0, 80)} => ${r.answer}`);
        if (r.answer === 0 && /solve the challenge and enter the numerical result/.test(text)) add('FALLBACK_ANSWER_ZERO', g, text.slice(0, 100));
      }
      const a = String(r.answer).toLowerCase();
      if (a.length >= 4 && text.toLowerCase().includes(a) && r.kind !== 'text') add('ANSWER_LEAKED_IN_PROMPT', g, `${a} in ${text.slice(0, 100)}`);
    }
    if (['memory', 'visual', 'set-memory'].includes(r.kind) && !(Number.isFinite(r.delay) && r.delay > 0) && r.kind !== 'set-memory') add('NO_DELAY', g, `${r.kind} ${r.delay}`);
    if (tier === 8 && level === 2) { const sig = JSON.stringify([r.prompt, r.question, r.answer, r.seq, r.cells, r.choices]); (pool[g.id] ??= { s: new Set() }).s.add(sig); }
    if (tier === 1 || tier === 15) { const sig = JSON.stringify([r.prompt, r.question]); ((pool[g.id] ??= { s: new Set() })['t' + tier] ??= new Set()).add(sig); }
  }
}
const out = { rounds, kindCount, games: GAMES.length, issues: {} };
for (const [k, m] of issues) out.issues[k] = [...m.entries()].map(([id, v]) => `${id} x${v.n} :: ${v.sample}`);
out.lowPool = Object.entries(pool).filter(([, v]) => v.s.size <= 3).map(([id, v]) => `${id} distinct=${v.s.size}`);
out.noProgression = Object.entries(pool).filter(([, v]) => v.t1 && v.t15 && v.t1.size > 0 && [...v.t1].every(x => v.t15.has(x)) && [...v.t15].every(x => v.t1.has(x))).map(([id]) => id);
import { writeFileSync } from 'node:fs'; writeFileSync('audit/audit_out.json', JSON.stringify(out, null, 1));
console.log('rounds', rounds, JSON.stringify(kindCount));
for (const [k, v] of Object.entries(out.issues)) console.log(`${k}: ${v.length} games`);
console.log('lowPool games', out.lowPool.length, 'noProgression games', out.noProgression.length);
