// Usage: node run.mjs tests/someRunner.test.ts   (no install; Node 22 or newer strips the types itself)
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: node run.mjs <file.ts>'); process.exit(2); }
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) { console.error(`NOT RUN: Node ${process.versions.node} cannot strip types; use Node 22 or newer`); process.exit(2); }
// Older Node 22 builds need a flag to strip types: start again once with the flag.
if (!process.features.typescript && !process.env.AXON_RUN_RESPAWN) {
  const again = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, AXON_RUN_RESPAWN: '1' } });
  process.exit(again.status ?? 1);
}
register('./register.mjs', import.meta.url);
await import(pathToFileURL(resolve(file)).href);
