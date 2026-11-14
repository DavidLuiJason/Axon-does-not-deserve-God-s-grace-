import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';

/** Linux child-process host. Commands are argv-only and executables are allowlisted. */
export class LinuxChildProcessHost {
  constructor({ workspaceRoot, allowedExecutables, maxOutputBytes = 64 * 1024, maxTimeMs = 30_000 } = {}) {
    if (process.platform !== 'linux') throw new Error('LINUX_PROCESS_HOST_REQUIRED');
    if (!workspaceRoot || !Array.isArray(allowedExecutables) || allowedExecutables.length === 0) {
      throw new Error('PROCESS_HOST_CONFIGURATION_REQUIRED');
    }
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.allowedExecutables = new Set(allowedExecutables.map((item) => path.resolve(item)));
    this.maxOutputBytes = maxOutputBytes;
    this.maxTimeMs = maxTimeMs;
    this.children = new Map();
  }

  async run({ jobId, file, args = [], cwd, signal, timeLimitMs } = {}) {
    if (!jobId || this.children.has(jobId)) throw new Error('DUPLICATE_PROCESS_JOB');
    const executable = path.resolve(String(file || ''));
    if (!this.allowedExecutables.has(executable)) throw new Error('EXECUTABLE_NOT_ALLOWED');
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' || arg.length > 4096)) {
      throw new Error('INVALID_PROCESS_ARGUMENTS');
    }
    const root = await realpath(this.workspaceRoot);
    const workingDirectory = await realpath(path.resolve(cwd || root));
    if (workingDirectory !== root && !workingDirectory.startsWith(`${root}${path.sep}`)) {
      throw new Error('PROCESS_CWD_OUTSIDE_WORKSPACE');
    }

    const child = spawn(executable, args, {
      cwd: workingDirectory,
      shell: false,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: '/usr/bin:/bin', HOME: workingDirectory, TMPDIR: workingDirectory, LANG: 'C.UTF-8' },
    });
    let output = '';
    let outputBytes = 0;
    let settled = false;
    let timer;
    const record = { child, state: 'running', output: () => output };
    this.children.set(jobId, record);

    const append = (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > this.maxOutputBytes) {
        child.kill('SIGKILL');
        return;
      }
      output += chunk.toString('utf8');
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const result = await new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.children.delete(jobId);
        if (error) reject(error);
        else resolve(value);
      };
      const onAbort = () => {
        child.kill('SIGTERM');
        finish(new Error('JOB_CANCELLED'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error('TIME_LIMIT'));
      }, Math.max(1, Math.min(Number(timeLimitMs) || this.maxTimeMs, this.maxTimeMs)));
      timer.unref?.();
      child.once('error', (error) => finish(error));
      child.once('close', (code, signalName) => {
        if (outputBytes > this.maxOutputBytes) return finish(new Error('OUTPUT_LIMIT'));
        finish(null, { output, exitCode: code, signal: signalName || null });
      });
    });
    return result;
  }

  pause(jobId) {
    const record = this.children.get(jobId);
    if (!record || record.state !== 'running' || !record.child.pid) return false;
    process.kill(record.child.pid, 'SIGSTOP');
    record.state = 'paused';
    return true;
  }

  resume(jobId) {
    const record = this.children.get(jobId);
    if (!record || record.state !== 'paused' || !record.child.pid) return false;
    process.kill(record.child.pid, 'SIGCONT');
    record.state = 'running';
    return true;
  }

  /**
   * Director fix (Round 14 verification): a process stopped by pause() cannot act on SIGTERM until it is continued, so cancelling a
   * paused job left the process alive and the job never settled; and a process that ignores SIGTERM could never be cancelled.
   * Cancel now continues a paused process after sending SIGTERM and ends it with SIGKILL when it has not exited within graceMs.
   */
  cancel(jobId, graceMs = 2000) {
    const record = this.children.get(jobId);
    if (!record) return false;
    const wasPaused = record.state === 'paused';
    record.state = 'stopping';
    record.child.kill('SIGTERM');
    if (wasPaused) record.child.kill('SIGCONT');
    const hardKill = setTimeout(() => {
      if (record.child.exitCode === null && record.child.signalCode === null) record.child.kill('SIGKILL');
    }, graceMs);
    hardKill.unref?.();
    record.child.once('close', () => clearTimeout(hardKill));
    return true;
  }

  interrupt(jobId) {
    const record = this.children.get(jobId);
    if (!record) return false;
    record.child.kill('SIGKILL');
    record.state = 'interrupted';
    return true;
  }

  async stopAll() {
    const rows = [...this.children.values()];
    for (const row of rows) row.child.kill('SIGTERM');
    await Promise.all(rows.map((row) => new Promise((resolve) => {
      if (row.child.exitCode !== null || row.child.signalCode !== null) return resolve();
      row.child.once('close', resolve);
      setTimeout(() => { row.child.kill('SIGKILL'); resolve(); }, 500).unref?.();
    })));
  }
}
