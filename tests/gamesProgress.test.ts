/** AXON Games progress keeper (DT3, GAMES4): rules, bounds, storage round trip, corrupt data, failing storage. */
import assert from 'node:assert/strict';
import {
  GAMES_PROGRESS_KEY, GAMES_PROGRESS_MAX_CHARS, MASTERY_MIN_ACCURACY, MASTERY_MIN_PLAYS, emptyProgress, readProgress,
  listGames, recommendedTier, recordResult, resetProgress, summarize, writeProgress,
} from '../src/games';
import type { GamesProgress, GamesProgressStorage } from '../src/games';

const memory = (): GamesProgressStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
};
const play = (p: GamesProgress, gameId: string, tier: number, results: boolean[]): GamesProgress => results.reduce((acc, correct) => recordResult(acc, { gameId, tier, level: 1, correct }), p);

// ---- rules
assert.equal(MASTERY_MIN_PLAYS, 3);
assert.equal(MASTERY_MIN_ACCURACY, 0.7);
let p = emptyProgress();
assert.equal(recommendedTier(p, 'who-is-lying'), 1, 'a new game starts at tier 1');
p = play(p, 'who-is-lying', 1, [true, true]);
assert.equal(recommendedTier(p, 'who-is-lying'), 1, 'two plays are not enough to master a tier');
p = play(p, 'who-is-lying', 1, [true]);
assert.equal(recommendedTier(p, 'who-is-lying'), 2, 'three correct plays master tier 1');
p = play(p, 'who-is-lying', 2, [true, false, false]);
assert.equal(recommendedTier(p, 'who-is-lying'), 2, 'one in three is below 70%');
p = play(p, 'who-is-lying', 2, [true, true, true, true, true, true, true]);
assert.equal(recommendedTier(p, 'who-is-lying'), 3, '8 of 10 at tier 2 masters it');
const top = play(emptyProgress(), 'nim', 15, [true, true, true]);
assert.equal(recommendedTier(top, 'nim'), 15, 'the recommendation never passes tier 15');
const skip = play(emptyProgress(), 'nim', 7, [true, true, true]);
assert.equal(recommendedTier(skip, 'nim'), 8, 'mastery counts at the highest mastered tier, not in order');
assert.equal(recommendedTier(play(emptyProgress(), 'nim', 3, [true, true, true, false]), 'nim'), 4, '3 of 4 is 75%');

// ---- recording is pure and bounded
const before = emptyProgress();
const after = recordResult(before, { gameId: 'nim', tier: 4, level: 2, correct: true });
assert.deepEqual(before, { games: {} }, 'the old progress is untouched');
assert.deepEqual(after.games.nim, { plays: 1, correct: 1, lastTier: 4, lastLevel: 2, tiers: { '4': { plays: 1, correct: 1 } } });
assert.throws(() => recordResult(before, { gameId: 'nope', tier: 1, level: 1, correct: true }), RangeError);
assert.throws(() => recordResult(before, { gameId: 'nim', tier: 0, level: 1, correct: true }), RangeError);
assert.throws(() => recordResult(before, { gameId: 'nim', tier: 16, level: 1, correct: true }), RangeError);
assert.throws(() => recordResult(before, { gameId: 'nim', tier: 1.5, level: 1, correct: true }), RangeError);
assert.throws(() => recordResult(before, { gameId: 'nim', tier: 1, level: 5, correct: true }), RangeError);
assert.throws(() => recordResult(before, { gameId: 'nim', tier: 1, level: 1, correct: 'yes' as unknown as boolean }), TypeError);
assert.throws(() => recommendedTier(before, 'nope'), RangeError);
const sum = summarize(play(play(emptyProgress(), 'nim', 1, [true, false]), 'go', 2, [true]));
assert.deepEqual(sum, { gamesPlayed: 2, plays: 3, correct: 2, accuracy: 2 / 3 });
assert.deepEqual(summarize(emptyProgress()), { gamesPlayed: 0, plays: 0, correct: 0, accuracy: null });

