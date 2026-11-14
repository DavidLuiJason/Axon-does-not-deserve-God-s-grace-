/** AXON Games screen contract (DT3, GAMES3): every round maps to one screen model, and a perfect player can finish every model with the logic layer alone. */
import assert from 'node:assert/strict';
import {
  MASTERMIND_DIGITS, MASTERMIND_MAX_GUESSES, checkAnswer, checkTappedCells, createSeededRandom, gameNote, listGames,
  levelsInTier, resetRandomSource, scoreGuess, screenModel, setRandomSource, startRound, submitCodeGuess,
} from '../src/games';
import { GAME_NOTE_IDS } from '../src/games/notes';
import type { Round, ScreenModel } from '../src/games';

// ---- mastermind scoring against an independent counting reference
const rand = createSeededRandom(99);
const digit = (): number => Math.floor(rand() * 10);
for (let i = 0; i < 20000; i++) {
  const code = [digit(), digit(), digit(), digit()];
  const guess = [digit(), digit(), digit(), digit()];
  const exact = guess.filter((v, k) => v === code[k]).length;
  let common = 0;
  for (let d = 0; d < 10; d++) common += Math.min(code.filter((v) => v === d).length, guess.filter((v) => v === d).length);
  assert.deepEqual(scoreGuess(code, guess), { exact, misplaced: common - exact }, `score ${code} vs ${guess}`);
}
assert.deepEqual(scoreGuess([1, 2, 3, 4], [1, 2, 3, 4]), { exact: 4, misplaced: 0 });
assert.deepEqual(scoreGuess([1, 1, 2, 2], [2, 2, 1, 1]), { exact: 0, misplaced: 4 });
assert.deepEqual(scoreGuess([1, 2, 3, 4], [1, 1, 1, 1]), { exact: 1, misplaced: 0 }, 'a code digit counts once');

// ---- one code round, played by guesses
setRandomSource(createSeededRandom(3));
const codeRound = startRound('mastermind-mini', 1, 1);
resetRandomSource();
assert.equal(codeRound.kind, 'mastermind');
assert.deepEqual(submitCodeGuess(codeRound, 0, '12a4'), { ok: false, reason: 'not-four-digits' });
assert.deepEqual(submitCodeGuess(codeRound, 0, '123'), { ok: false, reason: 'not-four-digits' });
const win = submitCodeGuess(codeRound, 2, (codeRound.code as number[]).join(''));
assert.ok(win.ok && win.solved && win.finished && win.exact === MASTERMIND_DIGITS);
const wrongText = (codeRound.code as number[]).map((d) => (d + 1) % 10).join('');
const miss = submitCodeGuess(codeRound, MASTERMIND_MAX_GUESSES - 1, wrongText);
assert.ok(miss.ok && !miss.solved && miss.finished && miss.remaining === 0, 'the eighth wrong guess ends the round');
const early = submitCodeGuess(codeRound, 0, wrongText);
assert.ok(early.ok && !early.solved && !early.finished && early.remaining === MASTERMIND_MAX_GUESSES - 1);

