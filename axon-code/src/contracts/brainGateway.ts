/**
 * Boundary between AXON (the intelligence system) and AXON Code (the technical
 * workbench/execution system). AXON owns intent, reasoning, code authorship and
 * capability choice. AXON Code executes only typed, authorised technical
 * operations and never invents goals or independently authors code.
 */
export type BrainOperation =
  | 'INSPECT_PROJECT'
  | 'ANALYSE_PROJECT'
  | 'APPLY_APPROVED_PATCH'
  | 'PREPARE_ENVIRONMENT'
  | 'RUN_COMMAND'
  | 'BUILD_PROJECT'
  | 'RUN_TESTS'
  | 'START_DEBUG_SESSION'
  | 'EXPORT_PROJECT'
  | 'INSTALL_DEPENDENCY';

export interface BrainAuthorisation {
  authority: 'AXON_BRAIN' | 'USER';
  requestId: string;
  intentId: string;
  issuedAt: number;
  expiresAt: number;
  approvalReference: string;
  /** True only when the user explicitly approved the code-changing operation. */
  userApproved?: boolean;
  scopes: readonly string[];
}

export interface BrainTechnicalRequest<TPayload = unknown> {
  operation: BrainOperation;
  authorisation: BrainAuthorisation;
  projectId: string;
  payload: TPayload;
  /** Explicitly supplied by Brain/user; Code must not infer or create source text. */
  suppliedPatch?: {
    file: string;
    baseText: string;
    startOffset: number;
    endOffset: number;
    oldText: string;
    newText: string;
    reason: string;
    safety: 'mechanical' | 'logic-changing' | 'unknown';
  };
}

export interface BrainRequestReplayStore { claim(requestId: string, expiresAt: number, now?: number): Promise<boolean>; }

/** Default process-local guard. Production hosts should supply an atomic durable store. */
export class MemoryBrainRequestReplayStore implements BrainRequestReplayStore {
  private readonly claimed = new Map<string, number>();
  async claim(requestId: string, expiresAt: number, now = Date.now()): Promise<boolean> {
    if (!requestId.trim() || !Number.isSafeInteger(expiresAt) || !Number.isSafeInteger(now)) return false;
    for (const [key, expiry] of this.claimed) if (expiry <= now) this.claimed.delete(key);
    if (this.claimed.has(requestId)) return false;
    this.claimed.set(requestId, expiresAt);
    return true;
  }
}

export interface BrainRequestValidationPolicy {
  now?: () => number;
  maxLifetimeMs?: number;
  maxPatchBytes?: number;
  allowedOperations?: readonly BrainOperation[];
  replayStore?: BrainRequestReplayStore;
}

const DEFAULT_ALLOWED: readonly BrainOperation[] = Object.freeze([
  'INSPECT_PROJECT', 'ANALYSE_PROJECT', 'APPLY_APPROVED_PATCH', 'PREPARE_ENVIRONMENT',
  'RUN_COMMAND', 'BUILD_PROJECT', 'RUN_TESTS', 'START_DEBUG_SESSION', 'EXPORT_PROJECT', 'INSTALL_DEPENDENCY'
]);

/** Validates authority and scope; it does not select user goals or generate code. */
export class BrainRequestGate {
  private readonly now: () => number;
  private readonly maxLifetimeMs: number;
  private readonly maxPatchBytes: number;
  private readonly allowed: Set<BrainOperation>;
  private readonly replayStore: BrainRequestReplayStore;

  constructor(policy: BrainRequestValidationPolicy = {}) {
    this.now = policy.now ?? Date.now;
    this.maxLifetimeMs = policy.maxLifetimeMs ?? 15 * 60_000;
    this.maxPatchBytes = policy.maxPatchBytes ?? 8 * 1024 * 1024;
    this.allowed = new Set(policy.allowedOperations ?? DEFAULT_ALLOWED);
    this.replayStore = policy.replayStore ?? new MemoryBrainRequestReplayStore();
    if (!Number.isSafeInteger(this.maxLifetimeMs) || this.maxLifetimeMs < 1 || !Number.isSafeInteger(this.maxPatchBytes) || this.maxPatchBytes < 1 || this.maxPatchBytes > 64 * 1024 * 1024) throw new Error('Invalid authorisation or patch-size policy.');
  }

