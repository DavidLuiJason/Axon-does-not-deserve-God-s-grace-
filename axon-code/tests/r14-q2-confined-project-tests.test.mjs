import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runConfinedProjectTests as runConfinedStrict, buildPermissionArguments } from '../src/services/confinedProjectTestRunner.mjs';

// These tests exercise the permission confinement itself, so they also run where the system forbids a PID namespace; signal isolation has its own Director test.
const runConfinedProjectTests = (root, options = {}) => runConfinedStrict(root, { signalRisk: 'accept', ...options });
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

async function fixture(source) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q2-project-'));
  await writeFile(path.join(root, 'hostile.test.mjs'), source);
  return root;
}
async function cleanup(root) { await rm(root, { recursive: true, force: true }); }

const denyResult = (result) => assert.notEqual(result.status, 'TESTED', `hostile project unexpectedly passed: ${result.output}`);

test('Q2 Node permission runner executes a harmless real node --test project', async () => {
  const root = await fixture("import test from 'node:test'; import assert from 'node:assert/strict'; test('safe',()=>assert.equal(2+2,4));\n");
  try {
    const result = await runConfinedProjectTests(root);
    assert.equal(result.status, 'TESTED', result.output || result.reason);
    assert.equal(result.exitCode, 0);
    assert.equal(result.isolation, 'PROCESS_PERMISSION_CONFINEMENT');
  } finally { await cleanup(root); }
});

test('Q2 hostile project cannot read /etc/passwd', async () => {
  const root = await fixture("import test from 'node:test'; import fs from 'node:fs'; test('read outside',()=>fs.readFileSync('/etc/passwd'));\n");
  try { denyResult(await runConfinedProjectTests(root)); } finally { await cleanup(root); }
});

test('Q2 hostile project cannot spawn a child process', async () => {
  const root = await fixture("import test from 'node:test'; import {spawnSync} from 'node:child_process'; test('spawn',()=>spawnSync(process.execPath,['-e','process.exit(0)']));\n");
  try { denyResult(await runConfinedProjectTests(root)); } finally { await cleanup(root); }
});

test('Q2 hostile project cannot write outside the one scratch directory', async () => {
  const outside = path.join(os.tmpdir(), `axon-q2-outside-${process.pid}.txt`);
  const root = await fixture(`import test from 'node:test'; import fs from 'node:fs'; test('write outside',()=>fs.writeFileSync(${JSON.stringify(outside)},'bad'));\n`);
  try {
    denyResult(await runConfinedProjectTests(root));
    await assert.rejects(import('node:fs/promises').then(({ access }) => access(outside)));
  } finally { await cleanup(root); await rm(outside, { force: true }); }
});

test('Q2 hostile infinite loop is cut off by the outer wall-clock timeout', async () => {
  const root = await fixture("while (true) {}\n");
  try {
    const result = await runConfinedProjectTests(root, { timeoutMs: 250 });
    assert.equal(result.timedOut, true);
    assert.equal(result.status, 'FAILED');
  } finally { await cleanup(root); }
});

test('Q2 hostile endless output is cut off by the output cap', async () => {
  const root = await fixture("process.stdout.write('x'.repeat(65536)); setInterval(()=>process.stdout.write('x'.repeat(65536)),1);\n");
  try {
    const result = await runConfinedProjectTests(root, { timeoutMs: 2000, maxOutputBytes: 2048 });
    assert.equal(result.outputLimited, true);
    assert.equal(result.status, 'FAILED');
  } finally { await cleanup(root); }
});

test('Q2 hostile project receives no inherited environment secrets', async () => {
  const prior = process.env.AXON_Q2_SECRET;
  process.env.AXON_Q2_SECRET = 'must-not-cross-boundary';
  const root = await fixture("import test from 'node:test'; import assert from 'node:assert/strict'; test('secret absent',()=>assert.equal(process.env.AXON_Q2_SECRET,undefined));\n");
  try {
    const result = await runConfinedProjectTests(root);
    assert.equal(result.status, 'TESTED', result.output || result.reason);
    assert.doesNotMatch(result.output, /must-not-cross-boundary/);
  } finally {
    await cleanup(root);
    if (prior === undefined) delete process.env.AXON_Q2_SECRET;
    else process.env.AXON_Q2_SECRET = prior;
  }
});

test('Q2 runner rejects empty projects and does not grant child-process or worker permissions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'axon-q2-empty-'));
  try {
    const result = await runConfinedProjectTests(root);
    assert.equal(result.status, 'FAILED');
    const args = buildPermissionArguments({ projectRoot: root, scratchRoot: os.tmpdir(), testFiles: [] });
    assert.ok(args.includes('--permission'));
    assert.ok(!args.includes('--allow-child-process'));
    assert.ok(!args.includes('--allow-worker'));
    assert.ok(!args.includes('--allow-addons'));
  } finally { await cleanup(root); }
});

test('Q2 real compiled runner mutant removing --permission is caught', async () => {
  const needle = '"--permission",';
  const mutant = await compileRealModuleMutant('src/services/confinedProjectTestRunner.mjs', needle, '');
  try {
    const args = mutant.module.buildPermissionArguments({ projectRoot: '/tmp/project', scratchRoot: '/tmp/scratch', testFiles: [] });
    let detected = false;
    try { assert.ok(args.includes('--permission'), 'permission confinement must be enabled'); }
    catch { detected = true; }
    assert.equal(detected, true, 'the real permission guard mutant must fail the confinement assertion');
  } finally { await mutant.cleanup(); }
});

test('Q2 project services now route real project tests through the confined runner', async () => {
  const { runProjectTests } = await import('../src/services/projectServices.mjs');
  const root = await fixture("import test from 'node:test'; import assert from 'node:assert/strict'; test('wired',()=>assert.equal(true,true));\n");
  try {
    const result = await runProjectTests(root);
    assert.equal(result.status, 'TESTED', result.output || result.reason);
    assert.equal(result.isolation, 'PROCESS_PERMISSION_CONFINEMENT');
  } finally { await cleanup(root); }
});
