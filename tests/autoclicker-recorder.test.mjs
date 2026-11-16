import test from 'node:test';
import assert from 'node:assert/strict';
import { eventsToRoutine, createRecorder } from '../src/axon-autoclicker/recorder.mjs';
import { validateRoutine } from '../src/axon-autoclicker/routine-model.mjs';

const screen = { width: 1000, height: 2000 };
const ev = (t, type, extra = {}) => ({ t, type, packageName: 'com.example.game', screen, ...extra });
const events = [
  ev(1000, 'window'), ev(1500, 'click', { label: 'Tap me', className: 'android.widget.Button', bounds: { l: 0, t: 120, r: 900, b: 220 } }),
  ev(2100, 'scroll', { scrollDy: 40 }), ev(2300, 'scroll', { scrollDy: 40 }), ev(2400, 'scroll', { scrollDy: -40 }),
  ev(4000, 'click', { bounds: { l: 400, t: 1400, r: 600, b: 1600 } }), ev(4100, 'long-click', { label: 'Menu', className: 'android.widget.Button' }),
  ev(5000, 'window', { packageName: 'com.example.notes' }), ev(5100, 'click', { label: 'New note', packageName: 'com.example.notes' }),
  ev(5200, 'click', { label: 'Check balance', packageName: 'com.example.bankapp' }), ev(5300, 'click', { label: 'AXON thing', packageName: 'com.axon.app' }),
  { t: 5400, type: 'click' }, null,
];
test('a recording becomes a draft routine by label, with fallback points, merged scrolls and sane delays', () => {
  const { routine, notes } = eventsToRoutine(events, { name: 'My run', blockedPackages: ['com.example.bankapp'] });
  assert.equal(routine.packageName, 'com.example.game');
  assert.deepEqual(routine.steps.map((s) => s.kind), ['tap', 'scroll', 'scroll', 'tap', 'long-press', 'wait-for', 'tap']);
  assert.deepEqual(routine.steps[0].target, { label: 'Tap me', role: 'button', fallbackPoint: { fx: 0.45, fy: 0.085 } });
  assert.deepEqual([routine.steps[1].direction, routine.steps[2].direction], ['down', 'up']);
  assert.deepEqual(routine.steps[3].target, { fallbackPoint: { fx: 0.5, fy: 0.75 } });
  assert.equal(routine.steps[0].delayAfterMs, 600); assert.equal(routine.steps[5].until.package, 'com.example.notes');
  assert.ok(!JSON.stringify(routine).includes('Check balance') && !JSON.stringify(routine).includes('AXON thing'));
  assert.match(notes.join(' '), /never recorded/); assert.equal(validateRoutine(routine).ok, true, validateRoutine(routine).errors.join('; '));
  assert.equal(routine.approvedHash, undefined);
});
test('internal recordings keep only AXON events; empty and huge recordings are handled', () => {
  const r = eventsToRoutine([ev(1, 'click', { label: 'A' }), { t: 2, type: 'click', packageName: 'com.axon.app', label: 'Test button' }], { scope: 'internal' });
  assert.deepEqual(r.routine.steps.map((s) => s.target.label), ['Test button']); assert.equal(r.routine.packageName, undefined);
  assert.equal(eventsToRoutine([]).routine.steps.length, 0); assert.equal(eventsToRoutine(undefined).routine.steps.length, 0);
  const many = Array.from({ length: 150 }, (_, i) => ev(1000 + i * 1000, 'click', { label: `B${i}` }));
  const big = eventsToRoutine(many);
  assert.deepEqual([big.routine.steps.length, big.truncated], [100, true]);
});
test('the recorder asks the phone to start and stop, and refuses to stop what never started', async () => {
  const calls = [];
  const source = { startRecording: async (o) => { calls.push(['start', o.blockedPackages]); return { ok: true }; }, stopRecording: async () => ({ ok: true, events }) };
  const rec = createRecorder({ source });
  assert.equal((await rec.stop()).code, 'not-recording');
  assert.equal((await rec.start({ blockedPackages: ['com.example.bankapp'] })).ok, true); assert.equal(rec.isRecording(), true);
  const out = await rec.stop({ name: 'Mine' });
  assert.deepEqual([out.ok, out.eventCount, out.routine.name, rec.isRecording()], [true, events.length, 'Mine', false]);
  assert.ok(!JSON.stringify(out.routine).includes('Check balance'));
  assert.deepEqual(calls, [['start', ['com.example.bankapp']]]);
  const failing = createRecorder({ source: { startRecording: async () => ({ ok: false, code: 'no-native-plugin' }), stopRecording: async () => ({ ok: false }) } });
  assert.equal((await failing.start()).ok, false); assert.equal((await failing.stop()).code, 'not-recording');
});
