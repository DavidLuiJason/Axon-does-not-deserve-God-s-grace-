// CTX1 DIRECTOR CHECKS: hand-derived expectations, written BEFORE running. Not for builders.
declare const console: { log: (v: string) => void };
import { lookupContext } from '../src/decision/contextLookup';
import { makeActOrAskInput } from '../src/decision/actOrAskFeed';
let n = 0;
const L: (x: unknown) => any = lookupContext;
const eq = (a: unknown, b: unknown, l: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('FAIL ' + l + '\n got ' + JSON.stringify(a) + '\n exp ' + JSON.stringify(b)); n++; };
const M = (slot: string, kind: string) => ({ slot, kind });
const I = (id: string, source: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, source, kind, ...extra });
const A = (id: string, slot: string, kind: string) => ({ id, source: 'answer', kind, slot });
const F = (id: string, readable: boolean) => ({ id, source: 'attached', kind: 'file', readable });
const run = (missing: unknown[], items: unknown[]): any => L({ missing, items });
const val = (missing: unknown[], items: unknown[]): any => { const r = run(missing, items); if (!r.ok) throw new Error('unexpected error ' + r.error); return r.value; };
const T = (slot: string, outcome: string, rule: string, itemId: string | null, reason: string) => ({ slot, outcome, rule, itemId, reason });
const out = (ctx: string[], safe: string[], trace: unknown[]) => ({ contextFills: ctx, safeStepFills: safe, trace });

