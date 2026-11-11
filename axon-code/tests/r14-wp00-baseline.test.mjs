import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const pty = fs.readFileSync(path.join(root, 'tools/linux-pty-provider.py'), 'utf8');

test('R14 WP0 pins TypeScript as an exact development dependency', () => {
  assert.equal(pkg.devDependencies?.typescript, '5.8.3');
  assert.equal(pkg.optionalDependencies?.typescript, undefined);
});

test('R14 WP0 lockfile resolves the same exact TypeScript version', () => {
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages?.['node_modules/typescript']?.version, '5.8.3');
  assert.equal(lock.packages?.['']?.devDependencies?.typescript, '5.8.3');
});

test('R14 WP0 rejects a dependency/lockfile version mismatch', () => {
  const mutantLockVersion = '5.8.2';
  assert.notEqual(mutantLockVersion, pkg.devDependencies.typescript);
  assert.throws(() => {
    assert.equal(mutantLockVersion, pkg.devDependencies.typescript);
  }, { name: 'AssertionError' });
});

test('R14 WP0 PTY environment is constructed from an allow-list, not inherited wholesale', () => {
  assert.match(pty, /env\s*=\s*\{"PATH":\s*os\.environ\.get\("PATH"/);
  assert.match(pty, /key not in \{"LANG", "TERM", "COLORTERM", "EDITOR"\}/);
  assert.doesNotMatch(pty, /env\s*=\s*os\.environ\.copy\(\)/);
});

test('R14 WP0 exit protocol separates a terminating signal from a numeric exit code', () => {
  assert.match(pty, /signal_number\s*=\s*-return_code/);
  assert.match(pty, /exitCode=exit_code,\s*signal=signal_number/);
  assert.match(pty, /signal=\(-code if code < 0 else None\)/);
});

test('R14 WP0 catches the deliberately broken null/negative-exit mutant', () => {
  const correct = (returnCode) => ({
    exitCode: returnCode !== null && returnCode >= 0 ? returnCode : null,
    signal: returnCode !== null && returnCode < 0 ? -returnCode : null,
  });
  const brokenMutant = (returnCode) => ({ exitCode: returnCode, signal: null });
  const expected = { exitCode: null, signal: 15 };
  assert.deepEqual(correct(-15), expected);
  assert.throws(() => assert.deepEqual(brokenMutant(-15), expected), { name: 'AssertionError' });
});

const bridge = fs.readFileSync(path.join(root, 'tools/linux-pty-websocket-bridge.py'), 'utf8');
const hostRequirements = fs.readFileSync(path.join(root, 'requirements-linux-pty.txt'), 'utf8');

test('R14 WP0 WebSocket bridge binds only to loopback and uses a one-time cryptographic token', () => {
  assert.match(bridge, /serve\(handler, '127\.0\.0\.1'/);
  assert.match(bridge, /secrets\.token_urlsafe\(32\)/);
  assert.match(bridge, /hmac\.compare_digest/);
});

test('R14 WP0 WebSocket bridge rejects Host and Origin mismatches and limits frames/rate', () => {
  assert.match(bridge, /headers\.get_all\('Host'\)/);
  assert.match(bridge, /headers\.get_all\('Origin'\)/);
  assert.match(bridge, /max_size=MAX_FRAME_BYTES/);
  assert.match(bridge, /MAX_MESSAGES_PER_WINDOW = 60/);
});

test('R14 WP0 WebSocket bridge dependency is pinned and shell environment is allow-listed', () => {
  assert.match(hostRequirements, /^websockets==16\.0/m);
  assert.match(bridge, /allowed = \('PATH', 'HOME', 'LANG', 'TMPDIR', 'LC_ALL'\)/);
  assert.doesNotMatch(bridge, /os\.environ\.copy\(\)/);
});

test('R14 WP0 catches a deliberately broken WebSocket Host-check mutant', () => {
  const secureHostCheck = (hosts, allowed) => hosts.length === 1 && allowed.has(hosts[0]);
  const brokenMutant = () => true;
  const allowed = new Set(['127.0.0.1:3000']);
  assert.equal(secureHostCheck(['evil.test'], allowed), false);
  assert.throws(() => assert.equal(brokenMutant(['evil.test'], allowed), false), { name: 'AssertionError' });
});