  validate<T>(request: BrainTechnicalRequest<T>, requiredScope: string): void {
    if (!request || typeof request !== 'object' || Array.isArray(request) || !this.allowed.has(request.operation)) throw new Error('Request operation is missing or not permitted.');
    if (typeof requiredScope !== 'string' || !requiredScope.trim() || requiredScope.length > 200) throw new Error('Required authorisation scope is invalid.');
    const auth = request.authorisation;
    if (!auth || typeof auth !== 'object' || Array.isArray(auth) || !Array.isArray(auth.scopes) || auth.scopes.some((scope) => typeof scope !== 'string' || !scope.trim()) || new Set(auth.scopes).size !== auth.scopes.length || typeof auth.requestId !== 'string' || typeof auth.intentId !== 'string' || typeof auth.approvalReference !== 'string') throw new Error('Request authorisation is malformed.');
    if (typeof request.projectId !== 'string' || !request.projectId.trim() || request.projectId.length > 200 || /[\u0000-\u001f\u007f]/.test(request.projectId)) throw new Error('A valid project ID is required.');
    if (!this.allowed.has(request.operation)) throw new Error(`Operation '${request.operation}' is not permitted by this gateway.`);
    if (!auth.requestId.trim() || !auth.intentId.trim() || !auth.approvalReference.trim()) throw new Error('Request, intent and approval references are required.');
    if (!Number.isSafeInteger(auth.issuedAt) || !Number.isSafeInteger(auth.expiresAt) || auth.expiresAt <= auth.issuedAt) throw new Error('Authorisation timestamps are invalid.');
    const now = this.now();
    if (auth.issuedAt > now + 30_000 || auth.expiresAt <= now || auth.expiresAt - auth.issuedAt > this.maxLifetimeMs) throw new Error('Authorisation is expired, future-dated or exceeds the permitted lifetime.');
    if (auth.authority !== 'AXON_BRAIN' && auth.authority !== 'USER') throw new Error('Unrecognised request authority.');
    if (!auth.scopes.includes(requiredScope)) throw new Error(`Authorisation does not include required scope '${requiredScope}'.`);
    if (request.operation === 'APPLY_APPROVED_PATCH' && !request.suppliedPatch) throw new Error('AXON Code does not author code; an explicit user/Brain-supplied patch is required.');
    if (request.suppliedPatch !== undefined) {
      const patch = request.suppliedPatch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || typeof patch.file !== 'string' || !patch.file.trim() || patch.file.length > 1024 || typeof patch.baseText !== 'string' || typeof patch.oldText !== 'string' || typeof patch.newText !== 'string' || typeof patch.reason !== 'string' || !patch.reason.trim() || !Number.isSafeInteger(patch.startOffset) || !Number.isSafeInteger(patch.endOffset) || patch.startOffset < 0 || patch.endOffset < patch.startOffset || !['mechanical', 'logic-changing', 'unknown'].includes(patch.safety)) throw new Error('Supplied patch structure is malformed.');
      const patchBytes = new TextEncoder().encode(patch.baseText).byteLength + new TextEncoder().encode(patch.oldText).byteLength + new TextEncoder().encode(patch.newText).byteLength;
      if (patchBytes > this.maxPatchBytes) throw new Error('Supplied patch exceeds the configured byte limit.');
    }
    if (request.operation === 'APPLY_APPROVED_PATCH' && auth.authority !== 'USER' && auth.userApproved !== true) throw new Error('A code-changing Brain request requires explicit user approval recorded in its authorisation.');
  }

  /** Validate and atomically claim a one-time request ID before side effects. Durable hosts should inject a persistent replay store. */
  async validateAndClaim<T>(request: BrainTechnicalRequest<T>, requiredScope: string): Promise<void> {
    this.validate(request, requiredScope);
    if (!await this.replayStore.claim(request.authorisation.requestId, request.authorisation.expiresAt, this.now())) throw new Error('This authorised request ID has already been used.');
  }
}

export interface BrainTechnicalResult<T = unknown> {
  requestId: string;
  projectId: string;
  operation: BrainOperation;
  status: 'COMPLETED' | 'PARTIAL' | 'BLOCKED' | 'FAILED';
  result?: T;
  evidenceIds: string[];
  limitations: string[];
  completedAt: number;
}

/** Transport contract only. The Brain decides what to do; this gateway returns technical results. */
export interface BrainResultSink {
  deliver(result: BrainTechnicalResult): Promise<void>;
}
