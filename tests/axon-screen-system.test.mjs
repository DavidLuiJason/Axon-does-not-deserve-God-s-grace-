import test from 'node:test';
import assert from 'node:assert/strict';
import { fakePhone } from './_fakePhone.mjs';
import { createScreenSystem } from '../src/axon-system/create-screen-system.mjs';
import { approveRoutine } from '../src/axon-autoclicker/routine-model.mjs';

test('one object wires reader, apps, auto-clicker, recorder and status together', async () => {
  const p = fakePhone();
  let saved = null;
  const sys = createScreenSystem({ screenPlugin: p.plugin, appsPlugin: p.appsPlugin, now: p.now, wait: p.wait, profiles: { aliases: { 'my game': 'com.example.game' } }, routineBackend: { load: async () => saved, save: async (t) => { saved = t; } } });
  const st = await sys.status();
  assert.deepEqual([st.readerOn, st.appCount, st.stopRequested, st.killSwitchAvailable, st.running], [true, 4, false, true, false]);
  assert.equal((await sys.controller.open('my game')).status, 'done');
  const r = await sys.runner.run(approveRoutine({ name: 'g', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'tap', target: { label: 'Tap me' } }], repeat: { count: 2, intervalMs: 1000 } }));
  assert.deepEqual([r.status, p.st.score], ['finished', 2]);
  assert.equal((await sys.recorder.stop()).code, 'not-recording');
  const { routine } = await sys.store.save({ name: 'Stored', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'tap', target: { label: 'Tap me' } }], repeat: { count: 1, intervalMs: 1000 } });
  await sys.store.approve(routine.id); await sys.store.setSchedule(routine.id, { kind: 'every', minutes: 5 });
  const tick = await sys.scheduler.tick();
  assert.deepEqual([tick.started, p.st.score], [routine.id, 3]);
});
test('without the native plugins everything fails safe and says so', async () => {
  const sys = createScreenSystem({});
  const st = await sys.status();
  assert.deepEqual([st.readerOn, st.appCount, st.appsCode, st.killSwitchAvailable], [false, null, 'no-native-plugin', false]);
  assert.equal((await sys.controller.open('x')).status, 'failed');
  const t = await sys.selfTest(); assert.equal(t.passed, false);
});