// C1 nothing at all
eq(val([], []), out([], [], []), 'C1 empty');
// C2 text slot, no item
eq(val([M('t', 'text')], []), out([], [], [T('t', 'not-filled', 'none', null, 'no-candidate')]), 'C2');
// C3 answer fills
eq(val([M('t', 'text')], [A('a1', 't', 'text')]), out(['t'], [], [T('t', 'context', 'R1', 'a1', 'ok')]), 'C3');
// C4 answer of another kind or another slot never counts
eq(val([M('t', 'text')], [A('a1', 't', 'number')]), out([], [], [T('t', 'not-filled', 'none', null, 'no-candidate')]), 'C4 kind');
eq(val([M('t', 'text')], [A('a1', 'u', 'text')]), out([], [], [T('t', 'not-filled', 'none', null, 'no-candidate')]), 'C5 slot');
// C6 two answers: ambiguous at R1, never falls to a later rule
eq(val([M('t', 'text')], [A('a1', 't', 'text'), A('a2', 't', 'text'), I('s1', 'selected', 'text')]), out([], [], [T('t', 'not-filled', 'R1', null, 'ambiguous')]), 'C6');
// C7 to C10 decision slots
eq(val([M('c', 'choice')], [A('a1', 'c', 'choice')]), out(['c'], [], [T('c', 'context', 'R1', 'a1', 'ok')]), 'C7 choice answer');
eq(val([M('c', 'choice')], [I('s1', 'selected', 'choice'), I('p1', 'previous-reference', 'choice')]), out([], [], [T('c', 'not-filled', 'R0', null, 'decision-slot')]), 'C8 choice object');
eq(val([M('y', 'yes-no')], [I('s1', 'selected', 'yes-no'), A('a1', 'y', 'text')]), out([], [], [T('y', 'not-filled', 'R0', null, 'decision-slot')]), 'C9 yes-no');
eq(val([M('c', 'choice')], [A('a1', 'c', 'choice'), A('a2', 'c', 'choice')]), out([], [], [T('c', 'not-filled', 'R1', null, 'ambiguous')]), 'C10');
// C11 to C18 the ladder
eq(val([M('t', 'text')], [I('s1', 'selected', 'text')]), out(['t'], [], [T('t', 'context', 'R2', 's1', 'ok')]), 'C11 selected');
eq(val([M('t', 'text')], [I('s1', 'selected', 'text'), I('s2', 'selected', 'text'), I('x1', 'attached', 'text')]), out([], [], [T('t', 'not-filled', 'R2', null, 'ambiguous')]), 'C12 two selected stop');
eq(val([M('t', 'text')], [I('s1', 'selected', 'number'), I('x1', 'attached', 'text')]), out(['t'], [], [T('t', 'context', 'R3', 'x1', 'ok')]), 'C13 selected wrong kind skipped');
eq(val([M('t', 'text')], [I('x1', 'attached', 'text'), I('x2', 'attached', 'text'), I('p1', 'previous-reference', 'text')]), out([], [], [T('t', 'not-filled', 'R3', null, 'ambiguous')]), 'C14');
eq(val([M('t', 'text')], [I('p1', 'previous-reference', 'text')]), out(['t'], [], [T('t', 'context', 'R4', 'p1', 'ok')]), 'C15');
eq(val([M('t', 'text')], [I('p1', 'previous-reference', 'text'), I('p2', 'previous-reference', 'text')]), out([], [], [T('t', 'not-filled', 'R4', null, 'ambiguous')]), 'C16');
eq(val([M('t', 'text')], [I('p1', 'previous-reference', 'text'), I('x1', 'attached', 'text'), I('s1', 'selected', 'text'), A('a1', 't', 'text')]), out(['t'], [], [T('t', 'context', 'R1', 'a1', 'ok')]), 'C17 answer first');
eq(val([M('t', 'text')], [I('p1', 'previous-reference', 'text'), I('x1', 'attached', 'text'), I('s1', 'selected', 'text')]), out(['t'], [], [T('t', 'context', 'R2', 's1', 'ok')]), 'C18 selected before attached');
// C19 to C23 safe step
eq(val([M('t', 'text')], [F('f1', true)]), out([], ['t'], [T('t', 'safe-step', 'R5', 'f1', 'ok')]), 'C19');
eq(val([M('t', 'text')], [F('f1', true), F('f2', true)]), out([], [], [T('t', 'not-filled', 'R5', null, 'ambiguous')]), 'C20');
eq(val([M('t', 'text')], [F('f1', false), F('f2', true)]), out([], ['t'], [T('t', 'safe-step', 'R5', 'f2', 'ok')]), 'C20b unreadable ignored');
eq(val([M('t', 'text')], [F('f1', false)]), out([], [], [T('t', 'not-filled', 'none', null, 'no-candidate')]), 'C21');
eq(val([M('t', 'text')], [F('f1', true), I('x1', 'attached', 'text')]), out(['t'], [], [T('t', 'context', 'R3', 'x1', 'ok')]), 'C22 R3 beats R5');
eq(val([M('n', 'number')], [F('f1', true)]), out([], [], [T('n', 'not-filled', 'none', null, 'no-candidate')]), 'C23 only text');
eq(val([M('t', 'text')], [I('s1', 'selected', 'file')]), out([], [], [T('t', 'not-filled', 'none', null, 'no-candidate')]), 'C23b selected file is not readable evidence');
// C24 to C28 other kinds
eq(val([M('f', 'file')], [F('f1', false)]), out(['f'], [], [T('f', 'context', 'R3', 'f1', 'ok')]), 'C24 file slot, readable irrelevant');
eq(val([M('f', 'file')], [I('s1', 'selected', 'file')]), out(['f'], [], [T('f', 'context', 'R2', 's1', 'ok')]), 'C25');
eq(val([M('n', 'number')], [I('s1', 'selected', 'number')]), out(['n'], [], [T('n', 'context', 'R2', 's1', 'ok')]), 'C26');
for (const k of ['duration', 'time', 'date']) eq(val([M('q', k)], [I('p1', 'previous-reference', k)]), out(['q'], [], [T('q', 'context', 'R4', 'p1', 'ok')]), 'C27 ' + k);
eq(val([M('f1', 'file'), M('f2', 'file')], [F('x', true)]), out(['f1', 'f2'], [], [T('f1', 'context', 'R3', 'x', 'ok'), T('f2', 'context', 'R3', 'x', 'ok')]), 'C28 one item may fill two slots');
// C29 mixed, order kept
eq(val([M('a', 'choice'), M('b', 'text'), M('c', 'text'), M('d', 'number')], [I('s1', 'selected', 'text'), F('f1', true), I('s2', 'selected', 'number'), A('a1', 'a', 'choice')]),
  out(['a', 'b', 'c', 'd'], [], [T('a', 'context', 'R1', 'a1', 'ok'), T('b', 'context', 'R2', 's1', 'ok'), T('c', 'context', 'R2', 's1', 'ok'), T('d', 'context', 'R2', 's2', 'ok')]), 'C29 mixed');
