import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalBackend, createProfilesPersistence, ROUTINES_STORAGE_KEY, PROFILES_STORAGE_KEY } from '../src/axon-autoclicker/routine-backend.mjs';
import { createAppProfiles } from '../src/axon-apps/app-profiles.mjs';
import { createRoutineStore } from '../src/axon-autoclicker/routine-store.mjs';
import { startSchedulerLoop } from '../src/axon-autoclicker/routine-scheduler.mjs';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, m }; };

test('routines survive a restart through the storage backend, under their own key', async () => {
  const storage = fakeStorage();
  const a = createRoutineStore({ backend: createLocalBackend({ storage }) });
  const { routine } = await a.save({ name: 'Keep me', scope: 'external', steps: [{ kind: 'back' }], repeat: { count: 1, intervalMs: 1000 } });
  await a.approve(routine.id);
  assert.deepEqual([...storage.m.keys()], [ROUTINES_STORAGE_KEY]);
  const b = createRoutineStore({ backend: createLocalBackend({ storage }) });
  assert.deepEqual((await b.list()).map((r) => [r.name, r.approved]), [['Keep me', true]]);
});
test('a missing, broken or full storage never throws', async () => {
  assert.equal(await createLocalBackend({ storage: null }).load(), null);
  await assert.rejects(createLocalBackend({ storage: null }).save('x'), /no-storage/);
  await assert.rejects(createLocalBackend({ storage: fakeStorage(), maxBytes: 5 }).save('123456'), /too-large/);
  assert.equal(await createLocalBackend({ storage: { getItem() { throw new Error('denied'); } } }).load(), null);
  const store = createRoutineStore({ backend: createLocalBackend({ storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } }) });
  assert.deepEqual(await store.list(), []); assert.equal((await store.save({ name: 'n', scope: 'external', steps: [{ kind: 'back' }] })).ok, false);
});
test('the scheduler loop ticks on a timer, never overlaps, survives errors and stops', async () => {
  let fn; let cleared = null; let ticks = 0; const errors = [];
  const gate = { resolve: null };
  const scheduler = { tick: async () => { ticks += 1; if (ticks === 1) await new Promise((r) => { gate.resolve = r; }); if (ticks === 3) throw new Error('boom'); } };
  const stop = startSchedulerLoop(scheduler, { intervalMs: 1000, setTimer: (f, ms) => { fn = f; assert.equal(ms, 15000); return 7; }, clearTimer: (h) => { cleared = h; }, onError: (e) => errors.push(e.message) });
  const first = fn(); await Promise.resolve();
  await fn(); assert.equal(ticks, 1);                       // overlapping tick skipped
  gate.resolve(); await first;
  await fn(); await fn(); assert.deepEqual([ticks, errors], [3, ['boom']]);
  stop(); assert.equal(cleared, 7);
});

test('the owner\'s app names are saved and loaded, and a broken storage gives empty profiles', async () => {
  const storage = fakeStorage(); const persist = createProfilesPersistence({ storage });
  const profiles = createAppProfiles(await persist.load()); profiles.setAlias('my bank', 'com.example.bankapp');
  assert.equal(await persist.save(profiles), true); assert.deepEqual([...storage.m.keys()], [PROFILES_STORAGE_KEY]);
  assert.equal(createAppProfiles(await persist.load()).lookup('MY BANK'), 'com.example.bankapp');
  const broken = createProfilesPersistence({ storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } });
  assert.deepEqual(await broken.load(), {}); assert.equal(await broken.save(profiles), false);
});
