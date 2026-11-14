import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, realpath, rm, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULTS = Object.freeze({ timeoutMs: 10_000, maxOutputBytes: 256 * 1024, maxFiles: 500, maxMemoryMb: 128 });

/**
 * Director fix (Round 14 verification): the Node permission model does NOT stop `process.kill`. A hostile project test could
 * kill any other process of the same user, including the AXON Code host, and the run was still reported as TESTED.
 * The child therefore runs inside its own user and PID namespace when the system allows it (the test then cannot even see
 * other processes). Where the system forbids that, the run is BLOCKED unless the caller explicitly accepts the risk
 * (`signalRisk: 'accept'`, for a project the user has trusted).
 */
const PID_NAMESPACE_ARGS = ['--user', '--map-root-user', '--pid', '--fork', '--kill-child', '--mount-proc'];
let pidNamespaceAvailable;

function hasPidNamespace() {
  if (pidNamespaceAvailable === undefined) {
    const probe = spawnSync('unshare', [...PID_NAMESPACE_ARGS, process.execPath, '-e', 'process.exit(0)'], {
      encoding: 'utf8',
      timeout: 3000,
      env: { PATH: process.env.PATH || '/usr/bin:/bin' },
    });
    pidNamespaceAvailable = !probe.error && probe.status === 0;
  }
  return pidNamespaceAvailable;
}

export function buildPermissionArguments({ projectRoot, scratchRoot, testFiles, maxMemoryMb = DEFAULTS.maxMemoryMb }) {
  const args = [
    `--max-old-space-size=${maxMemoryMb}`,
    '--permission',
    '--experimental-test-isolation=none',
    `--allow-fs-read=${projectRoot}`,
    `--allow-fs-write=${scratchRoot}`,
    '--test',
    ...testFiles,
  ];
  return args;
}

async function discoverTests(root, maxFiles) {
  const found = [];
  async function walk(directory, depth = 0) {
    if (depth > 24) throw new Error('PROJECT_DEPTH_LIMIT');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (found.length >= maxFiles) throw new Error('PROJECT_TEST_FILE_LIMIT');
      if (entry.name.includes('\0') || /[\x00-\x1f\x7f]/.test(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(absolute, depth + 1);
      else if (entry.isFile() && /(?:^|\.)test\.(?:mjs|cjs|js)$/.test(entry.name)) found.push(absolute);
    }
  }
  await walk(root);
  return found.sort();
}

export async function runConfinedProjectTests(projectRoot, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const permissionProbe = spawnSync(process.execPath, ['--permission', '--experimental-test-isolation=none', '-e', 'process.exit(0)'], { encoding: 'utf8', timeout: 2000, env: { PATH: process.env.PATH || '/usr/bin:/bin' } });
  if (permissionProbe.error || permissionProbe.status !== 0) {
    const reason = permissionProbe.error?.message || `${permissionProbe.stdout || ''}${permissionProbe.stderr || ''}`.trim() || `Node permission model probe exited ${permissionProbe.status}`;
    return { status: 'BLOCKED', reason, command: [process.execPath, '--permission', '--experimental-test-isolation=none'] };
  }
  const signalIsolated = hasPidNamespace();
  if (!signalIsolated && config.signalRisk !== 'accept') {
    return {
      status: 'BLOCKED',
      reason: 'NO_SIGNAL_ISOLATION: this system cannot give the test its own process namespace, and project test code could signal other processes of the same user. Run it only for a project the user has trusted, with signalRisk: "accept".',
      signalIsolation: false,
      command: null,
    };
  }
  let root;
  let scratch;
  try {
    root = await realpath(projectRoot);
    scratch = await mkdtemp(path.join(os.tmpdir(), 'axon-project-test-scratch-'));
    const tests = await discoverTests(root, config.maxFiles);
    if (!tests.length) return { status: 'FAILED', reason: 'NO_PROJECT_TESTS', command: null };
    const relativeTests = tests.map((file) => `./${path.relative(root, file).split(path.sep).join('/')}`);
    const args = buildPermissionArguments({ projectRoot: root, scratchRoot: scratch, testFiles: relativeTests, maxMemoryMb: config.maxMemoryMb });
    const env = {
      PATH: process.env.PATH || '/usr/bin:/bin',
      HOME: scratch,
      TMPDIR: scratch,
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
    };
    const result = await new Promise((resolve) => {
      const launch = signalIsolated
        ? { file: 'unshare', args: [...PID_NAMESPACE_ARGS, process.execPath, ...args] }
        : { file: process.execPath, args };
      const child = spawn(launch.file, launch.args, { cwd: root, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '';
      let outputBytes = 0;
      let timedOut = false;
      let outputLimited = false;
      let settled = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, config.timeoutMs);
      timer.unref?.();
      const append = (chunk) => {
        outputBytes += chunk.length;
        if (outputBytes > config.maxOutputBytes) {
          outputLimited = true;
          child.kill('SIGKILL');
          return;
        }
        output += chunk.toString('utf8');
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.once('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ error: error.message, exitCode: null, output, timedOut, outputLimited });
      });
      child.once('close', (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ exitCode: code, signal, output, timedOut, outputLimited });
      });
    });
    const command = [process.execPath, ...args];
    if (result.error) return { status: 'BLOCKED', reason: result.error, command };
    return {
      status: result.exitCode === 0 && !result.timedOut && !result.outputLimited ? 'TESTED' : 'FAILED',
      exitCode: result.exitCode,
      signal: result.signal || null,
      timedOut: result.timedOut,
      outputLimited: result.outputLimited,
      outputBytes: Buffer.byteLength(result.output),
      output: result.output,
      command,
      signalIsolation: signalIsolated,
      isolation: 'PROCESS_PERMISSION_CONFINEMENT',
      isolationDetail: signalIsolated ? 'WITH_PID_NAMESPACE' : 'SIGNALS_NOT_ISOLATED',
      isolationNote: signalIsolated
        ? 'Node permission model (project read, scratch-only write, no child-process, worker or addon grants) inside its own user and PID namespace; not a full OS sandbox.'
        : 'Node permission model only; the test could signal other processes of the same user (accepted by the caller); not an OS sandbox.',
    };
  } catch (error) {
    if (error?.code === 'ERR_UNKNOWN_OPTION' || /bad option|unknown option/i.test(String(error?.message))) {
      return { status: 'BLOCKED', reason: String(error.message), command: null };
    }
    return { status: 'FAILED', reason: String(error?.message || error), command: null };
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {});
  }
}
