import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { BackgroundJobQueue } from '../jobs/backgroundJobQueue.mjs';
import { approvalScopeMatches } from './approvalScope.mjs';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const transitions = {
  queued: ['running', 'paused', 'cancelled', 'failed', 'interrupted'],
  running: ['paused', 'completed', 'failed', 'cancelled', 'interrupted'],
  paused: ['running', 'queued', 'cancelled', 'failed', 'interrupted'],
  interrupted: ['queued', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

export class MemoryGatewayStore {
  constructor() {
    this.data = new Map();
    this.audit = [];
  }

  async get(key) {
    return structuredClone(this.data.get(key) ?? null);
  }

  async put(key, value) {
    this.data.set(key, structuredClone(value));
  }

  async mutate(key, update) {
    const next = update(await this.get(key));
    await this.put(key, next);
    return structuredClone(next);
  }

  async consume(key, predicate) {
    const current = this.data.get(key);
    if (!current || !predicate(current)) return null;
    const next = { ...current, used: true };
    this.data.set(key, structuredClone(next));
    return structuredClone(next);
  }

  async list(prefix) {
    return [...this.data.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value: structuredClone(value) }));
  }

  async recordAudit(row) {
    this.audit.push(structuredClone(row));
  }
}

export class FileGatewayStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.data = new Map();
    this.audit = [];
    this.ready = this.#load();
    this.lock = Promise.resolve();
  }

  async #load() {
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'));
      this.data = new Map(Object.entries(data.data || {}));
      this.audit = Array.isArray(data.audit) ? data.audit : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async #save() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    await writeFile(temporary, JSON.stringify({ data: Object.fromEntries(this.data), audit: this.audit }));
    await rename(temporary, this.filePath);
  }

  async #serial(operation) {
    await this.ready;
    const next = this.lock.then(operation);
    this.lock = next.catch(() => {});
    return next;
  }

  async get(key) {
    return this.#serial(() => structuredClone(this.data.get(key) ?? null));
  }

  async put(key, value) {
    return this.#serial(async () => {
      this.data.set(key, structuredClone(value));
      await this.#save();
    });
  }

  async consume(key, predicate) {
    return this.#serial(async () => {
      const current = this.data.get(key);
      if (!current || !predicate(current)) return null;
      const next = { ...current, used: true };
      this.data.set(key, next);
      await this.#save();
      return structuredClone(next);
    });
  }

  async list(prefix) {
    return this.#serial(() => [...this.data.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value: structuredClone(value) })));
  }

  async recordAudit(row) {
    return this.#serial(async () => {
      this.audit.push(structuredClone(row));
      await this.#save();
    });
  }
}

export class AxonCodeJobGateway {
  constructor({
    store = new MemoryGatewayStore(),
    projectInspect = async () => ({ status: 'BLOCKED', reason: 'No project inspection provider is configured.' }),
    workspaceExport = async () => ({ status: 'BLOCKED', reason: 'No workspace export provider is configured.' }),
    executor = async () => { throw new Error('NO_EXECUTION_PROVIDER'); },
    processHost = null,
    queue = null,
    queueConcurrency = 2,
    perOwnerQuota = 8,
    maxQueuedJobs = 256,
    now = Date.now,
    quotaBytes = 1024 * 1024,
    maxTimeMs = 30_000,
    maxOutputBytes = 65_536,
  } = {}) {
    this.store = store;
    this.projectInspect = projectInspect;
    this.workspaceExport = workspaceExport;
    this.executor = executor;
    this.processHost = processHost;
    this.queue = queue || new BackgroundJobQueue({
      concurrency: queueConcurrency,
      perOwnerQuota,
      maxJobs: maxQueuedJobs,
    });
    this.queueJobs = new Map();
    this.controllers = new Map();
    this.now = now;
    this.quotaBytes = quotaBytes;
    this.maxTimeMs = maxTimeMs;
    this.maxOutputBytes = maxOutputBytes;
  }

  async approve(request, scope, expiresAt = this.now() + 60_000) {
    const id = randomUUID();
    await this.store.put(`approval/${id}`, {
      id,
      requestHash: hash(request),
      scope,
      expiresAt,
      used: false,
    });
    return id;
  }

