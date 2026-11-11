export interface DebugAdapterAttestation { available: boolean; sandboxed: boolean; filesystemScoped: boolean; networkBlocked: boolean; memoryLimited: boolean; timeLimited: boolean; unprivileged: boolean; processTreeConfinement: boolean; notes: string[]; }
export interface DebugAdapterResponse { requestSeq: number; success: boolean; body?: unknown; message?: string; }
export interface DebugAdapterBridge {
  probe(): Promise<DebugAdapterAttestation>;
  start(input: { debugType: string; programToken: string; cwdToken: string; stopOnEntry: boolean; networkAllowed: false; unprivileged: true }): Promise<{ sessionToken: string; capabilities: string[] }>;
  request(sessionToken: string, input: { seq: number; command: string; arguments: unknown }): Promise<DebugAdapterResponse>;
  close(sessionToken: string): Promise<void>;
}
export interface DebugSession { id: string; debugType: string; state: 'RUNNING' | 'STOPPED' | 'CLOSED' | 'FAILED'; capabilities: string[]; startedAt: number; }
export interface DebugCommandResult { sequence: number; success: boolean; body?: unknown; message?: string; }

/** DAP lifecycle/controller. An external debug adapter performs language-specific debugging inside an attested sandbox. */
export class DebugSessionManager {
  private readonly sessions = new Map<string, { session: DebugSession; token: string; seq: number }>();
  private sequence = 0;
  constructor(private readonly bridge: DebugAdapterBridge, private readonly allowedDebugTypes: readonly string[], private readonly now: () => number = Date.now) {}
  async start(input: { debugType: string; programToken: string; cwdToken: string; stopOnEntry?: boolean; approved: boolean }): Promise<DebugSession> {
    if (!input.approved || !input.programToken.trim() || !input.cwdToken.trim()) throw new Error('Debug session requires approved program and working-directory tokens.');
    if (!this.allowedDebugTypes.includes(input.debugType)) throw new Error(`Debug adapter '${input.debugType}' is not registered.`);
    const probe = await this.bridge.probe();
    const missingProtections = [
      ['provider unavailable', probe.available], ['sandbox isolation', probe.sandboxed],
      ['filesystem isolation', probe.filesystemScoped], ['network blocking', probe.networkBlocked],
      ['memory limits', probe.memoryLimited], ['time limits', probe.timeLimited],
      ['unprivileged identity', probe.unprivileged], ['process-tree confinement', probe.processTreeConfinement]
    ].filter(([, present]) => present !== true).map(([name]) => name);
    if (missingProtections.length) throw new Error(`Debug adapter is not sufficiently sandboxed/isolated: ${missingProtections.join(', ')}${probe.notes.length ? `; ${probe.notes.join('; ')}` : ''}`);
    const started = await this.bridge.start({ debugType: input.debugType, programToken: input.programToken, cwdToken: input.cwdToken, stopOnEntry: input.stopOnEntry ?? true, networkAllowed: false, unprivileged: true });
    if (!started.sessionToken.trim()) throw new Error('Debug adapter returned an empty session token.');
    const session: DebugSession = { id: `debug-${++this.sequence}`, debugType: input.debugType, state: input.stopOnEntry === false ? 'RUNNING' : 'STOPPED', capabilities: [...started.capabilities], startedAt: this.now() };
    this.sessions.set(session.id, { session, token: started.sessionToken, seq: 0 });
    return structuredClone(session);
  }
  get(id: string): DebugSession | null { const row = this.sessions.get(id); return row ? structuredClone(row.session) : null; }
  async command(id: string, command: 'continue' | 'next' | 'stepIn' | 'stepOut' | 'pause' | 'stackTrace' | 'scopes' | 'variables' | 'disconnect', args: unknown = {}): Promise<DebugCommandResult> {
    const row = this.sessions.get(id); if (!row || row.session.state === 'CLOSED' || row.session.state === 'FAILED') throw new Error('Debug session is not active.');
    validateDebugArguments(command, args);
    const seq = ++row.seq;
    const response = await this.bridge.request(row.token, { seq, command, arguments: args });
    if (response.requestSeq !== seq) { row.session.state = 'FAILED'; throw new Error('Debug adapter response sequence does not match the request.'); }
    if (!response.success) return { sequence: seq, success: false, ...(response.message ? { message: response.message } : {}) };
    if (command === 'continue' || command === 'next' || command === 'stepIn' || command === 'stepOut') row.session.state = 'RUNNING';
    if (command === 'pause' || command === 'stackTrace' || command === 'scopes' || command === 'variables') row.session.state = 'STOPPED';
    if (command === 'disconnect') { await this.bridge.close(row.token); row.session.state = 'CLOSED'; }
    return { sequence: seq, success: true, ...(response.body !== undefined ? { body: response.body } : {}) };
  }
  async setBreakpoints(id: string, input: { sourceToken: string; lines: readonly number[] }): Promise<DebugCommandResult> {
    const row = this.sessions.get(id); if (!row || row.session.state === 'CLOSED' || row.session.state === 'FAILED') throw new Error('Debug session is not active.');
    if (!input.sourceToken.trim() || input.lines.length > 512 || input.lines.some((line) => !Number.isSafeInteger(line) || line < 1)) throw new Error('Breakpoint request is invalid.');
    const seq = ++row.seq;
    const response = await this.bridge.request(row.token, { seq, command: 'setBreakpoints', arguments: { source: { path: input.sourceToken }, breakpoints: input.lines.map((line) => ({ line })) } });
    if (response.requestSeq !== seq) { row.session.state = 'FAILED'; throw new Error('Debug adapter response sequence does not match the request.'); }
    return { sequence: seq, success: response.success, ...(response.body !== undefined ? { body: response.body } : {}), ...(response.message ? { message: response.message } : {}) };
  }
  async close(id: string): Promise<void> { const row = this.sessions.get(id); if (!row || row.session.state === 'CLOSED') return; await this.bridge.close(row.token); row.session.state = 'CLOSED'; }
  list(): DebugSession[] { return [...this.sessions.values()].map((row) => structuredClone(row.session)); }
}
function validateDebugArguments(command: string, args: unknown): void {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw new Error('Debug command arguments must be an object.');
  const value = args as Record<string, unknown>;
  const requiresThread = new Set(['continue', 'next', 'stepIn', 'stepOut', 'pause', 'stackTrace']);
  if (requiresThread.has(command) && (!Number.isSafeInteger(value['threadId']) || Number(value['threadId']) < 0)) throw new Error(`Debug command '${command}' requires a valid threadId.`);
  if (command === 'scopes' && (!Number.isSafeInteger(value['frameId']) || Number(value['frameId']) < 0)) throw new Error('Debug scopes requires a frameId.');
  if (command === 'variables' && (!Number.isSafeInteger(value['variablesReference']) || Number(value['variablesReference']) < 0)) throw new Error('Debug variables requires a variablesReference.');
  if (JSON.stringify(args).length > 32 * 1024) throw new Error('Debug command arguments exceed the configured limit.');
}
