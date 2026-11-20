/**
 * AXON Games, independent answer check for the tier-scaled generators (DT3, GAMES5).
 * Every expected answer is recomputed from the QUESTION TEXT with a different method (brute force wherever possible), never from round.answer.
 */
import assert from 'node:assert/strict';
import { createSeededRandom, resetRandomSource, setRandomSource, startRound, listGames, levelsInTier } from '../src/games';
import { BANKS, RANKS } from '../src/games/rounds/depth';
import { TIERED_IDS, tierWindow } from '../src/games/rounds/tiered';
import type { Round } from '../src/games';

const SEEDS = Number(process.env.GAMES_ORACLE_SEEDS ?? 6);
const num = (s: string): number[] => (s.match(/-?\d+/g) ?? []).map(Number);
const text = (r: Round): string => String(r.prompt ?? r.questionText ?? '');
const perms = (n: number): number[][] => { const out: number[][] = []; const go = (cur: number[]): void => { if (cur.length === n) { out.push(cur); return; } for (let i = 0; i < n; i++) if (!cur.includes(i)) go([...cur, i]); }; go([]); return out; };

// bridge: shortest-path search over (who is on the start side, where the torch is)
function bridgeSearch(times: number[]): number {
  const n = times.length, full = (1 << n) - 1;
  const best = new Map<string, number>(); const key = (m: number, torch: number): string => `${m}:${torch}`;
  best.set(key(full, 0), 0);
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    for (const [k, cost] of [...best.entries()]) {
      const [mStr, tStr] = k.split(':'); const m = Number(mStr), torch = Number(tStr);
      const side = torch === 0 ? m : full & ~m; // people on the torch side
      for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
        if (!(side >> a & 1) || !(side >> b & 1)) continue;
        const move = (1 << a) | (1 << b); const nm = torch === 0 ? m & ~move : m | move;
        const c = cost + Math.max(times[a] as number, times[b] as number); const nk = key(nm, 1 - torch);
        if (c < (best.get(nk) ?? Infinity)) { best.set(nk, c); changed = true; }
      }
    }
    if (!changed) break;
  }
  return best.get(key(0, 1)) as number;
}

const trace: Record<string, number> = {};
const seen = (id: string): void => { trace[id] = (trace[id] ?? 0) + 1; };
const answerOf = (r: Round): string => (Array.isArray(r.answer) ? r.answer.join(' ') : String(r.answer));

