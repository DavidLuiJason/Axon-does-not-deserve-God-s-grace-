import type { WorkbenchCommandRegistry } from '../workbench/commandRegistry.js';
import type { DocumentBufferManager, DocumentBufferSnapshot } from '../workbench/documentBuffers.js';

/**
 * Direct user access to AXON Code. This path is independent of AXON Brain.
 * The host application authenticates the user and injects a verifier; client
 * input cannot manufacture a trusted session or elevate its own scopes.
 */
export type DirectUserScope =
  | 'workspace:read'
  | 'workspace:write'
  | 'workspace:export'
  | 'workspace:delete'
  | 'execution:run'
  | 'debug:use'
  | 'terminal:use';

export interface VerifiedDirectUserSession {
  sessionId: string;
  userId: string;
  expiresAt: number;
  projectIds: readonly string[];
  scopes: readonly DirectUserScope[];
}

export interface DirectUserSessionVerifier {
  /** Verify an opaque host-issued session token. Do not trust request-supplied identity fields. */
  verify(sessionToken: string): Promise<VerifiedDirectUserSession | null>;
}

export interface DirectUserReplayStore {
  claim(requestId: string, expiresAt: number, now: number): Promise<boolean>;
}

export interface DirectUserAuditEvent {
  requestId: string;
  sessionId: string;
  userId: string;
  projectId: string;
  commandId: string;
  phase: 'STARTED' | 'COMPLETED' | 'FAILED';
  at: number;
  detail?: string;
}

export interface DirectUserAuditStore {
  append(event: DirectUserAuditEvent): Promise<void>;
}

export interface DirectUserCommandRequest {
  sessionToken: string;
  requestId: string;
  projectId: string;
  commandId: string;
  input?: unknown;
  /** Required for destructive commands; must be supplied by the authenticated UI action. */
  confirmation?: { approved: true; approvalReference: string; confirmationText: string };
}

export interface DirectUserCommandResult {
  requestId: string;
  commandId: string;
  status: 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'AUDIT_INCOMPLETE';
  result?: unknown;
  message?: string;
}

const COMMAND_SCOPE: Readonly<Record<string, DirectUserScope>> = Object.freeze({
  'project.open': 'workspace:read',
  'project.save': 'workspace:write',
  'project.select-all': 'workspace:read',
  'project.auto-select': 'workspace:read',
  'project.clear-selection': 'workspace:read',
  'project.copy': 'workspace:export',
  'project.share': 'workspace:export',
  'project.export': 'workspace:export',
  'project.remove-preview': 'workspace:write',
  'project.remove-confirm': 'workspace:delete',
  'project.undo-remove': 'workspace:write',
  'run.project': 'execution:run',
  'run.build': 'execution:run',
  'run.tests': 'execution:run',
  'debug.start': 'debug:use',
  'terminal.open': 'terminal:use',
  'view.problems': 'workspace:read',
  'view.output': 'workspace:read',
  'view.preview': 'workspace:read',
  'view.resources': 'workspace:read'
});

const DEFAULT_MAX_SESSION_TOKEN = 4096;
const DEFAULT_MAX_REQUEST_ID = 160;
const DEFAULT_MAX_INPUT_BYTES = 1024 * 1024;

