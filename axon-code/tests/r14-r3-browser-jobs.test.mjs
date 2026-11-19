import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { BrowserJobService } from '../ui/browserJobs.js';

async function makeService() {
  const name = `axon-job-test-${crypto.randomUUID()}`;
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('jobs', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return { service: new BrowserJobService(db), db, name };
}

test('R3 persists jobs and enforces the queued/running state machine', async () => {
  const { service, db } = await makeService();
  const job = await service.create({ owner: 'project-a' });
  assert.equal(job.state, 'running');
  const completed = await service.transition(job.id, 'completed');
  assert.equal(completed.state, 'completed');
  await assert.rejects(() => service.transition(job.id, 'running'), /Invalid job transition/);
  db.close();
});

test('R3 limits browser concurrency to two and queues excess jobs', async () => {
  const { service, db } = await makeService();
  const first = await service.create({ owner: 'a' });
  const second = await service.create({ owner: 'b' });
  const third = await service.create({ owner: 'c' });
  assert.equal(first.state, 'running');
  assert.equal(second.state, 'running');
  assert.equal(third.state, 'queued');
  await service.transition(first.id, 'completed');
  const after = await service.list();
  assert.equal(after.find(row => row.id === third.id).state, 'running');
  db.close();
});

test('R3 enforces per-owner active job quota', async () => {
  const { service, db } = await makeService();
  for (let i = 0; i < 20; i++) await service.create({ owner: 'same-owner' });
  await assert.rejects(() => service.create({ owner: 'same-owner' }), /quota/);
  db.close();
});

test('R3 user can cancel an AXON-origin job', async () => {
  const { service, db } = await makeService();
  const job = await service.create({ owner: 'axon', origin: 'axon' });
  assert.equal((await service.cancel(job.id, { actor: 'user' })).state, 'cancelled');
  db.close();
});

test('R3 AXON cannot cancel a user job without explicit permission', async () => {
  const { service, db } = await makeService();
  const job = await service.create({ owner: 'user-project', origin: 'user' });
  await assert.rejects(() => service.cancel(job.id, { actor: 'axon' }), /explicit permission/);
  assert.equal((await service.cancel(job.id, { actor: 'axon', permission: true })).state, 'cancelled');
  db.close();
});

test('R3 running jobs become interrupted with an honest reload reason', async () => {
  const { service, db } = await makeService();
  const job = await service.create({ owner: 'project-a' });
  await service.interruptRunning();
  const [stored] = await service.list();
  assert.equal(stored.state, 'interrupted');
  assert.match(stored.reason, /reloaded or closed/);
  db.close();
});


test('R3 reload interrupts running jobs without starting queued work in the reloaded page', async () => {
  const { service, db } = await makeService();
  await service.create({ owner: 'a' });
  await service.create({ owner: 'b' });
  const queued = await service.create({ owner: 'c' });
  await service.interruptRunning();
  const rows = await service.list();
  assert.equal(rows.filter(row => row.state === 'interrupted').length, 2);
  assert.equal(rows.find(row => row.id === queued.id).state, 'queued');
  db.close();
});

test('R3 pause and resume are explicitly unsupported by browser workers', async () => {
  const { service, db } = await makeService();
  assert.equal(service.pause().supported, false);
  assert.match(service.pause().reason, /do not support pause/);
  assert.equal(service.resume().supported, false);
  db.close();
});
