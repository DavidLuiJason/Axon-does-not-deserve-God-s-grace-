import { randomUUID } from 'node:crypto';

/** Bounded fair queue: priorities are respected within a round-robin owner schedule. */
export class BackgroundJobQueue {
  constructor({ concurrency = 2, perOwnerQuota = 8, maxJobs = 256 } = {}) {
    if (![concurrency, perOwnerQuota, maxJobs].every((n) => Number.isInteger(n) && n > 0)) {
      throw new Error('INVALID_QUEUE_LIMITS');
    }
    this.concurrency = concurrency;
    this.perOwnerQuota = perOwnerQuota;
    this.maxJobs = maxJobs;
    this.jobs = new Map();
    this.ownerOrder = [];
    this.cursor = 0;
    this.active = 0;
    this.closed = false;
  }

  submit({ owner, priority = 0, run } = {}) {
    if (this.closed) throw new Error('QUEUE_CLOSED');
    if (!owner || typeof run !== 'function') throw new Error('INVALID_JOB');
    this.#pruneHistory();
    if (this.jobs.size >= this.maxJobs) throw new Error('JOB_CAP_REACHED');
    const ownerJobs = [...this.jobs.values()].filter((job) => job.owner === owner && !['completed', 'failed', 'cancelled'].includes(job.state));
    if (ownerJobs.length >= this.perOwnerQuota) throw new Error('OWNER_QUOTA_REACHED');
    const id = `q-${randomUUID()}`;
    const job = { id, owner, priority: Number(priority) || 0, run, state: 'queued', submittedAt: Date.now() };
    this.jobs.set(id, job);
    if (!this.ownerOrder.includes(owner)) this.ownerOrder.push(owner);
    this.#pump();
    return id;
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.state)) return false;
    job.state = 'cancelled';
    job.controller?.abort(new Error('JOB_CANCELLED'));
    this.#pump();
    return true;
  }

  pause(id) {
    const job = this.jobs.get(id);
    if (!job || job.state !== 'queued') return false;
    job.state = 'paused';
    return true;
  }

  resume(id) {
    const job = this.jobs.get(id);
    if (!job || job.state !== 'paused') return false;
    job.state = 'queued';
    this.#pump();
    return true;
  }

  status(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    const { run, controller, ...safe } = job;
    return { ...safe };
  }

  #next() {
    const owners = this.ownerOrder.filter((owner) => [...this.jobs.values()].some((job) => job.owner === owner && job.state === 'queued'));
    if (!owners.length) return null;
    for (let attempts = 0; attempts < owners.length; attempts += 1) {
      const owner = owners[this.cursor % owners.length];
      this.cursor = (this.cursor + 1) % owners.length;
      const candidates = [...this.jobs.values()]
        .filter((job) => job.owner === owner && job.state === 'queued')
        .sort((a, b) => b.priority - a.priority || a.submittedAt - b.submittedAt);
      if (candidates.length) return candidates[0];
    }
    return null;
  }

  #pump() {
    while (!this.closed && this.active < this.concurrency) {
      const job = this.#next();
      if (!job) return;
      job.state = 'running';
      job.controller = new AbortController();
      this.active += 1;
      Promise.resolve().then(() => {
        if (job.state === 'cancelled' || job.controller.signal.aborted) return undefined;
        return job.run({ signal: job.controller.signal, jobId: job.id });
      })
        .then((result) => { if (job.state !== 'cancelled') { job.state = 'completed'; job.result = result; } })
        .catch((error) => { if (job.state !== 'cancelled') { job.state = 'failed'; job.error = String(error?.message || error).slice(0, 300); } })
        .finally(() => { this.active -= 1; this.#pruneOwners(); this.#pump(); });
    }
  }

  #pruneHistory() {
    if (this.jobs.size < this.maxJobs) return;
    for (const [id, job] of this.jobs) {
      if (['completed', 'failed', 'cancelled'].includes(job.state)) {
        this.jobs.delete(id);
        if (this.jobs.size < this.maxJobs) break;
      }
    }
    this.#pruneOwners();
  }

  #pruneOwners() {
    const activeOwners = new Set([...this.jobs.values()]
      .filter((job) => ['queued', 'running', 'paused'].includes(job.state))
      .map((job) => job.owner));
    this.ownerOrder = this.ownerOrder.filter((owner) => activeOwners.has(owner));
  }

  async close() {
    this.closed = true;
    for (const job of this.jobs.values()) {
      if (job.state === 'queued' || job.state === 'running') {
        job.state = 'cancelled';
        job.controller?.abort(new Error('QUEUE_CLOSED'));
      }
    }
    while (this.active > 0) await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
