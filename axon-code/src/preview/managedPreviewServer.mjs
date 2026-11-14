import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const MIME_TYPES = Object.freeze({
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain; charset=utf-8',
});

function safeText(value, max = 2048) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return String(text ?? '').slice(0, max);
  } catch {
    return '[unserializable]';
  }
}

function createConsoleScript(token, nonce) {
  const encoded = JSON.stringify(token);
  return `<script nonce="${nonce}">(() => {
    const token = ${encoded};
    const send = (type, payload) => {
      try { window.parent.postMessage({ __axonPreview: true, token, type, payload }, '*'); } catch {}
    };
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        send('console', { level, message: args.map((value) => {
          try { return typeof value === 'string' ? value : JSON.stringify(value); }
          catch { return '[unserializable]'; }
        }).join(' ').slice(0, 2048) });
        original(...args);
      };
    }
    window.addEventListener('error', (event) => send('error', { message: String(event.message || 'Script error').slice(0, 2048) }));
    window.addEventListener('unhandledrejection', (event) => send('error', { message: String(event.reason?.message || event.reason || 'Unhandled rejection').slice(0, 2048) }));
  })();</script>`;
}

export class PreviewConsoleBridge {
  constructor({ window, iframeWindow, origin, token, maxEvents = 200, maxBytes = 64 * 1024 } = {}) {
    if (!window?.addEventListener || !iframeWindow || !origin || !token) throw new Error('PREVIEW_BRIDGE_CONFIGURATION_REQUIRED');
    this.window = window;
    this.iframeWindow = iframeWindow;
    this.origin = origin;
    this.token = token;
    this.maxEvents = maxEvents;
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.events = [];
    this.closed = false;
    this.listener = (event) => this.handle(event);
  }

  attach() {
    if (this.closed) throw new Error('PREVIEW_BRIDGE_CLOSED');
    this.window.addEventListener('message', this.listener);
    return this;
  }

  handle(event) {
    if (this.closed || event.origin !== this.origin || event.source !== this.iframeWindow) return false;
    const data = event.data;
    if (!data || data.__axonPreview !== true || data.token !== this.token) return false;
    if (data.type !== 'console' && data.type !== 'error') return false;
    const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
    const row = data.type === 'console'
      ? { type: 'console', level: safeText(payload.level, 24), message: safeText(payload.message) }
      : { type: 'error', message: safeText(payload.message) };
    const size = Buffer.byteLength(JSON.stringify(row));
    if (this.events.length >= this.maxEvents || this.bytes + size > this.maxBytes) return false;
    this.bytes += size;
    this.events.push(row);
    return true;
  }

  close() {
    if (this.closed) return;
    this.window.removeEventListener('message', this.listener);
    this.closed = true;
  }
}

export function createManagedPreview({ files, maxFiles = 500, maxBytes = 8 * 1024 * 1024, host = '127.0.0.1', maxEvents = 1000, maxEventBytes = 64 * 1024 } = {}) {
  if (host !== '127.0.0.1') throw new Error('LOOPBACK_ONLY');
  if (!files || typeof files !== 'object' || Object.keys(files).length > maxFiles) throw new Error('FILE_COUNT_LIMIT');
  const entries = new Map();
  let total = 0;
  for (const [name, value] of Object.entries(files)) {
    if (name.startsWith('/') || name.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
        name.includes('\\') || /[\x00-\x1f\x7f]/.test(name) || /%2e|%2f/i.test(name)) {
      throw new Error('INVALID_PATH');
    }
    const body = Buffer.from(String(value));
    total += body.length;
    if (total > maxBytes) throw new Error('PROJECT_SIZE_LIMIT');
    entries.set(name, body);
  }

  const token = randomUUID();
  const nonce = randomUUID().replaceAll('-', '');
  const events = [];
  let eventBytes = 0;
  let server;
  let closed = false;

  const record = (row) => {
    const safe = { ...row };
    const size = Buffer.byteLength(JSON.stringify(safe));
    if (events.length >= maxEvents || eventBytes + size > maxEventBytes) return false;
    eventBytes += size;
    events.push(safe);
    return true;
  };

  return {
    events,
    async start() {
      if (closed) throw new Error('CLOSED');
      if (server) return server.address().port;
      server = http.createServer((request, response) => {
        try {
          const port = server.address()?.port;
          const hostHeader = String(request.headers.host || '').toLowerCase();
          if (hostHeader !== `127.0.0.1:${port}` && hostHeader !== `localhost:${port}`) {
            response.writeHead(421);
            response.end();
            return;
          }
          let requestedPath;
          try { requestedPath = decodeURIComponent((request.url || '/').split('?')[0]); }
          catch { response.writeHead(400); response.end(); return; }
          const fileName = requestedPath.replace(/^\/+/, '') || 'index.html';
          if (fileName.split('/').some((part) => part === '..' || part === '.') || fileName.includes('\\') || /[\x00-\x1f\x7f]/.test(fileName)) {
            response.writeHead(400);
            response.end();
            return;
          }
          const source = entries.get(fileName);
          if (!source) { response.writeHead(404); response.end(); return; }
          let body = source;
          if (path.extname(fileName).toLowerCase() === '.html') {
            let html = source.toString('utf8');
            const script = createConsoleScript(token, nonce);
            if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${script}</head>`);
            else html = `${script}${html}`;
            body = Buffer.from(html);
          }
          const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-same-origin`;
          response.writeHead(200, {
            'content-type': MIME_TYPES[path.extname(fileName).slice(1).toLowerCase()] || 'application/octet-stream',
            'x-content-type-options': 'nosniff',
            'content-security-policy': csp,
            'content-disposition': 'inline',
            'x-frame-options': 'SAMEORIGIN',
            'content-length': body.length,
          });
          response.end(body);
        } catch {
          response.writeHead(400);
          response.end();
        }
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, host, resolve);
      });
      return server.address().port;
    },
    createConsoleBridge({ window, iframeWindow, maxBridgeEvents = 200, maxBridgeBytes = 64 * 1024 } = {}) {
      if (!server?.listening) throw new Error('PREVIEW_NOT_RUNNING');
      const port = server.address().port;
      return new PreviewConsoleBridge({
        window,
        iframeWindow,
        origin: `http://127.0.0.1:${port}`,
        token,
        maxEvents: maxBridgeEvents,
        maxBytes: maxBridgeBytes,
      });
    },
    recordConsole(level, args) {
      return record({ type: 'console', level: safeText(level, 24), message: safeText(args) });
    },
    recordError(message) {
      return record({ type: 'error', message: safeText(message) });
    },
    async stop() {
      if (!server) return;
      const current = server;
      server = null;
      await new Promise((resolve) => current.close(resolve));
    },
    get running() { return Boolean(server?.listening); },
  };
}
