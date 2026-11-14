import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REAL_SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/typescript-language-server/lib/cli.mjs');

/** Strict bounded Content-Length decoder for the LSP JSON-RPC stream. */
export class LspFrameDecoder {
  constructor({ maxHeaderBytes = 8192, maxMessageBytes = 1024 * 1024, maxNotifications = 1000 } = {}) {
    this.maxHeaderBytes = maxHeaderBytes;
    this.maxMessageBytes = maxMessageBytes;
    this.maxNotifications = maxNotifications;
    this.buffer = Buffer.alloc(0);
    this.pendingOrder = [];
    this.notificationCount = 0;
    this.closed = false;
  }

  expect(id) {
    this.pendingOrder.push(id);
  }

  forget(id) {
    this.pendingOrder = this.pendingOrder.filter((candidate) => candidate !== id);
  }

  push(chunk) {
    if (this.closed) throw new Error('LSP_DECODER_CLOSED');
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk);
    if (this.buffer.length + chunk.length > this.maxMessageBytes + this.maxHeaderBytes) {
      throw new Error('LSP_BUFFER_LIMIT');
    }
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages = [];
    while (this.buffer.length) {
      const separator = this.buffer.indexOf('\r\n\r\n');
      if (separator < 0) {
        if (this.buffer.length > this.maxHeaderBytes) throw new Error('LSP_HEADER_TOO_LARGE');
        if (!/^[\x09\x0a\x0d\x20-\x7e]*$/.test(this.buffer.toString('latin1'))) throw new Error('LSP_MALFORMED_HEADER');
        break;
      }
      if (separator > this.maxHeaderBytes) throw new Error('LSP_HEADER_TOO_LARGE');
      const header = this.buffer.subarray(0, separator).toString('ascii');
      const lines = header.split('\r\n');
      let contentLength = null;
      for (const line of lines) {
        const match = /^Content-Length:\s*(\d+)$/i.exec(line);
        if (match) {
          if (contentLength !== null) throw new Error('LSP_DUPLICATE_CONTENT_LENGTH');
          contentLength = Number(match[1]);
        } else if (!/^[A-Za-z][A-Za-z0-9-]*:\s*[^\r\n]*$/.test(line)) {
          throw new Error('LSP_MALFORMED_HEADER');
        }
      }
      if (!Number.isSafeInteger(contentLength) || contentLength < 2 || contentLength > this.maxMessageBytes) {
        throw new Error('LSP_INVALID_CONTENT_LENGTH');
      }
      const bodyStart = separator + 4;
      const frameEnd = bodyStart + contentLength;
      if (this.buffer.length < frameEnd) break;
      let message;
      try { message = JSON.parse(this.buffer.subarray(bodyStart, frameEnd).toString('utf8')); }
      catch { throw new Error('LSP_INVALID_JSON'); }
      if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') {
        throw new Error('LSP_INVALID_JSONRPC');
      }
      if (Object.hasOwn(message, 'id') && !Object.hasOwn(message, 'method')) {
        const expected = this.pendingOrder[0];
        if (expected === undefined || message.id !== expected) throw new Error('LSP_RESPONSE_ORDER');
        this.pendingOrder.shift();
      } else if (typeof message.method === 'string' && !Object.hasOwn(message, 'id')) {
        this.notificationCount += 1;
        if (this.notificationCount > this.maxNotifications) throw new Error('LSP_NOTIFICATION_FLOOD');
      }
      messages.push(message);
      this.buffer = this.buffer.subarray(frameEnd);
    }
    return messages;
  }

  finish() {
    if (this.buffer.length) {
      this.closed = true;
      throw new Error('LSP_TRUNCATED_FRAME');
    }
    this.closed = true;
  }
}

export class TypeScriptLspClient {
  constructor({ cwd, timeoutMs = 8000, maxMessageBytes = 1024 * 1024, maxHeaderBytes = 8192,
    maxNotifications = 1000, command = process.execPath, args = [REAL_SERVER, '--stdio'] } = {}) {
    this.cwd = path.resolve(cwd || process.cwd());
    this.timeoutMs = timeoutMs;
    this.command = command;
    this.args = args;
    this.maxMessageBytes = maxMessageBytes;
    this.maxHeaderBytes = maxHeaderBytes;
    this.maxNotifications = maxNotifications;
    this.seq = 0;
    this.pending = new Map();
    this.stderr = '';
    this.restarts = 0;
    this.proc = null;
    this.closed = false;
    this.notifications = new Map();
    this.decoder = new LspFrameDecoder({ maxMessageBytes, maxHeaderBytes, maxNotifications });
  }