  async #refuse(request, code) {
    try {
      if (request?.requestId && request?.auditId && request?.callerContext?.callerId) {
        await this.store.recordAudit?.({
          at: this.now(),
          requestId: request.requestId,
          caller: request.callerContext.callerId,
          operation: String(request.operation || 'unknown'),
          projectId: String(request.scope?.projectId || ''),
          requestHash: hash(request),
          status: 'REFUSED',
          reason: code,
        });
      }
    } catch {
      // A refusal must remain a refusal even if the audit store is unavailable.
    }
    return { status: 'REFUSED', code };
  }

  async call(request) {
    try {
      if (!request || request.protocolVersion !== '1' || !request.callerContext ||
          !['USER', 'AXON_BRAIN'].includes(request.callerContext.authority) ||
          !request.scope || !Array.isArray(request.scope.permissions)) {
        return this.#refuse(request, 'INVALID_REQUEST');
      }
      if (!request.requestId || !request.auditId || !request.scope.projectId || !request.scope.workspaceId) {
        return this.#refuse(request, 'INVALID_REQUEST');
      }

      const operations = [
        'capabilities.read', 'project.inspect', 'job.submit', 'job.status',
        'job.pause', 'job.resume', 'job.cancel', 'job.results', 'workspace.export',
      ];
      if (!operations.includes(request.operation)) return this.#refuse(request, 'UNKNOWN_OPERATION');

      const approval = await this.store.get(`approval/${request.approvalReference}`);
      const { approvalReference, ...boundRequest } = request;
      if (!approval || approval.used || approval.expiresAt < this.now() || approval.requestHash !== hash(boundRequest)) {
        return this.#refuse(request, 'APPROVAL_INVALID');
      }
      if (!approvalScopeMatches(approval, request)) {
        return this.#refuse(request, 'APPROVAL_SCOPE_MISMATCH');
      }
      if (!request.scope.permissions.includes(request.operation)) return this.#refuse(request, 'PERMISSION_DENIED');

      const consumed = await this.store.consume(
        `approval/${approval.id}`,
        (row) => !row.used && row.expiresAt >= this.now() &&
          row.requestHash === hash(boundRequest) &&
          approvalScopeMatches(row, request),
      );
      if (!consumed) return this.#refuse(request, 'APPROVAL_INVALID');

      let result;
      switch (request.operation) {
        case 'capabilities.read':
          result = { capabilities: operations.filter((operation) => operation !== 'capabilities.read') };
          break;
        case 'project.inspect':
          result = await this.projectInspect(request.scope.projectId);
          break;
        case 'job.submit':
          result = await this.#submit(request);
          if (result?.__refused) return this.#refuse(request, result.code);
          break;
        case 'job.status':
        case 'job.results':
        case 'job.pause':
        case 'job.resume':
        case 'job.cancel': {
          const response = await this.#manageJob(request);
          if (response?.__refused) return this.#refuse(request, response.code);
          result = response;
          break;
        }
        case 'workspace.export':
          result = await this.workspaceExport(request.scope.projectId);
          break;
        default:
          return this.#refuse(request, 'UNKNOWN_OPERATION');
      }

      const response = {
        status: 'COMPLETED',
        requestId: request.requestId,
        auditId: request.auditId,
        result,
      };
      await this.store.recordAudit?.({
        at: this.now(),
        requestId: request.requestId,
        caller: request.callerContext.callerId,
        operation: request.operation,
        projectId: request.scope.projectId,
        requestHash: hash(request),
        status: response.status,
      });
      return response;
    } catch {
      return this.#refuse(request, 'GATEWAY_ERROR');
    }
  }

  async #submit(request) {
    const payload = request.payload || {};
    if (Buffer.byteLength(JSON.stringify(payload)) > this.quotaBytes) return { __refused: true, code: 'QUOTA_EXCEEDED' };
    const id = randomUUID();
    const job = {
      id,
      projectId: request.scope.projectId,
      workspaceId: request.scope.workspaceId,
      owner: request.callerContext.callerId,
      origin: request.callerContext.authority === 'AXON_BRAIN' ? 'AXON' : 'user',
      state: 'queued',
      createdAt: this.now(),
      updatedAt: this.now(),
      deadline: this.now() + Math.min(Number(payload.timeLimitMs) || this.maxTimeMs, this.maxTimeMs),
      output: '',
      outputBytes: 0,
      quotaBytes: this.quotaBytes,
    };
    await this.store.put(`job/${id}`, job);
    try {
      const queueId = this.queue.submit({
        owner: job.owner,
        priority: Number(payload.priority) || 0,
        run: () => this.#execute(job, payload),
      });
      this.queueJobs.set(id, queueId);
      await new Promise((resolve) => setImmediate(resolve));
    } catch (error) {
      const code = error?.message === 'OWNER_QUOTA_REACHED' ? 'QUOTA_EXCEEDED' : 'JOB_QUEUE_FULL';
      await this.store.put(`job/${id}`, { ...job, state: 'failed', error: code, updatedAt: this.now() });
      return { __refused: true, code };
    }
    return { jobId: id, state: 'queued', origin: job.origin };
  }

  async #manageJob(request) {
    const id = request.payload?.jobId;
    let job = await this.store.get(`job/${id}`);
    if (!job || job.projectId !== request.scope.projectId) return { __refused: true, code: 'JOB_NOT_FOUND' };

    if (request.operation === 'job.status' || request.operation === 'job.results') {
      if (job.owner !== request.callerContext.callerId &&
          !request.scope.permissions.includes('job.manage.any') &&
          !request.scope.permissions.includes('job.results.any')) {
        return { __refused: true, code: 'OWNER_MISMATCH' };
      }
      return request.operation === 'job.results'
        ? { state: job.state, output: job.output, outputBytes: job.outputBytes }
        : job;
    }

    const isWorkspaceUser = request.callerContext.authority === 'USER' && job.workspaceId === request.scope.workspaceId;
    const isOwningBrain = request.callerContext.authority === 'AXON_BRAIN' && job.owner === request.callerContext.callerId;
    if (!isWorkspaceUser && !isOwningBrain && !request.scope.permissions.includes('job.manage.any')) {
      return { __refused: true, code: 'OWNER_MISMATCH' };
    }

    const queueId = this.queueJobs.get(id);
    if (request.operation === 'job.pause') {
      if (!transitions[job.state]?.includes('paused')) return { __refused: true, code: 'INVALID_STATE' };
      const pausedQueued = job.state === 'queued' && queueId && this.queue.pause(queueId);
      const pausedRunning = this.processHost?.pause?.(id) === true;
      if (!pausedQueued && !pausedRunning) {
        return { status: 'NOT_SUPPORTED', reason: 'The active provider cannot suspend this job on this host.' };
      }
      job = { ...job, state: 'paused', updatedAt: this.now() };
      await this.store.put(`job/${id}`, job);
      return job;
    }

    if (request.operation === 'job.resume') {
      const resumedQueued = job.state === 'paused' && queueId && this.queue.resume(queueId);
      const resumedRunning = this.processHost?.resume?.(id) === true;
      if (!resumedQueued && !resumedRunning) {
        if (!this.processHost) {
          return { status: 'NOT_SUPPORTED', reason: 'The active provider cannot resume this job on this host.' };
        }
        return { __refused: true, code: 'INVALID_STATE' };
      }
      job = { ...job, state: resumedQueued ? 'queued' : 'running', updatedAt: this.now() };
      await this.store.put(`job/${id}`, job);
      return job;
    }

    if (request.operation === 'job.cancel') {
      if (!transitions[job.state]?.includes('cancelled')) return { __refused: true, code: 'INVALID_STATE' };
      job = { ...job, state: 'cancelled', updatedAt: this.now() };
      await this.store.put(`job/${id}`, job);
      if (queueId) this.queue.cancel(queueId);
      this.queueJobs.delete(id);
      this.processHost?.cancel?.(id);
      this.controllers.get(id)?.abort(new Error('JOB_CANCELLED'));
      return job;
    }

    return { __refused: true, code: 'UNKNOWN_OPERATION' };
  }

  async recover() {
    for (const { key, value: job } of await this.store.list('job/')) {
      if (!['queued', 'running', 'paused'].includes(job.state)) continue;
      const queueId = this.queueJobs.get(job.id);
      if (queueId) this.queue.cancel(queueId);
      this.queueJobs.delete(job.id);
      this.processHost?.interrupt?.(job.id);
      this.controllers.get(job.id)?.abort(new Error('SERVICE_RESTARTED'));
      const reason = job.state === 'queued'
        ? 'The in-memory queue was lost during service restart; the job was not silently re-enqueued.'
        : 'The host process cannot be restored after the service restarted.';
      await this.store.put(key, { ...job, state: 'interrupted', interruptedReason: reason, updatedAt: this.now() });
    }
  }

  async #execute(job, payload) {
    const key = `job/${job.id}`;
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    let timer;
    try {
      await this.store.put(key, { ...job, state: 'running', updatedAt: this.now() });
      if (controller.signal.aborted) return;
      if (this.now() > job.deadline) throw new Error('TIME_LIMIT');
      const aborted = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(String(controller.signal.reason?.message || 'JOB_CANCELLED')));
        }, { once: true });
      });
      const execution = payload.process && this.processHost
        ? this.processHost.run({
          jobId: job.id,
          ...payload.process,
          signal: controller.signal,
          timeLimitMs: Math.max(1, job.deadline - this.now()),
        })
        : this.executor({ job, payload, deadline: job.deadline, signal: controller.signal });
      const timed = Promise.race([
        execution,
        aborted,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error('TIME_LIMIT'));
            controller.abort(new Error('TIME_LIMIT'));
          }, Math.max(1, job.deadline - this.now()));
          timer.unref?.();
        }),
      ]);
      const providerResult = await timed;
      const output = String(providerResult?.output ?? '');
      const outputBytes = Buffer.byteLength(output);
      if (outputBytes > this.maxOutputBytes) throw new Error('OUTPUT_LIMIT');
      const current = await this.store.get(key);
      if (!current || current.state === 'cancelled' || current.state === 'interrupted') return;
      await this.store.put(key, {
        ...current,
        state: 'completed',
        output,
        outputBytes,
        exitCode: providerResult?.exitCode ?? null,
        signal: providerResult?.signal ?? null,
        updatedAt: this.now(),
      });
    } catch (error) {
      const current = await this.store.get(key);
      if (current && current.state !== 'cancelled' && current.state !== 'interrupted') {
        await this.store.put(key, {
          ...current,
          state: 'failed',
          error: String(error?.message || error).slice(0, 300),
          updatedAt: this.now(),
        });
      }
    } finally {
      clearTimeout(timer);
      if (this.controllers.get(job.id) === controller) this.controllers.delete(job.id);
      this.queueJobs.delete(job.id);
    }
  }
}
