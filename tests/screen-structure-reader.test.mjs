import test from 'node:test';
import assert from 'node:assert/strict';
import { readScreenStructure, findElements, diffStructures, roleOf, describeScreen } from '../src/screen-intelligence/structure-reader.mjs';

const snap = (extra = {}) => ({
  packageName: 'com.example.shop', windowTitle: 'Cart', screen: { width: 1080, height: 2400 },
  nodes: [{ className: 'android.widget.LinearLayout', children: [
    { className: 'android.widget.TextView', text: 'Your cart', bounds: { l: 0, t: 0, r: 500, b: 100 } },
    { className: 'android.widget.EditText', text: 'secret@mail.com', hint: 'Email', editable: true, bounds: { l: 0, t: 200, r: 900, b: 300 } },
    { className: 'android.widget.EditText', text: 'hunter2', password: true, editable: true, bounds: { l: 0, t: 320, r: 900, b: 400 } },
    { className: 'android.widget.Button', text: 'Pay now', clickable: true, bounds: { l: 0, t: 500, r: 400, b: 600 } },
    { className: 'android.widget.Button', text: 'Back', clickable: true, bounds: { l: 0, t: 700, r: 400, b: 800 } },
    { className: 'android.view.View', visible: false, text: 'hidden ad' },
    { className: 'android.view.View' },
    { className: 'android.widget.Switch', contentDescription: 'Gift wrap', checkable: true, checked: false, clickable: true, bounds: { l: 0, t: 900, r: 400, b: 1000 } },
    { className: 'android.widget.Button', text: 'Far below', clickable: true, bounds: { l: 0, t: 5000, r: 400, b: 5100 } },
    ...(extra.more ?? []),
  ] }],
});

test('roles come from class names', () => {
  assert.equal(roleOf({ className: 'android.widget.EditText' }), 'input');
  assert.equal(roleOf({ className: 'x.ImageButton' }), 'button');
  assert.equal(roleOf({ className: 'x.Unknown', clickable: true }), 'button');
  assert.equal(roleOf({ className: 'x.Unknown' }), 'other');
  assert.equal(roleOf({ password: true }), 'input');
});
test('hidden and empty nodes are dropped', () => {
  const s = readScreenStructure(snap());
  assert.ok(!s.elements.some((e) => e.label === 'hidden ad'));
  assert.ok(s.dropped >= 3);
});
test('password and typed text never appear', () => {
  const s = readScreenStructure(snap());
  const json = JSON.stringify(s);
  assert.ok(!json.includes('hunter2')); assert.ok(!json.includes('secret@mail.com'));
  assert.ok(findElements(s, { text: 'password' }).length === 1);
  assert.equal(findElements(s, { role: 'input' }).every((e) => e.redacted && e.hasValue), true);
});
test('typed text can be kept only when explicitly asked, passwords never', () => {
  const s = readScreenStructure(snap(), { keepTypedText: true });
  const json = JSON.stringify(s);
  assert.ok(json.includes('secret@mail.com')); assert.ok(!json.includes('hunter2'));
});
test('money and sign-in controls are flagged ask-first, others read-ok', () => {
  const s = readScreenStructure(snap());
  assert.equal(findElements(s, { text: 'pay now' })[0].risk, 'ask');
  assert.equal(findElements(s, { text: 'back' })[0].risk, 'read-ok');
  assert.equal(findElements(s, { text: 'your cart' })[0].risk, 'read-ok');
});
test('actions, toggle state and on-screen position are reported', () => {
  const s = readScreenStructure(snap());
  const sw = findElements(s, { text: 'gift wrap' })[0];
  assert.deepEqual(sw.actions, ['tap', 'toggle']); assert.equal(sw.checked, false);
  assert.equal(findElements(s, { text: 'far below' })[0].onScreen, false);
  assert.equal(findElements(s, { text: 'back' })[0].onScreen, true);
});
test('blocked package returns nothing readable', () => {
  const s = readScreenStructure(snap(), { blockedPackages: ['com.example.shop'] });
  assert.equal(s.blocked, true); assert.equal(s.elements.length, 0); assert.equal(s.outline, '');
});
test('bad input fails safe, never throws', () => {
  assert.deepEqual(readScreenStructure(null), { ok: false, reason: 'no-snapshot' });
  assert.equal(readScreenStructure({}).elements.length, 0);
});
test('flat snapshots with parentId read the same as nested ones', () => {
  const flat = { packageName: 'p', nodes: [{ id: 'a', className: 'LinearLayout' }, { id: 'b', parentId: 'a', className: 'Button', text: 'Go', clickable: true }, { id: 'c', parentId: 'a', className: 'TextView', text: 'Hi' }] };
  const s = readScreenStructure(flat);
  assert.deepEqual(s.elements.map((e) => e.label), ['Go', 'Hi']); assert.equal(s.elements[0].depth, 1);
});
test('node cap truncates and says so', () => {
  const more = Array.from({ length: 30 }, (_, i) => ({ className: 'TextView', text: `row ${i}` }));
  const s = readScreenStructure(snap({ more }), { maxNodes: 10 });
  assert.equal(s.elements.length, 10); assert.equal(s.truncated, true);
});
test('outline is short, marks ask-first and hidden values, and is length-capped', () => {
  const s = readScreenStructure(snap());
  assert.match(s.outline, /\[e\d+\] button "Pay now" \(tap, ASK-FIRST\)/);
  assert.match(s.outline, /hidden-value/);
  assert.match(describeScreen(s, { maxChars: 50 }), /\[cut: \d+ more characters\]/);
});
test('diff reports added, removed and changed, and sameApp', () => {
  const a = readScreenStructure(snap());
  const b = readScreenStructure(snap({ more: [{ className: 'TextView', text: 'New banner' }] }));
  const d = diffStructures(a, b);
  assert.equal(d.added.length, 1); assert.equal(d.added[0].label, 'New banner'); assert.equal(d.sameApp, true);
  assert.equal(diffStructures(a, a).unchanged, true);
  const toggled = snap(); toggled.nodes[0].children[7].checked = true;
  assert.equal(diffStructures(a, readScreenStructure(toggled)).changed.length, 1);
  assert.equal(diffStructures(a, readScreenStructure({ ...snap(), packageName: 'other' })).sameApp, false);
});
