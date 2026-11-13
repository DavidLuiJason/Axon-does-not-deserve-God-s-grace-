/**
 * AXON Games: public logic API (DT3, GAMES2).
 * Logic only. No screen, no storage, no timers, no Math.random: a screen asks for rounds and checks answers here.
 * Randomness comes from one injectable source so AXON can govern it and tests can replay any round.
 */
import { GAMES } from './catalogue';
import { createRound, validateAnswer } from './engine';
import { getTierProfile } from './progression/difficulty';
import { GAME_TIER_PROFILES } from './progression/game-tiers';
import { BATCH_TWO_TIER_PROFILES } from './progression/batch-two-tiers';
import { BATCH_THREE_TIER_PROFILES } from './progression/batch-three-tiers';
import { BATCH_FOUR_TIER_PROFILES } from './progression/batch-four-tiers';
import { BATCH_FIVE_TIER_PROFILES } from './progression/batch-five-tiers';
import { BATCH_SIX_TIER_PROFILES } from './progression/batch-six-tiers';
import type { GameEntry, Round, TierProfiles } from './types';

export { setRandomSource, resetRandomSource, createSeededRandom } from './random';
export type { GameEntry, Round } from './types';

export const GAME_TIER_COUNT = 15;

const PROFILES: TierProfiles = {
  ...GAME_TIER_PROFILES,
  ...BATCH_TWO_TIER_PROFILES,
  ...BATCH_THREE_TIER_PROFILES,
  ...BATCH_FOUR_TIER_PROFILES,
  ...BATCH_FIVE_TIER_PROFILES,
  ...BATCH_SIX_TIER_PROFILES,
};

/** What the Tools menu needs to list the Games hub. Plain data: the catalog owner copies it in (see docs/GAMES_TOOLS_MENU_PLAN.md). */
export const AXON_GAMES_CATALOG_ENTRY = {
  id: 'axon-games',
  name: 'AXON Games',
  description: 'Brain-training games for memory, logic, maths, language and strategy, with 15 tiers each.',
} as const;

export function listGames(): readonly GameEntry[] {
  return GAMES;
}

export function getGame(id: string): GameEntry | undefined {
  return GAMES.find((game) => game.id === id);
}

export function listCategories(): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const game of GAMES) counts.set(game.category, (counts.get(game.category) ?? 0) + 1);
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

export function gamesInCategory(category: string): GameEntry[] {
  return GAMES.filter((game) => game.category === category);
}

/** How many levels a tier has for this game (the screen offers levels 1..n). Games without a profile have 3. */
export function levelsInTier(gameId: string, tier: number): number {
  return PROFILES[gameId] ? getTierProfile(gameId, tier, PROFILES).levels : 3;
}

/** One new round. Throws RangeError for an unknown game, a tier outside 1..15 or a level the tier does not have. */
export function startRound(gameId: string, tier: number, level: number): Round {
  const game = getGame(gameId);
  if (!game) throw new RangeError(`Unknown game: ${gameId}`);
  if (!Number.isInteger(tier) || tier < 1 || tier > GAME_TIER_COUNT) throw new RangeError('tier must be an integer from 1 to 15');
  const levels = levelsInTier(gameId, tier);
  if (!Number.isInteger(level) || level < 1 || level > levels) throw new RangeError(`level must be an integer from 1 to ${levels} for ${gameId} tier ${tier}`);
  return createRound(game, tier, { level });
}

export interface AnswerCheck {
  correct: boolean;
  /** The answer the game expects, as text. */
  expected: string;
  /** Why, in the game's own words. */
  explanation: string;
}

export function checkAnswer(round: Round, input: unknown): AnswerCheck {
  const expected = Array.isArray(round.answer) ? round.answer.join(' ') : String(round.answer ?? '');
  return {
    correct: validateAnswer(round, input),
    expected,
    explanation: String(round.explanation ?? round.rule ?? ''),
  };
}
