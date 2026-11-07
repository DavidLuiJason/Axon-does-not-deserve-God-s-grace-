// CHR4 Director test: the owner's way back from an untrusted Charter or an unreadable history (SETCHR1 F1).
import assert from 'node:assert/strict';
import { CHARTER_HISTORY_KEY, CHARTER_HISTORY_MAX, CHARTER_KEY, previewCharterChange, readCharter, readCharterHistory, writeCharter } from '../src/mind/charter/charterStore.ts';
import type { CharterStorage } from '../src/mind/charter/charterStore.ts';
import { RECOVERY_KEEP_MAX, previewRecovery, recoverCharter } from '../src/mind/charter/charterRecovery.ts';
import type { OwnerApproval } from '../src/mind/charter/change.ts';
const sha = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16) + s.length.toString(16); };
let n = 0; const ck = (v: unknown, e: unknown, m: string) => { assert.deepEqual(v, e, m); n++; };
class Mem implements CharterStorage {
  m = new Map<string, string>(); failGetKey: string | null = null; failSetKey: string | null = null; failRemove = false; corruptHistory = false;
  getItem(k: string) { if (this.failGetKey === k) throw new Error('get'); return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { if (this.failSetKey === k) throw new Error('set'); const c = this.corruptHistory && k === CHARTER_HISTORY_KEY; this.m.set(k, c ? '[[' : v); }
  removeItem(k: string) { if (this.failRemove) throw new Error('rm'); this.m.delete(k); }
  snap() { return JSON.stringify([...this.m.entries()]); }
}
const NOW = '2026-11-07T12:00:00Z'; const EXP = '2026-11-07T12:02:00Z';
const appr = (hash: string, token: string, exp = EXP): OwnerApproval => ({ by: 'owner', actionHash: hash, issuedAt: NOW, expiresAt: exp, token });
const E = (r: any) => (r.ok ? 'ok' : r.error);
const pv = (s: CharterStorage): any => { const p: any = previewRecovery(s, sha); assert(p.ok && p.needed, 'preview must say needed'); return p; };
const rq = (s: CharterStorage, token = 't1', over: any = {}) => ({ approval: appr(pv(s).recoveryHash, token), now: NOW, usedTokens: new Set<string>(), ...over });
const lane = (rules: Record<string, 'allowed' | 'ask' | 'never'>) => ({ id: 'tools', name: 'Tools', actions: Object.fromEntries(Object.entries(rules).map(([k, l]) => [k, { level: l, reason: 'r' }])) });
function signedStore(): Mem {   // a real signed Charter and one history entry, written through the one writer
  const s = new Mem(); const patch = { lanes: { tools: lane({ 'tools.x': 'never' }) } }; const p: any = previewCharterChange(s, patch, sha); assert(p.ok);
  const w: any = writeCharter(s, { patch, changeApproval: p.widens ? appr(p.changeHash, 'c1') : null, signApproval: appr(p.resultHash, 's1'), now: NOW, usedTokens: new Set() }, sha); assert(w.ok); return s;
}
// 1 healthy stores need nothing
ck(previewRecovery(new Mem(), sha), { ok: true, needed: false }, 'empty storage is healthy');
const h = signedStore(); ck(previewRecovery(h, sha), { ok: true, needed: false }, 'a signed Charter with a good history is healthy');
const hs = h.snap(); ck([E(recoverCharter(h, { approval: appr('any', 'h0'), now: NOW, usedTokens: new Set() }, sha)), h.snap()], ['not-needed', hs], 'recovery on a healthy store refuses and changes nothing');
ck(E(previewRecovery(null as any, sha)), 'bad-input', 'bad storage'); ck(E(previewRecovery(new Mem(), null as any)), 'bad-input', 'bad hash function');
// 2 untrusted Charter: kept in history, built-in back, approval required
const u = new Mem(); u.m.set(CHARTER_KEY, 'garbage'); const p1 = pv(u); ck([p1.problem, typeof p1.recoveryHash], ['charter-untrusted', 'string'], 'garbage text is untrusted');
ck(readCharter(u, sha).status, 'untrusted', 'it is untrusted before');
const us = u.snap();
ck([E(recoverCharter(u, { approval: null, now: NOW, usedTokens: new Set() }, sha)), u.snap()], ['approval-required', us], 'no approval: nothing changes');
ck([E(recoverCharter(u, { ...rq(u), approval: { ...appr('x', 't') , by: 'axon' } as any }, sha)), u.snap()], ['approval-required', us], 'an approval not from the owner is refused');
ck([E(recoverCharter(u, { ...rq(u), approval: appr('wrong-hash', 't2') }, sha)), u.snap()], ['hash-mismatch', us], 'an approval for something else is refused');
ck([E(recoverCharter(u, rq(u, 't3', { now: '2026-11-07T12:03:00Z' }), sha)), u.snap()], ['expired', us], 'an expired approval is refused');
ck([E(recoverCharter(u, rq(u, 't4', { usedTokens: new Set(['t4']) }), sha)), u.snap()], ['replayed', us], 'a used token is refused');
ck([E(recoverCharter(u, rq(u, 't5', { now: 'not a date' }), sha)), u.snap()], ['expired', us], 'a bad clock is refused');
const r1: any = recoverCharter(u, rq(u, 't6'), sha); ck([r1.ok, r1.problem, [...r1.usedTokens]], [true, 'charter-untrusted', ['t6']], 'recovery works with a matching approval and returns the used token');
ck(readCharter(u, sha).status, 'built-in', 'the built-in Charter is back'); ck(u.m.has(CHARTER_KEY), false, 'the broken key is gone');
const hist1: any = readCharterHistory(u); ck([hist1.ok, hist1.entries.length, hist1.entries[0].text, hist1.entries[0].note], [true, 1, 'garbage', '[untrusted charter kept 2026-11-07T12:00:00Z]'], 'the untrusted text is kept in the history, not lost');
ck(previewRecovery(u, sha), { ok: true, needed: false }, 'after recovery nothing more is needed'); ck(E(recoverCharter(u, { approval: appr('any', 'z'), now: NOW, usedTokens: new Set() }, sha)), 'not-needed', 'a second run has nothing to do');
// 3 a tampered signed Charter is recovered too, and the history keeps what was there
const t = signedStore(); const good = t.m.get(CHARTER_KEY) as string; t.m.set(CHARTER_KEY, good.replace('"revision":2', '"revision":3'));
ck([readCharter(t, sha).status, pv(t).problem], ['untrusted', 'charter-untrusted'], 'a tampered Charter is untrusted'); const before = (readCharterHistory(t) as any).entries.length;
ck(E(recoverCharter(t, rq(t, 'tt'), sha)), 'ok', 'tampered Charter recovered'); const th: any = readCharterHistory(t); ck([th.entries.length, th.entries[th.entries.length - 1].text.includes('"revision":3')], [before + 1, true], 'the tampered text is the newest history entry; the older entries are kept');
// 4 an unreadable history with a good Charter: the Charter stays, the broken history is kept as one entry
const hu = signedStore(); const keepCharter = hu.m.get(CHARTER_KEY); hu.m.set(CHARTER_HISTORY_KEY, '{broken');
const p2 = pv(hu); ck(p2.problem, 'history-unreadable', 'bad history is its own problem');
ck(E(recoverCharter(hu, rq(hu, 'h1'), sha)), 'ok', 'history recovered'); ck(hu.m.get(CHARTER_KEY), keepCharter, 'the signed Charter is NOT reset when only the history was bad');
const hh: any = readCharterHistory(hu); ck([hh.ok, hh.entries.length, hh.entries[0].text], [true, 1, '{broken'], 'the broken history is kept as one entry');
// 5 both bad
const b = new Mem(); b.m.set(CHARTER_KEY, 'x'); b.m.set(CHARTER_HISTORY_KEY, 'y'); ck(pv(b).problem, 'both', 'both bad'); ck(E(recoverCharter(b, rq(b, 'b1'), sha)), 'ok', 'both recovered');
const bh: any = readCharterHistory(b); ck([readCharter(b, sha).status, bh.entries.map((e: any) => e.text)], ['built-in', ['y', 'x']], 'both texts are kept');
// 6 unreadable storage (throws) can be recovered when removing works; the text that cannot be read is not invented
const th2 = new Mem(); th2.m.set(CHARTER_KEY, 'z'); th2.failGetKey = CHARTER_KEY; ck(pv(th2).problem, 'charter-untrusted', 'a read error is untrusted'); const th2s = th2.snap();
ck([E(recoverCharter(th2, rq(th2, 'g1'), sha)), th2.snap()], ['storage-failed', th2s], 'text that cannot be read cannot be kept, so nothing is removed');
const th3 = new Mem(); th3.m.set(CHARTER_HISTORY_KEY, 'y'); th3.failGetKey = CHARTER_HISTORY_KEY; const th3s = th3.snap(); ck([E(recoverCharter(th3, rq(th3, 'g2'), sha)), th3.snap()], ['storage-failed', th3s], 'a history that cannot be read is not overwritten');
// 7 failures restore what was there
const f1 = new Mem(); f1.m.set(CHARTER_KEY, 'garbage'); f1.failSetKey = CHARTER_HISTORY_KEY; const f1s = f1.snap(); ck([E(recoverCharter(f1, rq(f1, 'f1'), sha)), f1.snap()], ['storage-failed', f1s], 'a failed history write changes nothing');
const f2 = new Mem(); f2.m.set(CHARTER_KEY, 'garbage'); f2.failRemove = true; const f2s = f2.snap(); const e2 = E(recoverCharter(f2, rq(f2, 'f2'), sha)); ck([e2, f2.m.get(CHARTER_KEY), f2.m.has(CHARTER_HISTORY_KEY)], ['storage-failed', 'garbage', true], 'a failed remove leaves the broken Charter in place; the extra history entry is harmless and loses nothing');
const f3 = new Mem(); f3.m.set(CHARTER_KEY, 'garbage'); f3.corruptHistory = true; ck([E(recoverCharter(f3, rq(f3, 'f3'), sha)), f3.m.get(CHARTER_KEY)], ['verify-failed', 'garbage'], 'a bad read-back restores the old text');
// 8 size and caps
const big = new Mem(); big.m.set(CHARTER_KEY, 'q'.repeat(RECOVERY_KEEP_MAX + 50)); ck(E(recoverCharter(big, rq(big, 'k1'), sha)), 'ok', 'a huge broken text is recovered'); ck((readCharterHistory(big) as any).entries[0].text.length, RECOVERY_KEEP_MAX, 'kept text is cut at the cap');
const full = new Mem(); const mk = (i: number) => ({ replacedAt: `2026-01-${String(i + 1).padStart(2, '0')}`, note: `n${i}`, text: 't' }); full.m.set(CHARTER_HISTORY_KEY, JSON.stringify(Array.from({ length: CHARTER_HISTORY_MAX }, (_, i) => mk(i)))); full.m.set(CHARTER_KEY, 'junk');
ck(E(recoverCharter(full, rq(full, 'm1'), sha)), 'ok', 'full history recovered'); const fh: any = readCharterHistory(full); ck([fh.entries.length, fh.entries[0].note, fh.entries[fh.entries.length - 1].text], [CHARTER_HISTORY_MAX, 'n1', 'junk'], 'history stays at 20: the oldest drops, the new entry is last');
// 9 the preview writes nothing and binds to what was seen
const pw = new Mem(); pw.m.set(CHARTER_KEY, 'junk'); const ps = pw.snap(); previewRecovery(pw, sha); ck(pw.snap(), ps, 'preview writes nothing');
const pa = pv(pw).recoveryHash; pw.m.set(CHARTER_KEY, 'other junk'); ck(pv(pw).recoveryHash === pa, false, 'the hash changes when the stored text changes, so an old approval cannot apply');
console.log(`CHARTER_RECOVERY OK: ${n} checks`);
