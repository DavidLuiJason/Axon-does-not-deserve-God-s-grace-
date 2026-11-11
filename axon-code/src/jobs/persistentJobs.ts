export const MAX_JOB_EVENT_WINDOW = 128;
export const MAX_TRACKED_COMPLETED_UNITS = 4096;
export const DEFAULT_MAX_CHECKPOINT_BYTES = 64 * 1024 * 1024;

export type JobState = 'QUEUED' | 'ANALYSING' | 'READY' | 'RUNNING' | 'PAUSED' | 'INTERRUPTED' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobEvent {
  sequence: number;
  at: number;
  state: JobState;
  stage: string;
  progress: number;
  note?: string;
}

export interface JobRecord {
  id: string;
  projectId: string;
  projectFingerprint: string;
  runtimeId: string;
  state: JobState;
  stage: string;
  progress: number;
  completedUnits: string[];
  events: JobEvent[];
  eventSequence: number;
  checkpointId?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface CheckpointEnvelope {
  id: string;
  jobId: string;
  projectId: string;
  projectFingerprint: string;
  runtimeId: string;
  stateFormat: string;
  state: Uint8Array;
  stateBytes?: number;
  sha256: string;
  completedUnits: string[];
  createdAt: number;
  resumable: boolean;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  /** Atomic read-modify-write in one host storage transaction. */
  mutate<T>(key: string, updater: (current: T | null) => T): Promise<T>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<Array<{ key: string; value: T }>>;
}

export type RecoveryDisposition = 'RESUME_FROM_CHECKPOINT' | 'RESTART_FROM_LAST_SAFE_STAGE' | 'MANUAL_INTERVENTION' | 'NO_RECOVERY_NEEDED' | 'CHECKPOINT_CORRUPT';

export interface RecoveryAssessment {
  jobId: string;
  disposition: RecoveryDisposition;
  reason: string;
  checkpoint?: CheckpointEnvelope;
}

const jobKey = (id: string): string => `job/${id}`;
const checkpointKey = (id: string): string => `checkpoint/${id}`;

async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SHA-256 is unavailable; checkpoint was not written.');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PersistentJobManager {
  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now) {}

  async create(input: { id: string; projectId: string; projectFingerprint: string; runtimeId: string }): Promise<JobRecord> {
    if (!input.id || !input.projectId || !input.projectFingerprint || !input.runtimeId) throw new Error('Job identity and execution context are required.');
    const key = jobKey(input.id);
    const timestamp = this.now();
    const record: JobRecord = { ...input, state: 'QUEUED', stage: 'QUEUED', progress: 0, completedUnits: [], events: [{ sequence: 1, at: timestamp, state: 'QUEUED', stage: 'QUEUED', progress: 0, note: 'Job created.' }], eventSequence: 1, version: 1, createdAt: timestamp, updatedAt: timestamp };
    return this.store.mutate<JobRecord>(key, (current) => {
      if (current) throw new Error(`Job '${input.id}' already exists.`);
      return record;
    });
  }

  async get(id: string): Promise<JobRecord | null> { return this.store.get<JobRecord>(jobKey(id)); }

  async update(id: string, update: { state?: JobState; stage?: string; progress?: number; completedUnit?: string; checkpointId?: string; lastError?: string; expectedVersion?: number }): Promise<JobRecord> {
    const key = jobKey(id);
    return this.store.mutate<JobRecord>(key, (current) => {
      if (!current) throw new Error(`Unknown job '${id}'.`);
      if (update.expectedVersion !== undefined && update.expectedVersion !== current.version) throw new Error('Job version conflict; refusing stale update.');
      if (update.progress !== undefined && (!Number.isFinite(update.progress) || update.progress < current.progress || update.progress > 1)) throw new Error('Progress must be monotonic and between 0 and 1.');
      const nextState = update.state ?? current.state;
      const allowed = transitions[current.state];
      if (update.state && update.state !== current.state && !allowed.includes(update.state)) throw new Error(`Illegal job transition: ${current.state} -> ${update.state}.`);
      const isNewUnit = update.completedUnit !== undefined && !current.completedUnits.includes(update.completedUnit);
      if (isNewUnit && current.completedUnits.length >= MAX_TRACKED_COMPLETED_UNITS) {
        throw new Error('Tracked completed-unit limit reached; checkpoint and roll the task forward before adding more unit identifiers.');
      }
      const completedUnits = isNewUnit ? [...current.completedUnits, update.completedUnit as string] : current.completedUnits;
      const nextStage = update.stage ?? current.stage;
      const nextProgress = update.progress ?? current.progress;
      const nextVersion = current.version + 1;
      const timestamp = this.now();
      const nextEventSequence = current.eventSequence + 1;
      const event: JobEvent = { sequence: nextEventSequence, at: timestamp, state: nextState, stage: nextStage, progress: nextProgress,
        ...(update.lastError !== undefined ? { note: update.lastError } : update.completedUnit !== undefined ? { note: `Completed unit: ${update.completedUnit}` } : {}) };
      return {
        ...current,
        state: nextState,
        stage: nextStage,
        progress: nextProgress,
        completedUnits,
        events: [...current.events, event].slice(-MAX_JOB_EVENT_WINDOW),
        eventSequence: nextEventSequence,
        ...(update.checkpointId !== undefined ? { checkpointId: update.checkpointId } : {}),
        ...(update.lastError !== undefined ? { lastError: update.lastError } : {}),
        version: nextVersion,
        updatedAt: timestamp
      };
    });
  }

  async list(): Promise<JobRecord[]> {
    return (await this.store.list<JobRecord>('job/')).map((item) => item.value).sort((a, b) => a.createdAt - b.createdAt);
  }

  async markInterruptedOnRecovery(): Promise<JobRecord[]> {
    const active: JobRecord[] = [];
    for (const job of await this.list()) {
      if (job.state === 'RUNNING' || job.state === 'ANALYSING' || job.state === 'VERIFYING') {
        active.push(await this.update(job.id, { state: 'INTERRUPTED', stage: 'INTERRUPTED', expectedVersion: job.version }));
      }
    }
    return active;
  }
}

