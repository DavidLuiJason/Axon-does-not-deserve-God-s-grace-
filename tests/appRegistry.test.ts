/**
 * B04B4P4 (Director): every capability register function that src/main.tsx imports must also be CALLED there.
 * Why: registerDictionaryCapability and registerPlannedCapabilities were imported and never called (OPEN_ITEMS 44),
 * so the running app and the tests disagreed about what AXON can do.
 */
import { readFileSync } from 'node:fs';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }

const text = readFileSync('src/main.tsx', 'utf8');
const imported = [...text.matchAll(/import\s*\{\s*(register[A-Za-z]+)\s*\}\s*from\s*'\.\/(?:capabilities|interfaces)\//g)].map((match) => match[1]);
assert(imported.length >= 12, `main.tsx imports at least 12 register functions (found ${imported.length})`);
for (const name of imported) {
  const calls = text.split(`${name}();`).length - 1;
  assert(calls === 1, `${name} is called exactly once in main.tsx (found ${calls})`);
}
for (const name of ['registerDictionaryCapability', 'registerPlannedCapabilities']) assert(imported.includes(name), `${name} is imported`);
console.log(`APP REGISTRY OK: ${checks} checks (${imported.length} register functions, each imported and called once)`);
