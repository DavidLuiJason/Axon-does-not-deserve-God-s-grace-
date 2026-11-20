// GAMES4: the one keeper of AXON Games progress. Pure over an injected storage; no clock, no random, no regex (house style of src/tools/state/toolStateStore.ts).
// Key axon.games.progress.v1; value JSON { v: 1, savedAt, state }. Never reads or writes the old lab key axon.games.lab.v2.
// RULES (decided by DT3 on 2026-11-13, overrulable, docs/AUTO_APPROVED.md): every tier is always open to play; progress only RECOMMENDS a tier.
// A tier counts as mastered after at least 3 plays with at least 70% correct; the recommended tier is one above the highest mastered tier (tier 1 when none).
import { GAMES } from './catalogue';

export const GAMES_PROGRESS_KEY = 'axon.games.progress.v1';
export const GAMES_PROGRESS_MAX_CHARS = 250000;
export const MASTERY_MIN_PLAYS = 3;
export const MASTERY_MIN_ACCURACY = 0.7;
const COUNT_CAP = 1000000;
const MAX_TIER = 15;
const MAX_LEVEL = 4;

export interface TierRecord { plays: number; correct: number }
export interface GameRecord { plays: number; correct: number; lastTier: number; lastLevel: number; tiers: Record<string, TierRecord> }
export interface GamesProgress { games: Record<string, GameRecord> }
export interface GamesProgressStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type UnusableReason = 'unreadable' | 'not-json' | 'bad-shape' | 'wrong-version' | 'too-large';
export type ProgressRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'ok'; readonly progress: GamesProgress; readonly savedAt: string }
  | { readonly kind: 'unusable'; readonly reason: UnusableReason };
export type ProgressWriteError = 'bad-input' | 'too-large' | 'storage-failed' | 'verify-failed';
export type ProgressWrite = { readonly ok: true } | { readonly ok: false; readonly error: ProgressWriteError };

const KNOWN_IDS: ReadonlySet<string> = new Set(GAMES.map((game) => game.id));
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= COUNT_CAP;

export function browserProgressStorage(): GamesProgressStorage | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

export function emptyProgress(): GamesProgress { return { games: {} }; }

/** Returns a NEW progress with one more result. Throws RangeError for an unknown game, a tier outside 1..15, a level outside 1..4. */
export function recordResult(progress: GamesProgress, result: { gameId: string; tier: number; level: number; correct: boolean }): GamesProgress {
  const { gameId, tier, level, correct } = result;
  if (!KNOWN_IDS.has(gameId)) throw new RangeError(`Unknown game: ${gameId}`);
  if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) throw new RangeError('tier must be an integer from 1 to 15');
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new RangeError('level must be an integer from 1 to 4');
  if (typeof correct !== 'boolean') throw new TypeError('correct must be true or false');
  const before = progress.games[gameId];
  const tiers: Record<string, TierRecord> = { ...(before?.tiers ?? {}) };
  const t = tiers[String(tier)] ?? { plays: 0, correct: 0 };
  tiers[String(tier)] = { plays: Math.min(COUNT_CAP, t.plays + 1), correct: Math.min(COUNT_CAP, t.correct + (correct ? 1 : 0)) };
  const record: GameRecord = {
    plays: Math.min(COUNT_CAP, (before?.plays ?? 0) + 1),
    correct: Math.min(COUNT_CAP, (before?.correct ?? 0) + (correct ? 1 : 0)),
    lastTier: tier,
    lastLevel: level,
    tiers,
  };
  return { games: { ...progress.games, [gameId]: record } };
}

/** The tier to suggest next. Tiers stay freely selectable; this is only a hint. */
export function recommendedTier(progress: GamesProgress, gameId: string): number {
  if (!KNOWN_IDS.has(gameId)) throw new RangeError(`Unknown game: ${gameId}`);
  const record = progress.games[gameId];
  if (!record) return 1;
  let mastered = 0;
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const t = record.tiers[String(tier)];
    if (t && t.plays >= MASTERY_MIN_PLAYS && t.correct / t.plays >= MASTERY_MIN_ACCURACY) mastered = tier;
  }
  return Math.min(MAX_TIER, mastered + 1);
}

