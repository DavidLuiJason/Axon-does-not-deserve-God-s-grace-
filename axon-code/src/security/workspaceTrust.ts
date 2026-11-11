export type WorkspaceTrustStatus = 'RESTRICTED' | 'TRUSTED';
export type ProtectedWorkspaceAction =
  | 'read'
  | 'edit'
  | 'script'
  | 'task'
  | 'package-hook'
  | 'debugger'
  | 'terminal-startup'
  | 'extension';

export interface WorkspaceTrustRecord {
  projectFingerprint: string;
  status: 'TRUSTED';
  approvedAt: number;
  expiresAt: number;
  approvalReference: string;
}

export function resolveWorkspaceTrust(input: {
  projectFingerprint: string;
  record?: WorkspaceTrustRecord | null;
  now?: number;
}): WorkspaceTrustStatus {
  const now = input.now ?? Date.now();
  const record = input.record;
  if (!record || record.status !== 'TRUSTED' || record.projectFingerprint !== input.projectFingerprint ||
      !record.approvalReference?.trim() || !Number.isFinite(record.approvedAt) ||
      !Number.isFinite(record.expiresAt) || record.expiresAt <= now || record.approvedAt > now) {
    return 'RESTRICTED';
  }
  return 'TRUSTED';
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

async function requestHash(projectFingerprint: string, action: ProtectedWorkspaceAction, request: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SHA-256 is required for one-time execution approvals.');
  const bytes = new TextEncoder().encode(canonical({ projectFingerprint, action, request }));
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface StoredApproval {
  projectFingerprint: string;
  action: ProtectedWorkspaceAction;
  requestHash: string;
  approvalReference: string;
  expiresAt: number;
}

export interface ExecutionApproval {
  token: string;
  projectFingerprint: string;
  action: ProtectedWorkspaceAction;
  requestHash: string;
  approvalReference: string;
  expiresAt: number;
}

/** In-memory, single-use approval vault. Tokens are bound to one exact project/action/request tuple. */
export class SingleUseExecutionApprovalVault {
  private readonly approvals = new Map<string, StoredApproval>();

  async issue(input: {
    projectFingerprint: string;
    action: ProtectedWorkspaceAction;
    request: unknown;
    approvalReference: string;
    expiresAt: number;
    now?: number;
  }): Promise<ExecutionApproval> {
    const now = input.now ?? Date.now();
    if (!input.projectFingerprint.trim() || !input.approvalReference.trim() ||
        !Number.isFinite(input.expiresAt) || input.expiresAt <= now) {
      throw new Error('A project fingerprint, explicit approval reference and future expiry are required.');
    }
    const hash = await requestHash(input.projectFingerprint, input.action, input.request);
    const token = globalThis.crypto.randomUUID();
    const stored: StoredApproval = { projectFingerprint: input.projectFingerprint, action: input.action,
      requestHash: hash, approvalReference: input.approvalReference, expiresAt: input.expiresAt };
    this.approvals.set(token, stored);
    return { token, ...stored };
  }

  async consume(input: {
    token: string;
    projectFingerprint: string;
    action: ProtectedWorkspaceAction;
    request: unknown;
    now?: number;
  }): Promise<{ approved: boolean; approvalReference?: string; reason: string }> {
    const stored = this.approvals.get(input.token);
    if (!stored) return { approved: false, reason: 'Approval token is unknown, expired or already consumed.' };
    this.approvals.delete(input.token);
    const now = input.now ?? Date.now();
    if (stored.expiresAt <= now) return { approved: false, reason: 'Approval token has expired.' };
    if (stored.projectFingerprint !== input.projectFingerprint) return { approved: false, reason: 'Approval token belongs to another project.' };
    if (stored.action !== input.action) return { approved: false, reason: 'Approval token is bound to another action.' };
    const hash = await requestHash(input.projectFingerprint, input.action, input.request);
    if (stored.requestHash !== hash) return { approved: false, reason: 'Approved request changed after confirmation.' };
    return { approved: true, approvalReference: stored.approvalReference, reason: 'Exact approved request accepted once.' };
  }

  get pendingCount(): number { return this.approvals.size; }
}

export async function authorizeWorkspaceAction(input: {
  trustStatus: WorkspaceTrustStatus;
  projectFingerprint: string;
  action: ProtectedWorkspaceAction;
  request: unknown;
  approval?: { token: string };
  vault: SingleUseExecutionApprovalVault;
  now?: number;
}): Promise<{ allowed: boolean; mode: WorkspaceTrustStatus; reason: string }> {
  if (input.action === 'read' || input.action === 'edit') {
    return { allowed: true, mode: input.trustStatus, reason: 'Read/edit is available in Restricted Mode.' };
  }
  if (!input.approval?.token) {
    return { allowed: false, mode: input.trustStatus, reason: 'Execution requires explicit single-use approval.' };
  }
  const consumed = await input.vault.consume({
    token: input.approval.token, projectFingerprint: input.projectFingerprint,
    action: input.action, request: input.request, ...(input.now !== undefined ? { now: input.now } : {}),
  });
  return { allowed: consumed.approved, mode: input.trustStatus, reason: consumed.reason };
}
