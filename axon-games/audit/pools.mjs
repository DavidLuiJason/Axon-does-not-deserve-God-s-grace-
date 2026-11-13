import { GAMES } from '../src/catalogue.js';
import { createRound } from '../src/engine.js';
import { setRandomSource, createSeededRandom } from '../src/random.js';
import { writeFileSync } from 'node:fs';
const ids = process.argv.slice(2);
const out = {}; 
for (const g of GAMES) {
  if (ids.length && !ids.includes(g.id)) continue;
  const m = new Map();
  for (let tier = 1; tier <= 15; tier++) for (let level = 1; level <= 3; level++) for (let s = 0; s < 8; s++) {
    setRandomSource(createSeededRandom(tier * 1000 + level * 100 + s * 7 + 3));
    const r = createRound(g, tier, { level });
    const p = String(r.prompt || r.questionText || '').replace(/\n[\s\S]*$/, '').replace(/\s+/g, ' ');
    const key = p + ' || ' + JSON.stringify(r.answer);
    if (!m.has(key)) m.set(key, { tiers: new Set(), p, a: r.answer, c: r.choices });
    m.get(key).tiers.add(tier);
  }
  out[g.id] = [...m.values()].map(v => ({ p: v.p, a: v.a, c: v.c, t: [...v.tiers] }));
}
writeFileSync('audit/pools.json', JSON.stringify(out));
const counts = Object.entries(out).map(([k, v]) => [k, v.length]).sort((a, b) => a[1] - b[1]);
console.log(counts.map(([k, n]) => `${k}:${n}`).join(' '));
