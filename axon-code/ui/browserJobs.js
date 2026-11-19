const TRANSITIONS = Object.freeze({
  queued: new Set(['running', 'cancelled', 'interrupted']),
  running: new Set(['completed', 'failed', 'cancelled', 'interrupted']),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  interrupted: new Set()
});
export class BrowserJobService {
  constructor(database, { concurrency = 2, ownerQuota = 20 } = {}) {
    if (!database?.objectStoreNames?.contains('jobs')) throw new Error('IndexedDB jobs store is unavailable.');
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('Browser job concurrency must be between one and two.');
    if (!Number.isSafeInteger(ownerQuota) || ownerQuota < 1 || ownerQuota > 100) throw new Error('Invalid per-owner job quota.');
    this.database = database;
    this.concurrency = concurrency;
    this.ownerQuota = ownerQuota;
  }
  async list() {
    const tx = this.database.transaction('jobs', 'readonly');
    return await new Promise((resolve, reject) => {
      const request = tx.objectStore('jobs').getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
      request.onerror = () => reject(request.error);
    });
  }
  async create({ owner, origin = 'user', kind = 'javascript' }) {
    if (typeof owner !== 'string' || !owner || !['user', 'axon'].includes(origin) || !['javascript', 'python'].includes(kind)) throw new Error('Invalid job metadata.');
    const rows = await this.list();
    if (rows.filter(row => row.owner === owner && ['queued', 'running'].includes(row.state)).length >= this.ownerQuota) throw new Error('Per-owner active job quota reached.');
    const active = rows.filter(row => ['running'].includes(row.state)).length;
    const now = Date.now();
    const job = { id: `job-${crypto.randomUUID()}`, owner, origin, kind, state: active >= this.concurrency ? 'queued' : 'running', createdAt: now, startedAt: active >= this.concurrency ? null : now, updatedAt: now, elapsedMs: 0, reason: null };
    await this.#put(job);
    return job;
  }
  async transition(id, nextState, reason = null, { promote = true } = {}) {
    const rows = await this.list();
    const job = rows.find(row => row.id === id);
    if (!job) throw new Error('Job does not exist.');
    if (!TRANSITIONS[job.state]?.has(nextState)) throw new Error(`Invalid job transition: ${job.state} -> ${nextState}.`);
    const now = Date.now();
    const elapsedMs = job.elapsedMs + (job.state === 'running' && job.startedAt ? Math.max(0, now - job.startedAt) : 0);
    const next = { ...job, state: nextState, updatedAt: now, elapsedMs, startedAt: nextState === 'running' ? now : null, reason };
    await this.#put(next);
    if (promote && ['completed', 'failed', 'cancelled', 'interrupted'].includes(nextState)) await this.#promoteQueued();
    return next;
  }
  async cancel(id, { actor = 'user', permission = false } = {}) {
    const rows = await this.list();
    const job = rows.find(row => row.id === id);
    if (!job) throw new Error('Job does not exist.');
    if (actor === 'axon' && job.origin === 'user' && permission !== true) throw new Error('AXON needs explicit permission to cancel a user job.');
    if (!['queued', 'running'].includes(job.state)) throw new Error('Only queued or running jobs can be cancelled.');
    return this.transition(id, 'cancelled', 'Cancelled by user.');
  }
  pause() { return { supported: false, reason: 'Browser JavaScript and Python workers do not support pause.' }; }
  resume() { return { supported: false, reason: 'Browser JavaScript and Python workers do not support resume.' }; }
  async #promoteQueued() {
    const rows = await this.list();
    let available = this.concurrency - rows.filter(row => row.state === 'running').length;
    for (const job of rows.filter(row => row.state === 'queued').sort((a, b) => a.createdAt - b.createdAt)) {
      if (available <= 0) break;
      await this.transition(job.id, 'running', 'Started from browser job queue.');
      available--;
    }
  }
  async interruptRunning() {
    const rows = await this.list();
    for (const job of rows) if (job.state === 'running') await this.transition(job.id, 'interrupted', 'Page was reloaded or closed while the job was running.', { promote: false });
  }
  async #put(job) {
    const tx = this.database.transaction('jobs', 'readwrite');
    await new Promise((resolve, reject) => {
      tx.objectStore('jobs').put(job);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Job persistence aborted.'));
    });
  }
}
