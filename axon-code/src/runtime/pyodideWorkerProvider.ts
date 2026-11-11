import type { ExecutionRequest, ExecutionResult, RuntimeAdapter, RuntimeDescriptor } from '../types.js';

export interface OfflinePyodideFile { path: string; sha256: string; sizeBytes: number; }
export interface OfflinePyodidePack {
  id: string;
  version: string;
  baseUrl: string;
  files: readonly OfflinePyodideFile[];
  /** Returns bytes from the installed, removable offline pack; must not fetch from the network. */
  readFile(path: string): Promise<Uint8Array | null>;
}
export interface PythonSourceProvider { readPythonEntry(request: ExecutionRequest): Promise<{ path: string; source: string } | null>; }
export interface OfflineRuntimePackStore { get(id: string): Promise<OfflinePyodidePack | null>; put(pack: OfflinePyodidePack): Promise<void>; remove(id: string): Promise<boolean>; }

/** Installs only complete, verified packs; removal is explicit and does not touch project files. */
export async function installOfflinePyodidePack(store: OfflineRuntimePackStore, pack: OfflinePyodidePack): Promise<{ installed: boolean; verifiedFiles: number; reason?: string }> {
  const verified = await verifyOfflinePyodidePack(pack);
  if (!verified.valid) return { installed: false, verifiedFiles: verified.verifiedFiles, reason: verified.reason ?? 'Pack verification failed.' };
  await store.put(pack);
  return { installed: true, verifiedFiles: verified.verifiedFiles };
}
export async function removeOfflinePyodidePack(store: OfflineRuntimePackStore, id: string): Promise<boolean> {
  if (!id.trim()) throw new Error('Offline runtime pack ID is required.');
  return store.remove(id);
}
export interface PyodideWorkerLike { postMessage(message: unknown): void; terminate(): void; addEventListener(type: 'message' | 'error', listener: (event: any) => void, options?: unknown): void; removeEventListener?(type: 'message' | 'error', listener: (event: any) => void): void; }
export interface PyodideWorkerFactory { create(source: string): PyodideWorkerLike; }

const REQUIRED_FILES = ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_PACK_FILE_BYTES = 64 * 1024 * 1024;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyOfflinePyodidePack(pack: OfflinePyodidePack): Promise<{ valid: boolean; reason?: string; verifiedFiles: number }> {
  if (!pack || !pack.id?.trim() || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(pack.version) || !(/^(file:|capacitor:)\/\//.test(pack.baseUrl))) {
    return { valid: false, reason: 'Offline Pyodide pack metadata is invalid.', verifiedFiles: 0 };
  }
  const entries = new Map(pack.files.map((file) => [file.path, file]));
  for (const required of REQUIRED_FILES) if (!entries.has(required)) return { valid: false, reason: `Offline pack is missing required Pyodide asset '${required}'.`, verifiedFiles: 0 };
  let verifiedFiles = 0;
  for (const [path, entry] of entries) {
    if (path.startsWith('/') || path.includes('..') || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 1 || entry.sizeBytes > MAX_PACK_FILE_BYTES || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      return { valid: false, reason: `Offline pack entry '${path}' has unsafe path, size or hash metadata.`, verifiedFiles };
    }
    const bytes = await pack.readFile(path);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== entry.sizeBytes || (await sha256(bytes)).toLowerCase() !== entry.sha256.toLowerCase()) {
      return { valid: false, reason: `Offline Pyodide asset '${path}' is missing or failed SHA-256 verification.`, verifiedFiles };
    }
    verifiedFiles++;
  }
  return { valid: true, verifiedFiles };
}

export function createPyodideWorkerSource(baseUrl: string): string {
  const safeBase = new URL(baseUrl).toString().replace(/\/$/, '') + '/';
  return [
    `importScripts(${JSON.stringify(`${safeBase}pyodide.js`)});`,
    'let pyodideInstance = null;',
    'self.onmessage = async (event) => {',
    '  const request = event.data;',
    '  if (!request || request.type !== "run" || typeof request.source !== "string") return;',
    '  const started = Date.now(); let outputBytes = 0; const maxOutputBytes = request.maxOutputBytes;',
    '  const emit = (stream, value) => { const text = String(value); const bytes = new TextEncoder().encode(text).byteLength; if (outputBytes + bytes > maxOutputBytes) { self.postMessage({type:"failed", error:"Python output limit exceeded."}); return false; } outputBytes += bytes; self.postMessage({type:"output", stream, text}); return true; };',
    '  try {',
    '    if (!pyodideInstance) pyodideInstance = await loadPyodide({ indexURL: request.baseUrl });',
    '    pyodideInstance.setStdout({ batched: (text) => emit("stdout", text + "\\n") });',
    '    pyodideInstance.setStderr({ batched: (text) => emit("stderr", text + "\\n") });',
    '    await pyodideInstance.runPythonAsync(request.source);',
    '    self.postMessage({type:"completed", exitCode:0, elapsedMs:Date.now()-started});',
    '  } catch (error) { self.postMessage({type:"failed", error:String(error), elapsedMs:Date.now()-started}); }',
    '};'
  ].join('\n');
}