// ---- storage round trip
const store = memory();
assert.deepEqual(readProgress(store), { kind: 'absent' });
assert.deepEqual(writeProgress(store, p, '2026-11-13T10:00:00Z'), { ok: true });
const read = readProgress(store);
assert.ok(read.kind === 'ok');
assert.deepEqual(read.kind === 'ok' ? read.progress : null, p, 'what was written is what is read');
assert.equal(read.kind === 'ok' ? read.savedAt : '', '2026-11-13T10:00:00Z');
assert.ok([...store.data.keys()].every((k) => k === GAMES_PROGRESS_KEY), 'only the one key is used, never the old lab key');
assert.equal(resetProgress(store), true);
assert.deepEqual(readProgress(store), { kind: 'absent' });

// ---- corrupt and hostile data is "unusable", never "absent", never silently fixed
const bad = (text: string, reason: string): void => {
  const s = memory(); s.data.set(GAMES_PROGRESS_KEY, text);
  assert.deepEqual(readProgress(s), { kind: 'unusable', reason }, text.slice(0, 60));
};
bad('not json', 'not-json');
bad('[]', 'bad-shape');
bad('{"v":1,"savedAt":"x","state":{"games":[]}}', 'bad-shape');
bad('{"v":2,"savedAt":"x","state":{"games":{}}}', 'wrong-version');
bad('{"v":1,"savedAt":3,"state":{"games":{}}}', 'bad-shape');
bad('{"v":1,"savedAt":"x","state":{"games":{"nope":{"plays":1,"correct":1,"lastTier":1,"lastLevel":1,"tiers":{"1":{"plays":1,"correct":1}}}}}}', 'bad-shape');
bad('{"v":1,"savedAt":"x","state":{"games":{"nim":{"plays":1,"correct":2,"lastTier":1,"lastLevel":1,"tiers":{"1":{"plays":1,"correct":2}}}}}}', 'bad-shape');
bad('{"v":1,"savedAt":"x","state":{"games":{"nim":{"plays":2,"correct":1,"lastTier":1,"lastLevel":1,"tiers":{"1":{"plays":1,"correct":1}}}}}}', 'bad-shape');
bad('{"v":1,"savedAt":"x","state":{"games":{"nim":{"plays":1,"correct":1,"lastTier":99,"lastLevel":1,"tiers":{"1":{"plays":1,"correct":1}}}}}}', 'bad-shape');
bad('{"v":1,"savedAt":"x","state":{"games":{"nim":{"plays":1,"correct":1,"lastTier":1,"lastLevel":1,"tiers":{"01":{"plays":1,"correct":1}}}}}}', 'bad-shape');
bad('x'.repeat(GAMES_PROGRESS_MAX_CHARS + 1), 'too-large');

// ---- storage that fails
const throwing: GamesProgressStorage = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
assert.deepEqual(readProgress(throwing), { kind: 'unusable', reason: 'unreadable' });
assert.deepEqual(writeProgress(throwing, p, 'now'), { ok: false, error: 'storage-failed' });
assert.equal(resetProgress(throwing), false);
const lying: GamesProgressStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
assert.deepEqual(writeProgress(lying, p, 'now'), { ok: false, error: 'verify-failed' });
assert.deepEqual(writeProgress(memory(), p, ''), { ok: false, error: 'bad-input' });

// ---- the biggest possible record still fits
let full = emptyProgress();
for (const id of ['nim', 'go', 'chess']) for (let tier = 1; tier <= 15; tier++) full = recordResult(full, { gameId: id, tier, level: 4, correct: true });
assert.deepEqual(writeProgress(memory(), full, '2026-11-13T10:00:00Z'), { ok: true });
// worst case: every game, every tier, counters at their cap
const worst: GamesProgress = { games: Object.fromEntries(listGames().map((g) => [g.id, { plays: 15000000, correct: 15000000, lastTier: 15, lastLevel: 4, tiers: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(i + 1), { plays: 1000000, correct: 1000000 }])) }])) };
assert.ok(JSON.stringify({ v: 1, savedAt: '2026-11-13T10:00:00.000Z', state: worst }).length < GAMES_PROGRESS_MAX_CHARS, 'the largest possible save is below the size cap');
console.log('PASS: games progress: rules, bounds, round trip, corrupt data, failing storage.');
