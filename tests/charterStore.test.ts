// CHR3 Director test: storage adapter, the single writer, the single-writer ratchet and the source-untouched proof (N3).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defaultCharter, charterHash } from '../src/mind/charter/charter.ts';
import type { Charter } from '../src/mind/charter/charter.ts';
import { browserCharterStorage, CHARTER_HISTORY_KEY, CHARTER_HISTORY_MAX, CHARTER_KEY, previewCharterChange, readCharter, readCharterHistory, writeCharter } from '../src/mind/charter/charterStore.ts';
import type { CharterStorage, WriteRequest } from '../src/mind/charter/charterStore.ts';
import { charterToFeedView, serializeCharter } from '../src/mind/charter/charterView.ts';
import type { OwnerApproval } from '../src/mind/charter/change.ts';
const sha = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
let n = 0; const ck = (v: unknown, e: unknown, m: string) => { assert.deepEqual(v, e, m); n++; };
class Mem implements CharterStorage {
  m = new Map<string, string>(); failGet = false; failSet: string | null = null; corruptSet: string | null = null; failRemove = false;
  getItem(k: string) { if (this.failGet) throw new Error('get'); return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { if (this.failSet === k) throw new Error('set'); const c = this.corruptSet === k; if (c) this.corruptSet = null; this.m.set(k, c ? v + 'X' : v); }
  removeItem(k: string) { if (this.failRemove) throw new Error('rm'); this.m.delete(k); }
  snap() { return JSON.stringify([...this.m.entries()]); }
}
const lane = (rules: Record<string, 'allowed' | 'ask' | 'never'>) => ({ id: 'tools', name: 'Tools', actions: Object.fromEntries(Object.entries(rules).map(([k, l]) => [k, { level: l, reason: 'r' }])) });
const NOW = '2026-11-06T12:00:00Z'; const LATER = '2026-11-06T13:00:00Z'; const EXP = '2027-01-01T00:00:00Z';
const appr = (hash: string, token: string, exp = EXP): OwnerApproval => ({ by: 'owner', actionHash: hash, issuedAt: NOW, expiresAt: exp, token });
// build a request for a patch the way a Settings screen will: preview first, then the owner approves the two hashes
function req(st: CharterStorage, rules: Record<string, 'allowed' | 'ask' | 'never'>, tok: string, now = NOW, used: string[] = [], over: Partial<WriteRequest> = {}): WriteRequest {
  const patch = { lanes: { tools: lane(rules) } }; const p = previewCharterChange(st, patch, sha); assert(p.ok);
  return { patch, changeApproval: p.widens ? appr(p.changeHash, tok + 'c') : null, signApproval: appr(p.resultHash, tok + 's'), now, usedTokens: new Set(used), ...over };
}
// 1 reads
const s1 = new Mem(); ck(readCharter(s1, sha).status, 'built-in', 'empty storage is the built-in default');
s1.failGet = true; const r1: any = readCharter(s1, sha); ck([r1.status, r1.reason], ['untrusted', 'unreadable'], 'a read error is unreadable, never absent');
s1.failGet = false; s1.m.set(CHARTER_KEY, ''); ck((readCharter(s1, sha) as any).reason, 'not-json', 'empty text'); s1.m.set(CHARTER_KEY, 'garbage'); ck((readCharter(s1, sha) as any).reason, 'not-json', 'garbage text');
ck(browserCharterStorage(), null, 'no window in node: no storage'); ck(readCharterHistory(new Mem()), { ok: true, entries: [] }, 'no history yet');
// 2 a narrowing write from the built-in default
const st = new Mem(); const before = st.snap(); const q = previewCharterChange(st, { lanes: { tools: lane({ 'tools.sort-lines': 'never' }) } }, sha); assert(q.ok); ck([q.widens, st.snap()], [false, before], 'preview widens nothing and writes nothing');
const w1: any = writeCharter(st, req(st, { 'tools.sort-lines': 'never' }, 'a'), sha); ck([w1.ok, w1.revision, [...w1.usedTokens]], [true, 2, ['as']], 'narrowing write works, one token used');
const l1: any = readCharter(st, sha); ck([l1.status, l1.charter.revision], ['signed', 2], 'reads back signed');
const v1: any = charterToFeedView({ load: l1, toolIds: ['sort-lines', 'counter'], links: [] }); ck([v1.value.never, v1.value.ask, v1.value.status], [['sort-lines'], [], 'signed'], 'the view sees the new rule');
const h1: any = readCharterHistory(st); ck([h1.entries.length, h1.entries[0].note, h1.entries[0].replacedAt, h1.entries[0].text], [1, `[replaced ${NOW}]`, NOW, (serializeCharter(defaultCharter()) as any).text], 'the replaced default is kept in the history');
// 3 a second write keeps exactly the replaced text
const prevText = st.getItem(CHARTER_KEY);
const w2: any = writeCharter(st, req(st, { 'tools.sort-lines': 'never', 'tools.counter': 'ask' }, 'b', LATER), sha); ck([w2.ok, w2.revision], [true, 3], 'second write');
const h2: any = readCharterHistory(st); ck([h2.entries.length, h2.entries[1].text, h2.entries[1].note], [2, prevText, `[replaced ${LATER}]`], 'history keeps the exact replaced text, newest last');
// 4 widening needs the owner; nothing is written when it fails
const snap = st.snap(); const wide = { 'tools.sort-lines': 'ask' as const, 'tools.counter': 'ask' as const };
const e = (r: any) => (r.ok ? 'ok' : r.error);
ck(e(writeCharter(st, req(st, wide, 'c', NOW, [], { changeApproval: null }), sha)), 'approval-required', 'widening without approval'); ck(st.snap(), snap, 'storage unchanged');
ck(e(writeCharter(st, req(st, wide, 'c', NOW, [], { changeApproval: appr('wrong', 'cc') }), sha)), 'approval-required', 'widening with a wrong hash'); ck(st.snap(), snap, 'storage unchanged');
ck(e(writeCharter(st, req(st, wide, 'c', NOW, ['cc']), sha)), 'replayed', 'the change token was used before'); ck(st.snap(), snap, 'storage unchanged');
ck(e(writeCharter(st, req(st, wide, 'c', '2028-01-01T00:00:00Z'), sha)), 'expired', 'approval expired'); ck(st.snap(), snap, 'storage unchanged');
ck(e(writeCharter(st, req(st, wide, 'c', NOW, [], { signApproval: appr('wrong', 'cs') }), sha)), 'hash-mismatch', 'signature approval for another Charter'); ck(st.snap(), snap, 'storage unchanged');
const same = req(st, wide, 'c'); ck(e(writeCharter(st, { ...same, signApproval: { ...(same.signApproval), token: (same.changeApproval as OwnerApproval).token } }, sha)), 'replayed', 'one token cannot approve both steps'); ck(st.snap(), snap, 'storage unchanged');
const w3: any = writeCharter(st, req(st, wide, 'c'), sha); ck([w3.ok, w3.revision], [true, 4], 'widening with both approvals works');
ck(e(writeCharter(st, req(st, { 'tools.sort-lines': 'never' }, 'd', NOW, [], { patch: { lanes: { tools: lane({}) } } as any }), sha)) !== 'ok', true, 'an empty lane is not silently accepted as a no-op write of a bad hash');
// 5 an untrusted store is never overwritten; a corrupt history blocks writes
const bad = new Mem(); bad.m.set(CHARTER_KEY, '{"version":1}'); const bs = bad.snap();
ck(e(writeCharter(bad, req(st, { 'tools.x': 'never' }, 'x'), sha)), 'store-untrusted', 'untrusted store'); ck(bad.snap(), bs, 'untrusted store unchanged'); ck((previewCharterChange(bad, { lanes: {} }, sha) as any).error, 'store-untrusted', 'preview refuses too');
const ch = new Mem(); ch.m.set(CHARTER_HISTORY_KEY, 'oops'); const cs = ch.snap(); ck(e(writeCharter(ch, req(new Mem(), { 'tools.x': 'never' }, 'x'), sha)), 'history-unreadable', 'corrupt history'); ck(ch.snap(), cs, 'corrupt history unchanged');
// 6 storage failures
const f1 = new Mem(); const rq = req(f1, { 'tools.x': 'never' }, 'f'); f1.failSet = CHARTER_HISTORY_KEY; ck([e(writeCharter(f1, rq, sha)), f1.snap()], ['storage-failed', '[]'], 'history write fails: nothing written');
const f2 = new Mem(); f2.failSet = CHARTER_KEY; ck([e(writeCharter(f2, req(f2, { 'tools.x': 'never' }, 'f'), sha)), f2.getItem(CHARTER_KEY)], ['storage-failed', null], 'charter write fails: charter unchanged');
const f3 = new Mem(); const rq3 = req(f3, { 'tools.x': 'never' }, 'f'); f3.corruptSet = CHARTER_KEY; ck([e(writeCharter(f3, rq3, sha)), f3.getItem(CHARTER_KEY)], ['verify-failed', null], 'read-back failure removes a first write');
const f4 = new Mem(); assert((writeCharter(f4, req(f4, { 'tools.x': 'never' }, 'g'), sha) as any).ok); const old = f4.getItem(CHARTER_KEY); const rq4 = req(f4, { 'tools.x': 'never', 'tools.y': 'never' }, 'h'); f4.corruptSet = CHARTER_KEY; ck([e(writeCharter(f4, rq4, sha)), f4.getItem(CHARTER_KEY)], ['verify-failed', old], 'read-back failure restores the old text');
const f5 = new Mem(); f5.getItem = () => { throw new Error('g'); }; ck(e(writeCharter(f5, rq, sha)), 'store-untrusted', 'unreadable store is not written');
ck(e(writeCharter(new Mem(), null as any, sha)), 'bad-input', 'null request'); ck(e(writeCharter(new Mem(), { ...rq, signApproval: null as any }, sha)), 'bad-input', 'no sign approval');
// 7 history cap: 22 writes keep the newest 20, oldest dropped
const cap = new Mem(); const rules: Record<string, 'never'> = {}; let last = '';
for (let i = 1; i <= 22; i++) { rules[`tools.r${i}`] = 'never'; last = cap.getItem(CHARTER_KEY) as string; const r: any = writeCharter(cap, req(cap, { ...rules }, `k${i}`, `2026-11-06T${String(i % 24).padStart(2, '0')}:00:00Z`), sha); assert(r.ok, `write ${i}: ${r.error}`); }
const hc: any = readCharterHistory(cap); ck([hc.entries.length, CHARTER_HISTORY_MAX, hc.entries[19].text], [20, 20, last], 'history capped at 20, newest last');
// 8 N3: the source files are byte-identical after any Charter action; and the single-writer ratchet
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const digest = () => { const h = createHash('sha256'); for (const f of files('src').sort()) { h.update(f); h.update(readFileSync(f)); } return h.digest('hex'); };
const d0 = digest(); const z = new Mem(); writeCharter(z, req(z, { 'tools.q': 'never' }, 'z'), sha); writeCharter(z, req(z, wide, 'zz'), sha); ck(digest(), d0, 'src tree byte-identical after Charter writes (N3)');
const ALLOWED_WRITER_IMPORTERS: string[] = ['src/mind/charter/charterRecovery.ts', 'src/mind/charter/charterSettings.ts'];   // deliberate (CHR4, SETCHR2): the owner-confirmed recovery and Settings adapter only; the screen imports charterSettings.ts, never charterStore.ts
const MARKS = ['writeCharter', 'CHARTER_KEY', 'CHARTER_HISTORY_KEY', 'axon.charter', 'charterStore'];
const offenders = (texts: Record<string, string>) => Object.entries(texts).filter(([f, t]) => f !== 'src/mind/charter/charterStore.ts' && !ALLOWED_WRITER_IMPORTERS.includes(f) && MARKS.some((m) => t.includes(m))).map(([f]) => f);
const real: Record<string, string> = {}; for (const f of files('src').filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))) real[f.split('\\').join('/')] = readFileSync(f, 'utf8');
ck(offenders(real), [], 'nothing in src outside charterStore.ts reaches the Charter writer or its keys');
ck(offenders({ 'src/x.ts': "import { writeCharter } from './a'", 'src/y.ts': 'const a = 1', 'src/z.ts': "localStorage.setItem('axon.charter.v1', t)", 'src/w.ts': "export * from './charterStore.ts'" }), ['src/x.ts', 'src/z.ts', 'src/w.ts'], 'the scanner catches a writer import, a key use and a re-export');
console.log(`CHARTER_STORE OK: ${n} checks`);
