import test from 'node:test';
import assert from 'node:assert/strict';
import { readScreenStructure } from '../src/screen-intelligence/structure-reader.mjs';
import { proposeAction, confirmProposal } from '../src/screen-intelligence/action-gate.mjs';

const NOW = 1_000_000;
const screen = (extra = []) => readScreenStructure({ packageName: 'com.example.shop', capturedAt: NOW - 1000, screen: { width: 1000, height: 2000 }, nodes: [{ className: 'LinearLayout', children: [
  { className: 'android.widget.Button', text: 'Back to list', clickable: true, bounds: { l: 0, t: 0, r: 200, b: 100 } },
  { className: 'android.widget.Button', text: 'Pay now', clickable: true, bounds: { l: 0, t: 200, r: 400, b: 300 } },
  { className: 'android.widget.EditText', text: 'x', hint: 'Note', editable: true, bounds: { l: 0, t: 400, r: 800, b: 500 } },
  { className: 'android.widget.Switch', contentDescription: 'Gift wrap', checkable: true, clickable: true, bounds: { l: 0, t: 600, r: 400, b: 700 } },
  { className: 'android.widget.Button', text: 'Disabled one', clickable: true, enabled: false, bounds: { l: 0, t: 800, r: 400, b: 900 } },
  { className: 'android.widget.Button', text: 'Far away', clickable: true, bounds: { l: 0, t: 5000, r: 400, b: 5100 } },
  { className: 'androidx.recyclerview.widget.RecyclerView', contentDescription: 'Items', scrollable: true, bounds: { l: 0, t: 1000, r: 1000, b: 1900 } },
  ...extra,
] }] });
const ref = (s, text) => s.elements.find((e) => e.label.toLowerCase().includes(text)).ref;
const go = (s, req, o = {}) => proposeAction(s, req, { now: NOW, ...o });

