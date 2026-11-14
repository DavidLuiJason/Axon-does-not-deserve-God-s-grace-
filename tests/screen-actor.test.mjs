import test from 'node:test';
import assert from 'node:assert/strict';
import { readScreenStructure } from '../src/screen-intelligence/structure-reader.mjs';
import { createStructureSource } from '../src/screen-intelligence/structure-source.mjs';
import { createScreenActor } from '../src/screen-intelligence/screen-actor.mjs';

let clock = 1_000_000;
const snapshot = () => ({ packageName: 'com.example.shop', capturedAt: clock, screen: { width: 1000, height: 2000 }, nodes: [{ className: 'LinearLayout', children: [
  { className: 'android.widget.Button', text: 'Next', clickable: true, bounds: { l: 0, t: 0, r: 200, b: 100 } },
  { className: 'android.widget.Button', text: 'Pay now', clickable: true, bounds: { l: 0, t: 200, r: 400, b: 300 } },
] }] });
function setup({ enabled = true, performResult = { ok: true, code: 'tap' } } = {}) {
  const calls = [];
  const plugin = { getStatus: async () => ({ serviceEnabled: enabled }), readScreen: async () => ({ snapshot: snapshot() }),
    performAction: async (a) => { calls.push(a.action); return { result: performResult }; } };
  const actor = createScreenActor({ source: createStructureSource(plugin), now: () => clock });
  return { actor, calls };
}
const refOf = (structure, text) => structure.elements.find((e) => e.label === text).ref;

test('an allowed tap is released to the native executor with a full payload', async () => {
  const { actor, calls } = setup();
  const { proposal, structure } = await actor.propose({ kind: 'tap', ref: 'e1' });
  assert.equal(structure.elements[0].label, 'Next'); assert.equal(proposal.decision, 'allow');
  const r = await actor.execute(proposal);
  assert.deepEqual([r.ok, r.executed], [true, true]);
  assert.deepEqual([calls[0].kind, calls[0].packageName, calls[0].path, calls[0].label], ['tap', 'com.example.shop', '0.0', 'Next']);
});
test('a risky tap does nothing until the owner approves', async () => {
  const { actor, calls } = setup();
  const { proposal, structure } = await actor.propose({ kind: 'tap', ref: 'e2' });
  assert.equal(structure.elements[1].label, 'Pay now'); assert.equal(proposal.decision, 'ask');
  assert.equal((await actor.execute(proposal)).code, 'not-approved'); assert.equal(calls.length, 0);
  assert.equal((await actor.execute(proposal, { approved: true })).executed, true); assert.equal(calls.length, 1);
});
test('refused actions never reach the executor', async () => {
  const { actor, calls } = setup();
  const { proposal } = await actor.propose({ kind: 'tap', ref: 'e99' });
  assert.equal(proposal.code, 'no-such-element');
  assert.equal((await actor.execute(proposal, { approved: true })).executed, false); assert.equal(calls.length, 0);
});
test('service off gives a refusal with plain help, no action', async () => {
  const { actor, calls } = setup({ enabled: false });
  const { proposal } = await actor.propose({ kind: 'back' });
  assert.equal(proposal.decision, 'refuse'); assert.match(proposal.reason, /Accessibility|accessibility/); assert.equal(calls.length, 0);
});
test('a failed native action is reported honestly and not counted', async () => {
  const { actor } = setup({ performResult: { ok: false, code: 'screen-changed' } });
  const { proposal } = await actor.propose({ kind: 'tap', ref: 'e1' });
  const r = await actor.execute(proposal);
  assert.deepEqual([r.ok, r.executed, r.code], [false, false, 'screen-changed']);
});
test('open-app is held back until the app list exists, and the pace limit applies', async () => {
  const { actor } = setup();
  const { proposal } = await actor.propose({ kind: 'open-app', packageName: 'com.android.settings' });
  assert.equal(proposal.decision, 'allow'); assert.equal((await actor.execute(proposal)).code, 'open-app-not-built');
  let last;
  for (let i = 0; i < 21; i += 1) { clock += 10; last = await actor.propose({ kind: 'back' }); await actor.execute(last.proposal); }
  assert.equal(last.proposal.code, 'too-fast');
});
test('source.performAction fails safe without a plugin or on a thrown error', async () => {
  assert.equal((await createStructureSource(undefined).performAction({})).code, 'no-native-plugin');
  assert.equal((await createStructureSource({ performAction: async () => { throw new Error('boom'); } }).performAction({})).code, 'boom');
  assert.equal((await createStructureSource({ performAction: async () => ({}) }).performAction({})).code, 'no-result');
});

test('open-app runs through an apps source when one is given', async () => {
  const opened = [];
  const plugin = { getStatus: async () => ({ serviceEnabled: true }), readScreen: async () => ({ snapshot: snapshot() }), performAction: async () => ({ result: { ok: true } }) };
  const actor = createScreenActor({ source: createStructureSource(plugin), apps: { openApp: async (pkg) => { opened.push(pkg); return { ok: pkg !== 'bad', code: pkg === 'bad' ? 'not-launchable' : 'opened' }; } }, now: () => clock });
  const good = await actor.execute((await actor.propose({ kind: 'open-app', packageName: 'com.android.settings' })).proposal);
  assert.deepEqual([good.ok, opened], [true, ['com.android.settings']]);
  const bad = await actor.execute((await actor.propose({ kind: 'open-app', packageName: 'bad' })).proposal);
  assert.deepEqual([bad.ok, bad.code], [false, 'not-launchable']);
});