function check(id: string, tier: number, r: Round): void {
  const p = text(r); const where = `${id} tier ${tier}`; let m: RegExpExecArray | null;
  switch (id) {
    case 'bridge-crossing': {
      if (tier <= 4) return;
      m = /^(\d) people cross a bridge in ([\d, ]+) minutes/.exec(p); assert.ok(m, where);
      const times = num(m[2] as string); assert.equal(times.length, Number(m[1]));
      assert.equal(times.length, tier <= 9 ? 3 : 4, `${where}: people grow with the tier`);
      assert.equal(Number(r.answer), bridgeSearch(times), `${where}: ${times}`); break;
    }
    case 'reverse-spelling': {
      m = /Spell “(\w+)” backwards/.exec(p); assert.ok(m, where);
      assert.equal(answerOf(r), (m[1] as string).split('').reverse().join('')); assert.equal((m[1] as string).length, Math.min(11, 3 + Math.ceil(tier / 2)), `${where}: length by tier`); break;
    }
    case 'hidden-word': {
      m = /hidden consecutively inside “(\w+)”/.exec(p); assert.ok(m, where);
      const inside = (r.choices as string[]).filter((c) => (m![1] as string).includes(c)); assert.deepEqual(inside, [r.answer]); break;
    }
    case 'visual-change-detection': {
      m = /Scene A: (.+)\. Scene B: (.+)\. What changed\?/.exec(p); assert.ok(m, where);
      const A = (m[1] as string).split('; '), B = (m[2] as string).split('; '); assert.equal(A.length, B.length);
      assert.equal(A.length, Math.min(8, 3 + Math.ceil(tier / 3)), `${where}: scene size by tier`);
      const diff = A.map((a, i) => (a !== B[i] ? a : '')).filter(Boolean);
      assert.ok(diff.length <= 1); assert.equal(answerOf(r), diff.length ? `${diff[0]} changed` : 'Nothing changed');
      if (tier < 8) assert.equal(diff.length, 1, `${where}: low tiers always change something`); break;
    }
    case 'target-switch': {
      if (tier <= 5) return;
      m = /Rule: respond (?:only )?when the symbol (.+)\. Stimulus: (.+)\. Should you respond\?/.exec(p); assert.ok(m, where);
      const stim = (m[2] as string).split(' '); const body = m[1] as string;
      const clause = (c: string): boolean => { let w = c.trim().replace(/^is /, ''); const neg = w.startsWith('not '); w = w.replace(/^not /, '').replace(/^a /, ''); return neg ? !stim.includes(w) : stim.includes(w); };
      const go = body.includes(' AND ') ? body.split(' AND ').every(clause) : body.split(' OR ').some(clause);
      assert.equal(answerOf(r), go ? 'respond' : 'withhold', `${where}: ${p}`); break;
    }
    case 'color-word-conflict': {
      if (tier <= 3) return;
      m = /INK \/ WORD: (.+)\. How many pairs/.exec(p); assert.ok(m, where);
      const pairs = (m[1] as string).split(', ').map((x) => x.split('/')); assert.equal(pairs.length, Math.min(12, 1 + Math.floor(tier * 0.8)), `${where}: stream grows`);
      assert.equal(Number(r.answer), pairs.filter((x) => x[0] !== x[1]).length); break;
    }
    case 'go-or-no-go': {
      if (tier <= 3) return;
      m = /Target: (\S+)\. Stream: (.+)\. How many items/.exec(p); assert.ok(m, where);
      const stream = (m[2] as string).split(', '); assert.equal(stream.length, Math.min(12, 1 + Math.floor(tier * 0.8)));
      assert.equal(Number(r.answer), stream.filter((x) => x === m![1]).length); break;
    }
    case 'visual-rotation': {
      if (tier <= 5) return;
      const names = ['back to the start', '90° clockwise', '180°', '270° clockwise'];
      let net: number;
      if ((m = /rotated (\d+) quarter-turns clockwise, then (\d+) quarter-turns counterclockwise/.exec(p))) net = (((Number(m[1]) - Number(m[2])) % 4) + 4) % 4;
      else { m = /rotated (\d+) quarter-turns clockwise\./.exec(p); assert.ok(m, where); net = Number(m[1]) % 4; }
      assert.equal(answerOf(r), names[net]); break;
    }
    case 'mirror-image': {
      if (tier <= 5) return;
      if ((m = /column (\d), row (\d) on a 7×7 grid \(numbered 1–7\)\. Reflect it across the (vertical|horizontal) centre line/.exec(p))) {
        const v = m[3] === 'vertical' ? Number(m[1]) : Number(m[2]); assert.notEqual(v, 4); assert.equal(answerOf(r), String(8 - v));
      } else {
        m = /column (\d), row (\d) on a 7×7 grid.*across the (main diagonal|anti-diagonal)/.exec(p); assert.ok(m, where);
        const c = Number(m[1]), rw = Number(m[2]); const [nc, nr] = m[3] === 'main diagonal' ? [rw, c] : [8 - rw, 8 - c];
        assert.ok(nc !== c || nr !== rw, 'the point must move'); assert.equal(answerOf(r), `${nc},${nr}`);
      }
      break;
    }
    case 'multi-rule-patterns': {
      if (tier <= 5) return;
      m = /: ([\d, ]+)\. What is the next term/.exec(p); assert.ok(m, where);
      const s = (m[1] as string).split(',').map((x) => Number(x.trim())); assert.equal(s.length, 7);
      const odd = s.filter((_, i) => i % 2 === 0), even = s.filter((_, i) => i % 2 === 1);
      assert.ok(odd.every((x, i) => i === 0 || x - (odd[i - 1] as number) === (odd[1] as number) - (odd[0] as number)), 'odd positions are arithmetic');
      const arith = even.every((x, i) => i === 0 || x - (even[i - 1] as number) === (even[1] as number) - (even[0] as number));
      const geo = even.every((x, i) => i === 0 || x === 2 * (even[i - 1] as number));
      assert.ok(arith !== geo || (tier > 10 ? geo : arith), `${where}: the even rule is unambiguous`);
      assert.equal(Number(r.answer), tier <= 10 ? (even[2] as number) + ((even[1] as number) - (even[0] as number)) : 2 * (even[2] as number)); break;
    }
    case 'logic-grid':
    case 'who-owns-what': {
      if (tier < 8) return;
      const things = (/exactly one different (?:colour|pet): (.+?)\./.exec(p)?.[1] ?? '').split(', '); assert.equal(things.length, 4, where);
      const people = ['Ada', 'Ben', 'Cy', 'Dee']; const clues = [...p.matchAll(/(Ada|Ben|Cy|Dee) (owns|does not own) (?:the )?(\w+)\./g)].map((c) => ({ person: people.indexOf(c[1] as string), owns: c[2] === 'owns', thing: things.indexOf(c[3] as string) }));
      const ask = things.indexOf(/Who owns (?:the )?(\w+)\?/.exec(p)?.[1] as string); assert.ok(ask >= 0 && clues.length >= 3, where);
      const sols = perms(4).filter((q) => clues.every((c) => (c.owns ? q[c.person] === c.thing : q[c.person] !== c.thing)));
      const owners = new Set(sols.map((q) => q.indexOf(ask))); assert.equal(owners.size, 1, `${where}: the asked item has exactly one owner`);
      assert.equal(answerOf(r), people[[...owners][0] as number]); break;
    }
    case 'the-impossible-lock': {
      if (tier < 7) return;
      m = /A (\d)-digit lock obeys all of these clues: (.+)\. Enter the code/.exec(p); assert.ok(m, where);
      const L = Number(m[1]); assert.equal(L, tier <= 10 ? 3 : 4, `${where}: length by tier`);
      const clues = (m[2] as string).split('; ');
      const holds = (code: number[], c: string): boolean => {
        let q: RegExpExecArray | null;
        if ((q = /^digit (\d) is (\d)$/.exec(c))) return code[Number(q[1]) - 1] === Number(q[2]);
        if ((q = /^digit (\d) is (even|odd)$/.exec(c))) return (code[Number(q[1]) - 1] as number) % 2 === (q[2] === 'even' ? 0 : 1);
        if ((q = /^digit (\d) is greater than digit (\d)$/.exec(c))) return (code[Number(q[1]) - 1] as number) > (code[Number(q[2]) - 1] as number);
        if ((q = /^digit (\d) equals digit (\d) plus (\d+)$/.exec(c))) return code[Number(q[1]) - 1] === (code[Number(q[2]) - 1] as number) + Number(q[3]);
        if ((q = /^the digits add up to (\d+)$/.exec(c))) return code.reduce((a, b) => a + b, 0) === Number(q[1]);
        if (c === 'no digit repeats') return new Set(code).size === code.length;
        throw new Error(`unknown clue: ${c}`);
      };
      const hits: string[] = [];
      for (let n = 0; n < 10 ** L; n++) { const code = String(n).padStart(L, '0').split('').map(Number); if (clues.every((c) => holds(code, c))) hits.push(code.join('')); }
      assert.deepEqual(hits, [answerOf(r)], `${where}: exactly one code satisfies every clue`); break;
    }
    case 'escape-room': {
      if (tier < 8) return;
      const V: Record<string, number> = { 'the number of sides on a triangle': 3, 'the number of sides on a square': 4, 'the number of days in a weekend': 2, 'the number of sides on a hexagon': 6, 'the number of wheels on a bicycle': 2 };
      m = /first digit = (.+?); second = (\d+) more than first; third = first \+ second; fourth = third minus first/.exec(p); assert.ok(m, where);
      const f = V[m[1] as string] as number, s2 = f + Number(m[2]), th = f + s2, fo = th - f; assert.ok(th <= 9 && fo >= 0 && fo <= 9);
      assert.equal(answerOf(r), `${f}${s2}${th}${fo}`); break;
    }
    case 'tic-tac-toe-master': {
      if (tier <= 5) return;
      m = /Board: ([^.]+)\. X to move/.exec(p); assert.ok(m, where);
      const b = (m[1] as string).split(' ').map((x) => (x === '·' ? '' : x)); assert.equal(b.length, 9);
      const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const wins = (mark: string): number[] => b.map((v, k) => (v === '' && L.some((ln) => ln.includes(k) && ln.filter((i) => i !== k).every((i) => b[i] === mark)) ? k + 1 : 0)).filter(Boolean);
      if (/stop O from winning/.test(p)) { assert.equal(wins('X').length, 0, 'X cannot win now'); assert.deepEqual(wins('O').map(String), [answerOf(r)]); }
      else { assert.deepEqual(wins('X').map(String), [answerOf(r)]); assert.ok(wins('O').length >= 1, 'O also threatens'); }
      break;
    }
    case 'odd-one-out-numbers': {
      const seq = r.seq as number[]; const rule = String(r.rule); const isPrime = (n: number): boolean => n > 1 && Array.from({ length: n }, (_, i) => i).filter((d) => d > 1 && d < n).every((d) => n % d);
      const violators = /multiples of 3/.test(rule) ? seq.filter((x) => x % 3 !== 0) : /prime/.test(rule) ? seq.filter((x) => !isPrime(x)) : /even/.test(rule) ? seq.filter((x) => x % 2 === 1) : [];
      assert.deepEqual(violators, [Number(r.answer)], `${where}: exactly one value breaks the rule`);
      assert.equal(/prime/.test(rule) ? 3 : /multiples/.test(rule) ? 2 : 1, tier <= 5 ? 1 : tier <= 10 ? 2 : 3, `${where}: property by tier`); break;
    }
    case 'prime-factor-challenge': {
      m = /factorization of (\d+) using/.exec(p); assert.ok(m, where);
      let n = Number(m[1]); const out: string[] = [];
      for (let f = 2; n > 1; f++) { let k = 0; while (n % f === 0) { n /= f; k++; } if (k) out.push(k > 1 ? `${f}^${k}` : `${f}`); }
      assert.equal(answerOf(r), out.join('×')); assert.ok(!p.includes(answerOf(r)), 'the example must not give the answer');
      const primes = [...answerOf(r).matchAll(/\d+/g)].map((x) => Number(x[0])).filter((x) => x !== 2 || true);
      const limit = tier <= 5 ? 5 : tier <= 10 ? 11 : 13; assert.ok(Math.max(...primes.filter((x) => x > 3 || x === 5 || x === 7 || x === 11 || x === 13)) <= limit, `${where}: primes by tier`); break;
    }
    case 'connect-four': {
      if (tier <= 5) return;
      m = /tall board, (\d) rows\): a column currently contains (\d) checker/.exec(p); assert.ok(m, where);
      assert.equal(Number(m[1]), tier <= 10 ? 7 : 8, `${where}: rows by tier`); assert.equal(answerOf(r), `row ${Number(m[2]) + 1}`); assert.equal((r.choices as string[]).length, Number(m[1])); break;
    }
    case 'word-chain': {
      if (tier <= 5) return;
      m = /step: (\w+) → \? → \? → (\w+)\. Which pair/.exec(p); assert.ok(m, where);
      const [a, d] = [m[1] as string, m[2] as string]; const hm = (u: string, v: string): number => (u.length === v.length ? [...u].filter((c, i) => c !== v[i]).length : 99);
      const right = (r.choices as string[]).filter((c) => { const [u, v] = c.split(' ') as [string, string]; return u !== v && hm(a, u) === 1 && hm(u, v) === 1 && hm(v, d) === 1; });
      assert.deepEqual(right, [answerOf(r)], `${where}: exactly one offered pair is a valid chain`); break;
    }
    case 'abstract-odd-one-out': {
      m = /Four values are (.+?); one is not\. Select the outlier: ([\d, ]+)\./.exec(p); assert.ok(m, where);
      const vals = num(m[2] as string); const rule = m[1] as string; const sq = (n: number): boolean => Number.isInteger(Math.sqrt(n)); const pw = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;
      let test: (n: number) => boolean; let mm: RegExpExecArray | null;
      if ((mm = /multiples of (\d+)/.exec(rule))) test = (n) => n % Number(mm![1]) === 0; else if (rule === 'perfect squares') test = sq; else test = pw;
      assert.deepEqual(vals.filter((n) => !test(n)), [Number(r.answer)], `${where}: exactly one outlier`);
      assert.equal(rule.startsWith('multiples') ? 1 : rule === 'perfect squares' ? 2 : 3, tier <= 5 ? 1 : tier <= 10 ? 2 : 3, `${where}: property by tier`); break;
    }
    case 'cube-net': {
      if (tier <= 5) return;
      m = /top (\d), front (\d), right (\d)\. What number is on the (bottom|back|left) face/.exec(p); assert.ok(m, where);
      const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]; assert.equal(new Set([a, b, c, 7 - a, 7 - b, 7 - c]).size, 6, 'the three visible faces are not opposites');
      assert.equal(answerOf(r), String(7 - (m[4] === 'bottom' ? a : m[4] === 'back' ? b : c))); break;
    }
    default: return;
  }
  seen(id);
}

