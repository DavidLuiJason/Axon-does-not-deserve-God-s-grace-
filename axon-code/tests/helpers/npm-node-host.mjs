import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function run(executable, args, options) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, options);
    let stdout = ''; let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > 2 * 1024 * 1024) child.kill('SIGKILL'); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 2 * 1024 * 1024) child.kill('SIGKILL'); });
    child.on('error', error => resolve({ exitCode: 127, stdout, stderr: `${stderr}\n${String(error)}` }));
    child.on('close', code => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

export class NodeNpmHost {
  constructor(root) { this.root = root; this.cacheDir = path.join(root, '.npm-cache'); }
  async probe() {
    const result = await run('npm', ['--version'], { cwd: this.root, env: { PATH: process.env.PATH ?? '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    return { available: result.exitCode === 0 && /^\d+\.\d+/.test(result.stdout.trim()), stagingTransactions: true, fixedNpmExecutable: true, scriptsCanBeDisabled: true, notes: [`npm --version exit=${result.exitCode}; version=${result.stdout.trim()}`] };
  }
  async fetchBytes(url, maxBytes) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    if (!response.ok || response.status >= 300) throw new Error(`registry fetch refused: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error(`registry artifact exceeds ${maxBytes} bytes`);
    return bytes;
  }
  async beginEnvironment(environmentId) {
    const target = path.join(this.root, 'environments', environmentId);
    const stage = path.join(this.root, 'staging', `${environmentId}-${randomUUID()}`);
    await fs.mkdir(path.dirname(stage), { recursive: true });
    await fs.mkdir(stage, { recursive: true });
    try { await fs.cp(target, stage, { recursive: true, errorOnExist: false, force: true }); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    await fs.mkdir(this.cacheDir, { recursive: true });
    let settled = false;
    return {
      root: stage,
      cacheDir: this.cacheDir,
      async writeText(relativePath, value) { const out = path.join(stage, relativePath); await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, value); },
      async readText(relativePath) { try { return await fs.readFile(path.join(stage, relativePath), 'utf8'); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; } },
      async runNpm(args, registryUrl, offline) {
        if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string') || !['install', 'ci', 'uninstall'].includes(args[0])) return { exitCode: 126, stdout: '', stderr: 'fixed npm command allow-list refused invocation' };
        const env = {
          PATH: process.env.PATH ?? '', HOME: path.join(stage, '.home'), TMPDIR: path.join(stage, '.tmp'),
          npm_config_userconfig: path.join(stage, '.empty-npmrc'), npm_config_globalconfig: path.join(stage, '.empty-global-npmrc'),
          npm_config_registry: registryUrl, npm_config_cache: path.join(stage, '..', '..', '.npm-cache'),
          npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false',
          npm_config_fetch_retries: '0', npm_config_fetch_timeout: '5000', npm_config_fetch_retry_mintimeout: '100', npm_config_fetch_retry_maxtimeout: '100',
          npm_config_offline: offline ? 'true' : 'false',
          ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {})
        };
        await fs.mkdir(env.HOME, { recursive: true }); await fs.mkdir(env.TMPDIR, { recursive: true });
        return run('npm', [...args, '--cache', env.npm_config_cache], { cwd: stage, env, stdio: ['ignore', 'pipe', 'pipe'] });
      },
      async commit() {
        if (settled) throw new Error('npm environment transaction already settled');
        settled = true;
        const backup = `${target}.backup-${randomUUID()}`;
        await fs.mkdir(path.dirname(target), { recursive: true });
        let hadTarget = false;
        try { await fs.rename(target, backup); hadTarget = true; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
        try { await fs.rename(stage, target); if (hadTarget) await fs.rm(backup, { recursive: true, force: true }); }
        catch (error) { if (hadTarget) await fs.rename(backup, target).catch(() => undefined); throw error; }
      },
      async rollback() { if (settled) return; settled = true; await fs.rm(stage, { recursive: true, force: true }); }
    };
  }
}

export async function makeNpmFixturePackage(root, { name = 'axon-local-fixture', version = '1.0.0', script = false } = {}) {
  const packageDir = path.join(root, 'fixture-package');
  const packDir = path.join(root, 'fixture-tarballs');
  await fs.mkdir(packageDir, { recursive: true }); await fs.mkdir(packDir, { recursive: true });
  const packageJson = { name, version, main: 'index.js', ...(script ? { scripts: { preinstall: 'node -e "require(\'fs\').writeFileSync(\'INSTALL_SCRIPT_RAN\', \'yes\')"' } } : {}) };
  await fs.writeFile(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  await fs.writeFile(path.join(packageDir, 'index.js'), `module.exports = ${JSON.stringify(`${name}@${version}`)};\n`);
  const packed = await run('npm', ['pack', '--ignore-scripts', '--pack-destination', packDir], { cwd: packageDir, env: { PATH: process.env.PATH ?? '', HOME: root }, stdio: ['ignore', 'pipe', 'pipe'] });
  if (packed.exitCode !== 0) throw new Error(`npm pack fixture failed: ${packed.stderr}`);
  const filename = `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
  return { packageDir, packDir, tarballPath: path.join(packDir, filename), packageJson };
}
