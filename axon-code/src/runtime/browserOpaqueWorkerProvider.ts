import type { SecureWorkerProvider, WorkerErrorEventLike, WorkerHandle, WorkerMessageEventLike, WorkerSandboxAttestation } from './javascriptWorker.js';

interface BrowserWorkerMessage {
  __axonWorkerFrame: true;
  event: 'frame-ready' | 'probe' | 'ready' | 'message' | 'error' | 'terminated';
  id?: string;
  frameOrigin?: string;
  cspMarker?: string;
  cspNetworkProbe?: boolean;
  data?: unknown;
  message?: string;
  workerOrigin?: string;
  capabilities?: Record<string, string>;
}

class BrowserWorkerHandle implements WorkerHandle {
  private readonly messageListeners = new Set<(event: WorkerMessageEventLike) => void>();
  private readonly errorListeners = new Set<(event: WorkerErrorEventLike) => void>();
  private terminated = false;

  constructor(private readonly id: string, private readonly send: (command: Record<string, unknown>) => void) {}

  addEventListener(type: 'message' | 'error', listener: ((event: WorkerMessageEventLike) => void) | ((event: WorkerErrorEventLike) => void)): void {
    if (type === 'message') this.messageListeners.add(listener as (event: WorkerMessageEventLike) => void);
    else this.errorListeners.add(listener as (event: WorkerErrorEventLike) => void);
  }

  removeEventListener(type: 'message' | 'error', listener: ((event: WorkerMessageEventLike) => void) | ((event: WorkerErrorEventLike) => void)): void {
    if (type === 'message') this.messageListeners.delete(listener as (event: WorkerMessageEventLike) => void);
    else this.errorListeners.delete(listener as (event: WorkerErrorEventLike) => void);
  }

  postMessage(message: unknown): void {
    if (this.terminated) throw new Error('Worker handle has been terminated.');
    this.send({ command: 'post', id: this.id, message });
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.send({ command: 'terminate', id: this.id });
    this.messageListeners.clear();
    this.errorListeners.clear();
  }

  dispatchMessage(data: unknown): void {
    if (this.terminated) return;
    for (const listener of this.messageListeners) listener({ data });
  }

  dispatchError(message: string): void {
    if (this.terminated) return;
    for (const listener of this.errorListeners) listener({ message });
  }
}

/**
 * Browser/WebView provider using a sandboxed opaque-origin iframe and a Blob Worker.
 * This is intended for owner-approved JavaScript snippets, not hostile internet code.
 * The browser's process/site isolation remains part of the security boundary.
 */
export class BrowserOpaqueWorkerProvider implements SecureWorkerProvider {
  private frame: HTMLIFrameElement | null = null;
  private ready = false;
  private verified = false;
  private cspConfirmed = false;
  private nextId = 0;
  private readonly handles = new Map<string, BrowserWorkerHandle>();
  private frameReadyResolve: (() => void) | null = null;
  private probeResolve: ((message: BrowserWorkerMessage) => void) | null = null;
  private readonly onMessageBound = (event: MessageEvent<unknown>): void => this.onFrameMessage(event);

  constructor(private readonly hostDocument: Document = document) {}

  async initialize(timeoutMs = 5_000): Promise<WorkerSandboxAttestation> {
    if (this.verified) return this.attest();
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100) throw new Error('Worker provider initialization timeout is invalid.');
    if (!this.hostDocument.body || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error('This host does not expose the required browser Worker capabilities.');
    }

    const frame = this.hostDocument.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.referrerPolicy = 'no-referrer';
    frame.style.position = 'absolute';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.left = '-10000px';
    frame.style.border = '0';
    frame.srcdoc = SANDBOX_FRAME_HTML;
    this.frame = frame;
    this.hostDocument.defaultView?.addEventListener('message', this.onMessageBound);
    this.hostDocument.body.append(frame);

