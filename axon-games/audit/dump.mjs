import { GAMES } from '../src/catalogue.js';
import { createRound } from '../src/engine.js';
import { setRandomSource, createSeededRandom } from '../src/random.js';
const [from, to, tier = 6, level = 2] = process.argv.slice(2).map(Number);
GAMES.slice(from, to).forEach((g, i) => {
  setRandomSource(createSeededRandom(42 + from + i));
  const r = createRound(g, tier, { level });
  const c = s => String(s ?? '').replace(/\s+/g, ' ');
  const extra = r.seq ? ` seq=${r.seq.join(',')} mode=${r.mode ?? ''}` : r.cells ? ` cells=${r.cells.join(',')}` : r.heaps ? ` heaps=${r.heaps}` : '';
  console.log(`${from + i}|${g.id}|${r.kind}|${c(r.prompt||r.questionText).slice(0, 230)}|Q:${c(r.question).slice(0, 90)}|A:${c(Array.isArray(r.answer) ? r.answer.join(' ') : r.answer).slice(0, 50)}|C:${(r.choices || []).join(' / ').slice(0, 90)}${extra}`);
});
