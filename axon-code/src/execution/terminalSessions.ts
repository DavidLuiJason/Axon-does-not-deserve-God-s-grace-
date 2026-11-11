export interface PtyHostAttestation {
  available: boolean;
  isolationConfirmed: boolean;
  filesystemIsolated: boolean;
  networkPolicyEnforced: boolean;
  memoryLimitEnforced: boolean;
  timeLimitEnforced: boolean;
  outputLimitEnforced: boolean;
  unprivilegedIdentity: boolean;
  processTreeConfinement: boolean;
  notes: string[];
}
export interface PtyStartRequest {
  shellId: string;
  workingDirectoryToken: string;
  environment: Record<string, string>;
  environmentAllowList: readonly string[];
  networkAllowed: boolean;
  maxSessionMs: number;
  maxOutputBytes: number;
  runAs: 'UNPRIVILEGED_ONLY';
  privilegeEscalation: false;
}
export type PtyHostEvent = { type: 'output'; data: string } | { type: 'exit'; exitCode?: number; signal?: string };
export interface PtyHostBridge {
  probe(): Promise<PtyHostAttestation>;
  start(request: PtyStartRequest): Promise<{ sessionToken: string; processId?: string }>;
  write(sessionToken: string, input: string): Promise<void>;
  resize(sessionToken: string, columns: number, rows: number): Promise<void>;
  close(sessionToken: string): Promise<void>;
  /** Optional native stream; without it the provider is not a fully interactive terminal yet. */
  subscribe?(sessionToken: string, handler: (event: PtyHostEvent) => void): () => void;
}
export type TerminalSessionState = 'OPEN' | 'CLOSING' | 'CLOSED' | 'FAILED';
export interface TerminalSessionRecord {
  id: string; projectId: string; shellId: string; state: TerminalSessionState; openedAt: number; lastActivityAt: number;
  processId?: string; exitCode?: number; outputBytes: number; outputTruncated: boolean; outputStreamingAvailable: boolean;
}
export interface TerminalOpenApproval { approved: boolean; approvalReference: string; allowNetwork: boolean; }
export interface TerminalOutputSnapshot { text: string; outputBytes: number; truncated: boolean; exitCode?: number; state: TerminalSessionState; }

/**
 * PTY lifecycle and bounded output buffer. This is not a PTY implementation:
 * an attested native host provider must supply actual process-tree isolation,
 * input/output streaming, resource limits and kill semantics.
 */
