export interface NodeInspectorResponse { result?: Record<string, any>; error?: { message?: string; code?: number }; }
export interface NodeInspectorTransport {
  send(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, any>>;
  onEvent(method: string, listener: (params: Record<string, any>) => void): () => void;
  close(): void;
}
export interface NodeInspectorExit { code: number | null; signal: string | null; stdout: string; stderr: string; }
export interface NodeInspectorTarget {
  inspectorUrl: Promise<string>;
  programUrl: string;
  exit: Promise<NodeInspectorExit>;
  kill(): void;
}
/** Host boundary. The production Node host must use a real child process and WebSocket Inspector transport. */
export interface NodeInspectorHost {
  launch(input: { programPath: string; cwd: string; workspaceRoot: string }): Promise<NodeInspectorTarget>;
  connect(inspectorUrl: string): Promise<NodeInspectorTransport>;
}
export interface NodeInspectorPause {
  reason: string;
  description?: string;
  callFrames: Array<{ callFrameId: string; functionName: string; url: string; lineNumber: number; columnNumber: number; scopeChain: Array<{ type: string; object: { objectId?: string } }> }>;
}
export interface NodeInspectorBreakpoint { breakpointId: string; locations: Array<{ scriptId: string; line: number; column: number }>; }

function normalizeAbsolutePath(input: string): string {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Debug path is required.');
  const value = input.replaceAll('\\', '/');
  if (!value.startsWith('/') && !/^[A-Za-z]:\//.test(value)) throw new Error('Debug paths must be absolute.');
  const prefix = /^[A-Za-z]:\//.test(value) ? value.slice(0, 3) : '/';
  const rest = value.slice(prefix.length);
  const parts: string[] = [];
  for (const part of rest.split('/')) { if (!part || part === '.') continue; if (part === '..') { if (!parts.length) throw new Error('Debug path escapes the workspace root.'); parts.pop(); } else parts.push(part); }
  return `${prefix}${parts.join('/')}`;
}
function isWithin(root: string, candidate: string): boolean { return candidate === root || candidate.startsWith(`${root.endsWith('/') ? root : `${root}/`}`); }

/** Real Node Inspector Protocol controller. Isolation is Grade 1 only; this class does not sandbox the target. */
export class NodeInspectorDebugAdapter {
  private target: NodeInspectorTarget | null = null;
  private transport: NodeInspectorTransport | null = null;
  private stateValue: 'STARTING' | 'PAUSED' | 'RUNNING' | 'STOPPED' | 'CRASHED' = 'STOPPED';
  private lastPause: NodeInspectorPause | null = null;
  private pauseSequence = 0;
  private pauseWaiters: Array<{ after: number; resolve: (pause: NodeInspectorPause | null) => void; timer: ReturnType<typeof setTimeout> }> = [];
  private exitResult: NodeInspectorExit | null = null;
  private waitingForDebugger = false;
  private crashMessage: string | null = null;
  private eventDisposers: Array<() => void> = [];

  constructor(private readonly host: NodeInspectorHost, private readonly timeoutMs = 8_000) {}
  get state(): 'STARTING' | 'PAUSED' | 'RUNNING' | 'STOPPED' | 'CRASHED' { return this.stateValue; }
  get crashedWith(): string | null { return this.crashMessage; }

  async start(input: { programPath: string; cwd: string; workspaceRoot: string }): Promise<NodeInspectorPause> {
    if (this.stateValue !== 'STOPPED') throw new Error('A Node Inspector target is already active.');
    const root = normalizeAbsolutePath(input.workspaceRoot);
    const programPath = normalizeAbsolutePath(input.programPath);
    const cwd = normalizeAbsolutePath(input.cwd);
    if (!isWithin(root, programPath) || !isWithin(root, cwd)) throw new Error('Node Inspector target and cwd must remain inside the approved workspace root.');
    this.stateValue = 'STARTING';
    try {
      this.target = await this.host.launch({ programPath, cwd, workspaceRoot: root });
      const inspectorUrl = await this.target.inspectorUrl;
      if (!/^ws:\/\/127\.0\.0\.1:\d+\//.test(inspectorUrl)) throw new Error('Node Inspector endpoint must be loopback-only.');
      this.transport = await this.host.connect(inspectorUrl);
      this.eventDisposers.push(this.transport.onEvent('Debugger.paused', (params) => {
        this.lastPause = params as unknown as NodeInspectorPause;
        this.pauseSequence++;
        this.stateValue = 'PAUSED';
        this.resolvePauseWaiters();
      }));
      this.eventDisposers.push(this.transport.onEvent('Debugger.resumed', () => { this.stateValue = 'RUNNING'; }));
      this.eventDisposers.push(this.transport.onEvent('Runtime.exceptionThrown', (params) => {
        const details = params['exceptionDetails'] as Record<string, any> | undefined;
        this.crashMessage = String(details?.['exception']?.['description'] ?? details?.['text'] ?? 'Node target threw an uncaught exception.');
        this.stateValue = 'CRASHED';
        this.resolvePauseWaiters();
        this.target?.kill();
      }));
      void this.target.exit.then((result) => {
        this.exitResult = result;
        if (this.stateValue !== 'STOPPED') this.stateValue = result.code !== 0 ? 'CRASHED' : 'STOPPED';
        this.resolvePauseWaiters();
      });
      await this.transport.send('Runtime.enable', {}, this.timeoutMs);
      await this.transport.send('Debugger.enable', {}, this.timeoutMs);
      // --inspect-brk holds the real target before user code. Node does not emit a call-frame pause event until it is released.
      this.waitingForDebugger = true;
      this.stateValue = 'PAUSED';
      return { reason: 'Break on start', callFrames: [] };
    } catch (error) {
      await this.stop().catch(() => undefined);
      throw error;
    }
  }

  async setBreakpoint(line: number): Promise<NodeInspectorBreakpoint> {
    if (!this.transport || !this.target || !Number.isSafeInteger(line) || line < 1) throw new Error('Breakpoint requires an active target and a positive one-based line.');
    const response = await this.transport.send('Debugger.setBreakpointByUrl', { url: this.target.programUrl, lineNumber: line - 1, columnNumber: 0 }, this.timeoutMs);
    if (typeof response['breakpointId'] !== 'string') throw new Error('Node Inspector did not return a breakpoint ID.');
    return { breakpointId: response['breakpointId'], locations: (response['locations'] ?? []).map((location: any) => ({ scriptId: String(location.scriptId), line: Number(location.lineNumber) + 1, column: Number(location.columnNumber) + 1 })) };
  }

  async resume(): Promise<NodeInspectorPause | null> {
    if (this.waitingForDebugger && this.transport) {
      const before = this.pauseSequence;
      this.waitingForDebugger = false;
      await this.transport.send('Runtime.runIfWaitingForDebugger', {}, this.timeoutMs);
      this.stateValue = 'RUNNING';
      const firstPause = await this.waitForPause(before, this.timeoutMs);
      if (firstPause?.reason === 'Break on start') {
        const initialBreakSequence = this.pauseSequence;
        await this.transport.send('Debugger.resume', {}, this.timeoutMs);
        this.stateValue = 'RUNNING';
        return this.waitForPause(initialBreakSequence, this.timeoutMs);
      }
      return firstPause;
    }
    return this.runControl('Debugger.resume');
  }
  async stepOver(): Promise<NodeInspectorPause | null> { return this.runControl('Debugger.stepOver'); }
  async stepInto(): Promise<NodeInspectorPause | null> { return this.runControl('Debugger.stepInto'); }
  async stepOut(): Promise<NodeInspectorPause | null> { return this.runControl('Debugger.stepOut'); }

  private async runControl(method: string): Promise<NodeInspectorPause | null> {
    if (!this.transport || this.stateValue !== 'PAUSED') throw new Error('Node Inspector control requires a paused target.');
    const before = this.pauseSequence;
    await this.transport.send(method, {}, this.timeoutMs);
    this.stateValue = 'RUNNING';
    return this.waitForPause(before, this.timeoutMs);
  }

  async stack(): Promise<NodeInspectorPause['callFrames']> {
    if (this.stateValue !== 'PAUSED' || !this.lastPause) throw new Error('Stack is available only while the target is paused.');
    return this.lastPause.callFrames.map((frame) => ({ ...frame, line: frame.lineNumber ?? 0, column: frame.columnNumber ?? 0 } as any));
  }

  async variables(frameIndex = 0): Promise<Array<{ name: string; value: string; type?: string }>> {
    if (!this.transport || this.stateValue !== 'PAUSED' || !this.lastPause) throw new Error('Variables are available only while the target is paused.');
    const frame = this.lastPause.callFrames[frameIndex];
    if (!frame) throw new Error('Requested stack frame does not exist.');
    const scope = frame.scopeChain.find((item) => item.type === 'local') ?? frame.scopeChain[0];
    if (!scope?.object?.objectId) return [];
    const response = await this.transport.send('Runtime.getProperties', { objectId: scope.object.objectId, ownProperties: true, accessorPropertiesOnly: false, generatePreview: false }, this.timeoutMs);
    return (response['result'] ?? []).filter((item: any) => typeof item.name === 'string').map((item: any) => ({ name: item.name, value: item.value?.value !== undefined ? String(item.value.value) : String(item.value?.description ?? item.value?.type ?? 'undefined'), ...(item.value?.type ? { type: String(item.value.type) } : {}) }));
  }

  async evaluate(expression: string, frameIndex = 0): Promise<{ value?: unknown; type: string; description?: string }> {
    if (typeof expression !== 'string' || !expression.trim() || expression.length > 4096) throw new Error('Evaluation expression is empty or exceeds 4 KiB.');
    if (!this.transport || this.stateValue !== 'PAUSED' || !this.lastPause) throw new Error('Evaluation is available only while the target is paused.');
    const frame = this.lastPause.callFrames[frameIndex];
    if (!frame) throw new Error('Requested stack frame does not exist.');
    const response = await this.transport.send('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression, returnByValue: true, silent: true }, this.timeoutMs);
    if (response['exceptionDetails']) throw new Error(String(response['exceptionDetails'].text ?? 'Inspector evaluation failed.'));
    return { ...(response['result']?.value !== undefined ? { value: response['result'].value } : {}), type: String(response['result']?.type ?? 'undefined'), ...(response['result']?.description ? { description: String(response['result'].description) } : {}) };
  }

  async waitForExit(timeoutMs = this.timeoutMs): Promise<NodeInspectorExit> {
    if (this.exitResult) return this.exitResult;
    if (!this.target) throw new Error('Node Inspector target has not started.');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Node Inspector target did not exit before the timeout.')), timeoutMs);
      this.target!.exit.then((result) => { clearTimeout(timer); resolve(result); }, (error) => { clearTimeout(timer); reject(error); });
    });
  }

  async stop(): Promise<void> {
    if (!this.target) { this.stateValue = 'STOPPED'; return; }
    this.target.kill();
    try { await this.waitForExit(Math.max(this.timeoutMs, 3_000)); } catch { /* A killed target may already have exited. */ }
    this.disposeTransport();
    this.stateValue = 'STOPPED';
  }

  async close(): Promise<void> { await this.stop(); }

  private waitForPause(after: number, timeoutMs: number): Promise<NodeInspectorPause | null> {
    if (this.pauseSequence > after && this.lastPause) return Promise.resolve(this.lastPause);
    if (this.exitResult || this.crashMessage) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pauseWaiters = this.pauseWaiters.filter((waiter) => waiter.resolve !== resolve); reject(new Error('Node Inspector did not pause before the timeout.')); }, timeoutMs);
      this.pauseWaiters.push({ after, resolve, timer });
    });
  }

  private resolvePauseWaiters(): void {
    const remaining: typeof this.pauseWaiters = [];
    for (const waiter of this.pauseWaiters) {
      if (this.pauseSequence > waiter.after && this.lastPause) { clearTimeout(waiter.timer); waiter.resolve(this.lastPause); }
      else if (this.exitResult || this.crashMessage) { clearTimeout(waiter.timer); waiter.resolve(null); }
      else remaining.push(waiter);
    }
    this.pauseWaiters = remaining;
  }

  private disposeTransport(): void {
    for (const dispose of this.eventDisposers.splice(0)) dispose();
    this.transport?.close(); this.transport = null;
  }
}
