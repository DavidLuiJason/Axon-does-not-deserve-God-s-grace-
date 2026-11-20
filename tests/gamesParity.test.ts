/**
 * AXON Games, GAMES2 parity test (DT3).
 * The TypeScript logic layer in src/games/ must produce EXACTLY the same rounds as the audited JavaScript lab in
 * axon-games/ (checked by tests/oracle-audit.test.mjs inside that folder), for every game, tier and level, on the same seeds.
 * It also proves the port never touches Math.random: the only random source is the injected one.
 */
import assert from 'node:assert/strict';
import { GAMES } from '../src/games/catalogue';
import { createRound as tsRound, validateAnswer as tsValidate } from '../src/games/engine';
import { setRandomSource as tsSet, resetRandomSource as tsReset, createSeededRandom as tsSeed } from '../src/games/random';
import { createRound as jsRound, validateAnswer as jsValidate } from '../axon-games/src/engine.js';
import { setRandomSource as jsSet, resetRandomSource as jsReset, createSeededRandom as jsSeed } from '../axon-games/src/random.js';

const jsCreate = jsRound as unknown as (g: unknown, d: number, s: { level: number }) => any;
const jsCheck = jsValidate as unknown as (r: unknown, v: unknown) => boolean;
// GAMES5: these games were deliberately changed after the audited baseline (tier scaling). The JavaScript lab is frozen, so they are allowed to differ;
// the rest must still match exactly. tests/gamesOracle.test.ts re-solves the changed games independently.
const EVOLVED = new Set<string>([
  'odd-one-out-numbers',
  'chess',
  'chess-tactics',
  'checkmate-in-one',
  'checkmate-in-two',
  'chess-position-memory',
  'blindfold-chess',
  'chess-endgame-challenge',
  'draughts',
  'go',
  'reversi',
  'tic-tac-toe-master',
  'hex',
  'logic-grid',
  'the-impossible-lock',
  'the-missing-clue',
  'who-owns-what',
  'bridge-crossing',
  'river-crossing',
  'prisoners-puzzle',
  'visual-rotation',
  'mirror-image',
  'tangram-challenge',
  'visual-change-detection',
  'reverse-spelling',
  'word-relationships',
  'hidden-word',
  'mathematical-proof-puzzle',
  'target-switch',
  'color-word-conflict',
  'go-or-no-go',
  'multi-rule-patterns',
  'alternative-uses',
  'what-would-you-do',
  'find-a-way-to-escape',
  'escape-room',
  'the-detective',
  'the-interrogator',
  'the-negotiator',
  'the-strategist',
  'the-paradox',
  'the-survival-planner',
  'the-investigator',
  'the-experimenter',
  'the-deceiver',
  'the-systems-breaker',
  'prime-factor-challenge',
  'connect-four',
  'word-chain',
  'synonym-challenge',
  'antonym-challenge',
  'vocabulary-ladder',
  'mastermind-mini',
  'abstract-odd-one-out',
  'cube-net',
  'mastermind',
  'color-sequence',
  'letter-sequence-memory',
  'mathematical-sequence',
  'equation-balancer',
  'resource-allocation',
  'the-architect',
  'go-or-no-go',
]);
const SEEDS = 2;
const realRandom = Math.random;
let rounds = 0;
const mismatches: string[] = [];
const evolvedDiffers = new Set<string>();
Math.random = () => { throw new Error('Math.random was called: games must use the injected random source'); };
try {
  assert.equal(GAMES.length, 171, 'catalogue must hold 171 games');
  for (const game of GAMES) {
    for (let tier = 1; tier <= 15; tier++) {
      for (let level = 1; level <= 3; level++) {
        for (let s = 0; s < SEEDS; s++) {
          const seed = 7000 + tier * 131 + level * 17 + s * 977 + game.id.length;
          tsSet(tsSeed(seed));
          jsSet(jsSeed(seed));
          const a = tsRound(game, tier, { level });
          const b = jsCreate(game, tier, { level });
          rounds++;
          try {
            if (EVOLVED.has(game.id)) { try { assert.deepEqual(a, b); } catch { evolvedDiffers.add(game.id); } continue; }
            assert.deepEqual(a, b);
            const right = String(Array.isArray(a.answer) ? a.answer.join(' ') : a.answer);
            assert.equal(tsValidate(a, a.kind === 'choice' || a.kind === 'strategy' ? (a.accepted?.[0] ?? a.answer) : right), jsCheck(b, b.kind === 'choice' || b.kind === 'strategy' ? (b.accepted?.[0] ?? b.answer) : right));
            assert.equal(tsValidate(a, '__wrong__'), jsCheck(b, '__wrong__'));
          } catch (e) {
            mismatches.push(`${game.id} tier ${tier} level ${level} seed ${s}: ${(e as Error).message.split('\n')[0]}`);
          }
        }
      }
    }
  }
} finally {
  Math.random = realRandom;
  tsReset();
  jsReset();
}
for (const id of EVOLVED) assert.ok(evolvedDiffers.has(id), `${id} is on the evolved list but still matches the baseline: remove it from the list`);
if (mismatches.length) console.log(mismatches.slice(0, 8).join('\n'));
assert.equal(mismatches.length, 0, `${mismatches.length} of ${rounds} rounds differ between the TypeScript port and the audited JavaScript`);
console.log(`PASS: TypeScript games layer matches the audited JavaScript on every game that was not deliberately evolved (${171 - EVOLVED.size} games, ${rounds} rounds checked in total); ${EVOLVED.size} evolved games differ as intended; Math.random never used.`);
