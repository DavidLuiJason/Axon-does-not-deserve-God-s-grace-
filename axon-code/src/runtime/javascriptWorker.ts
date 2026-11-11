import type { CodeDiagnostic, ExecutionRequest, ExecutionResult, RuntimeAdapter, RuntimeDescriptor } from '../types.js';
import { normalizeProjectPath } from '../pathSafety.js';
import { mapGeneratedPosition, type RawSourceMap } from './sourceMaps.js';

export interface WorkerSandboxAttestation {
  providerId: string;
  isolatedOrigin: boolean;
  networkBlockedByHostPolicy: boolean;
  filesystemBridgeAbsent: boolean;
  restrictiveCspConfirmed: boolean;
  noPrivilegedHostBridge: boolean;
}

export interface WorkerMessageEventLike { data: unknown; }
export interface WorkerErrorEventLike { message?: string; }
export interface WorkerHandle {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(type: 'message', listener: (event: WorkerMessageEventLike) => void): void;
  addEventListener(type: 'error', listener: (event: WorkerErrorEventLike) => void): void;
  removeEventListener?(type: 'message' | 'error', listener: ((event: WorkerMessageEventLike) => void) | ((event: WorkerErrorEventLike) => void)): void;
}

export interface SecureWorkerProvider {
  attest(): WorkerSandboxAttestation;
  createWorker(): WorkerHandle;
}

export interface JavaScriptEntrySourceProvider {
  readSingleEntry(request: ExecutionRequest): Promise<{ path: string; source: string } | null>;
  /** Extra file types are accepted only when the provider truly transpiles/bundles them to JavaScript. */
  supportedExtensions?: readonly string[];
  /** Set when transformations may shift source positions and the provider cannot map generated positions back. */
  requiresSourceMap?: boolean;
  sourceMap?: RawSourceMap;
}

export interface JavaScriptWorkerPolicy {
  maxTimeoutMs: number;
  maxOutputBytes: number;
  maxSourceBytes: number;
}

interface WorkerOutputMessage {
  type: 'stdout' | 'stderr' | 'completed' | 'failed' | 'blocked';
  text?: string;
  result?: string;
  exitCode?: number;
  name?: string;
  code?: string;
  line?: number;
  column?: number;
  stack?: string;
}

function isRunnableJavaScriptEntry(path: string, extraExtensions: readonly string[] = []): boolean {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return ['.mjs', '.cjs', '.js'].includes(extension) || extraExtensions.some((item) => item.toLowerCase() === extension);
}

function isAttested(attestation: WorkerSandboxAttestation): boolean {
  return Boolean(attestation.providerId.trim()) && attestation.isolatedOrigin === true &&
    attestation.networkBlockedByHostPolicy === true && attestation.filesystemBridgeAbsent === true &&
    attestation.restrictiveCspConfirmed === true && attestation.noPrivilegedHostBridge === true;
}

/** AC2 adapter shell. It will not create a worker unless the host provider attests the required isolation. */
export class JavaScriptWorkerExecutionAdapter implements RuntimeAdapter {
  readonly descriptor: RuntimeDescriptor;
  private readonly policy: JavaScriptWorkerPolicy;

  constructor(
    private readonly sourceProvider: JavaScriptEntrySourceProvider,
    private readonly workerProvider: SecureWorkerProvider,
    policy: Partial<JavaScriptWorkerPolicy> = {}
  ) {
    this.descriptor = {
      id: 'javascript-worker-ac2', label: 'Isolated JavaScript Worker', languages: ['javascript'],
      platforms: ['browser'], available: isAttested(this.workerProvider.attest()),
      supportsStreaming: false, supportsCheckpoint: false, isolation: 'worker',
      notes: ['Single-entry JavaScript only. Requires an attested isolated-origin worker provider. Browser provider requires per-host conformance; Android/desktop WebViews are not advertised until tested.']
    };
    this.policy = { maxTimeoutMs: 5_000, maxOutputBytes: 256 * 1024, maxSourceBytes: 1024 * 1024, ...policy };
    if (!Number.isInteger(this.policy.maxTimeoutMs) || this.policy.maxTimeoutMs < 1 || !Number.isInteger(this.policy.maxOutputBytes) || this.policy.maxOutputBytes < 1 || !Number.isInteger(this.policy.maxSourceBytes) || this.policy.maxSourceBytes < 1) {
      throw new Error('Invalid JavaScript worker policy.');
    }
  }

  canHandle(request: ExecutionRequest): boolean {
    try {
      const attestation = this.workerProvider.attest();
      return request.runtimeId === this.descriptor.id && request.mode === 'FULL_LOCAL' && request.entryFiles.length === 1 && normalizeProjectPath(request.entryFiles[0] ?? '') === request.entryFiles[0] && isRunnableJavaScriptEntry(request.entryFiles[0] ?? '', this.sourceProvider.supportedExtensions) &&
        request.networkAllowed === false && request.fileAccess === 'none' && isAttested(attestation);
    } catch { return false; }
  }

