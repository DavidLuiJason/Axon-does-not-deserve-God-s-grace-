import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function run(executable, args, options) {
  return new Promise(resolve => {
    const child = spawn(executable, args, options); let stdout = ''; let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => resolve({ exitCode: 127, stdout, stderr: `${stderr}\n${String(error)}` }));
    child.on('close', code => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

export class NodePipHost {
  constructor(root) { this.root = root; }
  async probe() {
    const result = await run('pip3', ['--version'], { cwd: this.root, env: { PATH: process.env.PATH ?? '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    return { available: result.exitCode === 0 && /pip\s+\d/.test(result.stdout), wheelOnly: true, notes: [`pip3 --version exit=${result.exitCode}; ${result.stdout.trim()}; T2 host process shares the current OS user.`] };
  }
  async beginEnvironment(environmentId) {
    const target = path.join(this.root, 'environments', environmentId);
    const stage = path.join(this.root, 'staging', `${environmentId}-${randomUUID()}`);
    await fs.mkdir(path.dirname(stage), { recursive: true }); await fs.mkdir(stage, { recursive: true });
    try { await fs.cp(target, stage, { recursive: true, force: true }); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    let settled = false;
    return {
      root: stage,
      async writeText(relativePath, value) { const out = path.join(stage, relativePath); await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, value); },
      async runPip(args, indexUrl) {
        if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string') || args[0] !== 'install') return { exitCode: 126, stdout: '', stderr: 'fixed pip install command refused invocation' };
        const env = { PATH: process.env.PATH ?? '', HOME: path.join(stage, '.home'), TMPDIR: path.join(stage, '.tmp'), PIP_CONFIG_FILE: '/dev/null', PIP_DISABLE_PIP_VERSION_CHECK: '1', PIP_NO_INPUT: '1', PYTHONNOUSERSITE: '1' };
        await fs.mkdir(env.HOME, { recursive: true }); await fs.mkdir(env.TMPDIR, { recursive: true });
        const result = await run('pip3', args, { cwd: stage, env, stdio: ['ignore', 'pipe', 'pipe'] });
        return { ...result, stderr: `${result.stderr}\n[local-index=${indexUrl}]` };
      },
      async commit() {
        if (settled) throw new Error('pip environment transaction already settled'); settled = true;
        await fs.mkdir(path.dirname(target), { recursive: true });
        const backup = `${target}.backup-${randomUUID()}`; let hadTarget = false;
        try { await fs.rename(target, backup); hadTarget = true; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
        try { await fs.rename(stage, target); if (hadTarget) await fs.rm(backup, { recursive: true, force: true }); }
        catch (error) { if (hadTarget) await fs.rename(backup, target).catch(() => undefined); throw error; }
      },
      async rollback() { if (settled) return; settled = true; await fs.rm(stage, { recursive: true, force: true }); }
    };
  }
}
