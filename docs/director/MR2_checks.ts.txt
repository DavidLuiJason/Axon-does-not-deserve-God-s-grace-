// MR2 DIRECTOR CHECKS: hand-derived expectations, written BEFORE running. Not for builders.
declare const console: { log: (v: string) => void };
import { composeReply } from '../src/decision/composeReply';
let n = 0;
const C: (x: unknown) => any = composeReply;
const eq = (a: unknown, b: unknown, l: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('FAIL ' + l + '\n got ' + JSON.stringify(a) + '\n exp ' + JSON.stringify(b)); n++; };
const A = (own: string, text: string) => ({ kind: 'answered', own, text });
const Q = (own: string, question: string, holdLine: string) => ({ kind: 'asks', own, question, holdLine });
const W = (own: string, line: string) => ({ kind: 'waits', own, line });
const X = (own: string, line: string, reason = 'tool refused') => ({ kind: 'failed', own, line, reason });
const R = (pieces: unknown[]): any => { const r = C({ pieces }); if (!r.ok) throw new Error('unexpected ' + r.error); return r.value; };
const V = (text: string, answered: number[], pending: number | null, held: number[], waiting: number[], failed: number[]) => ({ text, answered, pending, held, waiting, failed });
// one piece: no echo, nothing changes
eq(R([A('count words in "a b c"', '3 words')]), V('3 words', [0], null, [], [], []), 'M1 one answered');
eq(R([Q('convert', 'Which format?', 'later')]), V('Which format?', [], 0, [], [], []), 'M2 one asks');
eq(R([W('plan a trip', 'This needs deeper thought.')]), V('This needs deeper thought.', [], null, [], [0], []), 'M3 one waits');
eq(R([X('sort x', 'The sort tool refused: empty text.')]), V('The sort tool refused: empty text.', [], null, [], [], [0]), 'M4 one failed');
// two pieces: echo
eq(R([A('count words', '3 words'), A('count lines', '1 line')]), V('count words: 3 words\n\ncount lines: 1 line', [0, 1], null, [], [], []), 'M5 two answered, asked order');
eq(R([Q('convert hi', 'To which case?', 'I will ask about the case next.'), A('count words', '3 words')]), V('count words: 3 words\n\nconvert hi: To which case?', [1], 0, [], [], []), 'M6 answered first, then the question (Q2)');
eq(R([A('a', '1'), W('b', 'waits'), X('c', 'failed line')]), V('a: 1\n\nb: waits\n\nc: failed line', [0], null, [], [1], [2]), 'M7 answered, waits, failed');
eq(R([W('b', 'waits'), A('a', '1')]), V('a: 1\n\nb: waits', [1], null, [], [0], []), 'M8 waits listed after answered');
// two asks: first pending, other held (Q3)
eq(R([Q('p', 'Q-p?', 'H-p'), Q('q', 'Q-q?', 'H-q')]), V('p: Q-p?\n\nq: H-q', [], 0, [1], [], []), 'M9 two asks, one at a time');
eq(R([A('a', '1'), Q('p', 'Q-p?', 'H-p'), W('w', 'W-w'), Q('q', 'Q-q?', 'H-q'), X('x', 'X-x')]), V('a: 1\n\np: Q-p?\n\nq: H-q\n\nw: W-w\n\nx: X-x', [0], 1, [3], [2], [4]), 'M10 all kinds');
eq(R([W('w1', 'L1'), W('w2', 'L2'), W('w3', 'L3')]), V('w1: L1\n\nw2: L2\n\nw3: L3', [], null, [], [0, 1, 2], []), 'M11 three waits in order');
eq(R([A('a', 'x'), A('b', 'y'), A('c', 'z')]), V('a: x\n\nb: y\n\nc: z', [0, 1, 2], null, [], [], []), 'M12 three answered');
eq(R([A('one', 'multi\nline answer'), A('two', '2')]), V('one: multi\nline answer\n\ntwo: 2', [0, 1], null, [], [], []), 'M13 inner newline kept');
eq(R([X('a', 'F', 'r1'), X('b', 'G', 'r2')]), V('a: F\n\nb: G', [], null, [], [], [0, 1]), 'M14 reason not shown');
eq(R([A('a', '1'), A('b', '2'), A('c', '3'), A('d', '4'), A('e', '5'), A('f', '6')]).answered, [0, 1, 2, 3, 4, 5], 'M15 six pieces ok');
// errors
eq(C(5).error, 'bad-input', 'E1'); eq(C(null).error, 'bad-input', 'E2'); eq(C([]).error, 'bad-input', 'E3');
eq(C({}).error, 'unknown-key', 'E4'); eq(C({ pieces: [], x: 1 }).error, 'unknown-key', 'E5'); eq(C({ pieces: [A('a', '1')], [Symbol('s')]: 1 }).error, 'unknown-key', 'E6');
eq(C({ pieces: 5 }).error, 'bad-pieces', 'E7 not array'); eq(C({ pieces: [] }).error, 'bad-pieces', 'E8 empty');
eq(C({ pieces: [{ kind: 'zzz', own: 'a', text: 'b' }] }).error, 'bad-pieces', 'E9 kind');
eq(C({ pieces: [A('', '1')] }).error, 'bad-pieces', 'E10 empty own'); eq(C({ pieces: [A('a', '')] }).error, 'bad-pieces', 'E11 empty text');
eq(C({ pieces: [A(' a', '1')] }).error, 'bad-pieces', 'E12 leading space'); eq(C({ pieces: [A('a', '1 ')] }).error, 'bad-pieces', 'E13 trailing space'); eq(C({ pieces: [A('a', '\n')] }).error, 'bad-pieces', 'E14 only whitespace');
eq(C({ pieces: [{ kind: 'answered', own: 'a' }] }).error, 'bad-pieces', 'E15 missing key'); eq(C({ pieces: [{ kind: 'answered', own: 'a', text: 'b', extra: 1 }] }).error, 'bad-pieces', 'E16 extra key');
eq(C({ pieces: [{ kind: 'asks', own: 'a', question: 'q' }] }).error, 'bad-pieces', 'E17 asks without holdLine');
eq(C({ pieces: [{ kind: 'failed', own: 'a', line: 'l' }] }).error, 'bad-pieces', 'E18 failed without reason'); eq(C({ pieces: [{ kind: 'waits', own: 'a', line: 'l', reason: 'r' }] }).error, 'bad-pieces', 'E19 waits with reason');
eq(C({ pieces: [A('a', 5 as any)] }).error, 'bad-pieces', 'E20 text not string'); eq(C({ pieces: [5] }).error, 'bad-pieces', 'E21 piece not object'); eq(C({ pieces: [null] }).error, 'bad-pieces', 'E22 null piece');
eq(C({ pieces: Array.from({ length: 7 }, (_, i) => A('p' + i, 'x')) }).error, 'too-many-pieces', 'E23 seven');
eq(C({ pieces: [...Array.from({ length: 7 }, (_, i) => A('p' + i, 'x')), { kind: 'zzz' }] }).error, 'bad-pieces', 'E24 invalid beats too many');
const boom: any = {}; Object.defineProperty(boom, 'pieces', { enumerable: true, get() { throw new Error('boom'); } }); eq(C(boom).error, 'bad-input', 'E25 throwing getter');
eq(C(5).message, 'Reply composer input is invalid.', 'E26 message'); eq(C({ pieces: [] }).message, 'Reply composer input is invalid.', 'E27 message');
// frozen, unchanged
const inp = { pieces: [A('a', '1'), Q('p', 'Q?', 'H')] }; const snap = JSON.stringify(inp); const fr = R(inp.pieces);
eq(Object.isFrozen(fr) && Object.isFrozen(fr.answered) && Object.isFrozen(fr.held) && Object.isFrozen(fr.waiting) && Object.isFrozen(fr.failed), true, 'frozen deep');
eq(Object.isFrozen(C({ pieces: [A('a', '1')] })) && Object.isFrozen(C(5)), true, 'results frozen'); eq(JSON.stringify(inp), snap, 'input unchanged');
eq(Object.keys(fr), ['text', 'answered', 'pending', 'held', 'waiting', 'failed'], 'key order');
// seeded sweep: invariants
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (let t = 0; t < 3000; t++) {
  const k = 1 + Math.floor(rnd() * 6); const ps: any[] = [];
  for (let i = 0; i < k; i++) { const r = rnd(); const o = 'own' + i + 'x';
    ps.push(r < 0.3 ? A(o, 'ans' + i + 'x') : r < 0.55 ? Q(o, 'qst' + i + 'x', 'hld' + i + 'x') : r < 0.8 ? W(o, 'wat' + i + 'x') : X(o, 'fal' + i + 'x')); }
  const v = R(ps);
  const all = [...v.answered, ...(v.pending === null ? [] : [v.pending]), ...v.held, ...v.waiting, ...v.failed].sort((a, b) => a - b);
  eq(all, ps.map((_: any, i: number) => i), 'sweep every piece exactly once ' + t);
  eq(v.answered, ps.map((p: any, i: number) => p.kind === 'answered' ? i : -1).filter((i: number) => i >= 0), 'sweep answered ' + t);
  const asks = ps.map((p: any, i: number) => p.kind === 'asks' ? i : -1).filter((i: number) => i >= 0);
  eq(v.pending, asks.length ? asks[0] : null, 'sweep pending is the first ask ' + t); eq(v.held, asks.slice(1), 'sweep held ' + t);
  // no words of the composer's own: remove every piece string, only ': ' and newlines may remain
  let rest = v.text; for (const p of ps) for (const key of ['own', 'text', 'question', 'holdLine', 'line']) if ((p as any)[key]) rest = rest.split((p as any)[key]).join('');
  eq(rest.split('').every((c: string) => c === ':' || c === ' ' || c === '\n'), true, 'sweep no composer words ' + t);
  eq(ps.every((p: any) => v.text.includes(p.own)) || ps.length === 1, true, 'sweep echo when 2 or more ' + t);
  // order: answered text blocks come before the pending question, which comes before waits and failures
  const pos = (s: string) => v.text.indexOf(s);
  if (v.answered.length && v.pending !== null) eq(pos('ans' + v.answered[v.answered.length - 1] + 'x') < pos('qst' + v.pending + 'x'), true, 'sweep answered before question ' + t);
  if (v.pending !== null && v.waiting.length) eq(pos('qst' + v.pending + 'x') < pos('wat' + v.waiting[0] + 'x'), true, 'sweep question before waits ' + t);
}
console.log('MR2 DIRECTOR CHECKS OK: ' + n + ' checks');
