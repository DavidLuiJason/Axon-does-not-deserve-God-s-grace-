import { GAMES } from '../src/catalogue.js';
import { createRound } from '../src/engine.js';
import { setRandomSource, resetRandomSource, createSeededRandom } from '../src/random.js';
import { readFileSync, writeFileSync } from 'node:fs';
const cov = new Set(JSON.parse(readFileSync(process.argv[2] || '/tmp/oracle_cov.json', 'utf8')));
const NOTE = {};
const set = (ids, n) => ids.forEach(i => NOTE[i] = n);
set(['chess','chess-tactics','checkmate-in-one','checkmate-in-two','chess-position-memory','blindfold-chess','chess-endgame-challenge','draughts','go','reversi','hex'], 'Rules and concept questions only. There is no playable board or engine.');
set(['flash-grid','pattern-reproduction','shape-sequence','spot-the-difference','image-recall'], 'All five share one mechanic: memorise highlighted grid cells. The name overstates what is built (no shapes, no image comparison).');
set(['connect-four','tic-tac-toe-master'], 'A position puzzle (landing row / completing square), not a playable game.');
set(['nim'], 'Real nim-sum puzzle; every winning heap is accepted.');
set(['mastermind','mastermind-mini'], 'mastermind = rules question; mastermind-mini = real playable code-breaking.');
set(['imagine'], 'Open-ended, never scored.');
set(['maze-master'], 'Serpentine routes on three sizes; not a real maze search.');
set(['what-would-you-do','find-a-way-to-escape','the-detective','the-investigator','the-interrogator','the-negotiator','the-strategist','the-paradox','the-survival-planner','the-experimenter','the-deceiver','the-systems-breaker','alternative-uses','the-architect'], 'Judgement question with one curated best answer. Correct by review, not by calculation.');
set(['synonym-challenge','antonym-challenge','vocabulary-ladder','word-relationships','letter-sequence-memory','word-recall','hidden-object-memory','visual-change-detection','color-sequence','tangram-challenge','visual-rotation','cube-net','abstract-odd-one-out','word-chain'], 'Fixed word or fact pools; checked by review and by structural rules.');
const rows = []; let tf = 0;
for (const g of GAMES) {
  const sig = (tiers) => { const s = new Set(); let kind = ''; for (const tier of tiers) for (let level = 1; level <= 3; level++) for (let k = 0; k < 6; k++) { setRandomSource(createSeededRandom(tier * 1000 + level * 100 + k * 7 + 3)); const r = createRound(g, tier, { level }); kind = r.kind; s.add(String(r.prompt || r.questionText || '').replace(/\s+/g, ' ') + '|' + JSON.stringify(r.answer) + '|' + (r.seq ? r.seq.length : '') + '|' + (r.cells ? r.cells.length : '')); } return { s, kind }; };
  const lo = sig([1, 2, 3, 4, 5]), hi = sig([11, 12, 13, 14, 15]); const all = new Set([...lo.s, ...hi.s]);
  const flat = [...lo.s].every(x => hi.s.has(x)) && [...hi.s].every(x => lo.s.has(x)); if (flat) tf++;
  rows.push(`| ${rows.length + 1} | ${g.id} | ${g.category} | ${lo.kind} | ${all.size}+ | ${flat ? 'flat' : 'scales'} | ${cov.has(g.id) ? 'recomputed' : 'reviewed'} | ${NOTE[g.id] || ''} |`);
}
resetRandomSource();
const head = `# AXON Games Lab — honest inventory (DT3)\n\nMeasured on the code in this package. "Distinct" counts different questions seen across 5 low tiers + 5 high tiers x 3 levels x 6 seeds (a lower bound). "flat" = the low and high tiers draw the same questions, so difficulty does not grow with the tier. "recomputed" = every round's answer was recalculated independently by tests/oracle-audit.test.mjs; "reviewed" = checked by reading the question pools, not by calculation.\n\nTotals: ${GAMES.length} games; ${rows.filter(r => r.includes('| recomputed |')).length} recomputed, ${rows.filter(r => r.includes('| reviewed |')).length} reviewed; ${tf} tier-flat.\n\n| # | id | category | round kind | distinct | tiers | answers | note |\n|---|---|---|---|---|---|---|---|\n`;
writeFileSync(process.argv[3] || 'docs/GAMES_INVENTORY.md', head + rows.join('\n') + '\n');
console.log(`inventory: ${GAMES.length} games, recomputed ${rows.filter(r => r.includes('| recomputed |')).length}, reviewed ${rows.filter(r => r.includes('| reviewed |')).length}, tier-flat ${tf}`);