    await this.withTimeout(new Promise<void>((resolve) => { this.frameReadyResolve = resolve; }), timeoutMs, 'Opaque-origin worker frame did not initialise.');
    const probe = new Promise<BrowserWorkerMessage>((resolve) => { this.probeResolve = resolve; });
    this.send({ command: 'probe', id: '__axon_probe__' });
    const probeResult = await this.withTimeout(probe, timeoutMs, 'Opaque-origin worker probe did not respond.');
    const caps = probeResult.capabilities ?? {};
    const blocked = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'importScripts', 'BroadcastChannel', 'caches', 'document', 'localStorage', 'Worker', 'SharedWorker', 'WebTransport', 'RTCPeerConnection'];
    const blockedConfirmed = blocked.every((key) => caps[key] === 'undefined');
    this.verified = probeResult.workerOrigin === 'null' && blockedConfirmed && this.cspConfirmed;
    this.ready = this.verified;
    if (!this.verified) {
      this.dispose();
      throw new Error('Worker sandbox probe failed: the worker origin or restricted API checks did not match policy.');
    }
    return this.attest();
  }

  attest(): WorkerSandboxAttestation {
    const confirmed = this.verified && this.ready && Boolean(this.frame?.isConnected);
    return {
      providerId: confirmed ? 'browser-opaque-origin-blob-worker-v1' : 'browser-worker-unverified',
      isolatedOrigin: confirmed,
      networkBlockedByHostPolicy: confirmed,
      filesystemBridgeAbsent: confirmed,
      restrictiveCspConfirmed: confirmed && this.cspConfirmed,
      noPrivilegedHostBridge: confirmed
    };
  }

  createWorker(): WorkerHandle {
    if (!this.verified || !this.ready || !this.frame?.isConnected) throw new Error('Worker provider has not passed its isolation probe.');
    const id = `axon-worker-${++this.nextId}`;
    const handle = new BrowserWorkerHandle(id, (command) => this.send(command));
    this.handles.set(id, handle);
    this.send({ command: 'create', id });
    return handle;
  }

  dispose(): void {
    this.hostDocument.defaultView?.removeEventListener('message', this.onMessageBound);
    for (const handle of this.handles.values()) handle.terminate();
    this.handles.clear();
    this.frame?.remove();
    this.frame = null;
    this.ready = false;
    this.verified = false;
    this.cspConfirmed = false;
  }

  private send(command: Record<string, unknown>): void {
    this.frame?.contentWindow?.postMessage({ __axonWorkerCommand: true, ...command }, '*');
  }

  private onFrameMessage(event: MessageEvent<unknown>): void {
    if (!this.frame?.contentWindow || event.source !== this.frame.contentWindow || event.origin !== 'null') return;
    const data = event.data as Partial<BrowserWorkerMessage> | null;
    if (!data || data.__axonWorkerFrame !== true || typeof data.event !== 'string') return;
    if (data.event === 'frame-ready' && data.frameOrigin === 'null' && data.cspMarker === 'AXON_WORKER_CSP_V1') {
      this.ready = true;
      this.cspConfirmed = data.cspNetworkProbe === true;
      this.frameReadyResolve?.();
      this.frameReadyResolve = null;
      return;
    }
    if (data.event === 'probe') {
      this.probeResolve?.(data as BrowserWorkerMessage);
      this.probeResolve = null;
      return;
    }
    if (!data.id) return;
    const handle = this.handles.get(data.id);
    if (!handle) return;
    if (data.event === 'message') handle.dispatchMessage(data.data);
    else if (data.event === 'error') handle.dispatchError(typeof data.message === 'string' ? data.message : 'Browser Worker failed.');
    else if (data.event === 'terminated') this.handles.delete(data.id);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
}

