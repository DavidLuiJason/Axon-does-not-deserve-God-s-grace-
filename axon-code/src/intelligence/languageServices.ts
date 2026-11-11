import type { JsonRpcFailure, JsonRpcMessage, JsonRpcNotification, JsonRpcSuccess } from './jsonRpc.js';

export interface JsonRpcTransport {
  send(message: JsonRpcMessage): Promise<void>;
  close(): Promise<void>;
}
export interface LanguageServiceRequestOptions { timeoutMs?: number; signal?: AbortSignal; }
interface PendingRequest { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; abort?: () => void; signal?: AbortSignal; }

/** JSON-RPC client for an externally supplied LSP server. It is a client, not a language server implementation. */
export class LanguageServiceClient {
  private sequence = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notificationHandlers = new Map<string, Set<(params: unknown) => void>>();
  private readonly requestHandlers = new Map<string, (params: unknown) => Promise<unknown> | unknown>();
  private closed = false;
  constructor(private readonly transport: JsonRpcTransport, private readonly defaultTimeoutMs = 15_000, private readonly onHandlerError: (error: Error) => void = () => undefined) {
    if (!Number.isSafeInteger(defaultTimeoutMs) || defaultTimeoutMs < 1) throw new Error('Invalid language-service timeout.');
  }
  request<T = unknown>(method: string, params?: unknown, options: LanguageServiceRequestOptions = {}): Promise<T> {
    if (this.closed) return Promise.reject(new Error('Language service is closed.'));
    if (!method.trim() || method.length > 256) return Promise.reject(new Error('Invalid JSON-RPC method.'));
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10 * 60_000) return Promise.reject(new Error('Invalid request timeout.'));
    if (options.signal?.aborted) return Promise.reject(new Error('Language-service request was cancelled.'));
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => this.rejectPending(id, new Error(`Language-service request '${method}' timed out.`)), timeoutMs);
      const abort = options.signal ? () => {
        void this.transport.send({ jsonrpc: '2.0', method: '$/cancelRequest', params: { id } }).catch(() => undefined);
        this.rejectPending(id, new Error(`Language-service request '${method}' was cancelled.`));
      } : undefined;
      if (abort) options.signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer, ...(abort ? { abort, signal: options.signal } : {}) });
      void this.transport.send({ jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) }).catch((error: unknown) => this.rejectPending(id, toError(error)));
    });
  }
  notify(method: string, params?: unknown): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Language service is closed.'));
    if (!method.trim()) return Promise.reject(new Error('Invalid JSON-RPC notification method.'));
    return this.transport.send({ jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}) });
  }
  onNotification(method: string, handler: (params: unknown) => void): () => void {
    const handlers = this.notificationHandlers.get(method) ?? new Set<(params: unknown) => void>();
    handlers.add(handler); this.notificationHandlers.set(method, handlers);
    return () => { handlers.delete(handler); if (!handlers.size) this.notificationHandlers.delete(method); };
  }
  receive(message: JsonRpcMessage): void {
    if ('method' in message && 'id' in message) { void this.handleServerRequest(message.id, message.method, message.params); return; }
    if (isResponse(message)) {
      const pending = this.pending.get(Number(message.id));
      if (!pending) return;
      this.clearPending(Number(message.id), pending);
      if ('error' in message) pending.reject(new Error(`LSP ${message.error.code}: ${message.error.message}`));
      else pending.resolve((message as JsonRpcSuccess).result);
      return;
    }
    if ('method' in message) for (const handler of this.notificationHandlers.get(message.method) ?? []) { try { handler(message.params); } catch (error) { try { this.onHandlerError(toError(error)); } catch { /* observability hooks must not break protocol dispatch */ } } }
  }
  onServerRequest(method: string, handler: (params: unknown) => Promise<unknown> | unknown): () => void {
    if (typeof method !== 'string' || !method.trim() || method.length > 256 || typeof handler !== 'function') throw new Error('Server-request method and handler are required.');
    this.requestHandlers.set(method, handler);
    return () => { if (this.requestHandlers.get(method) === handler) this.requestHandlers.delete(method); };
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const [id, pending] of this.pending) { this.clearPending(id, pending); pending.reject(new Error('Language service closed with requests pending.')); }
    this.notificationHandlers.clear(); this.requestHandlers.clear(); await this.transport.close();
  }
  private async handleServerRequest(id: number | string, method: string, params: unknown): Promise<void> {
    const handler = this.requestHandlers.get(method);
    try {
      if (!handler) throw new Error(`Unsupported server request '${method}'.`);
      await this.transport.send({ jsonrpc: '2.0', id, result: await handler(params) });
    } catch (error) {
      await this.transport.send({ jsonrpc: '2.0', id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } }).catch(() => undefined);
    }
  }
  private rejectPending(id: number, error: Error): void { const pending = this.pending.get(id); if (!pending) return; this.clearPending(id, pending); pending.reject(error); }
  private clearPending(id: number, pending: PendingRequest): void {
    clearTimeout(pending.timer); if (pending.abort && pending.signal) pending.signal.removeEventListener('abort', pending.abort); this.pending.delete(id);
  }
}
function isResponse(message: JsonRpcMessage): message is JsonRpcSuccess | JsonRpcFailure { return 'id' in message && !('method' in message); }
function toError(value: unknown): Error { return value instanceof Error ? value : new Error(String(value)); }