// ---- tiered generators, every tier
for (const id of TIERED_IDS.concat(['odd-one-out-numbers'])) {
  for (let tier = 1; tier <= 15; tier++) {
    const level = 1; if (levelsInTier(id, tier) < level) continue;
    for (let s = 0; s < SEEDS; s++) {
      setRandomSource(createSeededRandom(31 * tier + 977 * s + id.length));
      check(id, tier, startRound(id, tier, level));
    }
  }
}
resetRandomSource();
for (const id of TIERED_IDS.concat(['odd-one-out-numbers'])) assert.ok((trace[id] ?? 0) > 20, `${id}: the oracle really checked rounds (${trace[id] ?? 0})`);

// ---- banks: ranks line up with items, answers are unique, and the tiers differ
const games = new Map(listGames().map((g) => [g.id, g]));
for (const [id, bank] of Object.entries(BANKS)) {
  assert.ok(games.has(id), `${id} is a real game`);
  assert.equal(bank.items.length, (RANKS[id] ?? bank.items.map(() => 0)).length, `${id}: one difficulty rank per item (or none for tiny banks)`);
  for (const item of bank.items) { assert.ok(item.length >= 3, `${id}: question, answer and at least one wrong option`); assert.equal(new Set(item.slice(1)).size, item.length - 1, `${id}: no duplicate options in "${item[0]}"`); }
}
for (const id of Object.keys(RANKS)) {
  const bank = BANKS[id]; if (!bank || bank.items.length < 4) continue;
  const asked = (lo: number, hi: number): Set<string> => { const out = new Set<string>(); for (let t = lo; t <= hi; t++) for (let s = 0; s < 40; s++) { setRandomSource(createSeededRandom(t * 7919 + s * 31 + id.length)); const r = startRound(id, t, 1); if (r.bankSize) out.add(text(r)); } return out; };
  const low = asked(1, 3), high = asked(13, 15);
  assert.ok(low.size > 0 && high.size > 0, `${id}: both ends draw from the bank`);
  assert.ok([...low].some((q) => !high.has(q)) || [...high].some((q) => !low.has(q)), `${id}: low and high tiers draw different questions`);
}
resetRandomSource();
for (const id of ['synonym-challenge', 'antonym-challenge', 'vocabulary-ladder']) {
  const asked = (lo: number, hi: number): Set<string> => { const out = new Set<string>(); for (let t = lo; t <= hi; t++) for (let k = 0; k < 40; k++) { setRandomSource(createSeededRandom(t * 7919 + k * 31 + id.length)); out.add(text(startRound(id, t, 1))); } return out; };
  const low = asked(1, 3), high = asked(13, 15);
  assert.ok([...low].some((q) => !high.has(q)) && [...high].some((q) => !low.has(q)), `${id}: low and high tiers draw different words`);
}
resetRandomSource();
// ---- position audit: the right button must not be in the same place every time
const biased: string[] = [];
for (const g of listGames()) {
  const positions: number[] = []; let options = 0;
  for (let tier = 1; tier <= 15; tier++) for (let level = 1; level <= levelsInTier(g.id, tier); level++) for (let k = 0; k < 10; k++) {
    setRandomSource(createSeededRandom(tier * 1000 + level * 100 + k * 13 + 5));
    const r = startRound(g.id, tier, level); if (r.kind !== 'choice' || !r.choices) continue;
    const ok = Array.isArray(r.accepted) ? r.accepted : [r.answer]; options = r.choices.length; positions.push((r.choices as unknown[]).findIndex((c) => ok.includes(c as string)));
  }
  if (positions.length < 30) continue;
  const counts = new Map<number, number>(); positions.forEach((q) => counts.set(q, (counts.get(q) ?? 0) + 1));
  const share = Math.max(...counts.values()) / positions.length; const limit = options <= 2 ? 0.8 : options === 3 ? 0.65 : 0.5;
  if (share > limit) biased.push(`${g.id} (${(share * 100).toFixed(0)}%)`);
}
resetRandomSource();
assert.deepEqual(biased, [], `the right answer sits in a predictable position in: ${biased.join(', ')}`);
assert.deepEqual(tierWindow([1, 2, 3, 4, 5, 6], 1), [1, 2, 3]);
assert.deepEqual(tierWindow([1, 2, 3, 4, 5, 6], 15), [4, 5, 6]);
assert.deepEqual(tierWindow([1, 2, 3], 8), [1, 2, 3]);
console.log(`PASS: tier-scaled generators re-solved independently (${Object.values(trace).reduce((a, b) => a + b, 0)} rounds over ${Object.keys(trace).length} generators); banks ordered and sliding.`);
