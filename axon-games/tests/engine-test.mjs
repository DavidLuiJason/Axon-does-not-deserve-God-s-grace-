import assert from 'node:assert/strict';
import { GAMES } from '../src/catalogue.js';
import { createRound, validateAnswer } from '../src/engine.js';
const families = new Set();
for (const game of GAMES) {
  const round = createRound(game, 'Normal', {});
  assert.ok(round && typeof round.kind === 'string', `no round generated for ${game.name}`);
  assert.ok(round.title, `round missing title for ${game.name}`);
  families.add(round.kind);
  if (round.kind === 'input' || round.kind === 'text' || round.kind === 'choice' || round.kind === 'strategy' || round.kind === 'memory' || round.kind === 'set-memory') {
    const answer = round.kind === 'set-memory' ? round.answer.join(' ') : String(round.answer);
    assert.equal(validateAnswer(round, answer), true, `known answer rejected for ${game.name} (${round.kind})`);
  }
  if (round.kind === 'visual') {
    assert.ok(round.cells.length > 0 && round.cells.every(i => i >= 0 && i < round.size * round.size), `invalid visual grid for ${game.name}`);
  }
  if (round.kind === 'ttt') assert.equal(round.board.length, 9);
  if (round.kind === 'mastermind') assert.equal(round.code.length, 4);
}
assert.ok(families.size >= 6, `expected several real challenge kinds, got ${[...families]}`);
console.log(`PASS: generated and checked ${GAMES.length} rounds; ${families.size} runtime challenge kinds exercised.`);
console.log('LIMIT: generated-round validation is not a substitute for end-to-end UI gameplay or named-board-game rules tests.');