export class DirectUserWorkbenchGateway {
  constructor(
    private readonly commands: WorkbenchCommandRegistry,
    private readonly sessions: DirectUserSessionVerifier,
    private readonly replay: DirectUserReplayStore,
    private readonly audit: DirectUserAuditStore,
    private readonly now: () => number = Date.now,
    private readonly maxInputBytes = DEFAULT_MAX_INPUT_BYTES
  ) {
    if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 16 * 1024 * 1024) {
      throw new Error('Invalid direct-user input limit.');
    }
  }

  async dispatch(request: DirectUserCommandRequest): Promise<DirectUserCommandResult> {
    const blocked = (message: string): DirectUserCommandResult => ({
      requestId: typeof request?.requestId === 'string' ? request.requestId : '',
      commandId: typeof request?.commandId === 'string' ? request.commandId : '',
      status: 'BLOCKED', message
    });
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        typeof request.sessionToken !== 'string' || !request.sessionToken.trim() || request.sessionToken.length > DEFAULT_MAX_SESSION_TOKEN ||
        typeof request.requestId !== 'string' || !request.requestId.trim() || request.requestId.length > DEFAULT_MAX_REQUEST_ID ||
        typeof request.projectId !== 'string' || !request.projectId.trim() || request.projectId.length > 200 ||
        typeof request.commandId !== 'string' || !/^[a-z][a-z0-9.-]{1,79}$/.test(request.commandId)) {
      return blocked('Direct-user request is malformed.');
    }
    let inputBytes = 0;
    try { inputBytes = new TextEncoder().encode(JSON.stringify(request.input ?? null)).byteLength; }
    catch { return blocked('Direct-user command input is not serialisable.'); }
    if (inputBytes > this.maxInputBytes) return blocked('Direct-user command input exceeds the configured limit.');

    const scope = COMMAND_SCOPE[request.commandId];
    if (!scope) return blocked('Command is not available through the direct-user workbench.');
    const descriptor = this.commands.list().find((item) => item.id === request.commandId);
    if (!descriptor) return blocked('Command is not registered.');
    if (descriptor.state !== 'BOUND') return blocked(`Command is not connected to an operational host action (${descriptor.state}).`);
    if (descriptor.destructive) {
      const confirmation = request.confirmation;
      if (!confirmation || confirmation.approved !== true || typeof confirmation.approvalReference !== 'string' || !confirmation.approvalReference.trim() ||
          confirmation.confirmationText !== `REMOVE ${request.projectId}`) {
        return blocked('Destructive command requires explicit confirmation for this project.');
      }
    }

    let session: VerifiedDirectUserSession | null;
    try { session = await this.sessions.verify(request.sessionToken); }
    catch { return blocked('Direct-user session verification failed.'); }
    const now = this.now();
    if (!session || !session.sessionId?.trim() || !session.userId?.trim() || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= now ||
        !Array.isArray(session.projectIds) || !Array.isArray(session.scopes) ||
        !session.projectIds.includes(request.projectId) || !session.scopes.includes(scope)) {
      return blocked('Direct-user session is expired or lacks project/scope access.');
    }
    try {
      if (!await this.replay.claim(request.requestId, session.expiresAt, now)) return blocked('Direct-user request was already used.');
    } catch {
      return blocked('Replay protection is unavailable; command was not dispatched.');
    }

    const baseEvent: Omit<DirectUserAuditEvent, 'phase' | 'at' | 'detail'> = {
      requestId: request.requestId, sessionId: session.sessionId, userId: session.userId,
      projectId: request.projectId, commandId: request.commandId
    };
    try {
      await this.audit.append({ ...baseEvent, phase: 'STARTED', at: now });
    } catch {
      return blocked('Audit storage is unavailable; command was not dispatched.');
    }

    try {
      const result = await this.commands.dispatch(request.commandId, request.input);
      try {
        await this.audit.append({ ...baseEvent, phase: 'COMPLETED', at: this.now() });
      } catch {
        return { requestId: request.requestId, commandId: request.commandId, status: 'AUDIT_INCOMPLETE', result,
          message: 'The command ran, but completion could not be durably audited. Do not assume an automatic retry is safe.' };
      }
      return { requestId: request.requestId, commandId: request.commandId, status: 'COMPLETED', result };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
      try { await this.audit.append({ ...baseEvent, phase: 'FAILED', at: this.now(), detail: message }); }
      catch {
        return { requestId: request.requestId, commandId: request.commandId, status: 'AUDIT_INCOMPLETE', message: `${message} (failure audit could not be stored)` };
      }
      return { requestId: request.requestId, commandId: request.commandId, status: 'FAILED', message };
    }
  }
}

/** Direct user editing path. A person's typed text is supplied as USER content, without a Brain request. */
export class DirectUserDocumentGateway {
  constructor(private readonly buffers: DocumentBufferManager, private readonly sessions: DirectUserSessionVerifier, private readonly now: () => number = Date.now) {}

  async open(sessionToken: string, workspaceId: string, path: string): Promise<DocumentBufferSnapshot> {
    await this.authorise(sessionToken, workspaceId, 'workspace:read');
    return this.buffers.open(workspaceId, path);
  }

  async stageTypedContent(input: { sessionToken: string; workspaceId: string; path: string; content: string; approvalReference: string }): Promise<DocumentBufferSnapshot> {
    await this.authorise(input.sessionToken, input.workspaceId, 'workspace:write');
    return this.buffers.supplyContent({ workspaceId: input.workspaceId, path: input.path, content: input.content, source: 'USER', approvalReference: input.approvalReference });
  }

  async save(input: { sessionToken: string; workspaceId: string; path: string; approved: boolean; approvalReference: string }): Promise<DocumentBufferSnapshot> {
    await this.authorise(input.sessionToken, input.workspaceId, 'workspace:write');
    return this.buffers.save(input.workspaceId, input.path, { approved: input.approved, approvalReference: input.approvalReference });
  }

  async close(sessionToken: string, workspaceId: string, path: string, allowDiscard: boolean): Promise<void> {
    await this.authorise(sessionToken, workspaceId, 'workspace:read');
    this.buffers.close(workspaceId, path, allowDiscard);
  }

  private async authorise(token: string, projectId: string, scope: DirectUserScope): Promise<VerifiedDirectUserSession> {
    if (typeof token !== 'string' || !token.trim() || token.length > DEFAULT_MAX_SESSION_TOKEN || typeof projectId !== 'string' || !projectId.trim()) throw new Error('A valid direct-user session and project are required.');
    const session = await this.sessions.verify(token);
    if (!session || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= this.now() || !session.projectIds.includes(projectId) || !session.scopes.includes(scope)) {
      throw new Error('Direct-user session is expired or lacks project/scope access.');
    }
    return session;
  }
}