  start() {
    if (this.proc && this.proc.exitCode === null && !this.proc.killed) return;
    this.decoder = new LspFrameDecoder({
      maxMessageBytes: this.maxMessageBytes,
      maxHeaderBytes: this.maxHeaderBytes,
      maxNotifications: this.maxNotifications,
    });
    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: this.cwd, LANG: 'C.UTF-8' },
    });
    this.proc.stdout.on('data', (chunk) => this.#consume(chunk));
    this.proc.stderr.on('data', (chunk) => { this.stderr = (this.stderr + chunk.toString()).slice(-8192); });
    this.proc.once('error', (error) => this.#failPending(error));
    this.proc.once('exit', (code) => {
      try { this.decoder.finish(); } catch (error) { this.#failPending(error); }
      this.#failPending(new Error(`LSP_EXIT_${code}`));
    });
    this.closed = false;
  }

  #failPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  #consume(chunk) {
    try {
      for (const message of this.decoder.push(chunk)) {
        if (Object.hasOwn(message, 'id') && !Object.hasOwn(message, 'method')) {
          const pending = this.pending.get(message.id);
          if (!pending) throw new Error('LSP_UNKNOWN_RESPONSE');
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message || 'LSP_ERROR'));
          else pending.resolve(message.result);
        } else if (typeof message.method === 'string') {
          for (const handler of this.notifications.get(message.method) || []) handler(message.params);
        }
      }
    } catch (error) {
      this.#failPending(error);
      this.stop();
    }
  }

  request(method, params = {}) {
    if (!this.proc || this.proc.exitCode !== null || this.closed) throw new Error('LSP_NOT_RUNNING');
    const id = ++this.seq;
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    if (body.length > this.maxMessageBytes) throw new Error('MESSAGE_TOO_LARGE');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.decoder.forget(id);
        reject(new Error('LSP_TIMEOUT'));
      }, this.timeoutMs);
      this.decoder.expect(id);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
    });
  }

  onNotification(method, handler) {
    const handlers = this.notifications.get(method) || [];
    handlers.push(handler);
    this.notifications.set(method, handlers);
    return () => this.notifications.set(method, (this.notifications.get(method) || []).filter((item) => item !== handler));
  }

  notify(method, params = {}) {
    if (!this.proc || this.proc.exitCode !== null || this.closed) throw new Error('LSP_NOT_RUNNING');
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', method, params }));
    if (body.length > this.maxMessageBytes) throw new Error('MESSAGE_TOO_LARGE');
    this.proc.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
  }

  async initialize() {
    this.start();
    const result = await this.request('initialize', {
      processId: process.pid,
      rootUri: new URL(`file://${this.cwd}/`).href,
      capabilities: { textDocument: { completion: { completionItem: { snippetSupport: false } }, hover: {}, definition: {}, publishDiagnostics: {} } },
    });
    this.notify('initialized', {});
    return result;
  }

  open(uri, text, languageId = 'typescript') {
    this.notify('textDocument/didOpen', { textDocument: { uri, languageId, version: 1, text } });
  }

  change(uri, text) {
    this.notify('textDocument/didChange', { textDocument: { uri, version: 2 }, contentChanges: [{ text }] });
  }

  completion(uri, line = 0, character = 0) {
    return this.request('textDocument/completion', { textDocument: { uri }, position: { line, character } });
  }

  hover(uri, line = 0, character = 0) {
    return this.request('textDocument/hover', { textDocument: { uri }, position: { line, character } });
  }

  definition(uri, line = 0, character = 0) {
    return this.request('textDocument/definition', { textDocument: { uri }, position: { line, character } });
  }

  async requestWithSingleRestart(method, params = {}) {
    try { return await this.request(method, params); }
    catch (error) {
      if (this.restarts >= 1) throw error;
      this.restarts += 1;
      this.stop();
      this.start();
      await this.request('initialize', { processId: process.pid, rootUri: new URL(`file://${this.cwd}/`).href, capabilities: {} });
      this.notify('initialized', {});
      return this.request(method, params);
    }
  }

  async shutdown() {
    if (!this.proc || this.proc.exitCode !== null) return;
    try { await this.request('shutdown', {}); this.notify('exit', {}); } catch { /* process is still terminated below */ }
    this.stop();
  }

  stop() {
    const processHandle = this.proc;
    this.proc = null;
    this.closed = true;
    if (processHandle && processHandle.exitCode === null) processHandle.kill('SIGTERM');
    this.#failPending(new Error('LSP_STOPPED'));
  }
}
