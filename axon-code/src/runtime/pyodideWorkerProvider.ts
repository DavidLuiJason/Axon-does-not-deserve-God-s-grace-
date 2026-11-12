import type { ExecutionRequest, ExecutionResult, RuntimeAdapter, RuntimeDescriptor } from '../types.js';
import { isPortableProjectPath } from '../pathSafety.js';

export interface OfflinePyodideFile { path: string; sha256: string; sizeBytes: number; }
export interface OfflinePyodidePack {
  id: string;
  version: string;
  baseUrl: string;
  files: readonly OfflinePyodideFile[];
  /** Returns bytes from the installed, removable offline pack; must not fetch from the network. */
  readFile(path: string): Promise<Uint8Array | null>;
}
export interface PythonProjectFile { path: string; content: string; }
export interface PythonSourceProvider {
  readPythonEntry(request: ExecutionRequest): Promise<{ path: string; source: string } | null>;
  readProjectFiles?(request: ExecutionRequest): Promise<readonly PythonProjectFile[]>;
  /** Commits only validated files returned from the isolated /project virtual directory. */
  writeProjectFiles?(request: ExecutionRequest, files: readonly PythonProjectFile[]): Promise<void>;
}
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
export interface PyodideWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void | Promise<unknown>;
  addEventListener(type: 'message' | 'error', listener: (event: any) => void, options?: unknown): void;
  removeEventListener?(type: 'message' | 'error', listener: (event: any) => void): void;
}
/** Injectable worker boundary; production uses a browser Worker and Node verification uses worker_threads. */
export interface PyodideWorkerFactory { create(source: string): PyodideWorkerLike; }

