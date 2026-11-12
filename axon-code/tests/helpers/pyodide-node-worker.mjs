import { parentPort, workerData } from 'node:worker_threads';
import { loadPyodide } from 'pyodide';

let pyodide;
let running = false;

function collectProjectFiles() {
  const files = [];
  const walk = (directory) => {
    for (const name of pyodide.FS.readdir(directory)) {
      if (name === '.' || name === '..') continue;
      const target = directory === '/' ? `/${name}` : `${directory}/${name}`;
      const stat = pyodide.FS.stat(target);
      if (pyodide.FS.isDir(stat.mode)) walk(target);
      else if (pyodide.FS.isFile(stat.mode) && target.startsWith('/project/')) {
        files.push({ path: target.slice('/project/'.length), content: new TextDecoder().decode(pyodide.FS.readFile(target)) });
      }
    }
  };
  walk('/project');
  return files;
}

async function initialize() {
  if (pyodide) return pyodide;
  pyodide = await loadPyodide({
    indexURL: workerData.indexURL,
    packageCacheDir: workerData.indexURL,
    jsglobals: Object.create(null),
    env: { HOME: '/project', PYTHONPATH: '/project' }
  });
  // The Python `js` module sees only this empty jsglobals object, not Node's process/global object.
  // Pyodide's Emscripten FS is an in-memory filesystem; no host directory is mounted.
  pyodide.runPython(`
import os, sys

def _axon_restrict(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo'):
        raise PermissionError('Network access is disabled for this execution.')
    if event == 'open':
        path = args[0] if len(args) > 0 else None
        mode = args[1] if len(args) > 1 else 'r'
        flags = args[2] if len(args) > 2 and isinstance(args[2], int) else 0
        writing = (isinstance(mode, str) and any(flag in mode for flag in 'wax+')) or bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND))
        if writing:
            if not isinstance(path, str):
                raise PermissionError('Writes must use a project-relative text path.')
            resolved = os.path.abspath(path)
            if not (resolved == '/project' or resolved.startswith('/project/')):
                raise PermissionError('Writes are restricted to the /project virtual directory.')

sys.addaudithook(_axon_restrict)
`);
  // Do not leave a Node network primitive in the worker global namespace.
  globalThis.fetch = undefined;
  globalThis.WebSocket = undefined;
  return pyodide;
}

parentPort.on('message', async (request) => {
  if (running || !request || request.type !== 'run' || typeof request.source !== 'string') return;
  running = true;
  let outputBytes = 0;
  let outputFailed = false;
  const emit = (stream, value) => {
    if (outputFailed) return false;
    const text = String(value);
    const bytes = new TextEncoder().encode(text).byteLength;
    if (outputBytes + bytes > request.maxOutputBytes) {
      outputFailed = true;
      parentPort.postMessage({ type: 'failed', error: 'Python output limit exceeded.' });
      return false;
    }
    outputBytes += bytes;
    parentPort.postMessage({ type: 'output', stream, text });
    return true;
  };
  try {
    const runtime = await initialize();
    runtime.FS.mkdirTree('/project');
    for (const file of request.files ?? []) {
      const target = `/project/${file.path}`;
      const slash = target.lastIndexOf('/');
      if (slash > '/project'.length) runtime.FS.mkdirTree(target.slice(0, slash));
      runtime.FS.writeFile(target, file.content);
    }
    runtime.FS.chdir('/project');
    const stdinLines = String(request.stdin ?? '').split('\n');
    let stdinIndex = 0;
    runtime.setStdin({ stdin: () => stdinIndex < stdinLines.length ? stdinLines[stdinIndex++] : null });
    runtime.setStdout({ batched: text => emit('stdout', text) });
    runtime.setStderr({ batched: text => emit('stderr', text) });
    const value = await runtime.runPythonAsync(request.source);
    if (!outputFailed) parentPort.postMessage({ type: 'completed', exitCode: 0, value: value == null ? '' : String(value), files: collectProjectFiles() });
  } catch (error) {
    parentPort.postMessage({ type: 'failed', error: String(error), traceback: String(error) });
  } finally {
    running = false;
  }
});
