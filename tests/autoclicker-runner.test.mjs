import test from 'node:test';
import assert from 'node:assert/strict';
import { fakePhone } from './_fakePhone.mjs';
import { createRoutineRunner } from '../src/axon-autoclicker/routine-runner.mjs';
import { approveRoutine } from '../src/axon-autoclicker/routine-model.mjs';

function mk(over = {}) {
  const p = fakePhone(over); const events = [];
  const runner = createRoutineRunner({ controller: p.c, screen: p.screen, now: p.now, wait: p.wait, random: () => 0.5, onEvent: (e) => { events.push(e); over.on?.(e, p, runner); } });
  return { ...p, runner, events };
}
const go = (p, routine) => p.runner.run(approveRoutine(routine));
const tapRoutine = (label, extra = {}) => ({ name: 'tap', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'tap', target: { label } }], repeat: { count: 1, intervalMs: 1000 }, ...extra });

test('a routine must be valid and approved, and any change cancels the approval', async () => {
  const p = mk();
  assert.equal((await p.runner.run({})).status, 'invalid');
  const r = tapRoutine('Tap me');
  assert.equal((await p.runner.run(r)).status, 'not-approved');
  const approved = approveRoutine(r);
  assert.equal((await p.runner.run({ ...approved, repeat: { count: 50, intervalMs: 1000 } })).status, 'not-approved');
  assert.equal(p.st.score, 0);
});
test('an internal routine taps inside AXON, shows the stop control and hides it at the end', async () => {
  const p = mk();
  const r = await go(p, { name: 'axon', scope: 'internal', steps: [{ kind: 'tap', target: { label: 'Test button' } }], repeat: { count: 3, intervalMs: 1000 } });
  assert.deepEqual([r.status, r.reason, r.loops, r.actions, p.st.axonTaps], ['finished', 'completed', 3, 3, 3]);
  assert.equal(p.st.stopShown, false); assert.ok(p.st.stopHidden >= 1);
});
test('an external routine opens an app and taps in it', async () => {
  const p = mk();
  const r = await go(p, { name: 'game', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'open', app: 'Tap Game' }, { kind: 'tap', target: { label: 'Tap me' } }], repeat: { count: 3, intervalMs: 2000 } });
  assert.deepEqual([r.status, p.st.score], ['finished', 3]);
});
test('the interval between rounds is honoured', async () => {
  const p = mk({ state: { fg: 'com.example.game' } });
  const r = await go(p, tapRoutine('Tap me', { repeat: { count: 3, intervalMs: 5000 } }));
  assert.equal(r.status, 'finished'); assert.ok(r.ms >= 10000, `took ${r.ms}`);
});
test('limits stop a forever routine: action limit, time limit', async () => {
  const a = mk({ state: { fg: 'com.example.game' } });
  const ra = await go(a, tapRoutine('Tap me', { repeat: { forever: true, intervalMs: 1500 }, limits: { maxActions: 3 } }));
  assert.deepEqual([ra.status, ra.reason, a.st.score], ['stopped', 'action-limit', 3]);
  const b = mk();
  const rb = await go(b, { name: 'slow', scope: 'internal', steps: [{ kind: 'wait', ms: 800 }], repeat: { count: 5, intervalMs: 150 }, limits: { maxRuntimeMs: 1000 } });
  assert.deepEqual([rb.status, rb.reason], ['stopped', 'time-limit']);
});
test('a missing label falls back to a point, and points and swipes work', async () => {
  const p = mk({ state: { fg: 'com.example.game' } });
  const r = await go(p, { name: 'pts', scope: 'external', packageName: 'com.example.game', repeat: { count: 1, intervalMs: 1000 }, steps: [
    { kind: 'tap', target: { label: 'Nope', fallbackPoint: { fx: 0.4, fy: 0.08 } } }, { kind: 'tap-point', at: { fx: 0.5, fy: 0.75 } }, { kind: 'swipe', from: { fx: 0.5, fy: 0.8 }, to: { fx: 0.5, fy: 0.2 } }] });
  assert.deepEqual([r.status, p.st.score, p.st.canvas, p.st.swipes, p.st.gestures.length], ['finished', 1, 1, 1, 3]);
});
test('the STOP button stops the routine at once, and the phone itself then refuses actions', async () => {
  const p = mk({ state: { fg: 'com.example.game' }, on: (e, ph) => { if (e.type === 'step' && ph.st.score >= 2) ph.st.kill = true; } });
  const r = await go(p, tapRoutine('Tap me', { repeat: { forever: true, intervalMs: 1000 } }));
  assert.deepEqual([r.status, r.reason, p.st.score], ['stopped', 'stop-button', 2]);
  assert.equal((await p.c.tap('Tap me')).ok, false);
});
test('the owner can stop from code too', async () => {
  const p = mk({ state: { fg: 'com.example.game' }, on: (e, ph, runner) => { if (e.type === 'step') runner.stop(); } });
  const r = await go(p, tapRoutine('Tap me', { repeat: { forever: true, intervalMs: 1000 } }));
  assert.deepEqual([r.status, r.reason, p.st.score], ['stopped', 'owner-stop', 1]);
});
test('other apps need the stop control; AXON-only routines may run without it', async () => {
  const p = mk({ state: { fg: 'com.example.game', noOverlay: true } });
  assert.deepEqual(await go(p, tapRoutine('Tap me')), { status: 'refused', reason: 'stop-control-unavailable' });
  assert.equal(p.st.score, 0);
  const q = mk({ state: { noOverlay: true } });
  assert.equal((await go(q, { name: 'a', scope: 'internal', steps: [{ kind: 'tap', target: { label: 'Test button' } }], repeat: { count: 1, intervalMs: 1000 } })).status, 'finished');
});
test('a money app always asks: decline stops the routine, yes carries on', async () => {
  const routine = { name: 'bank', scope: 'external', packageName: 'com.example.bankapp', steps: [{ kind: 'tap', target: { label: 'Check balance' } }], repeat: { count: 1, intervalMs: 1000 } };
  const p = mk({ state: { fg: 'com.example.bankapp' } });
  const first = await go(p, routine);
  assert.deepEqual([first.status, p.runner.isRunning()], ['needs-approval', true]);
  assert.match(first.question, /money, wallet or password/);
  assert.equal((await go(p, routine)).status, 'busy');
  assert.deepEqual([(await p.runner.answer(false)).reason, p.runner.isRunning()], ['declined', false]);
  await go(p, routine);
  const done = await p.runner.answer(true);
  assert.deepEqual([done.status, done.reason], ['finished', 'completed']);
  assert.equal((await p.runner.answer(true)).status, 'nothing-pending');
});
test('typing: pre-approved typing runs unattended, otherwise the routine waits for a yes; typed words never leak', async () => {
  const steps = [{ kind: 'tap', target: { label: 'New note' } }, { kind: 'type', target: { label: 'Note text' }, text: 'secret words' }, { kind: 'tap', target: { label: 'Save' } }];
  const base = { name: 'note', scope: 'external', packageName: 'com.example.notes', steps, repeat: { count: 1, intervalMs: 1000 } };
  const a = mk({ state: { fg: 'com.example.notes' } });
  const ra = await go(a, { ...base, preapprove: [1] });
  assert.deepEqual([ra.status, a.st.notes], ['finished', 1]);
  assert.ok(!JSON.stringify([ra, a.events, a.c.log()]).includes('secret words'));
  const b = mk({ state: { fg: 'com.example.notes' } });
  const rb = await go(b, base);
  assert.equal(rb.status, 'needs-approval'); assert.equal(b.st.notes, 0);
  const rb2 = await b.runner.answer(true);
  assert.deepEqual([rb2.status, b.st.notes], ['finished', 1]);
});
test('stuck detection, repeated failures, optional steps and leaving the app', async () => {
  const stuck = mk();
  const rs = await go(stuck, { name: 's', scope: 'internal', steps: [{ kind: 'tap', target: { label: 'Noop' } }], repeat: { forever: true, intervalMs: 1000 }, limits: { stuckAfter: 3 } });
  assert.deepEqual([rs.status, rs.reason], ['stopped', 'stuck']);
  const fail = mk();
  const rf = await go(fail, { name: 'f', scope: 'internal', steps: [{ kind: 'tap', target: { label: 'Nothing here' } }], repeat: { forever: true, intervalMs: 1000 } });
  assert.deepEqual([rf.status, rf.reason], ['failed', 'three-failures-in-a-row']);
  const opt = mk();
  const ro = await go(opt, { name: 'o', scope: 'internal', steps: [{ kind: 'tap', target: { label: 'Nothing here' }, optional: true }, { kind: 'tap', target: { label: 'Test button' } }], repeat: { count: 2, intervalMs: 1000 } });
  assert.deepEqual([ro.status, opt.st.axonTaps], ['finished', 2]);
  const left = mk({ state: { fg: 'com.example.game' }, on: (e, ph) => { if (e.type === 'step') ph.st.fg = 'com.axon.app'; } });
  const rl = await go(left, tapRoutine('Tap me', { repeat: { count: 3, intervalMs: 1000 } }));
  assert.deepEqual([rl.status, rl.reason, left.st.score], ['stopped', 'left-app', 1]);
});
test('a gate refusal stops the routine with the reason', async () => {
  const p = mk({ state: { fg: 'com.example.game' } });
  const r = await go(p, { name: 'off', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'tap-point', at: { fx: 0.5, fy: 0.5 } }], repeat: { count: 1, intervalMs: 1000 } });
  assert.equal(r.status, 'finished');
  const q = mk({ state: { fg: 'com.example.game' } });
  const bad = await q.runner.run(approveRoutine({ name: 'x', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'tap-point', at: { fx: 1.5, fy: 0 } }] }));
  assert.equal(bad.status, 'invalid');
});
test('preview describes a routine in plain words and runs nothing', () => {
  const p = mk();
  const pv = p.runner.preview({ name: 'p', scope: 'external', steps: [{ kind: 'tap', target: { label: 'Tap me' } }, { kind: 'type', target: { meaning: 'the note box' }, text: 'abc' }, { kind: 'wait', ms: 500 }], repeat: { forever: true, intervalMs: 2000 } });
  assert.equal(pv.ok, true); assert.equal(pv.repeat, 'until a limit or STOP'); assert.match(pv.lines[1], /3 characters/); assert.ok(!JSON.stringify(pv).includes('abc'));
  assert.equal(p.runner.preview({}).ok, false); assert.equal(p.st.score, 0);
});