const REQUIRED_FILES = ['pyodide.js', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_PACK_FILE_BYTES = 64 * 1024 * 1024;
const MAX_PROJECT_FILES = 256;
const MAX_PROJECT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_TOTAL_BYTES = 4 * 1024 * 1024;
const PYTHON_AUDIT_GUARD = [
  'import os, sys',
  'def _axon_audit(event, args):',
  "    if event in ('socket.connect', 'socket.getaddrinfo'):",
  "        raise PermissionError('Network access is disabled for this execution.')",
  "    if event == 'open':",
  '        path = args[0] if len(args) > 0 else None',
  "        mode = args[1] if len(args) > 1 else 'r'",
  '        flags = args[2] if len(args) > 2 and isinstance(args[2], int) else 0',
  "        writing = (isinstance(mode, str) and any(flag in mode for flag in 'wax+')) or bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND))",
  '        if writing:',
  '            resolved = os.path.abspath(path) if isinstance(path, str) else ',
  "            if not (resolved == '/project' or resolved.startswith('/project/')):",
  "                raise PermissionError('Writes are restricted to the /project virtual directory.')",
  'sys.addaudithook(_axon_audit)'
].join('\n');

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

/** Browser Worker source. Node tests use the separate worker_threads runner with the same message protocol. */
export function createPyodideWorkerSource(baseUrl: string): string {
  const safeBase = new URL(baseUrl).toString().replace(/\/$/, '') + '/';
  return [
    `importScripts(${JSON.stringify(`${safeBase}pyodide.js`)});`,
    'let pyodideInstance = null;',
    'self.onmessage = async (event) => {',
    '  const request = event.data;',
    '  if (!request || request.type !== "run" || typeof request.source !== "string") return;',
    '  const started = Date.now(); let outputBytes = 0; let outputFailed = false; const maxOutputBytes = request.maxOutputBytes;',
    '  const emit = (stream, value) => { if (outputFailed) return false; const text = String(value); const bytes = new TextEncoder().encode(text).byteLength; if (outputBytes + bytes > maxOutputBytes) { outputFailed = true; self.postMessage({type:"failed", error:"Python output limit exceeded."}); return false; } outputBytes += bytes; self.postMessage({type:"output", stream, text}); return true; };',
    '  try {',
    `    if (!pyodideInstance) pyodideInstance = await loadPyodide({ indexURL: request.baseUrl, jsglobals: Object.create(null) });`,
    '    pyodideInstance.FS.mkdirTree("/project");',
    '    for (const file of (request.files || [])) { const target = "/project/" + file.path; const slash = target.lastIndexOf("/"); if (slash > 8) pyodideInstance.FS.mkdirTree(target.slice(0, slash)); pyodideInstance.FS.writeFile(target, file.content); }',
    '    pyodideInstance.FS.chdir("/project");',
    `    pyodideInstance.runPython(${JSON.stringify(PYTHON_AUDIT_GUARD)});`,
    '    const stdinLines = String(request.stdin || "").split("\\n"); let stdinIndex = 0;',
    '    pyodideInstance.setStdin({ stdin: () => stdinIndex < stdinLines.length ? stdinLines[stdinIndex++] : null });',
    '    pyodideInstance.setStdout({ batched: (text) => emit("stdout", text) });',
    '    pyodideInstance.setStderr({ batched: (text) => emit("stderr", text) });',
    '    const value = await pyodideInstance.runPythonAsync(request.source);',
    '    const files = []; const walk = (directory) => { for (const name of pyodideInstance.FS.readdir(directory)) { if (name === "." || name === "..") continue; const target = directory === "/" ? "/" + name : directory + "/" + name; const stat = pyodideInstance.FS.stat(target); if (pyodideInstance.FS.isDir(stat.mode)) walk(target); else if (pyodideInstance.FS.isFile(stat.mode) && target.startsWith("/project/")) files.push({path:target.slice(9), content:new TextDecoder().decode(pyodideInstance.FS.readFile(target))}); } }; walk("/project");',
    '    if (!outputFailed) self.postMessage({type:"completed", exitCode:0, value:value == null ? "" : String(value), files, elapsedMs:Date.now()-started});',
    '  } catch (error) { self.postMessage({type:"failed", error:String(error), traceback:String(error), elapsedMs:Date.now()-started}); }',
    '};'
  ].join('\n');
}

/** Real CPython compiled to WebAssembly by Pyodide. Requires an installed, hash-verified offline pack. */
export class PyodideWorkerExecutionAdapter implements RuntimeAdapter {
  readonly descriptor: RuntimeDescriptor = { id: 'pyodide-cpython-wasm-worker', label: 'Pyodide CPython (WebAssembly Worker)', languages: ['python'], platforms: ['browser'], available: false, supportsStreaming: true, supportsCheckpoint: false, isolation: 'worker', notes: ['Requires an installed optional offline Pyodide pack; Worker isolation is Grade 1, not an OS sandbox.'] };
  constructor(private readonly source: PythonSourceProvider, private readonly workers: PyodideWorkerFactory, private readonly pack: OfflinePyodidePack | null) {}
  canHandle(request: ExecutionRequest): boolean { return !!this.pack && request.runtimeId === this.descriptor.id && request.entryFiles.length === 1 && /\.py$/i.test(request.entryFiles[0] ?? '') && request.mode === 'FULL_LOCAL' && request.networkAllowed === false && (request.fileAccess === 'project-read-only' || request.fileAccess === 'working-copy') && request.timeoutMs > 0 && request.timeoutMs <= 30_000 && request.outputLimitBytes > 0 && request.outputLimitBytes <= 64 * 1024; }
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
    if (request.fileAccess === 'working-copy' && !this.source.writeProjectFiles) return blocked('Python working-copy access requires a project-scoped write provider.');
    let projectFiles: readonly PythonProjectFile[] = [];
    try { projectFiles = await this.source.readProjectFiles?.(request) ?? []; } catch { return blocked('Python project files could not be read from the scoped workspace provider.'); }
    if (projectFiles.length > MAX_PROJECT_FILES) return blocked('Python project file count exceeds the 256-file limit.');
    let projectBytes = 0;
    const projectPaths = new Set<string>();
    for (const file of projectFiles) {
      if (!file || !isPortableProjectPath(file.path) || typeof file.content !== 'string' || projectPaths.has(file.path.toLowerCase())) return blocked('Python project file has an unsafe path, duplicate path or invalid text content.');
      projectPaths.add(file.path.toLowerCase());
      const size = new TextEncoder().encode(file.content).byteLength;
      if (size > MAX_PROJECT_FILE_BYTES || (projectBytes += size) > MAX_PROJECT_TOTAL_BYTES) return blocked('Python project files exceed the 4 MiB workspace transfer limit.');
    }
    const worker = this.workers.create(createPyodideWorkerSource(this.pack.baseUrl));
    return await new Promise<ExecutionResult>((resolve) => {
      let settled = false; let stdout = ''; let stderr = ''; let outputBytes = 0; let timer: ReturnType<typeof setTimeout>;
      const finish = async (status: ExecutionResult['status'], notes: string[], exitCode?: number, value?: string) => {
        if (settled) return;
        settled = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
        try { await worker.terminate(); } catch { /* Worker may already have exited. */ }
        resolve({ requestId: request.requestId, status, ...(exitCode !== undefined ? { exitCode } : {}), ...(value !== undefined ? { value } : {}), stdout, stderr, diagnostics: [], elapsedMs: Date.now() - started, artifacts: [], evidence: 'ADAPTER_REPORTED', notes: [...notes, 'Execution used real Pyodide CPython WebAssembly in a Worker (Grade 1), not an OS sandbox. The Node worker_threads proof used an empty JS global bridge, a memory-only Pyodide filesystem and Python audit guards for network and out-of-project writes; browser-host parity remains NOT RUN.'] });
      };
      const onAbort = () => { void finish('cancelled', ['Python execution was cancelled and its Worker was terminated.']); };
      timer = setTimeout(() => { void finish('timed-out', ['Python execution exceeded its wall-clock limit; Worker terminated.']); }, request.timeoutMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', (event) => {
        const message = event.data; if (!message || typeof message.type !== 'string') return;
        if (message.type === 'output' && typeof message.text === 'string') {
          outputBytes += new TextEncoder().encode(message.text).byteLength;
          if (outputBytes > request.outputLimitBytes) { void finish('failed', ['Python output exceeded the host-enforced byte limit; Worker terminated.'], 1); return; }
          if (message.stream === 'stderr') stderr += message.text; else stdout += message.text;
        } else if (message.type === 'completed') {
          void (async () => {
            try {
              const files = Array.isArray(message.files) ? message.files : [];
              if (files.length > MAX_PROJECT_FILES) throw new Error('Pyodide returned too many project files.');
              let returnedBytes = 0; const returnedPaths = new Set<string>();
              for (const file of files) {
                if (!file || !isPortableProjectPath(file.path) || typeof file.content !== 'string' || returnedPaths.has(file.path.toLowerCase())) throw new Error('Pyodide returned an unsafe or duplicate virtual project file.');
                returnedPaths.add(file.path.toLowerCase());
                const size = new TextEncoder().encode(file.content).byteLength;
                if (size > MAX_PROJECT_FILE_BYTES || (returnedBytes += size) > MAX_PROJECT_TOTAL_BYTES) throw new Error('Pyodide returned oversized virtual project files.');
              }
              if (request.fileAccess === 'working-copy' && this.source.writeProjectFiles) await this.source.writeProjectFiles(request, files);
              void finish('completed', ['Pyodide execution completed.'], 0, typeof message.value === 'string' ? message.value : '');
            } catch (error) { void finish('failed', [`Python project write-back failed: ${String(error)}`], 1); }
          })();
        } else if (message.type === 'failed') {
          stderr += typeof message.error === 'string' ? message.error : 'Pyodide execution failed.';
          if (typeof message.traceback === 'string' && message.traceback !== message.error) stderr += `\n${message.traceback}`;
          void finish('failed', ['Pyodide reported a Python runtime error.'], 1);
        }
      });
      worker.addEventListener('error', (event) => { void finish('failed', [`Pyodide Worker failed: ${String(event?.message ?? 'unknown Worker error')}`], 1); });
      worker.postMessage({ type: 'run', source: entry.source, baseUrl: this.pack!.baseUrl, maxOutputBytes: request.outputLimitBytes, stdin: request.stdin ?? '', files: projectFiles });
    });
  }
}
