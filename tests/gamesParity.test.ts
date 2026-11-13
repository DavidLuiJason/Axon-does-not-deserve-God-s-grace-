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
const SEEDS = 2;
const realRandom = Math.random;
let rounds = 0;
const mismatches: string[] = [];
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
if (mismatches.length) console.log(mismatches.slice(0, 8).join('\n'));
assert.equal(mismatches.length, 0, `${mismatches.length} of ${rounds} rounds differ between the TypeScript port and the audited JavaScript`);
console.log(`PASS: TypeScript games layer matches the audited JavaScript on ${rounds} rounds (171 games x 15 tiers x 3 levels x ${SEEDS} seeds); Math.random never used.`);