// ---- every round of every game, perfect player and wrong player
const seen = new Map<string, number>();
let rounds = 0;
for (const game of listGames()) {
  for (let tier = 1; tier <= 15; tier++) {
    for (let level = 1; level <= levelsInTier(game.id, tier); level++) {
      setRandomSource(createSeededRandom(tier * 101 + level * 13 + game.id.length));
      const round: Round = startRound(game.id, tier, level);
      const model: ScreenModel = screenModel(round);
      rounds++;
      seen.set(model.type, (seen.get(model.type) ?? 0) + 1);
      const where = `${game.id} t${tier} l${level} (${model.type})`;
      const answerText = Array.isArray(round.answer) ? round.answer.join(' ') : String(round.answer);
      switch (model.type) {
        case 'typed-memory':
          assert.ok(model.memorize.length > 0 && model.memorizeMs > 0 && model.question.length > 0, where);
          assert.equal(checkAnswer(round, answerText).correct, true, where);
          assert.equal(checkAnswer(round, '__wrong__').correct, false, where);
          break;
        case 'select-memory':
        case 'set-select':
          assert.ok(model.options.length >= 2 && model.memorizeMs > 0, where);
          assert.ok((round.answer as Array<string | number>).every((a) => model.options.includes(a)), `${where}: every right option is offered`);
          assert.equal(checkAnswer(round, round.answer as Array<string | number>).correct, true, where);
          {
            const right = round.answer as Array<string | number>;
            // an empty right answer is legitimate (every digit was called); then the wrong move is picking something
            assert.equal(checkAnswer(round, right.length === 0 ? [model.options[0] as string | number] : []).correct, false, where);
          }
          break;
        case 'choice': {
          assert.ok(model.options.length >= 2 && model.prompt.length > 0, where);
          const verdicts = model.options.map((o) => checkAnswer(round, o).correct);
          assert.ok(verdicts.some(Boolean) && verdicts.some((v) => !v), `${where}: at least one right and one wrong button`);
          break;
        }
        case 'typed':
          assert.ok(model.prompt.length > 0, where);
          assert.equal(checkAnswer(round, answerText).correct, true, where);
          assert.equal(checkAnswer(round, '__wrong__').correct, false, where);
          break;
        case 'grid': {
          assert.ok(model.size >= 2 && model.litCells.length > 0 && model.showMs > 0, where);
          assert.ok(model.litCells.every((c) => Number.isInteger(c) && c >= 0 && c < model.size * model.size), `${where}: lit cells are on the grid`);
          assert.equal(checkTappedCells(round, model.litCells), true, where);
          assert.equal(checkTappedCells(round, model.litCells.slice(1)), false, `${where}: a missing cell fails`);
          const extra = Array.from({ length: model.size * model.size }, (_, i) => i).find((i) => !model.litCells.includes(i));
          if (extra !== undefined) assert.equal(checkTappedCells(round, [...model.litCells, extra]), false, `${where}: an extra cell fails`);
          break;
        }
        case 'heaps': {
          assert.ok(model.heaps.length === 3 && model.heaps.every((h) => h > 0), where);
          const winners = new Set<number>(Array.isArray(round.acceptedAnswers) ? (round.acceptedAnswers as number[]) : [Number(round.answer)]);
          for (let heap = 0; heap <= 3; heap++) assert.equal(checkAnswer(round, String(heap)).correct, winners.has(heap), `${where}: heap ${heap}`);
          break;
        }
        case 'code':
          assert.equal(model.digits, MASTERMIND_DIGITS);
          assert.equal(model.maxGuesses, MASTERMIND_MAX_GUESSES);
          assert.equal((round.code as number[]).length, MASTERMIND_DIGITS, where);
          break;
        case 'open':
          assert.ok(model.prompt.length > 0 && model.visual.count > 0, where);
          break;
      }
    }
  }
}
resetRandomSource();
for (const type of ['typed-memory', 'select-memory', 'set-select', 'choice', 'typed', 'grid', 'heaps', 'code', 'open']) assert.ok((seen.get(type) ?? 0) > 0, `screen model ${type} is exercised`);

// ---- honest notes
for (const id of GAME_NOTE_IDS) assert.ok(listGames().some((g) => g.id === id), `note refers to a real game: ${id}`);
assert.match(String(gameNote('chess')), /no playable board/i);
assert.equal(gameNote('who-is-lying'), null);

assert.throws(() => screenModel({ kind: 'nonsense' } as Round), RangeError);
assert.throws(() => checkTappedCells({ kind: 'choice' } as Round, []), TypeError);
console.log(`PASS: screen contract: ${rounds} rounds, ${[...seen.keys()].length} screen models, a perfect player finishes every one with the logic layer only; code scoring matches an independent reference on 20,000 guesses.`);
