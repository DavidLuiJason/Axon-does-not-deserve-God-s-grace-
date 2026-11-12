import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { PyodideWorkerExecutionAdapter } from '../../dist/runtime/pyodideWorkerProvider.js';

const runtimeId = 'pyodide-cpython-wasm-worker';
const packageDir = path.resolve('node_modules/pyodide');
const indexURL = `${packageDir}${path.sep}`;
const packBaseUrl = pathToFileURL(indexURL).href;
const workerUrl = new URL('./pyodide-node-worker.mjs', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredAssets = ['pyodide.js', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
let verifiedPack;

async function realPack() {
  if (verifiedPack) return verifiedPack;
  const assets = new Map();
  const files = [];
  for (const name of requiredAssets) {
    const bytes = new Uint8Array(await fs.readFile(path.join(packageDir, name)));
    assets.set(name, bytes);
    files.push({ path: name, sizeBytes: bytes.byteLength, sha256: hash(bytes) });
  }
  verifiedPack = { id: 'vendor-pack-v2-pyodide', version: '314.0.7', baseUrl: packBaseUrl, files, async readFile(name) { return assets.get(name) ?? null; } };
  return verifiedPack;
}

class NodeWorkerFactory {
  constructor() { this.created = 0; }
  create(_browserWorkerSource) {
    this.created++;
    const worker = new Worker(workerUrl, {
      workerData: { indexURL },
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 }
    });
    return {
      postMessage: message => worker.postMessage(message),
      terminate: () => worker.terminate(),
      addEventListener(type, listener) {
        if (type === 'message') worker.on('message', data => listener({ data }));
        else if (type === 'error') worker.on('error', error => listener(error));
      },
      removeEventListener() {}
    };
  }
}

function makeRequest(overrides = {}) {
  return {
    requestId: `py-${Date.now()}-${Math.random()}`,
    projectId: 'node-worker-project',
    entryFiles: ['main.py'],
    runtimeId,
    mode: 'FULL_LOCAL',
    timeoutMs: 12_000,
    outputLimitBytes: 4096,
    networkAllowed: false,
    fileAccess: 'project-read-only',
    ...overrides
  };
}

async function makeAdapter({ source = 'print("ready")', projectFiles = [], fileAccess = 'project-read-only', writeBack } = {}) {
  const factory = new NodeWorkerFactory();
  const savedFiles = [];
  const provider = {
    async readPythonEntry(request) { return { path: request.entryFiles[0], source }; },
    async readProjectFiles() { return projectFiles; },
    async writeProjectFiles(_request, files) { if (writeBack) await writeBack(files); savedFiles.push(...files); }
  };
  const adapter = new PyodideWorkerExecutionAdapter(provider, factory, await realPack());
  const initialized = await adapter.initialize();
  assert.equal(initialized.available, true, initialized.reason ?? 'real Pyodide assets should verify');
  return { adapter, factory, provider, savedFiles, request: overrides => makeRequest({ fileAccess, ...overrides }) };
}

// Real Pyodide 314.0.7 is loaded inside a Node worker_threads Worker. No Python imitation or fake runtime is used.
test('WP7 real CPython prints output and returns the final expression value', async () => {
  const h = await makeAdapter({ source: "print('hello from CPython')\n40 + 2" });
  const result = await h.adapter.execute(h.request());
  assert.equal(result.status, 'completed');
  assert.match(result.stdout, /hello from CPython/);
  assert.equal(result.value, '42');
  assert.equal(result.exitCode, 0);
  assert.match(result.notes.join(' '), /Grade 1/);
});

test('WP7 real CPython reports syntax errors with Python traceback context', async () => {
  const h = await makeAdapter({ source: 'def broken(:\n    pass' });
  const result = await h.adapter.execute(h.request());
  assert.equal(result.status, 'failed');
  assert.match(result.stderr, /SyntaxError/);
  assert.match(result.stderr, /File "<exec>"|line 1|invalid syntax/i);
});

test('WP7 real CPython reports runtime errors and traceback', async () => {
  const h = await makeAdapter({ source: "def explode():\n    raise RuntimeError('runtime boom')\nexplode()" });
  const result = await h.adapter.execute(h.request());
  assert.equal(result.status, 'failed');
  assert.match(result.stderr, /Traceback/);
  assert.match(result.stderr, /RuntimeError: runtime boom/);
});

test('WP7 real CPython receives stdin through the worker protocol', async () => {
  const h = await makeAdapter({ source: "name = input('Name: ')\nprint('received:' + name)", fileAccess: 'project-read-only' });
  const result = await h.adapter.execute(h.request({ stdin: 'AXON-user\n' }));
  assert.equal(result.status, 'completed');
  assert.match(result.stdout, /received:AXON-user/);
});

test('WP7 real CPython infinite loop is terminated by the host wall-clock timeout', async () => {
  const h = await makeAdapter({ source: "print('loop-started')\nwhile True:\n    pass" });
  const result = await h.adapter.execute(h.request({ timeoutMs: 5000 }));
  assert.match(result.stdout, /loop-started/);
  assert.equal(result.status, 'timed-out');
  assert.match(result.notes.join(' '), /Worker terminated/);
});

test('WP7 real CPython output cap terminates the worker before unbounded output is accepted', async () => {
  const h = await makeAdapter({ source: "print('x' * 10000)" });
  const result = await h.adapter.execute(h.request({ outputLimitBytes: 64 }));
  assert.equal(result.status, 'failed');
  assert.match(result.stderr, /output limit exceeded/i);
});

test('WP7 NEGATIVE: source exceeding the memory/input bound is refused before a worker starts', async () => {
  const h = await makeAdapter({ source: 'x'.repeat(512 * 1024 + 1) });
  const result = await h.adapter.execute(h.request());
  assert.equal(result.status, 'blocked');
  assert.match(result.notes.join(' '), /512 KiB/);
  assert.equal(h.factory.created, 0);
});

test('WP7 each execution gets a fresh worker and Python globals do not leak between runs', async () => {
  const h = await makeAdapter({ source: 'session_marker = 718' });
  const first = await h.adapter.execute(h.request());
  assert.equal(first.status, 'completed');
  // The source provider returns the next program without reusing a prior worker's Python globals.
  h.provider.readPythonEntry = async request => ({ path: request.entryFiles[0], source: 'print(session_marker)' });
  const second = await h.adapter.execute(h.request());
  assert.equal(second.status, 'failed');
  assert.match(second.stderr, /NameError/);
  assert.equal(h.factory.created, 2);
});

test('WP7 real CPython reads and writes only through the project virtual directory', async () => {
  const h = await makeAdapter({
    source: "with open('/project/input.txt', 'r') as source:\n    data = source.read()\nwith open('/project/output.txt', 'w') as target:\n    target.write(data.upper())\nprint(data)",
    projectFiles: [{ path: 'input.txt', content: 'project data' }],
    fileAccess: 'working-copy'
  });
  const result = await h.adapter.execute(h.request({ fileAccess: 'working-copy' }));
  assert.equal(result.status, 'completed');
  assert.match(result.stdout, /project data/);
  assert.ok(h.savedFiles.some(file => file.path === 'output.txt' && file.content === 'PROJECT DATA'));
});

test('WP7 NEGATIVE: network, host filesystem and writes outside /project are denied', async () => {
  // Let the preceding worker_threads termination settle before opening the adversarial socket/FS probe worker.
  await new Promise(resolve => setTimeout(resolve, 50));
  console.log('WP7 Node worker isolation probe: start');
  const hostMarker = path.join(os.tmpdir(), `axon-pyodide-host-${process.pid}.txt`);
  await fs.writeFile(hostMarker, 'host-only-marker');
  try {
    const source = [
      'import os, socket, js',
      `try:\n    open(${JSON.stringify(hostMarker)}, 'r').read()\n    print('HOST_FILE_VISIBLE')\nexcept Exception as error:\n    print(type(error).__name__)`,
      "print('NODE_PROCESS_EXPOSED' if hasattr(js, 'process') else 'NODE_PROCESS_HIDDEN')",
      "try:\n    open('/tmp/axon-outside-project.txt', 'w').write('escape')\n    print('OUTSIDE_WRITE_ALLOWED')\nexcept Exception as error:\n    print(type(error).__name__)",
      "try:\n    socket.socket().connect(('127.0.0.1', 9))\n    print('NETWORK_ALLOWED')\nexcept Exception as error:\n    print(type(error).__name__)"
    ].join('\n');
    const h = await makeAdapter({ source, fileAccess: 'working-copy' });
    const result = await h.adapter.execute(h.request({ fileAccess: 'working-copy' }));
    console.log('WP7 Node worker isolation probe: completed', result.status);
    assert.equal(result.status, 'completed');
    assert.doesNotMatch(result.stdout, /HOST_FILE_VISIBLE|NODE_PROCESS_EXPOSED|OUTSIDE_WRITE_ALLOWED|NETWORK_ALLOWED/);
    assert.match(result.stdout, /FileNotFoundError/);
    assert.match(result.stdout, /NODE_PROCESS_HIDDEN/);
    assert.match(result.stdout, /PermissionError/);
  } finally { await fs.rm(hostMarker, { force: true }); }
});

test('WP7 NEGATIVE: unsafe workspace paths and missing writeback authority are refused', async () => {
  const unsafe = await makeAdapter({ source: "print('x')", projectFiles: [{ path: '../outside.txt', content: 'no' }] });
  const unsafeResult = await unsafe.adapter.execute(unsafe.request());
  assert.equal(unsafeResult.status, 'blocked');
  assert.match(unsafeResult.notes.join(' '), /unsafe path/);

  const noWriteback = new PyodideWorkerExecutionAdapter({ async readPythonEntry(request) { return { path: request.entryFiles[0], source: 'print(1)' }; } }, new NodeWorkerFactory(), await realPack());
  await noWriteback.initialize();
  const refused = await noWriteback.execute(makeRequest({ fileAccess: 'working-copy' }));
  assert.equal(refused.status, 'blocked');
  assert.match(refused.notes.join(' '), /write provider/);
});


test('WP7 NEGATIVE (real mutant): removing the real compiled source-size guard allows oversized Python into CPython', async () => {
  const compiledUrl = new URL('../../dist/runtime/pyodideWorkerProvider.js', import.meta.url);
  const compiled = await fs.readFile(compiledUrl, 'utf8');
  const guard = 'if (new TextEncoder().encode(entry.source).byteLength > MAX_SOURCE_BYTES)';
  assert.ok(compiled.includes(guard), 'the mutant must remove a guard from the actual compiled provider module');
  const mutantPath = path.join(path.dirname(fileURLToPath(compiledUrl)), `pyodideWorkerProvider-mutant-${process.pid}.mjs`);
  await fs.writeFile(mutantPath, compiled.replace(guard, 'if (false)'));
  try {
    const { PyodideWorkerExecutionAdapter: MutantAdapter } = await import(`${pathToFileURL(mutantPath).href}?mutant=${process.pid}`);
    const oversizedProvider = { async readPythonEntry(request) { return { path: request.entryFiles[0], source: `#${'x'.repeat(512 * 1024 + 1)}` }; } };
    const pack = await realPack();
    const realFactory = new NodeWorkerFactory();
    const realAdapter = new PyodideWorkerExecutionAdapter(oversizedProvider, realFactory, pack);
    await realAdapter.initialize();
    const realResult = await realAdapter.execute(makeRequest());
    assert.equal(realResult.status, 'blocked');
    assert.equal(realFactory.created, 0);

    const mutantFactory = new NodeWorkerFactory();
    const mutantAdapter = new MutantAdapter(oversizedProvider, mutantFactory, pack);
    await mutantAdapter.initialize();
    const mutantResult = await mutantAdapter.execute(makeRequest());
    assert.equal(mutantFactory.created, 1);
    assert.equal(mutantResult.status, 'completed', 'the deliberately mutated real provider must bypass the size refusal');
  } finally { await fs.rm(mutantPath, { force: true }); }
});