eq(val([M('b', 'text'), M('c', 'text')], [F('f1', true)]), out([], ['b', 'c'], [T('b', 'safe-step', 'R5', 'f1', 'ok'), T('c', 'safe-step', 'R5', 'f1', 'ok')]), 'C29b two text slots one file');
eq(val([M('z', 'text')], [I('p1', 'previous-reference', 'file')]), out([], [], [T('z', 'not-filled', 'none', null, 'no-candidate')]), 'C30 wrong kind');
// caps: selected 4, attached 8, previous-reference 8, answer 8
const many = (src: string, kind: string, k: number, extra?: (i: number) => Record<string, unknown>) => Array.from({ length: k }, (_, i) => ({ id: src + i, source: src, kind, ...(extra ? extra(i) : {}) }));
eq(run([], many('selected', 'text', 4)).ok, true, 'cap sel 4'); eq(run([], many('selected', 'text', 5)).error, 'too-many-items', 'cap sel 5');
eq(run([], many('attached', 'text', 8)).ok, true, 'cap att 8'); eq(run([], many('attached', 'text', 9)).error, 'too-many-items', 'cap att 9');
eq(run([], many('previous-reference', 'text', 8)).ok, true, 'cap prev 8'); eq(run([], many('previous-reference', 'text', 9)).error, 'too-many-items', 'cap prev 9');
eq(run([], many('answer', 'text', 8, i => ({ slot: 's' + i }))).ok, true, 'cap ans 8'); eq(run([], many('answer', 'text', 9, i => ({ slot: 's' + i }))).error, 'too-many-items', 'cap ans 9');
eq(run([], [...many('selected', 'text', 4), ...many('attached', 'text', 8), ...many('previous-reference', 'text', 8), ...many('answer', 'text', 8, i => ({ slot: 's' + i }))]).ok, true, 'all caps full');
// errors
const sym = Symbol('x');
eq(L(5).error, 'bad-input', 'E number'); eq(L(null).error, 'bad-input', 'E null'); eq(L([]).error, 'bad-input', 'E array'); eq(L('x').error, 'bad-input', 'E string');
eq(L({ missing: [] }).error, 'unknown-key', 'E missing key'); eq(L({ items: [] }).error, 'unknown-key', 'E no missing'); eq(L({ missing: [], items: [], z: 1 }).error, 'unknown-key', 'E extra key');
eq(L({ missing: [], items: [], [sym]: 1 }).error, 'unknown-key', 'E symbol key');
eq(run([] as unknown[], [] as unknown[]).ok, true, 'E ok base');
eq(L({ missing: 5, items: [] }).error, 'bad-missing', 'E missing not array');
eq(run([M('t', 'text'), M('t', 'number')], []).error, 'bad-missing', 'E dup slot'); eq(run([M('t', 'blob')], []).error, 'bad-missing', 'E bad kind');
eq(run([M('', 'text')], []).error, 'bad-missing', 'E empty slot'); eq(run([{ slot: 't', kind: 'text', x: 1 }], []).error, 'bad-missing', 'E extra key in entry'); eq(run([5], []).error, 'bad-missing', 'E entry not object');
eq(L({ missing: [], items: 5 }).error, 'bad-items', 'E items not array');
eq(run([], [I('a', 'long-term-note', 'text')]).error, 'bad-items', 'E unknown source (no memory notes)'); eq(run([], [I('a', 'memory', 'text')]).error, 'bad-items', 'E memory source');
for (const bad of ['note', 'notes', 'memory-note', 'previous', 'Selected', '']) eq(run([], [I('a', bad, 'text')]).error, 'bad-items', 'E source ' + bad);
eq(run([], [I('a', 'selected', 'blob')]).error, 'bad-items', 'E item kind');
eq(run([], [{ id: 'a', source: 'answer', kind: 'text' }]).error, 'bad-items', 'E answer without slot');
eq(run([], [{ id: 'a', source: 'answer', kind: 'text', slot: '' }]).error, 'bad-items', 'E answer empty slot');
eq(run([], [{ id: 'a', source: 'selected', kind: 'text', slot: 't' }]).error, 'bad-items', 'E slot on selected');
eq(run([], [{ id: 'a', source: 'attached', kind: 'file' }]).error, 'bad-items', 'E attached file without readable');
eq(run([], [{ id: 'a', source: 'attached', kind: 'file', readable: 'yes' }]).error, 'bad-items', 'E readable not boolean');
eq(run([], [{ id: 'a', source: 'attached', kind: 'text', readable: true }]).error, 'bad-items', 'E readable on attached text');
eq(run([], [{ id: 'a', source: 'selected', kind: 'file', readable: true }]).error, 'bad-items', 'E readable on selected file');
eq(run([], [{ id: 'a', source: 'answer', kind: 'file', slot: 'f', readable: true }]).error, 'bad-items', 'E readable on answer');
eq(run([], [I('a', 'selected', 'text'), I('a', 'attached', 'text')]).error, 'bad-items', 'E dup id');
eq(run([], [I('', 'selected', 'text')]).error, 'bad-items', 'E empty id'); eq(run([], [5]).error, 'bad-items', 'E item not object');
// error order
eq(L({ missing: 5, items: 5 }).error, 'bad-missing', 'order missing before items');
eq(run([], [...many('attached', 'text', 9), { id: 'bad', source: 'zzz', kind: 'text' }]).error, 'bad-items', 'order bad-items before too-many');
eq(L({ missing: [], items: [], get z() { throw new Error('x'); } }).error, 'unknown-key', 'extra getter key is an unknown key');
const boom: any = { items: [] }; Object.defineProperty(boom, 'missing', { enumerable: true, get() { throw new Error('boom'); } });
eq(L(boom).error, 'bad-input', 'throwing getter never throws');
eq(L(5).message, 'Context lookup input is invalid.', 'message');
eq(run([M('t', 'blob')], []).message, 'Context lookup input is invalid.', 'message 2');
// frozen, unchanged
const inM = [M('t', 'text')]; const inI = [A('a1', 't', 'text')]; const snap = JSON.stringify([inM, inI]);
const fr = val(inM, inI);
eq(Object.isFrozen(fr) && Object.isFrozen(fr.contextFills) && Object.isFrozen(fr.safeStepFills) && Object.isFrozen(fr.trace) && Object.isFrozen(fr.trace[0]), true, 'frozen deep');
eq(Object.isFrozen(run([], [], )), true, 'result frozen'); eq(Object.isFrozen(L(5)), true, 'error frozen');
eq(JSON.stringify([inM, inI]), snap, 'inputs unchanged');
eq(Object.keys(fr), ['contextFills', 'safeStepFills', 'trace'], 'value key order'); eq(Object.keys(fr.trace[0]), ['slot', 'outcome', 'rule', 'itemId', 'reason'], 'trace key order');
// LINK to the feed
const schema = { tool: 't1', effects: ['shows-result'], preconditions: [], undo: 'not-needed', slots: [{ name: 'text1', required: true }, { name: 'pick', required: true }] };
const feed = (lk: any, missingSlots: string[]) => (makeActOrAskInput as any)({ resolution: { kind: 'match', tool: 't1', missingSlots }, schemas: [schema], slotDefaults: [], extraReadingTools: [], contextFills: lk.contextFills, safeStepFills: lk.safeStepFills, charter: { never: [], ask: [] }, costly: false });
let lk = val([M('text1', 'text'), M('pick', 'choice')], [I('s1', 'selected', 'text'), A('a1', 'pick', 'choice')]);
let fd = feed(lk, ['text1', 'pick']); eq(fd.ok, true, 'link ok'); eq(fd.value.missing, 'CONTEXT-ANSWERS', 'link all context');
lk = val([M('text1', 'text'), M('pick', 'choice')], [I('s1', 'selected', 'text'), I('s2', 'selected', 'choice')]);
fd = feed(lk, ['text1', 'pick']); eq(fd.ok, true, 'link ok 2'); eq(fd.value.missing, 'OWNER-ONLY', 'link choice never from object');
lk = val([M('text1', 'text')], [F('f1', true)]);
fd = feed(lk, ['text1']); eq(fd.ok, true, 'link ok 3'); eq(fd.value.missing, 'SAFE-STEP-ANSWERS', 'link safe step');
lk = val([M('text1', 'text')], []);
fd = feed(lk, ['text1']); eq(fd.value.missing, 'OWNER-ONLY', 'link nothing found asks');
// seeded sweep
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const KINDS = ['text', 'choice', 'file', 'number', 'yes-no', 'duration', 'time', 'date'];
for (let t = 0; t < 3000; t++) {
  const ms: any[] = []; const k = Math.floor(rnd() * 6);
  for (let i = 0; i < k; i++) ms.push(M('s' + i, pick(KINDS)));
  const items: any[] = []; let id = 0;
  const caps: [string, number][] = [['selected', 4], ['attached', 8], ['previous-reference', 8], ['answer', 8]];
  for (const [src, cap] of caps) { const c = Math.floor(rnd() * (Math.min(cap, 3) + 1)); for (let i = 0; i < c; i++) { const kind = pick(KINDS); const it: any = { id: 'i' + id++, source: src, kind }; if (src === 'answer') it.slot = 's' + Math.floor(rnd() * 6); if (src === 'attached' && kind === 'file') it.readable = rnd() < 0.5; items.push(it); } }
  const r = L({ missing: ms, items }); if (!r.ok) throw new Error('sweep error ' + r.error);
  const v = r.value; const tr = v.trace;
  eq(tr.map((e: any) => e.slot), ms.map((m: any) => m.slot), 'sweep trace order ' + t);
  eq(v.contextFills.filter((s: string) => v.safeStepFills.includes(s)).length, 0, 'sweep disjoint ' + t);
  eq(v.contextFills, tr.filter((e: any) => e.outcome === 'context').map((e: any) => e.slot), 'sweep context list ' + t);
  eq(v.safeStepFills, tr.filter((e: any) => e.outcome === 'safe-step').map((e: any) => e.slot), 'sweep safe list ' + t);
  for (const e of tr) {
    const m = ms.find((x: any) => x.slot === e.slot);
    if (e.outcome === 'not-filled') { eq(e.itemId, null, 'sweep null item ' + t); continue; }
    const it = items.find((x: any) => x.id === e.itemId); eq(!!it, true, 'sweep item exists ' + t);
    if (e.outcome === 'context') eq(it.kind, m.kind, 'sweep kind ' + t);
    if (m.kind === 'choice' || m.kind === 'yes-no') eq(e.rule, 'R1', 'sweep decision only R1 ' + t);
    if (e.outcome === 'safe-step') { eq(m.kind, 'text', 'sweep safe text ' + t); eq(it.readable, true, 'sweep safe readable ' + t); }
    if (e.rule === 'R1') eq(it.source === 'answer' && it.slot === e.slot, true, 'sweep R1 item ' + t);
  }
}
console.log('CTX1 DIRECTOR CHECKS OK: ' + n + ' checks');
