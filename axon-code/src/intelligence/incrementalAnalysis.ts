export type AnalysisPriority = 'ACTIVE_DOCUMENT' | 'DIRECT_DEPENDENCY' | 'BACKGROUND_INDEX';
export type AnalysisMode = 'AUTO' | 'REDUCED' | 'SUSPENDED';
export interface AnalysisResourceBudget { availableForWorkBytes: number; cpuCores: number; thermalState: 'normal' | 'warm' | 'hot' | 'critical' | 'unknown'; }
export interface AnalysisTaskInput<T> {
  projectId: string; filePath: string; revision: number; priority: AnalysisPriority; estimatedMemoryBytes: number;
  run(context: { signal: AbortSignal; yieldIfSuspended(): Promise<void> }): Promise<T>;
}
export interface AnalysisTaskResult<T> { projectId: string; filePath: string; revision: number; status: 'COMPLETED' | 'STALE' | 'CANCELLED'; value?: T; elapsedMs: number; }
interface QueuedTask<T = unknown> { input: AnalysisTaskInput<T>; key: string; sequence: number; controller: AbortController; resolve: (result: AnalysisTaskResult<T>) => void; reject: (error: Error) => void; startedAt?: number; }

/**
 * Priority-aware, revision-safe background analysis scheduler.
 * Heavy work must be delegated to a host worker/process provider; this class
 * schedules tasks and exposes cooperative yield points but does not create a worker itself.
 */
