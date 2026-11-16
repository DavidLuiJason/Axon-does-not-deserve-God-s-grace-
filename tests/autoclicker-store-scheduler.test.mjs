import test from 'node:test';
import assert from 'node:assert/strict';
import { fakePhone } from './_fakePhone.mjs';
import { createRoutineRunner } from '../src/axon-autoclicker/routine-runner.mjs';
import { createRoutineStore } from '../src/axon-autoclicker/routine-store.mjs';
import { createScheduler, isDue, lastSlot } from '../src/axon-autoclicker/routine-scheduler.mjs';

const memory = (fail = false) => { let data = null; return { load: async () => { if (fail) throw new Error('x'); return data; }, save: async (s) => { if (fail) throw new Error('x'); data = s; } }; };
const routine = (over = {}) => ({ name: 'Tap game', scope: 'external', packageName: 'com.example.game', steps: [{ kind: 'tap', target: { label: 'Tap me' } }], repeat: { count: 1, intervalMs: 1000 }, ...over });

test('saving validates; approval is explicit and any behaviour change cancels it', async () => {
  const store = createRoutineStore({ backend: memory() });
  const bad = await store.save({ name: '' }); assert.equal(bad.ok, false);
  const saved = await store.save(routine()); assert.deepEqual([saved.ok, saved.approved], [true, false]);
  const id = saved.routine.id;
  assert.equal((await store.list())[0].approved, false);
  await store.approve(id); assert.equal((await store.list())[0].approved, true);
  assert.equal((await store.save({ ...(await store.get(id)), name: 'Tap game' })).approved, true);
  const edited = await store.save({ ...(await store.get(id)), steps: [{ kind: 'back' }] });
  assert.equal(edited.approved, false); assert.equal((await store.list())[0].approved, false);
  assert.equal((await store.approve('nope')).ok, false); assert.equal((await store.remove(id)).ok, true); assert.equal((await store.list()).length, 0);
});
test('schedules are validated and stored apart from the routine', async () => {
  const store = createRoutineStore({ backend: memory() });
  const { routine: r } = await store.save(routine()); await store.approve(r.id);
  assert.equal((await store.setSchedule(r.id, { kind: 'daily', time: '25:00' })).ok, false);
  assert.equal((await store.setSchedule(r.id, { kind: 'every', minutes: 0 })).ok, false);
  assert.equal((await store.setSchedule(r.id, { kind: 'daily', time: '08:30', days: [1, 2, 9] })).ok, true);
  const item = (await store.list())[0];
  assert.deepEqual(item.schedule, { kind: 'daily', time: '08:30', days: [1, 2] }); assert.equal(item.approved, true);
  assert.equal((await store.setSchedule(r.id, null)).ok, true); assert.equal((await store.list())[0].schedule, null);
});
test('a broken backend never throws', async () => {
  const store = createRoutineStore({ backend: memory(true) });
  assert.deepEqual(await store.list(), []); assert.equal((await store.save(routine())).ok, false);
});
test('schedule maths: every N minutes, daily slots, weekday filters', () => {
  const at = new Date(2026, 10, 16, 9, 0).getTime();   // Monday 16 Nov 2026, 09:00 local
  assert.equal(isDue({ kind: 'every', minutes: 5 }, at - 6 * 60000, at), true); assert.equal(isDue({ kind: 'every', minutes: 5 }, at - 4 * 60000, at), false); assert.equal(isDue({ kind: 'every', minutes: 5 }, undefined, at), true);
  const daily = { kind: 'daily', time: '08:30' };
  assert.equal(new Date(lastSlot(daily, at)).getHours(), 8);
  assert.equal(isDue(daily, new Date(2026, 10, 15, 8, 30).getTime(), at), true); assert.equal(isDue(daily, new Date(2026, 10, 16, 8, 31).getTime(), at), false);
  assert.equal(new Date(lastSlot({ kind: 'daily', time: '10:00' }, at)).getDate(), 15);
  const wk = lastSlot({ kind: 'daily', time: '08:30', days: [5] }, at); assert.equal(new Date(wk).getDay(), 5);
  assert.equal(isDue(null, 0, at), false);
});
test('the scheduler starts only approved, due routines, once per slot, never two at once', async () => {
  const p = fakePhone({ state: { fg: 'com.example.game' } });
  const runner = createRoutineRunner({ controller: p.c, screen: p.screen, now: p.now, wait: p.wait, random: () => 0.5 });
  const store = createRoutineStore({ backend: memory(), now: p.now });
  const sched = createScheduler({ store, runner, now: p.now });
  const { routine: r } = await store.save(routine()); await store.setSchedule(r.id, { kind: 'every', minutes: 10 });
  assert.equal((await sched.tick()).reason, 'nothing-due');            // not approved yet
  await store.approve(r.id);
  const first = await sched.tick(); assert.deepEqual([first.started, first.result.status, p.st.score], [r.id, 'finished', 1]);
  assert.equal((await sched.tick()).reason, 'nothing-due');             // already ran this slot
  p.st.clock += 11 * 60000;
  assert.equal((await sched.tick()).started, r.id); assert.equal(p.st.score, 2);
  const busy = { isRunning: () => true };
  assert.equal((await createScheduler({ store, runner: busy, now: p.now }).tick()).reason, 'busy');
});
