import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

class InspectorWebSocketTransport {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', async event => {
      const text = typeof event.data === 'string' ? event.data : await event.data.text();
      const message = JSON.parse(text);
      if (Number.isSafeInteger(message.id)) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message ?? 'Inspector protocol command failed.'));
        else pending.resolve(message.result ?? {});
      } else if (typeof message.method === 'string') {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
      }
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Inspector WebSocket closed.')); }
      this.pending.clear();
    });
    socket.addEventListener('error', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Inspector WebSocket transport error.')); }
      this.pending.clear();
    });
  }
  send(method, params = {}, timeoutMs = 8000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Inspector command timed out: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  onEvent(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }
  close() { try { this.socket.close(); } catch {} }
}

export class RealNodeInspectorHost {
  async launch({ programPath, cwd, workspaceRoot }) {
    const [root, program, working] = await Promise.all([realpath(workspaceRoot), realpath(programPath), realpath(cwd)]);
    const inside = candidate => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
    if (!inside(program) || !inside(working)) throw new Error('Real Node host refused a symlink or path outside the approved workspace root.');
    const child = spawn(process.execPath, ['--inspect-brk=127.0.0.1:0', program], { cwd: working, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-128 * 1024); });
    let resolveEndpoint; let rejectEndpoint;
    const inspectorUrl = new Promise((resolve, reject) => { resolveEndpoint = resolve; rejectEndpoint = reject; });
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-128 * 1024);
      const match = stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);
      if (match) resolveEndpoint(match[1]);
    });
    const exit = new Promise(resolve => child.once('exit', (code, signal) => {
      if (!resolveEndpointUsed) rejectEndpoint(new Error(`Node target exited before Inspector startup (code ${code}, signal ${signal}).`));
      resolve({ code, signal, stdout, stderr });
    }));
    let resolveEndpointUsed = false;
    const endpoint = inspectorUrl.then(value => { resolveEndpointUsed = true; return value; });
    const timeout = setTimeout(() => rejectEndpoint(new Error('Node Inspector endpoint did not start within 10 seconds.')), 10_000);
    void endpoint.finally(() => clearTimeout(timeout));
    return {
      inspectorUrl: endpoint,
      programUrl: pathToFileURL(program).href,
      exit,
      kill() { if (child.exitCode === null && !child.killed) child.kill('SIGTERM'); }
    };
  }
  async connect(inspectorUrl) {
    const socket = new WebSocket(inspectorUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Inspector WebSocket connection timed out.')), 8_000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Inspector WebSocket connection failed.')); }, { once: true });
    });
    return new InspectorWebSocketTransport(socket);
  }
}