export class IncrementalAnalysisScheduler {
  private mode: AnalysisMode = 'AUTO';
  private budget: AnalysisResourceBudget = { availableForWorkBytes: 256 * 1024 * 1024, cpuCores: 2, thermalState: 'normal' };
  private readonly queue: QueuedTask[] = [];
  private readonly active = new Map<string, QueuedTask>();
  private readonly latestRevision = new Map<string, number>();
  private readonly dedupe = new Map<string, Promise<AnalysisTaskResult<unknown>>>();
  private readonly resumeWaiters = new Set<() => void>();
  private sequence = 0;
  private draining = false;
  private closed = false;
  constructor(private readonly policy: { maxWorkers: number; memoryPerWorkerBytes: number; maxQueue: number; maxTrackedDocuments?: number; now?: () => number }) {
    if (![policy.maxWorkers, policy.memoryPerWorkerBytes, policy.maxQueue, policy.maxTrackedDocuments ?? 20_000].every(Number.isSafeInteger) || policy.maxWorkers < 1 || policy.memoryPerWorkerBytes < 1 || policy.maxQueue < 1 || (policy.maxTrackedDocuments ?? 20_000) < 1) throw new Error('Invalid incremental analysis policy.');
  }
  setMode(mode: AnalysisMode): void { if (!['AUTO', 'REDUCED', 'SUSPENDED'].includes(mode)) throw new Error('Invalid analysis mode.'); this.mode = mode; if (mode !== 'SUSPENDED') this.releaseWaiters(); this.pump(); }
  getMode(): AnalysisMode { return this.mode; }
  setResourceBudget(budget: AnalysisResourceBudget): void {
    if (!Number.isSafeInteger(budget.availableForWorkBytes) || budget.availableForWorkBytes < 0 || !Number.isFinite(budget.cpuCores) || budget.cpuCores < 0) throw new Error('Invalid analysis resource measurements.');
    if (!['normal', 'warm', 'hot', 'critical', 'unknown'].includes(budget.thermalState)) throw new Error('Invalid thermal state.');
    this.budget = { ...budget }; this.releaseWaiters(); this.pump();
  }
  getConcurrencyLimit(): number {
    if (this.mode === 'SUSPENDED' || this.budget.thermalState === 'critical') return 0;
    if (this.budget.availableForWorkBytes < this.policy.memoryPerWorkerBytes) return 0;
    const memoryBound = Math.floor(this.budget.availableForWorkBytes / this.policy.memoryPerWorkerBytes);
    const cpuBound = Math.floor(this.budget.cpuCores);
    if (cpuBound < 1) return 0;
    const thermalBound = this.budget.thermalState === 'hot' || this.budget.thermalState === 'unknown' ? 1 : this.budget.thermalState === 'warm' ? Math.max(1, Math.floor(this.policy.maxWorkers / 2)) : this.policy.maxWorkers;
    const modeBound = this.mode === 'REDUCED' ? 1 : this.policy.maxWorkers;
    return Math.max(0, Math.min(memoryBound, cpuBound, thermalBound, modeBound, this.policy.maxWorkers));
  }
  enqueue<T>(input: AnalysisTaskInput<T>): Promise<AnalysisTaskResult<T>> {
    if (this.closed) return Promise.reject(new Error('Analysis scheduler is closed.'));
    if (!input.projectId.trim() || !input.filePath.trim() || !Number.isSafeInteger(input.revision) || input.revision < 0 || !Number.isSafeInteger(input.estimatedMemoryBytes) || input.estimatedMemoryBytes < 1 || typeof input.run !== 'function') return Promise.reject(new Error('Analysis task identity, revision, memory estimate or runner is invalid.'));
    const key = `${input.projectId}\u0000${input.filePath}\u0000${input.revision}`;
    const existing = this.dedupe.get(key); if (existing) return existing as Promise<AnalysisTaskResult<T>>;
    const pathKey = `${input.projectId}\u0000${input.filePath}`;
    if (this.queue.length >= this.policy.maxQueue) return Promise.reject(new Error('Analysis queue limit reached.'));
    if (!this.latestRevision.has(pathKey) && this.latestRevision.size >= (this.policy.maxTrackedDocuments ?? 20_000)) return Promise.reject(new Error('Tracked analysis document limit reached.'));
    this.latestRevision.set(pathKey, Math.max(this.latestRevision.get(pathKey) ?? -1, input.revision));
    const promise = new Promise<AnalysisTaskResult<T>>((resolve, reject) => {
      const task: QueuedTask<T> = { input, key, sequence: ++this.sequence, controller: new AbortController(), resolve, reject };
      this.queue.push(task as QueuedTask); this.sortQueue();
    });
    this.dedupe.set(key, promise as Promise<AnalysisTaskResult<unknown>>);
    this.pump();
    return promise;
  }
  cancel(projectId: string, filePath: string, revision: number): boolean {
    const key = `${projectId}\u0000${filePath}\u0000${revision}`;
    const queued = this.queue.find((item) => item.key === key);
    if (queued) { this.queue.splice(this.queue.indexOf(queued), 1); queued.controller.abort(); queued.resolve({ projectId, filePath, revision, status: 'CANCELLED', elapsedMs: 0 }); this.dedupe.delete(key); return true; }
    const active = this.active.get(key); if (active) { active.controller.abort(); return true; }
    return false;
  }
  async close(timeoutMs = 5000): Promise<void> {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('Invalid scheduler close timeout.');
    this.closed = true; this.mode = 'SUSPENDED';
    for (const task of this.queue.splice(0)) { task.controller.abort(); task.reject(new Error('Analysis scheduler closed before task start.')); this.dedupe.delete(task.key); }
    for (const task of this.active.values()) task.controller.abort();
    this.releaseWaiters();
    const deadline = Date.now() + timeoutMs;
    while (this.active.size && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    if (this.active.size) throw new Error(`Analysis provider did not stop ${this.active.size} task(s) after cancellation; host isolation must enforce termination.`);
  }
  private sortQueue(): void { const rank: Record<AnalysisPriority, number> = { ACTIVE_DOCUMENT: 0, DIRECT_DEPENDENCY: 1, BACKGROUND_INDEX: 2 }; this.queue.sort((a, b) => rank[a.input.priority] - rank[b.input.priority] || a.sequence - b.sequence); }
  private pump(): void {
    if (this.draining || this.closed || this.mode === 'SUSPENDED') return;
    this.draining = true;
    queueMicrotask(() => { try { while (!this.closed && this.mode !== 'SUSPENDED' && this.active.size < this.getConcurrencyLimit()) {
      const activeMemory = [...this.active.values()].reduce((sum, task) => sum + task.input.estimatedMemoryBytes, 0);
      const remaining = Math.max(0, this.budget.availableForWorkBytes - activeMemory);
      const index = this.queue.findIndex((task) => (this.mode !== 'REDUCED' || task.input.priority !== 'BACKGROUND_INDEX') && task.input.estimatedMemoryBytes <= remaining);
      if (index < 0) break;
      const task = this.queue.splice(index, 1)[0]!; this.start(task);
    } } finally { this.draining = false; } });
  }
  private start(task: QueuedTask): void {
    task.startedAt = this.policy.now?.() ?? Date.now(); this.active.set(task.key, task);
    void this.execute(task).then((result) => task.resolve(result), (error: unknown) => task.reject(error instanceof Error ? error : new Error(String(error))))
      .finally(() => { this.active.delete(task.key); this.dedupe.delete(task.key); const pathKey = `${task.input.projectId}\u0000${task.input.filePath}`; const stillTracked = [...this.active.values(), ...this.queue].some((item) => item.input.projectId === task.input.projectId && item.input.filePath === task.input.filePath); if (!stillTracked) this.latestRevision.delete(pathKey); this.pump(); });
  }
  private async execute(task: QueuedTask): Promise<AnalysisTaskResult<unknown>> {
    const started = task.startedAt ?? Date.now();
    const value = await task.input.run({ signal: task.controller.signal, yieldIfSuspended: () => this.waitIfSuspended(task) });
    if (task.controller.signal.aborted) return { projectId: task.input.projectId, filePath: task.input.filePath, revision: task.input.revision, status: 'CANCELLED', elapsedMs: (this.policy.now?.() ?? Date.now()) - started };
    const pathKey = `${task.input.projectId}\u0000${task.input.filePath}`;
    const stale = (this.latestRevision.get(pathKey) ?? task.input.revision) !== task.input.revision;
    return { projectId: task.input.projectId, filePath: task.input.filePath, revision: task.input.revision, status: stale ? 'STALE' : 'COMPLETED', ...(stale ? {} : { value }), elapsedMs: (this.policy.now?.() ?? Date.now()) - started };
  }
  private async waitIfSuspended(task: QueuedTask): Promise<void> {
    const shouldYield = () => this.mode === 'SUSPENDED' || this.budget.thermalState === 'critical' || this.budget.availableForWorkBytes < task.input.estimatedMemoryBytes || (this.mode === 'REDUCED' && task.input.priority === 'BACKGROUND_INDEX');
    while (shouldYield() && !task.controller.signal.aborted && !this.closed) await new Promise<void>((resolve) => { const wake = () => { this.resumeWaiters.delete(wake); resolve(); }; this.resumeWaiters.add(wake); });
    if (task.controller.signal.aborted || this.closed) throw new Error('Analysis task was cancelled while cooperatively suspended.');
  }
  private releaseWaiters(): void { for (const wake of [...this.resumeWaiters]) wake(); }
}