export class TerminalSessionManager {
  private readonly sessions = new Map<string, { record: TerminalSessionRecord; token: string; output: string; unsubscribe: (() => void) | undefined }>();
  private nextId = 0;
  constructor(
    private readonly host: PtyHostBridge,
    private readonly policy: { maxSessions: number; maxSessionMs: number; maxOutputBytes: number; allowedShells: readonly string[]; allowedEnvironment: readonly string[]; now?: () => number }
  ) {
    if (!Number.isSafeInteger(policy.maxSessions) || policy.maxSessions < 1 || !Number.isSafeInteger(policy.maxSessionMs) || policy.maxSessionMs < 1000 || !Number.isSafeInteger(policy.maxOutputBytes) || policy.maxOutputBytes < 1 || !policy.allowedShells.length) throw new Error('Invalid terminal session policy.');
  }
  list(): TerminalSessionRecord[] { return [...this.sessions.values()].map(({ record }) => ({ ...record })); }
  async open(input: { projectId: string; shellId: string; workingDirectoryToken: string; environment?: Record<string, string>; approval: TerminalOpenApproval }): Promise<TerminalSessionRecord> {
    if (!input.projectId.trim() || !input.workingDirectoryToken.trim() || input.approval?.approved !== true || !input.approval.approvalReference.trim() || typeof input.approval.allowNetwork !== 'boolean') throw new Error('Terminal requires a project, working-directory token and explicit approval.');
    if (!this.policy.allowedShells.includes(input.shellId)) throw new Error(`Shell '${input.shellId}' is not allowed on this host.`);
    const active = [...this.sessions.values()].filter(({ record }) => record.state === 'OPEN').length;
    if (active >= this.policy.maxSessions) throw new Error('Terminal session limit reached.');
    const environment = input.environment ?? {};
    if (!environment || typeof environment !== 'object' || Array.isArray(environment)) throw new Error('Terminal environment must be a plain key/value object.');
    for (const [key, value] of Object.entries(environment)) {
      if (!this.policy.allowedEnvironment.includes(key) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string' || value.length > 4096 || /[\u0000\r\n]/.test(value)) throw new Error(`Environment variable '${key}' is not permitted or is invalid.`);
    }
    const probe = await this.host.probe();
    const missingProtections = [
      ['provider unavailable', probe.available], ['sandbox isolation', probe.isolationConfirmed],
      ['filesystem isolation', probe.filesystemIsolated], ['network policy', probe.networkPolicyEnforced],
      ['memory limit', probe.memoryLimitEnforced], ['time limit', probe.timeLimitEnforced],
      ['output limit', probe.outputLimitEnforced], ['unprivileged identity', probe.unprivilegedIdentity],
      ['process-tree confinement', probe.processTreeConfinement]
    ].filter(([, present]) => present !== true).map(([name]) => name);
    if (missingProtections.length) throw new Error(`Terminal provider lacks required sandbox/isolation protections: ${missingProtections.join(', ')}${probe.notes.length ? `; ${probe.notes.join('; ')}` : ''}`);
    const started = await this.host.start({ shellId: input.shellId, workingDirectoryToken: input.workingDirectoryToken, environment, environmentAllowList: this.policy.allowedEnvironment,
      networkAllowed: input.approval.allowNetwork, maxSessionMs: this.policy.maxSessionMs, maxOutputBytes: this.policy.maxOutputBytes, runAs: 'UNPRIVILEGED_ONLY', privilegeEscalation: false });
    if (typeof started.sessionToken !== 'string' || !started.sessionToken.trim()) throw new Error('PTY provider returned an empty session token.');
    const now = this.policy.now?.() ?? Date.now();
    const record: TerminalSessionRecord = { id: `terminal-${++this.nextId}`, projectId: input.projectId, shellId: input.shellId, state: 'OPEN', openedAt: now, lastActivityAt: now, outputBytes: 0, outputTruncated: false, outputStreamingAvailable: Boolean(this.host.subscribe), ...(started.processId ? { processId: started.processId } : {}) };
    const session: { record: TerminalSessionRecord; token: string; output: string; unsubscribe: (() => void) | undefined } = { record, token: started.sessionToken, output: '', unsubscribe: undefined };
    this.sessions.set(record.id, session);
    if (this.host.subscribe) {
      try {
        session.unsubscribe = this.host.subscribe(started.sessionToken, (event) => this.acceptEvent(record.id, event));
      } catch (error) {
        this.sessions.delete(record.id);
        await this.host.close(started.sessionToken).catch(() => undefined);
        throw new Error(`PTY output subscription failed; session was closed: ${String(error)}`);
      }
    }
    return { ...record };
  }
  async write(sessionId: string, input: string): Promise<void> {
    const session = this.requireOpen(sessionId);
    if (typeof input !== 'string' || input.length === 0 || new TextEncoder().encode(input).byteLength > 64 * 1024 || input.includes('\u0000')) throw new Error('Terminal input is empty, too large or contains NUL.');
    await this.host.write(session.token, input); session.record.lastActivityAt = this.policy.now?.() ?? Date.now();
  }
  async resize(sessionId: string, columns: number, rows: number): Promise<void> {
    const session = this.requireOpen(sessionId);
    if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows) || columns < 10 || columns > 500 || rows < 5 || rows > 300) throw new Error('Terminal dimensions are outside supported bounds.');
    await this.host.resize(session.token, columns, rows);
  }
  readOutput(sessionId: string, clear = false): TerminalOutputSnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Terminal session does not exist.');
    const snapshot: TerminalOutputSnapshot = { text: session.output, outputBytes: session.record.outputBytes, truncated: session.record.outputTruncated, state: session.record.state, ...(session.record.exitCode !== undefined ? { exitCode: session.record.exitCode } : {}) };
    if (clear) session.output = '';
    return snapshot;
  }
  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId); if (!session || session.record.state === 'CLOSED') return;
    session.record.state = 'CLOSING';
    try { await this.host.close(session.token); session.record.state = 'CLOSED'; session.unsubscribe?.(); session.unsubscribe = undefined; }
    catch (error) { session.record.state = 'FAILED'; throw error; }
  }
  async closeAll(): Promise<void> { const errors: string[] = []; for (const session of this.list()) if (session.state === 'OPEN') await this.close(session.id).catch((error: unknown) => errors.push(String(error))); if (errors.length) throw new Error(`Some terminal sessions failed to close: ${errors.join('; ')}`); }
  private acceptEvent(sessionId: string, event: PtyHostEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.record.state !== 'OPEN') return;
    if (event.type === 'exit') {
      if (event.exitCode !== undefined && !Number.isSafeInteger(event.exitCode)) { session.record.state = 'FAILED'; return; }
      if (event.exitCode !== undefined) session.record.exitCode = event.exitCode;
      session.record.state = 'CLOSED';
      session.unsubscribe?.(); session.unsubscribe = undefined;
      return;
    }
    if (event.type !== 'output' || typeof event.data !== 'string') { session.record.outputTruncated = true; return; }
    const bytes = new TextEncoder().encode(event.data);
    const remaining = Math.max(0, this.policy.maxOutputBytes - session.record.outputBytes);
    const accepted = bytes.subarray(0, remaining);
    if (accepted.byteLength < bytes.byteLength) session.record.outputTruncated = true;
    if (accepted.byteLength) {
      session.output += new TextDecoder().decode(accepted);
      session.record.outputBytes += accepted.byteLength;
      session.record.lastActivityAt = this.policy.now?.() ?? Date.now();
    }
  }
  private requireOpen(id: string): { record: TerminalSessionRecord; token: string; output: string; unsubscribe: (() => void) | undefined } { const session = this.sessions.get(id); if (!session || session.record.state !== 'OPEN') throw new Error(`Terminal session '${id}' is not open.`); return session; }
}
