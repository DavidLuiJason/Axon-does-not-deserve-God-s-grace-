/** AXON Games public API (DT3, GAMES2): listing, rounds, answer checking, bounds, replay. */
import assert from 'node:assert/strict';
import {
  AXON_GAMES_CATALOG_ENTRY, GAME_TIER_COUNT, checkAnswer, createSeededRandom, gamesInCategory, getGame,
  levelsInTier, listCategories, listGames, resetRandomSource, setRandomSource, startRound,
} from '../src/games';

assert.equal(listGames().length, 171, '171 games');
assert.equal(new Set(listGames().map((g) => g.id)).size, 171, 'game ids are unique');
const categories = listCategories();
assert.equal(categories.reduce((n, c) => n + c.count, 0), 171, 'every game sits in exactly one category');
assert.ok(categories.every((c) => gamesInCategory(c.category).length === c.count), 'category counts match the lists');
assert.equal(getGame('no-such-game'), undefined);
assert.equal(AXON_GAMES_CATALOG_ENTRY.id, 'axon-games');

let rounds = 0;
for (const game of listGames()) {
  for (let tier = 1; tier <= GAME_TIER_COUNT; tier++) {
    const levels = levelsInTier(game.id, tier);
    assert.ok(Number.isInteger(levels) && levels >= 1 && levels <= 4, `${game.id} tier ${tier} has a sane level count`);
    for (let level = 1; level <= levels; level++) {
      setRandomSource(createSeededRandom(tier * 100 + level));
      const round = startRound(game.id, tier, level);
      rounds++;
      assert.equal(typeof round.kind, 'string');
      const text = String(round.prompt ?? round.questionText ?? '');
      assert.ok(text.length > 0, `${game.id}: round has a prompt`);
      const right = round.kind === 'choice' || round.kind === 'strategy' ? (round.accepted?.[0] ?? round.answer) : Array.isArray(round.answer) ? round.answer.join(' ') : String(round.answer);
      if (round.kind !== 'imagine' && round.kind !== 'mastermind' && round.kind !== 'visual' && round.kind !== 'ttt') {
        const ok = checkAnswer(round, right);
        assert.equal(ok.correct, true, `${game.id} tier ${tier} level ${level}: its own answer is accepted`);
        assert.ok(ok.expected.length > 0);
        assert.equal(checkAnswer(round, '__wrong__').correct, false, `${game.id}: a wrong answer is rejected`);
      }
    }
  }
}
resetRandomSource();

// replay: the same seed gives the same round
setRandomSource(createSeededRandom(5)); const a = startRound('who-is-lying', 6, 1);
setRandomSource(createSeededRandom(5)); const b = startRound('who-is-lying', 6, 1);
resetRandomSource();
assert.deepEqual(a, b, 'a seeded round replays exactly');

// bounds
assert.throws(() => startRound('who-is-lying', 0, 1), RangeError);
assert.throws(() => startRound('who-is-lying', 16, 1), RangeError);
assert.throws(() => startRound('who-is-lying', 3, 0), RangeError);
assert.throws(() => startRound('who-is-lying', 3, 99), RangeError);
assert.throws(() => startRound('nope', 3, 1), RangeError);
assert.throws(() => startRound('who-is-lying', 2.5, 1), RangeError);
console.log(`PASS: games API: 171 games, ${rounds} rounds started and answered, bounds enforced, seeded replay exact.`);
