// Director test (Round 14 verification): both local servers (managed preview, UI server) must refuse requests whose Host header is not
// the loopback server itself. Without it a malicious web page can reach them through DNS rebinding and read the user's project files.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const request = (port, headers = {}, urlPath = '/') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'GET', headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject); req.end();
});
async function mutantOf(relativePath, from, to) {
  const file = path.join(root, relativePath);
  const source = await fs.readFile(file, 'utf8');
  assert.ok(source.includes(from), `the mutant must alter the real source (${relativePath})`);
  const mutantFile = path.join(path.dirname(file), `mutant-${process.pid}-${path.basename(file)}`);
  await fs.writeFile(mutantFile, source.replace(from, to));
  return { module: await import(`${pathToFileURL(mutantFile).href}?m=${Date.now()}`), cleanup: () => fs.rm(mutantFile, { force: true }) };
}

before(() => { execFileSync(process.execPath, ['tools/build-ui.mjs'], { cwd: root, stdio: 'ignore' }); });

test('managed preview: normal and localhost Host headers are served, a foreign Host is refused (421)', async () => {
  const { createManagedPreview } = await import('../src/preview/managedPreviewServer.mjs');
  const preview = createManagedPreview({ files: { 'index.html': '<h1>x</h1>' } });
  const port = await preview.start();
  try {
    assert.equal(await request(port), 200);
    assert.equal(await request(port, { Host: `localhost:${port}` }), 200);
    for (const host of [`evil.example:${port}`, `evil.example`, `127.0.0.1.evil.example:${port}`, `127.0.0.1:${port + 1}`, 'x']) assert.equal(await request(port, { Host: host }), 421, `Host "${host}" must be refused`);
  } finally { await preview.stop(); }
});

test('UI server: normal Host is served, a foreign Host is refused (421), traversal still refused', async () => {
  const { createUiServer } = await import('../tools/serve-ui.mjs');
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'axon-ui-director-')));
  await fs.writeFile(path.join(dir, 'index.html'), 'ok');
  const server = createUiServer({ directory: dir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(await request(port, {}, '/index.html'), 200);
    assert.equal(await request(port, { Host: `evil.example:${port}` }, '/index.html'), 421);
    assert.equal(await request(port, {}, '/%2e%2e/etc/passwd'), 400);
  } finally { server.close(); }
});

test('NEGATIVE (real mutant): the managed preview without the Host check serves a foreign Host', async () => {
  const mutant = await mutantOf('src/preview/managedPreviewServer.mjs', 'if(hostHeader!==`127.0.0.1:${localPort}`&&hostHeader!==`localhost:${localPort}`)', 'if(false)');
  try {
    const preview = mutant.module.createManagedPreview({ files: { 'index.html': 'x' } });
    const port = await preview.start();
    assert.equal(await request(port, { Host: `evil.example:${port}` }), 200, 'the mutant must serve it, proving this suite can fail');
    await preview.stop();
  } finally { await mutant.cleanup(); }
});

test('NEGATIVE (real mutant): the UI server without the Host check serves a foreign Host', async () => {
  const mutant = await mutantOf('tools/serve-ui.mjs', "if(!hostAllowed(req,res.socket))throw new Error('BAD_HOST');", '');
  try {
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'axon-ui-mutant-')));
    await fs.writeFile(path.join(dir, 'index.html'), 'ok');
    const server = mutant.module.createUiServer({ directory: dir });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    assert.equal(await request(port, { Host: `evil.example:${port}` }, '/index.html'), 200);
    server.close();
  } finally { await mutant.cleanup(); }
});
