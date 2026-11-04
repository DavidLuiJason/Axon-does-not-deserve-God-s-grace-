// tools/wire-write.mjs: DIRECTOR TOOL, the ONE writer of auto-wiring (part 2). It writes ONLY the six generated files in src/generated/
// (never a hand file, never a delete). All or nothing: any bad or refused card means nothing is written. No clock, no random, no network.
// Usage: node tools/wire-write.mjs           (write the generated files; prints WROTE / SAME per file)
//        node tools/wire-write.mjs --check   (write nothing; exit 1 if a generated file is stale)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { plan, render, GENERATED_FILES } from './wire.mjs';

const OUT_DIR = 'src/generated';
const root = process.cwd(), checkOnly = process.argv.includes('--check');
const pl = plan(root);
for (const s of pl.skipped) console.log(`SKIPPED ${s}`);
for (const r of pl.refused) console.log(`REFUSED ${r}`);
if (pl.skipped.length || pl.refused.length) { console.log('WIRE WRITE: nothing written (fix the cards above)'); process.exit(1); }
const files = render(pl);
let stale = 0;
for (const name of GENERATED_FILES) {
  const path = join(root, OUT_DIR, name);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === files[name]) { console.log(`SAME  ${OUT_DIR}/${name}`); continue; }
  stale++;
  if (checkOnly) { console.log(`STALE ${OUT_DIR}/${name}`); continue; }
  mkdirSync(join(root, OUT_DIR), { recursive: true });
  writeFileSync(path, files[name]);
  console.log(`WROTE ${OUT_DIR}/${name}`);
}
console.log(`WIRE WRITE${checkOnly ? ' CHECK' : ''}: ${pl.items.length} card(s), ${stale} file(s) ${checkOnly ? 'stale' : 'written'}`);
process.exit(checkOnly && stale ? 1 : 0);
