// Director test (Round 14 verification): the Node permission model does not stop process.kill, so a hostile project test could kill
// other processes of the same user, including the AXON Code host. The confined runner must either run the test in its own PID
// namespace (the victim survives) or refuse to run it (BLOCKED) unless the caller accepts the risk.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runConfinedProjectTests } from '../src/services/confinedProjectTestRunner.mjs';

const isAlive = async (pid) => {
  try { process.kill(pid, 0); } catch { return false; }
  try { return (await fs.readFile(`/proc/${pid}/stat`, 'utf8')).split(' ')[2] !== 'Z'; } catch { return true; }
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

async function killerProject(victimPid) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-q2-killer-'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.writeFile(path.join(dir, 'a.test.mjs'), `import test from 'node:test';\ntest('kills a neighbour', () => { process.kill(${victimPid}, 'SIGKILL'); });\n`);
  return dir;
}
async function withVictim(run) {
  const victim = spawn('sleep', ['120'], { stdio: 'ignore' });
  try { return await run(victim.pid); } finally { try { process.kill(victim.pid, 'SIGKILL'); } catch { /* already gone */ } }
}
async function mutantRunner(from, to) {
  const file = path.join(path.dirname(new URL('../src/services/confinedProjectTestRunner.mjs', import.meta.url).pathname), `mutant-${process.pid}-${Date.now()}.mjs`);
  const source = await fs.readFile(new URL('../src/services/confinedProjectTestRunner.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes(from), 'the mutant must alter the real source');
  await fs.writeFile(file, source.replace(from, to));
  return { module: await import(pathToFileURL(file).href), cleanup: () => fs.rm(file, { force: true }) };
}

test('NEGATIVE: a hostile test cannot kill a neighbouring process (isolated, or refused)', async () => {
  await withVictim(async (pid) => {
    const dir = await killerProject(pid);
    const result = await runConfinedProjectTests(dir, { timeoutMs: 4000 });
    await settle();
    assert.equal(await isAlive(pid), true, 'the neighbouring process must survive');
    assert.notEqual(result.status, 'TESTED', 'a run that tried to kill a neighbour must not be reported as passed');
    assert.equal(typeof result.signalIsolation === 'boolean' || result.status === 'BLOCKED', true);
  });
});

test('a harmless project reports whether signals were isolated, honestly', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-q2-ok-'));
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await fs.writeFile(path.join(dir, 'a.test.mjs'), "import test from 'node:test';\ntest('ok', () => {});\n");
  const result = await runConfinedProjectTests(dir, { timeoutMs: 4000 });
  if (result.status === 'BLOCKED') { assert.match(result.reason, /NO_SIGNAL_ISOLATION/); assert.equal(result.signalIsolation, false); return; }
  assert.equal(result.status, 'TESTED');
  assert.equal(result.signalIsolation, true);
  assert.equal(result.isolationDetail, 'WITH_PID_NAMESPACE');
});

test('NEGATIVE: without a PID namespace and without the explicit risk flag the run is BLOCKED', async () => {
  const mutant = await mutantRunner('const signalIsolated = hasPidNamespace();', 'const signalIsolated = false;');
  try {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'axon-q2-nons-'));
    await fs.writeFile(path.join(dir, 'a.test.mjs'), "import test from 'node:test';\ntest('ok', () => {});\n");
    const result = await mutant.module.runConfinedProjectTests(dir, {});
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /NO_SIGNAL_ISOLATION/);
    assert.equal(result.signalIsolation, false);
  } finally { await mutant.cleanup(); }
});

test('NEGATIVE (real mutant): with isolation removed and the risk accepted, the hostile test DOES kill the neighbour', async () => {
  const mutant = await mutantRunner('const signalIsolated = hasPidNamespace();', 'const signalIsolated = false;');
  try {
    await withVictim(async (pid) => {
      const dir = await killerProject(pid);
      await mutant.module.runConfinedProjectTests(dir, { timeoutMs: 4000, signalRisk: 'accept' });
      await settle();
      assert.equal(await isAlive(pid), false, 'the mutant must let the attack succeed, proving this suite can fail');
    });
  } finally { await mutant.cleanup(); }
});
