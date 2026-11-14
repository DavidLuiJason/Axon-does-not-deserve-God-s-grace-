// Director test (Round 14 verification): cancelling a PAUSED job, or a job that ignores SIGTERM, must really end the process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LinuxChildProcessHost } from '../src/jobs/linuxChildProcessHost.mjs';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function processGone(pid, withinMs) {
  const deadline = Date.now() + withinMs;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); } catch { return true; }
    try { if ((await fs.readFile(`/proc/${pid}/stat`, 'utf8')).split(') ')[1][0] === 'Z') return true; } catch { return true; }
    await wait(50);
  }
  return false;
}
async function startJob(HostClass, code) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-q1-director-'));
  const host = new HostClass({ workspaceRoot: workspace, allowedExecutables: [process.execPath], maxTimeMs: 20000 });
  const settled = host.run({ jobId: 'job-1', file: process.execPath, args: ['-e', code], cwd: workspace, timeLimitMs: 15000 }).then(() => 'settled', () => 'settled');
  await wait(500);
  const record = host.children.get('job-1');
  return { host, settled, pid: record.child.pid };
}

test('cancelling a PAUSED job ends the process and settles the job', async () => {
  const { host, settled, pid } = await startJob(LinuxChildProcessHost, 'while(true){}');
  assert.equal(host.pause('job-1'), true);
  assert.equal(host.cancel('job-1', 500), true);
  assert.equal(await processGone(pid, 3000), true, 'a cancelled paused process must be gone');
  assert.equal(await Promise.race([settled, wait(3000).then(() => 'stuck')]), 'settled');
});

test('NEGATIVE: a job that ignores SIGTERM is still ended by the hard kill after the grace period', async () => {
  const { host, settled, pid } = await startJob(LinuxChildProcessHost, "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
  assert.equal(host.cancel('job-1', 400), true);
  assert.equal(await processGone(pid, 3000), true, 'the hard kill must end a process that ignores SIGTERM');
  assert.equal(await Promise.race([settled, wait(3000).then(() => 'stuck')]), 'settled');
});

test('NEGATIVE: pause and resume refuse unknown jobs, and a paused job cannot be paused twice', async () => {
  const { host, pid } = await startJob(LinuxChildProcessHost, 'while(true){}');
  assert.equal(host.pause('nope'), false);
  assert.equal(host.resume('job-1'), false, 'a running job cannot be resumed');
  assert.equal(host.pause('job-1'), true);
  assert.equal(host.pause('job-1'), false);
  assert.equal(host.resume('job-1'), true);
  host.interrupt('job-1');
  assert.equal(await processGone(pid, 3000), true);
});

test('NEGATIVE (real mutant): the old cancel (SIGTERM only) leaves a paused job alive', async () => {
  const file = new URL('../src/jobs/linuxChildProcessHost.mjs', import.meta.url);
  const source = await fs.readFile(file, 'utf8');
  const a = "if (wasPaused) record.child.kill('SIGCONT');";
  const b = "record.child.kill('SIGKILL');\n    }, graceMs);";
  assert.ok(source.includes(a) && source.includes(b), 'the mutant must alter the real source');
  const mutantFile = path.join(path.dirname(file.pathname), `mutant-${process.pid}-linuxChildProcessHost.mjs`);
  await fs.writeFile(mutantFile, source.replace(a, '').replace(b, ';\n    }, graceMs);'));
  let pid;
  try {
    const { LinuxChildProcessHost: Mutant } = await import(pathToFileURL(mutantFile).href);
    const job = await startJob(Mutant, 'while(true){}');
    pid = job.pid;
    job.host.pause('job-1');
    job.host.cancel('job-1', 300);
    assert.equal(await processGone(pid, 1500), false, 'the mutant must leave the paused process alive, proving this suite can fail');
  } finally {
    if (pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    await fs.rm(mutantFile, { force: true });
  }
});
