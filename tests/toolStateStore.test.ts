// STATE2 Director test: the keeper of timer, stopwatch and tally state (STATE1 S1 to S4, S8) and its single-writer ratchet.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clearToolState, readToolState, toolStateKey, TOOL_STATE_MAX_CHARS, TOOL_STATE_PREFIX, unusableStateLine, validToolId, writeToolState, browserToolStateStorage } from '../src/tools/state/toolStateStore.ts';
import type { ToolStateStorage } from '../src/tools/state/toolStateStore.ts';
import { startTimer } from '../src/tools/engines/time/timer.ts';
import { startStopwatch } from '../src/tools/engines/time/stopwatch.ts';
import { addCounter, createTally } from '../src/tools/engines/time/tally.ts';
import type { TallyState } from '../src/tools/engines/time/tally.ts';
let n = 0; const ck = (v: unknown, e: unknown, m: string) => { assert.deepEqual(v, e, m); n++; };
class Mem implements ToolStateStorage {
  m = new Map<string, string>(); failGet = false; failSet = false; corruptSet = false; stuck = false; failRemove = false;
  getItem(k: string) { if (this.failGet) throw new Error('get'); return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { if (this.failSet) throw new Error('set'); const c = this.corruptSet; this.corruptSet = false; this.m.set(k, c ? v + 'X' : v); }
  removeItem(k: string) { if (this.failRemove) throw new Error('rm'); if (!this.stuck) this.m.delete(k); }
  snap() { return JSON.stringify([...this.m.entries()]); }
}
const AT = '2026-11-07T12:00:00Z'; const K = 'axon.toolstate.v1.timer';
const E = (r: { ok: boolean; error?: string }) => (r.ok ? 'ok' : r.error);
// 1 names and keys
ck([validToolId('timer'), validToolId('tally-counter'), validToolId(''), validToolId('Timer'), validToolId('a b'), validToolId('a/b'), validToolId('x'.repeat(65)), validToolId(5)], [true, true, false, false, false, false, false, false], 'tool ids are plain lowercase words');
ck([TOOL_STATE_PREFIX, toolStateKey('timer'), TOOL_STATE_MAX_CHARS], ['axon.toolstate.v1.', K, 100000], 'key shape and size cap');
ck(browserToolStateStorage(), null, 'no window in node: no storage');
// 2 round trips with the real engine states (the three tools)
const timer = startTimer(60000, 1000); assert(timer.ok); const sw = startStopwatch(2000); assert(sw.ok);
let tally: TallyState = createTally(); const a = addCounter(tally, 'cups', 2); assert(a.ok); tally = a.value;
const s = new Mem(); ck(readToolState(s, 'timer'), { kind: 'absent' }, 'first use is absent, not unusable');
for (const [id, st] of [['timer', timer.value], ['stopwatch', sw.value], ['tally-counter', tally]] as const) {
  ck(E(writeToolState(s, id, st, AT)), 'ok', `${id} saved`);
  ck(readToolState(s, id), { kind: 'ok', state: JSON.parse(JSON.stringify(st)), savedAt: AT }, `${id} reads back equal (a restart gives the same state)`);
}
ck(s.m.size, 3, 'one key per tool');
const t2 = startTimer(5000, 9000); assert(t2.ok); writeToolState(s, 'timer', t2.value, AT); ck((readToolState(s, 'timer') as any).state.durationMs, 5000, 'a second write replaces the first');
// 3 bad reads are unusable, never absent, never a guess (S2, S3)
const bad = (text: string | null, why: string, reason: string) => { const m = new Mem(); if (text !== null) m.m.set(K, text); ck(readToolState(m, 'timer'), { kind: 'unusable', reason }, why); };
bad('not json', 'garbage text', 'not-json'); bad('', 'empty text', 'not-json'); bad('[]', 'an array', 'bad-shape'); bad('null', 'null', 'bad-shape'); bad('5', 'a number', 'bad-shape');
bad(JSON.stringify({ v: 1, toolId: 'timer', state: {} }), 'no savedAt', 'bad-shape'); bad(JSON.stringify({ v: 1, toolId: 'timer', savedAt: AT }), 'no state', 'bad-shape');
bad(JSON.stringify({ v: 2, toolId: 'timer', savedAt: AT, state: {} }), 'wrong version', 'wrong-version'); bad(JSON.stringify({ v: 1, toolId: 'stopwatch', savedAt: AT, state: {} }), 'another tool\'s record under this key', 'wrong-tool');
bad('x'.repeat(TOOL_STATE_MAX_CHARS + 1), 'over the cap', 'too-large');
const g = new Mem(); g.failGet = true; ck(readToolState(g, 'timer'), { kind: 'unusable', reason: 'unreadable' }, 'a read error is unreadable, never absent');
ck(readToolState(new Mem(), 'Bad Id'), { kind: 'unusable', reason: 'bad-shape' }, 'a bad tool id is refused');
ck(unusableStateLine('timer'), 'I could not read the earlier timer, so I treat it as gone.', 'S3 wording');
// 4 write failures keep the old state and say so (S4)
const w = new Mem(); writeToolState(w, 'timer', timer.value, AT); const before = w.snap();
ck([E(writeToolState(w, 'Bad Id', {}, AT)), E(writeToolState(w, 'timer', {}, 5 as any)), E(writeToolState(w, 'timer', undefined, AT))], ['bad-input', 'bad-input', 'bad-input'], 'bad input');
const circ: any = {}; circ.self = circ; ck([E(writeToolState(w, 'timer', circ, AT)), E(writeToolState(w, 'timer', 1n as any, AT))], ['not-serializable', 'not-serializable'], 'not serializable');
ck(E(writeToolState(w, 'timer', 'x'.repeat(TOOL_STATE_MAX_CHARS), AT)), 'too-large', 'refused loudly over the cap'); ck(w.snap(), before, 'a refused write changes nothing');
w.failSet = true; ck([E(writeToolState(w, 'timer', t2.value, AT)), w.snap()], ['storage-failed', before], 'a failed save is reported and the old state stays'); w.failSet = false;
w.corruptSet = true; ck([E(writeToolState(w, 'timer', t2.value, AT)), w.snap()], ['verify-failed', before], 'a bad read-back restores the old state');
const f = new Mem(); f.corruptSet = true; ck([E(writeToolState(f, 'timer', t2.value, AT)), f.m.size], ['verify-failed', 0], 'a bad read-back on a first save leaves nothing');
const gg = new Mem(); gg.failGet = true; ck(E(writeToolState(gg, 'timer', t2.value, AT)), 'storage-failed', 'an unreadable store is not written blind');
// 5 clear (S8): the key is removed
const c = new Mem(); writeToolState(c, 'timer', timer.value, AT); ck([E(clearToolState(c, 'timer')), c.m.size, readToolState(c, 'timer')], ['ok', 0, { kind: 'absent' }], 'reset removes the key');
ck(E(clearToolState(new Mem(), 'timer')), 'ok', 'clearing nothing is fine'); ck(E(clearToolState(c, 'a b')), 'bad-input', 'bad id');
const c2 = new Mem(); writeToolState(c2, 'timer', timer.value, AT); c2.failRemove = true; ck(E(clearToolState(c2, 'timer')), 'storage-failed', 'a failed remove is reported'); c2.failRemove = false; c2.stuck = true; ck(E(clearToolState(c2, 'timer')), 'verify-failed', 'a key that is still there is a failure');
// 6 worst-case size (S8, measured here): the tally is the only state that can grow
const snapshot = (k: number): TallyState => ({ counters: Object.fromEntries(Array.from({ length: k }, (_, i) => [`counter-${i}`, { name: `counter-${i}`, value: i, step: 1 }])), history: [] });
const grown = (k: number): TallyState => ({ ...snapshot(k), history: Array.from({ length: 100 }, () => snapshot(k)) });
const size = (k: number) => JSON.stringify({ v: 1, toolId: 'tally-counter', savedAt: AT, state: grown(k) }).length;
const big = new Mem();
ck([size(10) <= TOOL_STATE_MAX_CHARS, E(writeToolState(big, 'tally-counter', grown(10), AT))], [true, 'ok'], '10 counters with a full 100-step undo history fit');
ck([size(60) > TOOL_STATE_MAX_CHARS, E(writeToolState(big, 'tally-counter', grown(60), AT))], [true, 'too-large'], '60 counters with a full history are refused loudly, not cut');
ck((readToolState(big, 'tally-counter') as any).state.history.length, 100, 'the refused write left the earlier tally untouched');
// 7 ratchet: no module outside the keeper may call the write or clear function (S4); the lane's go-live adapter joins this list deliberately later
function files(dir: string, out: string[] = []): string[] { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) { if (e !== 'node_modules') files(p, out); } else out.push(p.split('\\').join('/')); } return out; }
const ALLOWED_STATE_WRITERS: string[] = [];
const offenders = (texts: Record<string, string>) => Object.entries(texts).filter(([f, t]) => f !== 'src/tools/state/toolStateStore.ts' && !ALLOWED_STATE_WRITERS.includes(f) && ['writeToolState', 'clearToolState', 'axon.toolstate'].some((m) => t.includes(m))).map(([f]) => f);
const real: Record<string, string> = {}; for (const p of files('src').filter((q) => q.endsWith('.ts') || q.endsWith('.tsx'))) real[p] = readFileSync(p, 'utf8');
ck(offenders(real), [], 'nothing in src outside the keeper writes or clears tool state');
ck(offenders({ 'src/a.ts': "import { writeToolState } from './x'", 'src/b.ts': 'const a = 1', 'src/c.ts': "localStorage.setItem('axon.toolstate.v1.timer', t)", 'src/d.ts': 'clearToolState(s, id)' }), ['src/a.ts', 'src/c.ts', 'src/d.ts'], 'the scanner catches a stray writer');
console.log(`TOOL_STATE_STORE OK: ${n} checks`);
