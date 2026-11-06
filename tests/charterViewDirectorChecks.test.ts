import assert from 'node:assert/strict';
import { defaultCharter, charterHash } from '../src/mind/charter/charter.ts';
import type { Charter } from '../src/mind/charter/charter.ts';
import { charterToFeedView, loadCharterText, serializeCharter } from '../src/mind/charter/charterView.ts';
const sha = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
let n = 0; const ck = (v: unknown, e: unknown, m: string) => { assert.deepEqual(v, e, m); n++; };
const mk = (lanes: Record<string, Record<string, 'allowed' | 'ask' | 'never'>>): Charter => { const o: Record<string, any> = {}; for (const [id, acts] of Object.entries(lanes)) { const a: Record<string, any> = {}; for (const [k, l] of Object.entries(acts)) a[k] = { level: l, reason: 'r' }; o[id] = { id, name: id, actions: a }; } return { version: 1, revision: 1, lanes: o, fences: { neverTouch: [], maxSpendPerAction: 0, maxSpendPerDay: 0 }, createdAt: '', signedAt: null, signature: null }; };
const sign = (c: Charter): Charter => { const d = { ...c, signedAt: '2026-11-06T00:00:00Z' }; return { ...d, signature: `${charterHash(d, sha)}:owner` }; };
const sg = (c: Charter) => loadCharterText({ kind: 'text', text: (serializeCharter(c) as any).text }, sha);
const bi = loadCharterText({ kind: 'absent' }, sha);
const view = (load: any, toolIds: string[], links: any[]) => { const r: any = charterToFeedView({ load, toolIds, links }); assert(r.ok); return { never: r.value.never, ask: r.value.ask }; };
// DIRECTOR FINDING (CHR2 return): a declared action named like an inherited property (constructor, toString, __proto__ ...) was found "allowed" on a parsed Charter, so the tool stayed free. Unknown declared action must go UP to ask, on parsed AND null-prototype lanes.
const S = sg(sign(mk({ tools: { 'tools.x': 'allowed' } })));
for (const a of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
  ck(view(S, ['x'], [{ tool: 'x', actions: [a] }]), { never: [], ask: ['x'] }, `parsed charter, inherited name ${a} goes up to ask`);
  ck(view(bi, ['x'], [{ tool: 'x', actions: [a] }]), { never: [], ask: ['x'] }, `built-in charter, inherited name ${a} goes up to ask`);
}
// an inherited name used as a TOOL id is not a rule
ck(view(S, ['constructor', 'toString', 'x'], []), { never: [], ask: [] }, 'inherited tool ids have no rule');
// a never elsewhere still wins over the unknown-action ask
ck(view(bi, ['x'], [{ tool: 'x', actions: ['constructor', 'money.pay'] }]), { never: ['x'], ask: [] }, 'never beats the unknown-action ask');
// link order does not matter
ck(view(bi, ['x'], [{ tool: 'x', actions: ['money.pay', 'email.send'] }]), view(bi, ['x'], [{ tool: 'x', actions: ['email.send', 'money.pay'] }]), 'action order irrelevant');
// untrusted view still checks the link shape and the load shape
const e = (a: any) => { const r: any = charterToFeedView(a); return r.ok ? 'ok' : r.error; };
ck(e({ load: { status: 'untrusted', reason: 'x' }, toolIds: [], links: [] }), 'bad-load', 'untrusted load without a charter key');
ck(e({ load: { status: 'untrusted', reason: 'whatever', charter: null }, toolIds: ['a'], links: [] }), 'ok', 'any non-empty reason string is accepted');
ck(e({ load: bi, toolIds: ['a'], links: [{ tool: 'a', actions: ['x'], [Symbol('s')]: 1 }] }), 'bad-links', 'symbol key inside a link');
ck(e({ load: bi, toolIds: ['a'], links: [{ tool: '', actions: [] }] }), 'bad-links', 'empty link tool is a shape error, not an unknown tool');
// serialize: output is valid JSON and keeps the signature
const sgn = sign(mk({ tools: { 'tools.x': 'ask' } })); const txt = (serializeCharter(sgn) as any).text;
ck(JSON.parse(txt).signature, sgn.signature, 'signature kept in the text'); ck(typeof JSON.parse(txt).signedAt, 'string', 'signedAt kept');
ck((loadCharterText({ kind: 'text', text: txt }, sha) as any).status, 'signed', 'serialized signed charter loads as signed');
// the default charter shipped as source keeps the pinned hash and a fresh object per call
ck(charterHash(defaultCharter(), sha), '167fb2be', 'default pin'); assert.notEqual((loadCharterText({ kind: 'absent' }, sha) as any).charter, (loadCharterText({ kind: 'absent' }, sha) as any).charter); n++;
console.log(`CHARTER_VIEW DIRECTOR CHECKS OK: ${n} checks`);