const SANDBOX_FRAME_HTML = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; font-src 'none'; style-src 'none'">
<script>
(() => {
  'use strict';
  const workers = new Map();
  const marker = '__axonWorkerFrame';
  const emit = (message) => parent.postMessage({ [marker]: true, ...message }, '*');
  const workerSource = [
    "const nativePost = self.postMessage.bind(self);",
    "const disabled = ['fetch','XMLHttpRequest','WebSocket','EventSource','indexedDB','importScripts','BroadcastChannel','caches','Worker','SharedWorker','WebTransport','RTCPeerConnection'];",
    "for (const key of disabled) { try { Object.defineProperty(self, key, { value: undefined, writable: false, configurable: false }); } catch (_) { try { self[key] = undefined; } catch (_) {} } }",
    "try { Object.defineProperty(self, 'postMessage', { value: undefined, writable: false, configurable: false }); } catch (_) {}",
    "try { Object.defineProperty(self, 'close', { value: undefined, writable: false, configurable: false }); } catch (_) {}",
    "self.onmessage = async (event) => {",
    "  const req = event.data;",
    "  if (!req || typeof req !== 'object') return;",
    "  if (req.type === 'axon-probe') { const caps = {}; for (const key of ['fetch','XMLHttpRequest','WebSocket','EventSource','indexedDB','importScripts','BroadcastChannel','caches','document','localStorage','Worker','SharedWorker','WebTransport','RTCPeerConnection']) caps[key] = typeof self[key]; nativePost({ type: 'probe-result', workerOrigin: self.origin, capabilities: caps }); return; }",
    "  if (req.type !== 'axon-execute' || typeof req.source !== 'string') { nativePost({ type: 'failed', text: 'Invalid worker request.', code: 'INVALID_WORKER_REQUEST' }); return; }",
    "  self.onmessage = null;",
    "  const outputLimit = Number.isSafeInteger(req.outputLimitBytes) && req.outputLimitBytes > 0 ? req.outputLimitBytes : 65536;",
    "  let outputBytes = 0; let outputBlocked = false; let failureReported = false;",
    "  const format = (value) => { try { if (typeof value === 'string') return value.length > outputLimit ? value.slice(0, outputLimit + 1) : value; const json = JSON.stringify(value); if (json === undefined) return String(value); return json.length > outputLimit ? json.slice(0, outputLimit + 1) : json; } catch (_) { const text = String(value); return text.length > outputLimit ? text.slice(0, outputLimit + 1) : text; } };",
    "  const write = (type, args) => { if (outputBlocked) return; if (args.length > 64) { outputBlocked = true; nativePost({ type: 'blocked', text: 'Worker output argument limit exceeded; the worker was terminated.' }); return; } const parts = []; let chars = 0; for (const value of args) { const part = format(value); if (chars + part.length > outputLimit) { outputBlocked = true; nativePost({ type: 'blocked', text: 'Worker output limit exceeded; the worker was terminated.' }); return; } parts.push(part); chars += part.length + 1; } const text = parts.join(' ') + '\\\\n'; if (text.length > outputLimit) { outputBlocked = true; nativePost({ type: 'blocked', text: 'Worker output limit exceeded; the worker was terminated.' }); return; } const bytes = new TextEncoder().encode(text).byteLength; if (outputBytes + bytes > outputLimit) { outputBlocked = true; nativePost({ type: 'blocked', text: 'Worker output limit exceeded; the worker was terminated.' }); return; } outputBytes += bytes; nativePost({ type, text }); };",
    "  const safeConsole = Object.freeze({ log: (...args) => write('stdout', args), info: (...args) => write('stdout', args), warn: (...args) => write('stderr', args), error: (...args) => write('stderr', args) });",
    "  const reportError = (error, code) => { const name = (error && typeof error.name === 'string' ? error.name : 'Error').slice(0, 80); const rawMessage = error && typeof error.message === 'string' ? error.message : String(error); const message = rawMessage.slice(0, 4000); const rawStack = error && typeof error.stack === 'string' ? error.stack : ''; const stack = rawStack.slice(0, 4000); const markerText = String(req.sourceUrl) + ':'; const pos = rawStack.indexOf(markerText); const tail = pos >= 0 ? rawStack.slice(pos + markerText.length, pos + markerText.length + 128) : ''; const first = tail.split(String.fromCharCode(10))[0] || ''; const colon = first.indexOf(':'); const parsedLine = Number.parseInt(colon >= 0 ? first.slice(0, colon) : first, 10); const parsedColumn = colon >= 0 ? Number.parseInt(first.slice(colon + 1), 10) : 0; const line = Number.isSafeInteger(parsedLine) && parsedLine >= 1 ? (parsedLine > 2 ? parsedLine - 2 : parsedLine) : undefined; const column = Number.isSafeInteger(parsedColumn) && parsedColumn > 0 ? parsedColumn : undefined; const normalizedCode = name === 'RangeError' && /maximum call stack/i.test(message) ? 'JAVASCRIPT_STACK_OVERFLOW' : code; nativePost({ type: 'failed', text: name + ': ' + message, name, code: normalizedCode, line, column, stack }); };",
    "  self.onunhandledrejection = (event) => { event.preventDefault(); if (!failureReported && !outputBlocked) { failureReported = true; reportError(event.reason, 'JAVASCRIPT_UNHANDLED_REJECTION'); } };",
    "  let fn; try { const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor; fn = new AsyncFunction('console', req.source + '\\\\n//# sourceURL=' + req.sourceUrl); } catch (error) { reportError(error, 'JAVASCRIPT_SYNTAX_ERROR'); return; }",
    "  try { const result = await fn(safeConsole); await new Promise((resolve) => setTimeout(resolve, 25)); if (failureReported || outputBlocked) return; if (result !== undefined) write('stdout', ['return:', result]); if (!outputBlocked) nativePost({ type: 'completed', exitCode: 0 }); } catch (error) { if (!outputBlocked && !failureReported) reportError(error, 'JAVASCRIPT_RUNTIME_ERROR'); }",
    "};"
  ].join('\\n');

  function createWorker(id) {
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    let worker;
    try { worker = new Worker(url); }
    catch (error) { URL.revokeObjectURL(url); emit({ event: 'error', id, message: String(error && error.message || error) }); return null; }
    URL.revokeObjectURL(url);
    workers.set(id, worker);
    worker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'probe-result') emit({ event: 'probe', id, workerOrigin: event.data.workerOrigin, capabilities: event.data.capabilities });
      else emit({ event: 'message', id, data: event.data });
    });
    worker.addEventListener('error', (event) => emit({ event: 'error', id, message: event.message || 'Worker error.' }));
    emit({ event: 'ready', id });
    return worker;
  }

  addEventListener('message', (event) => {
    if (event.source !== parent || !event.data || event.data.__axonWorkerCommand !== true) return;
    const { command, id, message } = event.data;
    if (typeof id !== 'string') return;
    if (command === 'probe') {
      const worker = createWorker(id);
      worker?.postMessage({ type: 'axon-probe' });
    } else if (command === 'create') createWorker(id);
    else if (command === 'post') workers.get(id)?.postMessage(message);
    else if (command === 'terminate') {
      const worker = workers.get(id);
      if (worker) { worker.terminate(); workers.delete(id); }
      emit({ event: 'terminated', id });
    }
  });
  const verifyConnectSrcPolicy = () => new Promise((resolve) => {
    let finished = false;
    const timer = setTimeout(() => finish(false), 700);
    const finish = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      document.removeEventListener('securitypolicyviolation', onViolation);
      resolve(value);
    };
    const onViolation = (event) => {
      if (event.effectiveDirective === 'connect-src' && String(event.blockedURI).includes('axon-csp-probe.invalid')) finish(true);
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    try { fetch('https://axon-csp-probe.invalid/blocked-by-csp').catch(() => {}); } catch (_) { finish(false); }
  });
  verifyConnectSrcPolicy().then((cspNetworkProbe) => emit({ event: 'frame-ready', frameOrigin: location.origin, cspMarker: 'AXON_WORKER_CSP_V1', cspNetworkProbe }));
})();
</script>`;