  async execute(request: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    const started = Date.now();
    const base = (status: ExecutionResult['status'], notes: string[], stdout = '', stderr = '', exitCode?: number, diagnostics: CodeDiagnostic[] = []): ExecutionResult => ({
      requestId: request.requestId, status, ...(exitCode !== undefined ? { exitCode } : {}), stdout, stderr,
      diagnostics, elapsedMs: Date.now() - started, artifacts: [], evidence: 'ADAPTER_REPORTED', notes
    });

    if (!this.canHandle(request)) return base('blocked', ['Request or host worker provider does not satisfy the isolated JavaScript execution policy.']);
    if (signal?.aborted) return base('cancelled', ['Execution was cancelled before worker startup.']);
    if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1 || !Number.isSafeInteger(request.outputLimitBytes) || request.outputLimitBytes < 1) {
      return base('blocked', ['Timeout and output limits must be positive integers.']);
    }
    let entry: { path: string; source: string; sourceMap?: RawSourceMap } | null;
    try { entry = await this.sourceProvider.readSingleEntry(request); }
    catch (error) { return base('failed', [`Could not read JavaScript entry: ${String(error)}`]); }
    if (signal?.aborted) return base('cancelled', ['Execution was cancelled while reading the entry.']);
    if (!entry || entry.path !== request.entryFiles[0] || normalizeProjectPath(entry.path) !== entry.path || typeof entry.source !== 'string') {
      return base('blocked', ['A matching canonical single JavaScript entry file could not be read.']);
    }
    if (new TextEncoder().encode(entry.source).byteLength > this.policy.maxSourceBytes) return base('blocked', [`JavaScript entry exceeds the ${this.policy.maxSourceBytes}-byte source limit.`]);

