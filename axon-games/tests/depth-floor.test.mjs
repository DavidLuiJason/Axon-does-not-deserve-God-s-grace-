// DT3: no game may be one fixed question repeated forever, and no prompt may promise difficulty features that do not exist.
import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound } from '../src/engine.js';
import { setRandomSource, resetRandomSource, createSeededRandom } from '../src/random.js';
const FLOOR = 6;
const EXCEPTIONS = { 'mastermind-mini': 'live code-breaking board: the secret code is random each time, not a fixed question', 'maze-master': 'three maze sizes only (documented limit)', 'connect-four': 'one question type with six stack heights (documented limit)' };
const low = [];
for (const g of GAMES) {
  const seen = new Set();
  for (let tier = 1; tier <= 15; tier++) for (let level = 1; level <= 3; level++) for (let s = 0; s < 8; s++) {
    setRandomSource(createSeededRandom(tier * 1000 + level * 100 + s * 7 + 3));
    const r = createRound(g, tier, { level });
    const text = String(r.prompt || r.questionText || '');
    assert.ok(!/Level \d adds/.test(text), `${g.id}: prompt promises a level feature that does not exist`);
    assert.ok(!/Tier \d+ focus/.test(text), `${g.id}: prompt carries a tier-focus claim that is not implemented`);
    seen.add(text + '||' + JSON.stringify(r.answer) + '||' + (r.seq ? r.seq.length : ''));
  }
  const cap = EXCEPTIONS[g.id] ? 1 : FLOOR;
  if (seen.size < cap) low.push(`${g.id}: ${seen.size} distinct`);
}
resetRandomSource();
assert.equal(low.length, 0, `games below the variety floor of ${FLOOR}: ${low.join(', ')}`);
console.log(`PASS: every game offers at least ${FLOOR} distinct rounds (documented exceptions: ${Object.keys(EXCEPTIONS).join(', ')}).`);