/** Real CPython compiled to WebAssembly by Pyodide. Requires an installed, hash-verified offline pack. */
export class PyodideWorkerExecutionAdapter implements RuntimeAdapter {
  readonly descriptor: RuntimeDescriptor = { id: 'pyodide-cpython-wasm-worker', label: 'Pyodide CPython (WebAssembly Worker)', languages: ['python'], platforms: ['browser'], available: false, supportsStreaming: true, supportsCheckpoint: false, isolation: 'worker', notes: ['Requires an installed optional offline Pyodide pack; Worker isolation is Grade 1, not an OS sandbox.'] };
  constructor(private readonly source: PythonSourceProvider, private readonly workers: PyodideWorkerFactory, private readonly pack: OfflinePyodidePack | null) {}
  canHandle(request: ExecutionRequest): boolean { return !!this.pack && request.runtimeId === this.descriptor.id && request.entryFiles.length === 1 && /\.py$/i.test(request.entryFiles[0] ?? '') && request.mode === 'FULL_LOCAL' && request.networkAllowed === false && request.fileAccess === 'project-read-only' && request.timeoutMs > 0 && request.timeoutMs <= 30_000 && request.outputLimitBytes > 0 && request.outputLimitBytes <= 64 * 1024; }
  async initialize(): Promise<{ available: boolean; verifiedFiles: number; reason?: string }> {
    if (!this.pack) { this.descriptor.available = false; this.descriptor.notes = [...(this.descriptor.notes ?? []), 'No offline Pyodide pack is installed; execution is BLOCKED rather than emulated.']; return { available: false, verifiedFiles: 0, reason: 'OFFLINE_PACK_NOT_INSTALLED' }; }
    const verified = await verifyOfflinePyodidePack(this.pack);
    this.descriptor.available = verified.valid;
    if (!verified.valid) this.descriptor.notes = [...(this.descriptor.notes ?? []), verified.reason ?? 'Offline pack verification failed.'];
    return { available: verified.valid, verifiedFiles: verified.verifiedFiles, ...(verified.reason ? { reason: verified.reason } : {}) };
  }
  async execute(request: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    const started = Date.now();
    const blocked = (note: string): ExecutionResult => ({ requestId: request.requestId, status: 'blocked', stdout: '', stderr: '', diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'CHECKED', notes: [note] });
    if (!this.pack || !this.canHandle(request) || !this.descriptor.available) return blocked('Real Pyodide execution is unavailable: a verified offline pack and an eligible request are required. No Python interpreter imitation is used.');
    const entry = await this.source.readPythonEntry(request);
    if (!entry || entry.path !== request.entryFiles[0]) return blocked('Python entry file is missing or does not match the requested project path.');
    if (new TextEncoder().encode(entry.source).byteLength > MAX_SOURCE_BYTES) return blocked('Python source exceeds the 512 KiB execution limit.');
    const worker = this.workers.create(createPyodideWorkerSource(this.pack.baseUrl));
    return await new Promise<ExecutionResult>((resolve) => {
      let settled = false; let stdout = ''; let stderr = ''; let outputBytes = 0; let timer: ReturnType<typeof setTimeout>;
      const finish = (status: ExecutionResult['status'], notes: string[], exitCode?: number) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort); worker.terminate(); resolve({ requestId: request.requestId, status, ...(exitCode !== undefined ? { exitCode } : {}), stdout, stderr, diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'ADAPTER_REPORTED', notes: [...notes, 'Execution used real Pyodide CPython WebAssembly in a Worker (Grade 1). This is not an OS sandbox; network and filesystem access are not granted by this adapter.'] }); };
      const onAbort = () => finish('cancelled', ['Python execution was cancelled and its Worker was terminated.']);
      timer = setTimeout(() => finish('timed-out', ['Python execution exceeded its wall-clock limit; Worker terminated.']), request.timeoutMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', (event) => { const message = event.data; if (!message || typeof message.type !== 'string') return; if (message.type === 'output' && typeof message.text === 'string') { outputBytes += new TextEncoder().encode(message.text).byteLength; if (outputBytes > request.outputLimitBytes) { finish('failed', ['Python output exceeded the host-enforced byte limit; Worker terminated.'], 1); return; } if (message.stream === 'stderr') stderr += message.text; else stdout += message.text; } else if (message.type === 'completed') finish('completed', ['Pyodide execution completed.'], 0); else if (message.type === 'failed') { stderr += typeof message.error === 'string' ? message.error : 'Pyodide execution failed.'; finish('failed', ['Pyodide reported a Python runtime error.'], 1); } });
      worker.addEventListener('error', (event) => finish('failed', [`Pyodide Worker failed: ${String(event?.message ?? 'unknown Worker error')}`], 1));
      worker.postMessage({ type: 'run', source: entry.source, baseUrl: this.pack!.baseUrl, maxOutputBytes: request.outputLimitBytes });
    });
  }
}