export type LanguageId = 'javascript' | 'typescript' | 'python' | 'cpp' | 'rust' | 'java' | 'kotlin' | 'html' | 'css' | 'json' | 'unknown';
export interface LanguageServiceCapabilities { completion: boolean; definition: boolean; references: boolean; diagnostics: boolean; formatting: boolean; rename: boolean; }
export interface LanguageServiceProvider {
  id: string;
  language: LanguageId;
  state: 'AVAILABLE' | 'ADAPTER_REQUIRED' | 'NOT_IMPLEMENTED';
  capabilities: LanguageServiceCapabilities;
  createClient?(): Promise<LanguageServiceClient>;
}

/** Registry for host-provided language servers. It never pretends a server exists merely because a language is recognised. */
export class LanguageServiceRegistry {
  private readonly providers = new Map<LanguageId, LanguageServiceProvider>();
  register(provider: LanguageServiceProvider): void {
    if (!provider.id.trim() || this.providers.has(provider.language)) throw new Error(`Language service for '${provider.language}' is invalid or already registered.`);
    if (provider.state === 'AVAILABLE' && !provider.createClient) throw new Error('An AVAILABLE language service must provide a client factory.');
    this.providers.set(provider.language, { ...provider, capabilities: { ...provider.capabilities } });
  }
  get(language: LanguageId): LanguageServiceProvider | null { const value = this.providers.get(language); return value ? { ...value, capabilities: { ...value.capabilities } } : null; }
  list(): LanguageServiceProvider[] { return [...this.providers.values()].map((value) => ({ ...value, capabilities: { ...value.capabilities } })); }
  async connect(language: LanguageId): Promise<LanguageServiceClient> {
    const provider = this.providers.get(language);
    if (!provider || provider.state !== 'AVAILABLE' || !provider.createClient) throw new Error(`Language service '${language}' is not operational on this host.`);
    return provider.createClient();
  }
}

export const EMPTY_LANGUAGE_CAPABILITIES: Readonly<LanguageServiceCapabilities> = Object.freeze({ completion: false, definition: false, references: false, diagnostics: false, formatting: false, rename: false });

