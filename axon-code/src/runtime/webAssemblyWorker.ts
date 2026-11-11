import type { ExecutionRequest, ExecutionResult, RuntimeAdapter, RuntimeDescriptor } from '../types.js';
import type { SecureWorkerProvider } from './javascriptWorker.js';
import { JavaScriptWorkerExecutionAdapter, type JavaScriptEntrySourceProvider } from './javascriptWorker.js';

export interface BinaryProjectSourceProvider {
  readBinaryEntry(request: ExecutionRequest): Promise<{ path: string; bytes: Uint8Array } | null>;
}

export interface WasmValidationResult {
  valid: boolean;
  imports: number;
  memoryPages: number;
  reason?: string;
}

function readU32Leb(bytes: Uint8Array, state: { offset: number }): number {
  let value = 0;
  let shift = 0;
  for (let count = 0; count < 5; count++) {
    if (state.offset >= bytes.length) throw new Error('Truncated WebAssembly LEB128 value.');
    const byte = bytes[state.offset++]!;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return value >>> 0;
    shift += 7;
  }
  throw new Error('WebAssembly LEB128 value is too long.');
}

/** Deliberately accepts a narrow, import-free MVP subset; it is not a WASI runtime. */
export function validatePureWasmModule(bytes: Uint8Array, maxMemoryPages = 256): WasmValidationResult {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8) return { valid: false, imports: 0, memoryPages: 0, reason: 'WebAssembly module is empty or truncated.' };
  if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d ||
      bytes[4] !== 0x01 || bytes[5] !== 0x00 || bytes[6] !== 0x00 || bytes[7] !== 0x00) {
    return { valid: false, imports: 0, memoryPages: 0, reason: 'WebAssembly magic or version is invalid.' };
  }
  if (!Number.isSafeInteger(maxMemoryPages) || maxMemoryPages < 0) return { valid: false, imports: 0, memoryPages: 0, reason: 'WebAssembly memory policy is invalid.' };
  const state = { offset: 8 };
  let imports = 0;
  let memoryPages = 0;
  try {
    while (state.offset < bytes.length) {
      const sectionId = bytes[state.offset++]!;
      const sectionLength = readU32Leb(bytes, state);
      const sectionEnd = state.offset + sectionLength;
      if (sectionEnd > bytes.length) throw new Error('Truncated WebAssembly section.');
      if (sectionId === 2) {
        imports = readU32Leb(bytes, state);
        if (imports > 0) return { valid: false, imports, memoryPages, reason: 'Imported functions, memories, tables and globals are blocked by the pure-WASM policy.' };
      } else if (sectionId === 5) {
        const count = readU32Leb(bytes, state);
        if (count > 1) throw new Error('Multiple WebAssembly memories are not supported.');
        for (let index = 0; index < count; index++) {
          const flags = readU32Leb(bytes, state);
          if (flags !== 1) throw new Error('WebAssembly memory must declare an explicit maximum; shared and memory64 modes are unsupported.');
          const initial = readU32Leb(bytes, state);
          const maximum = readU32Leb(bytes, state);
          if (initial > maximum || maximum > maxMemoryPages) throw new Error(`WebAssembly memory maximum ${maximum} pages exceeds policy ${maxMemoryPages}.`);
          memoryPages = maximum;
        }
      }
      state.offset = sectionEnd;
    }
    return { valid: true, imports, memoryPages };
  } catch (error) {
    return { valid: false, imports, memoryPages, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function createPureWasmWorkerSource(bytes: Uint8Array): string {
  const byteArray = `[${Array.from(bytes).join(',')}]`;
  return [
    `const __axonWasmBytes = new Uint8Array(${byteArray});`,
    'const __axonWasmModule = await WebAssembly.compile(__axonWasmBytes);',
    'const __axonWasmInstance = await WebAssembly.instantiate(__axonWasmModule, {});',
    'const __axonWasmExports = __axonWasmInstance.exports;',
    'const __axonWasmEntry = typeof __axonWasmExports.main === "function" ? __axonWasmExports.main : __axonWasmExports._start;',
    'if (typeof __axonWasmEntry !== "function") throw new Error("WebAssembly module must export main or _start.");',
    'const __axonWasmResult = __axonWasmEntry();',
    'console.log("WASM_RESULT", __axonWasmResult === undefined ? "void" : __axonWasmResult);'
  ].join('\n');
}

export class WebAssemblyWorkerExecutionAdapter implements RuntimeAdapter {
  readonly descriptor: RuntimeDescriptor;
  private readonly delegate: JavaScriptWorkerExecutionAdapter;

  constructor(
    private readonly binaries: BinaryProjectSourceProvider,
    provider: SecureWorkerProvider,
    private readonly maxModuleBytes = 256 * 1024,
    private readonly maxMemoryPages = 256
  ) {
    const sourceProvider: JavaScriptEntrySourceProvider = {
      supportedExtensions: ['.wasm'],
      readSingleEntry: async (request) => {
        const item = await this.binaries.readBinaryEntry(request);
        if (!item || item.path !== request.entryFiles[0]) return null;
        if (item.bytes.byteLength > this.maxModuleBytes) throw new Error(`WebAssembly module exceeds ${this.maxModuleBytes} bytes.`);
        const validation = validatePureWasmModule(item.bytes, this.maxMemoryPages);
        if (!validation.valid) throw new Error(validation.reason ?? 'WebAssembly module failed validation.');
        return { path: item.path, source: createPureWasmWorkerSource(item.bytes) };
      }
    };
    this.delegate = new JavaScriptWorkerExecutionAdapter(sourceProvider, provider, {
      maxTimeoutMs: 5_000, maxOutputBytes: 64 * 1024, maxSourceBytes: Math.max(1_048_576, maxModuleBytes * 6)
    });
    this.descriptor = {
      id: 'webassembly-pure-worker', label: 'Pure WebAssembly Worker', languages: ['webassembly'], platforms: ['browser'],
      available: this.delegate.descriptor.available, supportsStreaming: false, supportsCheckpoint: false, isolation: 'worker',
      notes: ['Runs import-free WebAssembly MVP-style modules with main or _start exports; no WASI, filesystem or network imports. Worker timeout terminates the execution.']
    };
  }

  canHandle(request: ExecutionRequest): boolean {
    return request.runtimeId === this.descriptor.id && request.entryFiles.length === 1 && /\.wasm$/i.test(request.entryFiles[0] ?? '') &&
      request.mode === 'FULL_LOCAL' && request.networkAllowed === false && request.fileAccess === 'none' && this.descriptor.available;
  }

  async execute(request: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    if (!this.canHandle(request)) return {
      requestId: request.requestId, status: 'blocked', stdout: '', stderr: '', diagnostics: [], elapsedMs: 0, artifacts: [], evidence: 'CHECKED',
      notes: ['WebAssembly request is outside the import-free, single-file, no-network policy or the worker host is unavailable.']
    };
    const delegated = await this.delegate.execute({ ...request, runtimeId: 'javascript-worker-ac2' }, signal);
    return { ...delegated, notes: [...delegated.notes, 'WebAssembly bytes were validated before execution in the isolated JavaScript Worker.'] };
  }
}
