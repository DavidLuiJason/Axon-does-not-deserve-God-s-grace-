// SETCHR2 Director test: the one adapter between the Charter Settings screen and the Charter writer (SETCHR1 V4 to V8).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CHARTER_KEY, readCharter, readCharterHistory } from '../src/mind/charter/charterStore.ts';
import { CHARTER_UNTRUSTED_NOTICE } from '../src/mind/charter/charterView.ts';
import { defaultCharter } from '../src/mind/charter/charter.ts';
import { APPROVAL_MS, CHARTER_BUILT_IN_LINE, CHARTER_RECOVERY_LINES, CHARTER_WIDENS_LINE, approvalFor, charterChangedLine, previewAxonProposal, previewChange, previewRecoveryChange, readCharterScreen, saveChange, saveRecovery, toolRulePatch } from '../src/mind/charter/charterSettings.ts';
import type { CharterStorage } from '../src/mind/charter/charterSettings.ts';
const sha = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16) + s.length.toString(16); };
let n = 0; const ck = (v: unknown, e: unknown, m: string) => { assert.deepEqual(v, e, m); n++; };
class Mem implements CharterStorage {
  m = new Map<string, string>(); failSet = false;
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { if (this.failSet) throw new Error('set'); this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  snap() { return JSON.stringify([...this.m.entries()]); }
}
const NOW = '2026-11-07T12:00:00Z';
const tokens = (...t: string[]) => { let i = 0; return () => t[i++] ?? `auto${i++}`; };
const E = (r: any) => (r.ok ? 'ok' : r.error);
const patchOf = (s: Mem, id: string, c: 'none' | 'ask' | 'never') => { const sc = readCharterScreen(s, sha); assert(sc.charter); const p: any = toolRulePatch(sc.charter, id, c); assert(!('ok' in p)); return p; };
function save(s: Mem, id: string, c: 'none' | 'ask' | 'never', tk: string[], used: string[] = [], now = NOW) {
  const patch = patchOf(s, id, c); const pv: any = previewChange(s, patch, sha); assert(pv.ok);
  return { pv, res: saveChange(s, { patch, seen: pv.seen, now, newToken: tokens(...tk), usedTokens: new Set(used) }, sha) as any };
}
// 1 reading: the three states, in plain words
const s0 = new Mem(); const r0 = readCharterScreen(s0, sha); ck([r0.status, r0.statusLine, r0.history, r0.recoveryNeeded], ['built-in', CHARTER_BUILT_IN_LINE, [], false], 'empty storage reads as built-in rules');
ck(Object.keys(r0.charter!.lanes).length, 11, 'the eleven default lanes are shown');
const bad = new Mem(); bad.m.set(CHARTER_KEY, 'junk'); const rb = readCharterScreen(bad, sha); ck([rb.status, rb.statusLine, rb.charter, rb.recoveryNeeded], ['untrusted', CHARTER_UNTRUSTED_NOTICE, null, true], 'an untrusted Charter shows the notice and asks for recovery');
// 2 a narrowing rule from the built-in Charter: one tap, written, signed, history kept
const src0 = (() => { const h = createHash('sha256'); const walk = (d: string): string[] => readdirSync(d).flatMap((e) => { const q = join(d, e); return statSync(q).isDirectory() ? walk(q) : [q]; }); for (const f of walk('src').sort()) { h.update(f); h.update(readFileSync(f)); } return h.digest('hex'); })();
const s1 = new Mem(); const a1 = save(s1, 'sort-lines', 'never', ['a', 'b']);
ck([a1.pv.widens, a1.pv.lines], [false, ['sort-lines: Never']], 'a narrowing change shows one plain line and no bold line');
ck([a1.res.ok, a1.res.revision, [...a1.res.usedTokens]], [true, 2, ['b']], 'saved as revision 2; only the signing token is used');
const r1 = readCharterScreen(s1, sha); ck([r1.status, r1.statusLine, r1.history], ['signed', charterChangedLine('2026-11-07'), [{ replacedAt: NOW }]], 'the screen reads signed, with the date, and one history entry');
ck((r1.charter!.lanes.tools.actions['tools.sort-lines'] as any).level, 'never', 'the rule is there');
// 3 a widening shows the bold line and needs both approvals (change and signature); both tokens are used
const a2 = save(s1, 'sort-lines', 'none', ['c', 'd'], ['b']);
ck([a2.pv.widens, a2.pv.lines], [true, ['tools.sort-lines changes from NEVER to ALLOWED.', CHARTER_WIDENS_LINE]], 'removing an existing Never rule is a real widening: the change line and the bold line');
ck([a2.res.ok, a2.res.revision, [...a2.res.usedTokens].sort()], [true, 3, ['b', 'c', 'd']], 'the widening saved with two fresh tokens, old tokens kept');
ck(readCharterScreen(s1, sha).history!.length, 2, 'two history entries, newest first');
// CHR5: "Ask me first" on a tool with no rule gives AXON no new freedom, so the sheet shows no bold line; the writer still takes both approvals (change.ts calls it a widening)
const a3 = save(s1, 'timer', 'ask', ['e', 'f']); ck([a3.pv.widens, a3.pv.lines, a3.res.ok, [...a3.res.usedTokens].sort()], [false, ['timer: Ask me first'], true, ['e', 'f']], 'CHR5: a first "ask" rule shows no bold line and still saves with two approvals');
const a5 = save(new Mem(), 'timer', 'none', ['i', 'j']); ck([a5.pv.widens, a5.pv.lines, a5.res.ok], [false, ['No effective Charter change is proposed.'], true], 'CHR5: "No extra rule" on a tool with no rule changes nothing and says so');
const a4 = save(s1, 'timer', 'never', ['g', 'h']); ck([a4.pv.widens, a4.res.ok], [false, true], 'ask to never narrows: no bold line');
// 4 the Charter changed after the owner looked: refused, nothing written
const s2 = new Mem(); const patch2 = patchOf(s2, 'sort-lines', 'never'); const seen2: any = previewChange(s2, patch2, sha); save(s2, 'timer', 'never', ['p', 'q']); const snap2 = s2.snap();
ck([E(saveChange(s2, { patch: patch2, seen: seen2.seen, now: NOW, newToken: tokens('r', 's'), usedTokens: new Set() }, sha)), s2.snap()], ['changed-since-preview', snap2], 'a stale preview is refused and nothing is written');
ck([E(saveChange(s2, { patch: patch2, seen: { changeHash: 'x', resultHash: 'y' }, now: NOW, newToken: tokens('r', 's'), usedTokens: new Set() }, sha)), s2.snap()], ['changed-since-preview', snap2], 'a made-up preview is refused');
// 5 approvals: replay, same token twice, bad generator, bad clock, failing storage
const s3 = new Mem(); const p3 = patchOf(s3, 'sort-lines', 'never'); const v3: any = previewChange(s3, p3, sha); const base3 = s3.snap();
const go = (over: any) => saveChange(s3, { patch: p3, seen: v3.seen, now: NOW, newToken: tokens('t1', 't2'), usedTokens: new Set(), ...over }, sha);
ck([E(go({ usedTokens: new Set(['t2']) })), s3.snap()], ['replayed', base3], 'a used token cannot sign again');
ck([E(go({ newToken: tokens('same', 'same') })), E(go({ newToken: tokens('', 'x') })), E(go({ newToken: 5 })), E(go({ now: 5 })), E(go({ seen: null })), s3.snap()], ['bad-input', 'bad-input', 'bad-input', 'bad-input', 'bad-input', base3], 'bad tokens and bad requests are refused');
ck([E(go({ now: 'not a date' })), s3.snap()], ['expired', base3], 'an unreadable clock never signs');
s3.failSet = true; ck([E(go({})), s3.snap()], ['storage-failed', base3], 'a failed save is reported and the store is unchanged'); s3.failSet = false;
ck(approvalFor('h', NOW, 't'), { by: 'owner', actionHash: 'h', issuedAt: NOW, expiresAt: '2026-11-07T12:02:00.000Z', token: 't' }, 'an approval lasts exactly two minutes'); ck([APPROVAL_MS, approvalFor('h', 'bad', 't').expiresAt], [120000, ''], 'a bad clock makes an approval that can never be used');
ck(E(go({})), 'ok', 'and the same request works when everything is right');
// 6 AXON can propose but never widen (V6); the proposal writes nothing
const s4 = new Mem(); const s4s = s4.snap(); const c4 = readCharterScreen(s4, sha).charter!;
const emailWide = { lanes: { email: { ...c4.lanes.email, actions: { ...c4.lanes.email.actions, 'email.send': { level: 'allowed' as const, reason: 'r' } } } } };
ck(E(previewAxonProposal(s4, emailWide, sha)), 'axon-cannot-widen', 'AXON cannot propose a widening'); ck(E(previewAxonProposal(s4, toolRulePatch(c4, 'timer', 'ask') as any, sha)), 'ok', 'AXON may propose a tool rule that only tightens, even a first one');
const wideShown: any = previewChange(s4, emailWide, sha); ck([wideShown.widens, wideShown.lines[wideShown.lines.length - 1]], [true, CHARTER_WIDENS_LINE], 'a real widening in another lane still shows the bold line');
const ap: any = previewAxonProposal(s4, toolRulePatch(c4, 'timer', 'never') as any, sha); ck([ap.ok, ap.widens, s4.snap()], [true, false, s4s], 'AXON can propose a narrowing; it waits for the owner and writes nothing');
ck(E(previewAxonProposal(bad, toolRulePatch(c4, 'timer', 'never') as any, sha)), 'store-untrusted', 'no proposal on an untrusted Charter');
// 7 untrusted: no change, recovery needed, one tap, text kept
ck([E(previewChange(bad, toolRulePatch(c4, 'timer', 'never') as any, sha)), E(saveChange(bad, { patch: toolRulePatch(c4, 'timer', 'never') as any, seen: { changeHash: 'a', resultHash: 'b' }, now: NOW, newToken: tokens('x', 'y'), usedTokens: new Set() }, sha))], ['store-untrusted', 'store-untrusted'], 'an untrusted Charter cannot be changed, only recovered');
const rv: any = previewRecoveryChange(bad, sha); ck([rv.ok, rv.needed, rv.line], [true, true, CHARTER_RECOVERY_LINES['charter-untrusted']], 'the recovery sheet has its line');
const badSnap = bad.snap();
ck([E(saveRecovery(bad, { seen: 'wrong', now: NOW, newToken: tokens('r1'), usedTokens: new Set() }, sha)), bad.snap()], ['hash-mismatch', badSnap], 'recovery bound to something else is refused');
ck([E(saveRecovery(bad, { seen: rv.seen, now: NOW, newToken: tokens('r1'), usedTokens: new Set(['r1']) }, sha)), bad.snap()], ['replayed', badSnap], 'a used token cannot recover');
ck([E(saveRecovery(bad, { seen: rv.seen, now: NOW, newToken: 5 as any, usedTokens: new Set() }, sha)), E(saveRecovery(bad, { seen: 5 as any, now: NOW, newToken: tokens('r1'), usedTokens: new Set() }, sha))], ['bad-input', 'bad-input'], 'bad recovery requests');
const rec: any = saveRecovery(bad, { seen: rv.seen, now: NOW, newToken: tokens('r1'), usedTokens: new Set() }, sha); ck([rec.ok, [...rec.usedTokens]], [true, ['r1']], 'recovery works');
const rb2 = readCharterScreen(bad, sha); ck([rb2.status, rb2.statusLine, rb2.recoveryNeeded, (readCharterHistory(bad) as any).entries[0].text], ['built-in', CHARTER_BUILT_IN_LINE, false, 'junk'], 'back to built-in, the broken text is in History');
ck(previewRecoveryChange(new Mem(), sha), { ok: true, needed: false }, 'a healthy store needs no recovery');
const hbad = new Mem(); hbad.m.set('axon.charter.history', '{x'); const hv: any = previewRecoveryChange(hbad, sha); ck([hv.needed, hv.line, readCharterScreen(hbad, sha).history], [true, CHARTER_RECOVERY_LINES['history-unreadable'], null], 'a bad history is shown as unreadable (null), never as empty');
// 8 the tool rule builder
ck(E(toolRulePatch(c4, 'timer', 'bogus' as any) as any), 'bad-input', 'bad choice'); ck(E(toolRulePatch(c4, '', 'ask') as any), 'bad-input', 'empty tool id'); ck(E(toolRulePatch(null as any, 'timer', 'ask') as any), 'bad-input', 'no charter');
const full = defaultCharter(); full.lanes.tools = { id: 'tools', name: 'Tools', actions: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`tools.t${i}`, { level: 'never', reason: 'r' }])) } as any;
ck([E(toolRulePatch(full, 'new-one', 'ask') as any), ('lanes' in (toolRulePatch(full, 't5', 'ask') as any))], ['cap-reached', true], 'a full Tools list refuses a new tool but still changes an existing one');
ck(Object.keys(((toolRulePatch(c4, 'timer', 'none') as any).lanes.tools.actions)), ['tools.timer'], '"No extra rule" is written as a rule, never as a removal (change.ts counts a removal as narrowing)');
ck([(toolRulePatch(c4, 'timer', 'none') as any).lanes.tools.actions['tools.timer'].level, (toolRulePatch(c4, 'timer', 'ask') as any).lanes.tools.actions['tools.timer'].reason], ['allowed', 'Set by the owner in Settings.'], 'none is allowed; reason fixed');
// 9 ratchets: only the adapter reaches recovery; the screen never reaches the writer; the source is untouched (N3)
const walk = (d: string): string[] => readdirSync(d).flatMap((e) => { const q = join(d, e).split('\\').join('/'); return statSync(q).isDirectory() ? walk(q) : [q]; });
const texts: Record<string, string> = {}; for (const f of walk('src').filter((q) => q.endsWith('.ts') || q.endsWith('.tsx'))) texts[f] = readFileSync(f, 'utf8');
const ALLOWED = ['src/mind/charter/charterRecovery.ts', 'src/mind/charter/charterSettings.ts'];
ck(Object.entries(texts).filter(([f, t]) => !ALLOWED.includes(f) && (t.includes('charterRecovery') || t.includes('recoverCharter'))).map(([f]) => f), [], 'only the adapter reaches the recovery');
ck(Object.entries(texts).filter(([f, t]) => f.startsWith('src/components/') && ['charterStore', 'charterRecovery', 'writeCharter', 'axon.charter'].some((m) => t.includes(m))).map(([f]) => f), [], 'no screen reaches the Charter store or writer directly (they import charterSettings.ts)');
const src1 = (() => { const h = createHash('sha256'); for (const f of walk('src').sort()) { h.update(f); h.update(readFileSync(f)); } return h.digest('hex'); })(); ck(src1, src0, 'src tree byte-identical after every save and recovery (N3)');
ck(readCharter(s1, sha).status, 'signed', 'last: the saved store still verifies');
console.log(`CHARTER_SETTINGS OK: ${n} checks`);
