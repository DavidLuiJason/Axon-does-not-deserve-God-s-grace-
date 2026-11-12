import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function run(executable, args, options, maxOutputBytes = 2 * 1024 * 1024) {
  return new Promise(resolve => {
    const child = spawn(executable, args, options); let stdout = ''; let stderr = ''; let settled = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 10_000);
    const append = (target, chunk) => {
      const next = target + chunk.toString();
      if (Buffer.byteLength(next) > maxOutputBytes) { child.kill('SIGKILL'); return target; }
      return next;
    };
    child.stdout?.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr?.on('data', chunk => { stderr = append(stderr, chunk); });
    child.on('error', error => { if (settled) return; settled = true; clearTimeout(timer); resolve({ exitCode: 127, stdout, stderr: `${stderr}\n${String(error)}` }); });
    child.on('close', code => { if (settled) return; settled = true; clearTimeout(timer); resolve({ exitCode: code ?? 1, stdout, stderr }); });
  });
}

export async function rawGit(cwd, args) {
  return run('git', args, { cwd, env: { PATH: process.env.PATH ?? '', HOME: os.tmpdir(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
}

export class GitNodeHost {
  constructor() { this.forwardedEnvKeys = []; }
  async isWithinWorkspace(workspaceRoot, candidatePath) {
    try {
      const root = await fs.realpath(workspaceRoot);
      const candidate = await fs.realpath(candidatePath);
      const relative = path.relative(root, candidate);
      return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    } catch { return false; }
  }
  async fileSize(absolutePath) { try { return (await fs.stat(absolutePath)).size; } catch (error) { if (error?.code === 'ENOENT') return null; throw error; } }
  async runGit(cwd, args, policy) {
    if (policy?.disableHooks !== true || policy?.credentialsDisabled !== true) return { exitCode: 126, stdout: '', stderr: 'Git host requires hooks and credential access disabled.' };
    const env = {
      PATH: process.env.PATH ?? '', HOME: path.join(os.tmpdir(), `axon-git-empty-home-${process.pid}`),
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '',
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {})
    };
    this.forwardedEnvKeys.push(...Object.keys(env));
    await fs.mkdir(env.HOME, { recursive: true });
    const result = await run('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }, policy.maxOutputBytes);
    return result;
  }
}