/** Managed LSP document/session facade used by editor hosts. Server capabilities must be negotiated at runtime. */
export class LanguageServiceSession {
  private initialized = false;
  private readonly versions = new Map<string, number>();
  private serverCapabilities: Record<string, unknown> = {};
  constructor(private readonly client: LanguageServiceClient) {}
  async initialize(input: { processId: number | null; rootUri: string | null; workspaceFolders?: Array<{ uri: string; name: string }> }): Promise<Record<string, unknown>> {
    if (this.initialized) throw new Error('Language service session is already initialized.');
    if (!input || (input.processId !== null && (!Number.isSafeInteger(input.processId) || input.processId < 1)) || (input.rootUri !== null && (typeof input.rootUri !== 'string' || !/^file:\/\//i.test(input.rootUri) || input.rootUri.length > 4096)) || (input.workspaceFolders !== undefined && (!Array.isArray(input.workspaceFolders) || input.workspaceFolders.length > 256 || input.workspaceFolders.some((folder) => !folder || typeof folder.uri !== 'string' || !/^file:\/\//i.test(folder.uri) || typeof folder.name !== 'string')))) throw new Error('Language-service initialization options are invalid.');
    const response = await this.client.request<{ capabilities?: Record<string, unknown> }>('initialize', { processId: input.processId, rootUri: input.rootUri, capabilities: { textDocument: { completion: { completionItem: { snippetSupport: false } }, definition: {}, references: {}, documentSymbol: {}, formatting: {}, codeAction: {} } }, ...(input.workspaceFolders ? { workspaceFolders: input.workspaceFolders } : {}) });
    this.serverCapabilities = response.capabilities ?? {};
    await this.client.notify('initialized', {}); this.initialized = true;
    return structuredClone(this.serverCapabilities);
  }
  async openDocument(uri: string, languageId: string, text: string): Promise<void> {
    this.requireInitialized(); this.validateUri(uri); if (!languageId.trim() || languageId.length > 64) throw new Error('Invalid document language ID.');
    if (new TextEncoder().encode(text).byteLength > 8 * 1024 * 1024) throw new Error('Document exceeds the LSP sync size limit.');
    if (this.versions.has(uri)) throw new Error('Document is already open in this language-service session.');
    this.versions.set(uri, 1); await this.client.notify('textDocument/didOpen', { textDocument: { uri, languageId, version: 1, text } });
  }
  async changeDocument(uri: string, text: string): Promise<number> {
    this.requireInitialized(); const current = this.versions.get(uri); if (current === undefined) throw new Error('Document is not open in this language-service session.');
    if (new TextEncoder().encode(text).byteLength > 8 * 1024 * 1024) throw new Error('Document exceeds the LSP sync size limit.');
    const next = current + 1; this.versions.set(uri, next); await this.client.notify('textDocument/didChange', { textDocument: { uri, version: next }, contentChanges: [{ text }] }); return next;
  }
  async closeDocument(uri: string): Promise<void> {
    this.requireInitialized(); if (!this.versions.has(uri)) return; this.versions.delete(uri); await this.client.notify('textDocument/didClose', { textDocument: { uri } });
  }
  async completion(uri: string, line: number, character: number, signal?: AbortSignal): Promise<unknown> { this.validatePosition(uri, line, character); return this.client.request('textDocument/completion', { textDocument: { uri }, position: { line, character } }, { ...(signal ? { signal } : {}) }); }
  async definition(uri: string, line: number, character: number, signal?: AbortSignal): Promise<unknown> { this.validatePosition(uri, line, character); return this.client.request('textDocument/definition', { textDocument: { uri }, position: { line, character } }, { ...(signal ? { signal } : {}) }); }
  async references(uri: string, line: number, character: number, signal?: AbortSignal): Promise<unknown> { this.validatePosition(uri, line, character); return this.client.request('textDocument/references', { textDocument: { uri }, position: { line, character }, context: { includeDeclaration: true } }, { ...(signal ? { signal } : {}) }); }
  getCapabilities(): Record<string, unknown> { return structuredClone(this.serverCapabilities); }
  async close(): Promise<void> { if (this.initialized) for (const uri of [...this.versions.keys()]) await this.closeDocument(uri); this.initialized = false; await this.client.close(); }
  private requireInitialized(): void { if (!this.initialized) throw new Error('Language service has not completed initialize.'); }
  private validateUri(uri: string): void { if (!/^file:\/\//i.test(uri) || uri.length > 4096 || /[\u0000\r\n]/.test(uri)) throw new Error('Language-service document URI must be a bounded local file URI.'); }
  private validatePosition(uri: string, line: number, character: number): void { this.requireInitialized(); this.validateUri(uri); if (!this.versions.has(uri)) throw new Error('Document is not open.'); if (!Number.isSafeInteger(line) || line < 0 || !Number.isSafeInteger(character) || character < 0) throw new Error('Invalid LSP document position.'); }
}