test('plain navigation taps, scrolls, back and home are allowed', () => {
  const s = screen();
  assert.equal(go(s, { kind: 'tap', ref: ref(s, 'back to list') }).decision, 'allow');
  assert.equal(go(s, { kind: 'scroll', ref: ref(s, 'items'), direction: 'down' }).decision, 'allow');
  assert.equal(go(s, { kind: 'back' }).decision, 'allow');
  assert.equal(go(s, { kind: 'home' }).decision, 'allow');
  assert.equal(go(s, { kind: 'open-app', packageName: 'com.android.settings' }).decision, 'allow');
});
test('paying, typing and switching ask first, with a plain sentence', () => {
  const s = screen();
  const pay = go(s, { kind: 'tap', ref: ref(s, 'pay now') });
  assert.deepEqual([pay.decision, pay.code], ['ask', 'risky-control']);
  assert.equal(pay.summary, 'Tap "Pay now" in com.example.shop');
  assert.equal(go(s, { kind: 'type', ref: ref(s, 'note'), text: 'hello' }).code, 'typing');
  assert.equal(go(s, { kind: 'toggle', ref: ref(s, 'gift wrap') }).code, 'setting-change');
});
test('password fields are never typed into; card-like text is refused', () => {
  const s = screen([{ className: 'android.widget.EditText', password: true, editable: true, bounds: { l: 0, t: 1200, r: 800, b: 1300 } }]);
  const pw = s.elements.find((e) => e.label === '[password field]').ref;
  assert.equal(go(s, { kind: 'type', ref: pw, text: 'abc' }).code, 'password-field');
  assert.equal(go(s, { kind: 'type', ref: ref(s, 'note'), text: '4111 1111 1111 1111' }).code, 'card-number');
  assert.equal(go(s, { kind: 'type', ref: ref(s, 'note'), text: '1234 5678 9012 3456' }).decision, 'ask');
});
test('a sign-in screen makes even a plain tap ask, but scrolling stays allowed', () => {
  const s = screen([{ className: 'android.widget.EditText', password: true, editable: true, bounds: { l: 0, t: 1200, r: 800, b: 1300 } }]);
  assert.equal(go(s, { kind: 'tap', ref: ref(s, 'back to list') }).code, 'sign-in-screen');
  assert.equal(go(s, { kind: 'scroll', ref: ref(s, 'items') }).decision, 'allow');
});
test('bad targets are refused: missing, disabled, off-screen, wrong action', () => {
  const s = screen();
  assert.equal(go(s, { kind: 'tap', ref: 'e999' }).code, 'no-such-element');
  assert.equal(go(s, { kind: 'tap', ref: ref(s, 'disabled one') }).code, 'element-disabled');
  assert.equal(go(s, { kind: 'tap', ref: ref(s, 'far away') }).code, 'off-screen');
  assert.equal(go(s, { kind: 'type', ref: ref(s, 'back to list'), text: 'x' }).code, 'not-supported-by-element');
  assert.equal(go(s, { kind: 'dance' }).code, 'unknown-action');
  assert.equal(go(s, { kind: 'type', ref: ref(s, 'note'), text: '' }).code, 'no-text');
  assert.equal(go(s, { kind: 'type', ref: ref(s, 'note'), text: 'a'.repeat(501) }).code, 'text-too-long');
});
test('stale, missing and blocked screens are refused', () => {
  const s = screen();
  assert.equal(go(s, { kind: 'tap', ref: ref(s, 'back to list') }, { now: NOW + 10000 }).code, 'stale-screen');
  assert.equal(go({ ok: false }, { kind: 'tap', ref: 'e1' }).code, 'no-screen');
  assert.equal(go(s, { kind: 'tap', ref: ref(s, 'back to list') }, { policy: { blockedPackages: ['com.example.shop'] } }).code, 'package-blocked');
  assert.equal(go(s, { kind: 'open-app', packageName: 'x.y' }, { policy: { blockedPackages: ['x.y'] } }).code, 'package-blocked');
});
test('autonomy levels: read-only refuses everything, ask-everything asks everything', () => {
  const s = screen();
  assert.equal(go(s, { kind: 'back' }, { policy: { autonomy: 'read-only' } }).code, 'read-only');
  for (const req of [{ kind: 'back' }, { kind: 'tap', ref: ref(s, 'back to list') }, { kind: 'open-app', packageName: 'a.b' }]) {
    assert.equal(go(s, req, { policy: { autonomy: 'ask-everything' } }).decision, 'ask');
  }
});
test('too many actions in a minute are refused', () => {
  const s = screen();
  const history = Array.from({ length: 20 }, (_, i) => NOW - i * 1000);
  assert.equal(go(s, { kind: 'back' }, { history }).code, 'too-fast');
  assert.equal(go(s, { kind: 'back' }, { history: history.slice(0, 5) }).decision, 'allow');
});
test('confirmProposal: allowed goes through, asked needs a fresh yes, refused never', () => {
  const s = screen();
  const ok = go(s, { kind: 'tap', ref: ref(s, 'back to list') });
  const r = confirmProposal(ok, {}, { now: NOW });
  assert.equal(r.execute, true); assert.deepEqual(r.payload.center, { x: 100, y: 50 });
  const ask = go(s, { kind: 'tap', ref: ref(s, 'pay now') });
  assert.equal(confirmProposal(ask, {}, { now: NOW }).reason, 'not-approved');
  assert.equal(confirmProposal(ask, { approved: 'yes' }, { now: NOW }).execute, false);
  assert.equal(confirmProposal(ask, { approved: true }, { now: NOW + 30000 }).execute, true);
  assert.equal(confirmProposal(ask, { approved: true }, { now: NOW + 61000 }).reason, 'approval-expired');
  assert.equal(confirmProposal(go(s, { kind: 'tap', ref: 'e999' }), { approved: true }).execute, false);
  assert.equal(confirmProposal(undefined, { approved: true }).execute, false);
});
test('typed text only reaches the payload after approval and is never in the summary', () => {
  const s = screen();
  const p = go(s, { kind: 'type', ref: ref(s, 'note'), text: 'private words' });
  assert.ok(!p.summary.includes('private words')); assert.match(p.summary, /Type 13 characters/);
  assert.equal(confirmProposal(p, { approved: true }, { now: NOW }).payload.text, 'private words');
});