const transitions: Record<JobState, JobState[]> = {
  QUEUED: ['ANALYSING', 'CANCELLED', 'FAILED'],
  ANALYSING: ['READY', 'INTERRUPTED', 'FAILED', 'CANCELLED'],
  READY: ['RUNNING', 'CANCELLED', 'FAILED'],
  RUNNING: ['PAUSED', 'INTERRUPTED', 'VERIFYING', 'FAILED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED', 'FAILED', 'INTERRUPTED'],
  INTERRUPTED: ['QUEUED', 'ANALYSING', 'READY', 'RUNNING', 'FAILED', 'CANCELLED'],
  VERIFYING: ['COMPLETED', 'INTERRUPTED', 'FAILED'],
  COMPLETED: [], FAILED: [], CANCELLED: []
};

export class CheckpointManager {
  constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now, private readonly maxCheckpointBytes = DEFAULT_MAX_CHECKPOINT_BYTES) {
    if (!Number.isSafeInteger(maxCheckpointBytes) || maxCheckpointBytes < 1) throw new Error('Maximum checkpoint size must be a positive safe integer.');
  }

  async save(input: Omit<CheckpointEnvelope, 'sha256' | 'createdAt'>): Promise<CheckpointEnvelope> {
    if (!input.resumable) throw new Error('Runtime did not declare this checkpoint resumable; refusing to save a misleading checkpoint.');
    if (!input.id || !input.jobId || !input.projectId || !input.projectFingerprint || !input.runtimeId || !input.stateFormat) throw new Error('Checkpoint identity, project, runtime and state format are required.');
    if (!(input.state instanceof Uint8Array) || input.state.byteLength > this.maxCheckpointBytes) throw new Error(`Checkpoint state must be a Uint8Array no larger than ${this.maxCheckpointBytes} bytes.`);
    if (input.stateBytes !== undefined && (!Number.isSafeInteger(input.stateBytes) || input.stateBytes !== input.state.byteLength)) throw new Error('Checkpoint stateBytes must match the actual state length.');
    if (!Array.isArray(input.completedUnits) || input.completedUnits.length > MAX_TRACKED_COMPLETED_UNITS || input.completedUnits.some((unit) => typeof unit !== 'string' || !unit)) throw new Error('Checkpoint completed-unit list is invalid or exceeds its limit.');
    const envelope: CheckpointEnvelope = { ...input, state: new Uint8Array(input.state), stateBytes: input.state.byteLength, sha256: await sha256(input.state), createdAt: this.now() };
    await this.store.put(checkpointKey(input.id), envelope);
    return envelope;
  }

  async assess(id: string, expected: { projectFingerprint: string; runtimeId: string }): Promise<RecoveryAssessment> {
    const checkpoint = await this.store.get<CheckpointEnvelope>(checkpointKey(id));
    if (!checkpoint) return { jobId: '', disposition: 'MANUAL_INTERVENTION', reason: 'Checkpoint record is missing.' };
    if (!(checkpoint.state instanceof Uint8Array) || checkpoint.state.byteLength > this.maxCheckpointBytes || checkpoint.stateBytes !== checkpoint.state.byteLength || !Array.isArray(checkpoint.completedUnits)) return { jobId: checkpoint.jobId, disposition: 'CHECKPOINT_CORRUPT', reason: 'Checkpoint state or metadata is missing, malformed or exceeds the configured limits.' };
    const actualHash = await sha256(checkpoint.state);
    if (actualHash !== checkpoint.sha256) return { jobId: checkpoint.jobId, disposition: 'CHECKPOINT_CORRUPT', reason: 'Checkpoint integrity verification failed.' };
    if (checkpoint.projectFingerprint !== expected.projectFingerprint) return { jobId: checkpoint.jobId, disposition: 'MANUAL_INTERVENTION', reason: 'Project fingerprint changed; automatic resume is unsafe.' };
    if (checkpoint.runtimeId !== expected.runtimeId) return { jobId: checkpoint.jobId, disposition: 'MANUAL_INTERVENTION', reason: 'Runtime identity differs from the checkpoint runtime.' };
    if (!checkpoint.resumable) return { jobId: checkpoint.jobId, disposition: 'RESTART_FROM_LAST_SAFE_STAGE', reason: 'The runtime did not guarantee resumability of the saved state.' };
    return { jobId: checkpoint.jobId, disposition: 'RESUME_FROM_CHECKPOINT', reason: 'Checkpoint integrity, project identity and runtime identity match.', checkpoint };
  }

  async delete(id: string): Promise<void> { await this.store.delete(checkpointKey(id)); }
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> { return (this.values.get(key) as T | undefined) ?? null; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, structuredClone(value)); }
  async mutate<T>(key: string, updater: (current: T | null) => T): Promise<T> {
    const current = (this.values.get(key) as T | undefined) ?? null;
    const next = updater(current === null ? null : structuredClone(current));
    this.values.set(key, structuredClone(next));
    return structuredClone(next);
  }
  async delete(key: string): Promise<void> { this.values.delete(key); }
  async list<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    return [...this.values.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value: structuredClone(value) as T }));
  }
}