    // Parse already-transpiled JavaScript before execution. Prefer the TypeScript
    // compiler parser when the host has it. Browser Worker hosts may not resolve
    // a bare "typescript" import from an opaque-origin/blob context; in that case
    // use the host engine's real AsyncFunction parser. This is a parser, not the
    // former delimiter/token heuristic. Transpiling TS/JSX remains the source
    // provider's responsibility when it advertises those extensions.
    let syntaxFindings: CodeDiagnostic[] = [];
    try {
      const ts = await import('typescript');
      const extension = entry.path.toLowerCase();
      const kind = extension.endsWith('.tsx') ? ts.ScriptKind.TSX : extension.endsWith('.jsx') ? ts.ScriptKind.JSX :
        extension.endsWith('.ts') || extension.endsWith('.mts') || extension.endsWith('.cts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
      const parsed = ts.createSourceFile(entry.path, entry.source, ts.ScriptTarget.Latest, true, kind);
      const parseDiagnostics = (parsed as import('typescript').SourceFile & { parseDiagnostics: readonly import('typescript').Diagnostic[] }).parseDiagnostics;
      syntaxFindings = parseDiagnostics.map((item) => {
        const position = parsed.getLineAndCharacterOfPosition(item.start ?? 0);
        return { id: `${entry.path}:TS${item.code}:${position.line + 1}:${position.character + 1}`, code: `TS${item.code}`, severity: 'error', stage: 'syntax',
          message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), location: { file: entry.path, line: position.line + 1, column: position.character + 1 },
          evidence: 'CHECKED', confidence: 'high', explanation: 'Syntax diagnostic from the TypeScript compiler parser.' };
      });
    } catch {
      // The provider contract guarantees that TS/JSX inputs accepted here have
      // already been transpiled. AsyncFunction construction parses ECMAScript
      // without executing it and supports the top-level-await bundle wrapper.
      try {
        const AsyncFunction = Object.getPrototypeOf(async function () { /* parser only */ }).constructor as new (...args: string[]) => Function;
        new AsyncFunction('console', entry.source);
      } catch (error) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        syntaxFindings = [{ id: `${entry.path}:JAVASCRIPT_SYNTAX_ERROR`, code: 'JAVASCRIPT_SYNTAX_ERROR', severity: 'error', stage: 'syntax',
          message, location: { file: entry.path }, evidence: 'CHECKED', confidence: 'high',
          explanation: 'The host ECMAScript parser rejected the transpiled JavaScript. A verified line/column was not exposed by this host parser.' }];
      }
    }
    if (syntaxFindings.length) return base('failed', ['Compiler parser found syntax errors; execution was not started.'], '', '', 1, syntaxFindings);

    let worker: WorkerHandle;
    const providerId = this.workerProvider.attest().providerId;
    try { worker = this.workerProvider.createWorker(); }
    catch (error) { return base('failed', [`Worker creation failed: ${String(error)}`]); }

    return new Promise<ExecutionResult>((resolve) => {
      let settled = false;
      let outputBytes = 0;
      let stdout = '';
      let stderr = '';
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (status: ExecutionResult['status'], notes: string[], exitCode?: number, diagnostics: CodeDiagnostic[] = []): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        worker.terminate();
        resolve(base(status, notes, stdout, stderr, exitCode, diagnostics));
      };
      const onAbort = (): void => finish('cancelled', ['Worker terminated after cancellation.']);
      const onMessage = (event: WorkerMessageEventLike): void => {
        const message = event.data as Partial<WorkerOutputMessage> | null;
        if (!message || typeof message !== 'object' || !['stdout', 'stderr', 'completed', 'failed', 'blocked'].includes(String(message.type))) {
          finish('failed', ['Worker emitted an invalid protocol message.']); return;
        }
        if (message.type === 'stdout' || message.type === 'stderr') {
          const text = typeof message.text === 'string' ? message.text : '';
          outputBytes += new TextEncoder().encode(text).byteLength;
          if (outputBytes > Math.min(this.policy.maxOutputBytes, request.outputLimitBytes)) {
            finish('blocked', ['Worker output limit exceeded; execution was terminated.']); return;
          }
          if (message.type === 'stdout') stdout += text;
          else stderr += text;
        } else if (message.type === 'blocked') {
          finish('blocked', [typeof message.text === 'string' ? message.text : 'Worker execution was blocked by an enforced limit.']);
        } else if (message.type === 'completed') {
          finish('completed', [`Executed single entry '${entry.path}' through provider '${providerId}'.`], Number.isInteger(message.exitCode) ? message.exitCode : 0);
        } else {
          const text = typeof message.text === 'string' ? message.text : 'JavaScript worker reported an execution failure.';
          const code = typeof message.code === 'string' && /^[A-Z0-9_]+$/.test(message.code) ? message.code : 'JAVASCRIPT_EXECUTION_ERROR';
          const generatedLine = Number.isSafeInteger(message.line) && Number(message.line) >= 1 ? Number(message.line) : undefined;
          const generatedColumn = Number.isSafeInteger(message.column) && Number(message.column) >= 1 ? Number(message.column) : undefined;
          // A transformed multi-file/TypeScript bundle can shift line positions. Until the
          // provider supplies an explicit source-map mapper, never label generated offsets
          // as original source locations. Keep the file identity but lower confidence.
          const mappedPosition = entry.sourceMap && generatedLine !== undefined && generatedColumn !== undefined
            ? mapGeneratedPosition(entry.sourceMap, generatedLine, generatedColumn) : null;
          const directPositionIsValid = this.sourceProvider.requiresSourceMap !== true;
          const locationFile = mappedPosition?.source ?? entry.path;
          const line = mappedPosition?.line ?? (directPositionIsValid ? generatedLine : undefined);
          const column = mappedPosition?.column ?? (directPositionIsValid ? generatedColumn : undefined);
          const sourcePositionIsMapped = mappedPosition !== null || directPositionIsValid;
          const explanationParts: string[] = [];
          if (typeof message.stack === 'string') explanationParts.push(message.stack.slice(0, 3_600));
          if (!sourcePositionIsMapped) explanationParts.push('Generated bundle position was withheld: no verified source-map segment covers the reported generated position.');
          const diagnostic: CodeDiagnostic = {
            id: `${locationFile}:${code}:${line ?? 0}:${column ?? 0}`, code, severity: 'error',
            stage: code === 'JAVASCRIPT_SYNTAX_ERROR' ? 'syntax' : 'runtime', message: text,
            location: { file: locationFile, ...(line !== undefined ? { line } : {}), ...(column !== undefined ? { column } : {}) },
            evidence: 'ADAPTER_REPORTED', confidence: mappedPosition !== null ? 'high' : line !== undefined && message.name !== 'RangeError' ? 'medium' : 'low',
            ...(explanationParts.length ? { explanation: explanationParts.join('\n\n').slice(0, 4_000) } : {})
          };
          finish('failed', [text, ...(!sourcePositionIsMapped ? ['Original source line and column were not reported because the verified source map did not cover the generated position.'] : [])], 1, [diagnostic]);
        }
      };
      const onError = (event: WorkerErrorEventLike): void => finish('failed', [event.message || 'JavaScript worker crashed.'], 1);
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => finish('timed-out', [`Worker exceeded ${Math.min(request.timeoutMs, this.policy.maxTimeoutMs)} ms and was terminated.`]), Math.min(request.timeoutMs, this.policy.maxTimeoutMs));
      try {
        worker.postMessage({ type: 'axon-execute', requestId: request.requestId, source: entry.source, path: entry.path,
          timeoutMs: Math.min(request.timeoutMs, this.policy.maxTimeoutMs), outputLimitBytes: Math.min(this.policy.maxOutputBytes, request.outputLimitBytes), sourceUrl: 'axon-user-entry.js' });
      } catch (error) { finish('failed', [`Could not send the execution request to the worker: ${String(error)}`], 1); }
    });
  }
}