export interface ProgressSummary { gamesPlayed: number; plays: number; correct: number; accuracy: number | null }
export function summarize(progress: GamesProgress): ProgressSummary {
  let plays = 0;
  let correct = 0;
  const ids = Object.keys(progress.games);
  for (const id of ids) { const r = progress.games[id]; if (r) { plays += r.plays; correct += r.correct; } }
  return { gamesPlayed: ids.length, plays, correct, accuracy: plays === 0 ? null : correct / plays };
}

function validRecord(raw: unknown): raw is GameRecord {
  if (!isObject(raw) || !isCount(raw.plays) || !isCount(raw.correct) || raw.correct > raw.plays) return false;
  if (!isCount(raw.lastTier) || raw.lastTier < 1 || raw.lastTier > MAX_TIER) return false;
  if (!isCount(raw.lastLevel) || raw.lastLevel < 1 || raw.lastLevel > MAX_LEVEL) return false;
  if (!isObject(raw.tiers)) return false;
  let sumPlays = 0;
  for (const key of Object.keys(raw.tiers)) {
    const tier = Number(key);
    const t = raw.tiers[key];
    if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER || String(tier) !== key) return false;
    if (!isObject(t) || !isCount(t.plays) || !isCount(t.correct) || t.correct > t.plays) return false;
    sumPlays += t.plays;
  }
  return sumPlays === raw.plays || raw.plays === COUNT_CAP;
}

export function readProgress(storage: GamesProgressStorage): ProgressRead {
  let text: string | null;
  try { text = storage.getItem(GAMES_PROGRESS_KEY); } catch { return { kind: 'unusable', reason: 'unreadable' }; }
  if (text === null) return { kind: 'absent' };
  if (typeof text !== 'string') return { kind: 'unusable', reason: 'bad-shape' };
  if (text.length > GAMES_PROGRESS_MAX_CHARS) return { kind: 'unusable', reason: 'too-large' };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { kind: 'unusable', reason: 'not-json' }; }
  if (!isObject(parsed) || typeof parsed.savedAt !== 'string' || !isObject(parsed.state)) return { kind: 'unusable', reason: 'bad-shape' };
  if (parsed.v !== 1) return { kind: 'unusable', reason: 'wrong-version' };
  const games = parsed.state.games;
  if (!isObject(games)) return { kind: 'unusable', reason: 'bad-shape' };
  for (const id of Object.keys(games)) if (!KNOWN_IDS.has(id) || !validRecord(games[id])) return { kind: 'unusable', reason: 'bad-shape' };
  return { kind: 'ok', progress: { games: games as Record<string, GameRecord> }, savedAt: parsed.savedAt };
}

/** `savedAt` is passed in by the caller (this file has no clock). Verifies by reading back. */
export function writeProgress(storage: GamesProgressStorage, progress: GamesProgress, savedAt: string): ProgressWrite {
  if (!isObject(progress) || !isObject(progress.games) || typeof savedAt !== 'string' || savedAt.length === 0) return { ok: false, error: 'bad-input' };
  const text = JSON.stringify({ v: 1, savedAt, state: progress });
  if (text.length > GAMES_PROGRESS_MAX_CHARS) return { ok: false, error: 'too-large' };
  try { storage.setItem(GAMES_PROGRESS_KEY, text); } catch { return { ok: false, error: 'storage-failed' }; }
  let back: string | null;
  try { back = storage.getItem(GAMES_PROGRESS_KEY); } catch { return { ok: false, error: 'verify-failed' }; }
  return back === text ? { ok: true } : { ok: false, error: 'verify-failed' };
}

/** The player's own reset: removes the saved progress. Returns false when storage refuses. */
export function resetProgress(storage: GamesProgressStorage): boolean {
  try { storage.removeItem(GAMES_PROGRESS_KEY); return true; } catch { return false; }
}
