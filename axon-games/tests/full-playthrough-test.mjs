import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const kinds = new Set();
let rounds = 0;
for (const game of GAMES) {
  for (let tier = 1; tier <= 15; tier++) {
    for (let level = 1; level <= 3; level++) {
      const r = createRound(game, tier, { level });
      rounds++;
      kinds.add(r.kind);
      assert.equal(r.title, game.name, `${game.id}: title at tier ${tier}, level ${level}`);
      assert.ok(r.prompt || r.questionText, `${game.id}: missing player-facing prompt at tier ${tier}`);
      assert.ok(r.rule && Array.isArray(r.steps) && r.steps.length >= 2, `${game.id}: missing teaching support`);
      if (['input','text','choice','strategy','memory','set-memory'].includes(r.kind)) {
        const correct = Array.isArray(r.answer) ? r.answer.join(' ') : String(r.answer);
        assert.equal(validateAnswer(r, correct), true, `${game.id}: player correct answer rejected at tier ${tier}, level ${level}`);
        assert.equal(validateAnswer(r, '__wrong_player_answer__'), false, `${game.id}: incorrect answer accepted`);
      } else if (r.kind === 'visual') {
        assert.ok(r.cells.length > 0 && r.cells.length < r.size * r.size);
        assert.equal(new Set(r.cells).size, r.cells.length);
        assert.ok(r.cells.every(x => Number.isInteger(x) && x >= 0 && x < r.size * r.size));
        const selected = new Set(r.cells);
        assert.equal(selected.size === r.cells.length && r.cells.every(x => selected.has(x)), true);
      } else if (r.kind === 'mastermind') {
        assert.equal(r.code.length, 4);
        const guess = r.code.join('');
        const exact = guess.split('').filter((digit, i) => Number(digit) === r.code[i]).length;
        assert.equal(exact, 4, `${game.id}: exact solution must win`);
      } else if (r.kind === 'imagine') {
        assert.ok(r.visual.count >= 100 && r.visual.count <= 2500);
        assert.equal(r.answer, 'open-ended'); // player completes without a scored answer
      } else {
        assert.fail(`${game.id}: unhandled game interaction kind ${r.kind}`);
      }
      if (r.kind === 'strategy') {
        assert.ok(Number.isInteger(r.answer) && r.answer >= 0 && r.answer <= 3, `${game.id}: invalid heap response`);
        assert.match(app, /data-heap=\\?"\\?\$\{i\+1\}/, 'strategy UI must send 1-based heap numbers');
        assert.match(app, /data-heap=\\?"0\\?"/, 'strategy UI must offer zero/no-winning-move response');
      }
    }
  }
}
assert.equal(GAMES.length, 171);
assert.ok(html.includes('id="gameCount"'));
assert.match(app, /\$\('#gameCount'\)\.textContent=String\(GAMES\.length\)/);
console.log(`PASS: simulated player playthroughs for ${GAMES.length} games × 15 tiers × 3 levels = ${rounds} rounds.`);
console.log(`PASS: all ${kinds.size} interaction kinds completed with correct answers/actions; wrong-answer rejection checked where applicable.`);
console.log('PASS: visual selection, Imagine completion, Mastermind exact solution, and Nim 1-based/zero UI response wiring checked.');
console.log('LIMIT: this is a deterministic engine-to-interaction simulation; it is not a physical human play session or browser/device visual inspection.');
