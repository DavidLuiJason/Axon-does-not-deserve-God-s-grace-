// BUD6 DIRECTOR CHECKS: hand-derived expectations (written BEFORE running). Not for builders.
declare const console: { log: (v: string) => void };
import { builderVector, packBatch, BATCH_PLAN_TABLE } from '../src/budget/batchPlan';
import { BUILDER_LOG_ROWS } from './fixtures/builderLogRows';
import { newBudget } from '../src/budget/budgetBroker';
import { budgetView } from '../src/budget/budgetView';
let n = 0;
const bv: (x: unknown) => any = builderVector;
const pb: (x: unknown) => any = packBatch;
const eq = (a: unknown, b: unknown, l: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('FAIL ' + l + '\n got ' + JSON.stringify(a) + '\n exp ' + JSON.stringify(b)); n++; };
const V = (builder: string, rows: unknown = BUILDER_LOG_ROWS): any => bv({ rows, builder });
const P = (cards: unknown, overheadChars: unknown, history: unknown): any => pb({ cards, overheadChars, history });
const mk = (k: number, chars: number) => Array.from({ length: k }, (_, i) => ({ id: 'c' + (i + 1), chars }));
// table
eq(BATCH_PLAN_TABLE, { masterChars: 16000, minCards: 3, startCards: 6, ceilingCards: 10, raiseStep: 2, maxDirectorTurns: 2 }, 'table');
// ChatGPT
let g = V('ChatGPT'); eq(g.ok, true, 'gpt ok'); g = g.value;
eq(g.runs, 18, 'gpt runs');
eq(g.figures.promptChars, { figure: 16000, reason: 'ok', okRows: 3, badRows: 2, basis: 'ESTIMATE' }, 'gpt promptChars');
eq(g.figures.miniBaseFiles, { figure: 10, reason: 'ok', okRows: 3, badRows: 0, basis: 'ESTIMATE' }, 'gpt miniBase');
eq(g.figures.filesReturned, { figure: 22, reason: 'ok', okRows: 12, badRows: 0, basis: 'OBSERVED' }, 'gpt files');
eq(g.figures.directorCommands, { figure: null, reason: 'no-ok-rows', okRows: 0, badRows: 0, basis: null }, 'gpt cmds');
eq(g.capacity, { repoFiles: 22 }, 'gpt capacity');
eq(g.unknown, [{ resource: 'builderMemoryMb', reason: 'no-log-field' }, { resource: 'archiveExpandMb', reason: 'no-log-field' }, { resource: 'testMinutes', reason: 'no-log-field' }, { resource: 'reviewCommands', reason: 'no-ok-rows' }], 'gpt unknown');
eq(Object.keys(g), ['builder', 'runs', 'figures', 'capacity', 'unknown'], 'key order');
// Claude (Director): commands conflict: ok max 43, failing/partial min 24
let c = V('Claude').value;
eq(c.runs, 11, 'claude runs');
eq(c.figures.directorCommands, { figure: null, reason: 'conflict', okRows: 9, badRows: 1, basis: null }, 'claude cmds conflict');
eq(c.capacity, {}, 'claude capacity');
eq(c.unknown.map((u: any) => u.resource + ':' + u.reason), ['builderMemoryMb:no-log-field', 'archiveExpandMb:no-log-field', 'repoFiles:no-ok-rows', 'testMinutes:no-log-field', 'reviewCommands:conflict'], 'claude unknown');
// Grok and an unknown builder
let k = V('Grok').value; eq(k.runs, 1, 'grok runs'); eq(k.figures.promptChars, { figure: null, reason: 'no-ok-rows', okRows: 0, badRows: 1, basis: null }, 'grok prompt'); eq(k.capacity, {}, 'grok cap');
let u = V('Vibe').value; eq(u.runs, 0, 'vibe runs'); eq(u.capacity, {}, 'vibe cap'); eq(u.unknown.length, 5, 'vibe unknown');
// sample minimum: 5 OK rows flips ESTIMATE to OBSERVED (files: 12 rows OBSERVED above; mini-base 3 rows ESTIMATE above)
// validation (first failure wins)
eq(V('ChatGPT', 5).error, 'bad-rows', 'rows not array');
eq(bv(5).error, 'bad-input', 'not object'); eq(bv({ rows: [] }).error, 'unknown-key', 'missing key'); eq(bv({ rows: [], builder: 'x', z: 1 }).error, 'unknown-key', 'extra key');
eq(V('', []).error, 'bad-builder', 'empty builder');
const R0: any = BUILDER_LOG_ROWS[3];
eq(V('ChatGPT', [{ ...R0, date: '2026-1-05' }]).error, 'bad-row', 'bad date');
eq(V('ChatGPT', [{ ...R0, outcome: 'OK', accepted: 2 }]).error, 'bad-row', 'OK but accepted < cards');
eq(V('ChatGPT', [{ ...R0, outcome: 'FAILED', accepted: 2 }]).error, 'bad-row', 'FAILED but accepted 2');
eq(V('ChatGPT', [{ ...R0, outcome: 'PARTIAL', accepted: 3 }]).error, 'bad-row', 'PARTIAL but accepted = cards');
eq(V('ChatGPT', [{ ...R0, cards: 0 }]).error, 'bad-row', 'cards 0');
eq(V('ChatGPT', [{ ...R0, extra: 1 }]).error, 'bad-row', 'extra row key');
eq(V('ChatGPT', [R0, R0]).error, 'duplicate-row-id', 'dup id');
eq(V('ChatGPT', [R0, { ...R0, outcome: 'nope' }, R0]).error, 'bad-row', 'bad row before duplicate check');
eq(V('ChatGPT', []).value.runs, 0, 'empty rows ok');
// conflict rule: a failing value at or below the safe value kills the figure
const A = { ...R0, id: 'a', promptChars: 10000, miniBaseFiles: null, outcome: 'OK', accepted: 3 };
eq(V('ChatGPT', [A, { ...A, id: 'b', promptChars: 10000, outcome: 'FAILED', accepted: 0 }]).value.figures.promptChars.reason, 'conflict', 'bad = safe is a conflict');
eq(V('ChatGPT', [A, { ...A, id: 'b', promptChars: 10001, outcome: 'FAILED', accepted: 0 }]).value.figures.promptChars.figure, 10000, 'bad just above safe is fine');
// sample minimum boundary: 4 OK rows = ESTIMATE, 5 = OBSERVED
const F = (i: number) => ({ ...R0, id: 'f' + i, promptChars: null, miniBaseFiles: null, filesReturned: 5, outcome: 'OK', accepted: 3 });
eq(V('ChatGPT', [1, 2, 3, 4].map(F)).value.figures.filesReturned.basis, 'ESTIMATE', 'four ok rows');
eq(V('ChatGPT', [1, 2, 3, 4, 5].map(F)).value.figures.filesReturned.basis, 'OBSERVED', 'five ok rows');
// date separators
eq(V('ChatGPT', [{ ...R0, date: '2026/01/05' }]).error, 'bad-row', 'slash date');
eq(V('ChatGPT', [{ ...R0, date: '2026-01x05' }]).error, 'bad-row', 'second separator');
eq(V('ChatGPT', [{ ...R0, date: '2026x01-05' }]).error, 'bad-row', 'first separator');
eq(V('ChatGPT', [{ ...R0, date: '2026-01-0a' }]).error, 'bad-row', 'letter in date');
// pack
const c7 = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(id => ({ id, chars: 3000 }));
eq(P(c7, 4000, []).value, { outcome: 'PACKED', target: 6, targetReason: 'start', inMaster: ['A', 'B', 'C', 'D'], inMiniBase: [{ id: 'E', reason: 'no-room' }, { id: 'F', reason: 'no-room' }, { id: 'G', reason: 'no-room' }], usedChars: 12000 }, 'P1');
eq(P(mk(8, 1000), 4000, []).value, { outcome: 'PACKED', target: 6, targetReason: 'start', inMaster: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], inMiniBase: [{ id: 'c7', reason: 'target-reached' }, { id: 'c8', reason: 'target-reached' }], usedChars: 6000 }, 'P2');
eq([P(mk(8, 1000), 0, [{ cards: 6, accepted: 6, directorTurns: null }]).value.target, P(mk(8, 1000), 0, [{ cards: 6, accepted: 6, directorTurns: null }]).value.targetReason], [6, 'turns-unknown'], 'P3');
let p4 = P(mk(10, 1000), 0, [{ cards: 6, accepted: 6, directorTurns: 2 }]).value; eq([p4.target, p4.targetReason, p4.inMaster.length, p4.inMiniBase.length, p4.usedChars, p4.outcome], [8, 'raise', 8, 2, 8000, 'PACKED'], 'P4');
const T = (h: any) => { const v = P(mk(10, 1000), 0, [h]).value; return [v.target, v.targetReason]; };
eq(T({ cards: 6, accepted: 5, directorTurns: 2 }), [5, 'shrink'], 'P5 not all accepted');
eq(T({ cards: 6, accepted: 6, directorTurns: 3 }), [5, 'shrink'], 'P6 three turns');
eq(T({ cards: 10, accepted: 10, directorTurns: 1 }), [10, 'raise'], 'P7 ceiling');
eq(T({ cards: 3, accepted: 2, directorTurns: 1 }), [3, 'shrink'], 'P8 floor');
eq(T({ cards: 12, accepted: 12, directorTurns: null }), [10, 'turns-unknown'], 'ceiling clamp');
eq(T({ cards: 6, accepted: 3, directorTurns: null }), [5, 'shrink'], 'P12 real batch 6');
// newest last: only the last row counts
eq(P(mk(10, 1000), 0, [{ cards: 6, accepted: 1, directorTurns: 9 }, { cards: 6, accepted: 6, directorTurns: 2 }]).value.target, 8, 'only last history row');
let p9 = P([{ id: 'big', chars: 20000 }, { id: 's1', chars: 1000 }, { id: 's2', chars: 1000 }], 4000, []).value;
eq(p9, { outcome: 'TOO-FEW', target: 6, targetReason: 'start', inMaster: ['s1', 's2'], inMiniBase: [{ id: 'big', reason: 'over-limit' }], usedChars: 2000 }, 'P9');
eq(P(mk(3, 1000), 16000, []).value, { outcome: 'NOTHING', target: 6, targetReason: 'start', inMaster: [], inMiniBase: [{ id: 'c1', reason: 'no-room' }, { id: 'c2', reason: 'no-room' }, { id: 'c3', reason: 'no-room' }], usedChars: 0 }, 'P10 usable 0');
eq(P(mk(1, 1000), 20000, []).value.outcome, 'NOTHING', 'P11 usable negative');
eq(P(mk(3, 1000), 4000, []).value.outcome, 'PACKED', 'exactly three is packed');
eq(P([{ id: 'x', chars: 12000 }], 4000, []).value.inMaster, ['x'], 'card exactly equal to usable fits');
eq(P([{ id: 'x', chars: 12001 }], 4000, []).value.inMiniBase, [{ id: 'x', reason: 'over-limit' }], 'one over usable');
eq(P([{ id: 'a', chars: 7000 }, { id: 'b', chars: 5001 }, { id: 'c', chars: 5000 }], 4000, []).value.inMaster, ['a', 'c'], 'skip and continue');
// pack validation
eq(pb(5).error, 'bad-input', 'p not object'); eq(pb({ cards: [] }).error, 'unknown-key', 'p missing keys');
eq(P([], 0, []).error, 'bad-cards', 'empty cards');
eq(P([{ id: 'a', chars: 1 }, { id: 'a', chars: 2 }], 0, []).error, 'bad-cards', 'dup card');
eq(P([{ id: 'a', chars: 0 }], 0, []).error, 'bad-cards', 'chars 0');
eq(P([{ id: 'a', chars: 1.5 }], 0, []).error, 'bad-cards', 'chars fractional');
eq(P([{ id: 'a', chars: 1, z: 1 }], 0, []).error, 'bad-cards', 'card extra key');
eq(P([{ id: 'a', chars: 1 }], -1, []).error, 'bad-overhead', 'overhead negative');
eq(P([{ id: 'a', chars: 1 }], 1.5, []).error, 'bad-overhead', 'overhead fractional');
eq(P([{ id: 'a', chars: 1 }], 0, 'x').error, 'bad-history', 'history not array');
eq(P([{ id: 'a', chars: 1 }], 0, [{ cards: 2, accepted: 3, directorTurns: 1 }]).error, 'bad-history', 'accepted > cards');
eq(P([], -1, 'x').error, 'bad-cards', 'cards error comes first');
eq(P([{ id: 'a', chars: 1 }], 0, [{ cards: 6, accepted: 6 }]).error, 'bad-history', 'history missing key');
eq(P([], 0, []).message, 'Batch plan input is invalid.', 'message'); eq(V('', []).message, 'Builder vector input is invalid.', 'vmessage');
// frozen
eq([Object.isFrozen(g), Object.isFrozen(g.figures), Object.isFrozen(g.capacity), Object.isFrozen(g.unknown), Object.isFrozen(p9), Object.isFrozen(p9.inMaster), Object.isFrozen(p9.inMiniBase)], [true, true, true, true, true, true, true], 'frozen');
// inputs untouched
const snap = JSON.stringify(BUILDER_LOG_ROWS); V('ChatGPT'); eq(JSON.stringify(BUILDER_LOG_ROWS), snap, 'rows untouched');
// vector meets the existing broker and view
const nb = newBudget(g.capacity); eq(nb.ok, true, 'newBudget accepts');
const st = (nb as any).value;
const view = (req: any) => (budgetView({ domain: 'BUILDER', state: st, request: req }) as any);
eq(view({ repoFiles: 30 }).value.outcome, 'BLOCKED', 'view 30 files'); eq(view({ repoFiles: 30 }).value.reasons.map((r: any) => r.code), ['over-budget', 'estimate-only'], 'view 30 reasons');
eq(view({ repoFiles: 10 }).value.outcome, 'UNKNOWN', 'view 10 files'); eq(view({ repoFiles: 10 }).value.reasons.map((r: any) => r.code), ['estimate-only'], 'view 10 reasons');
eq(view({ repoFiles: 2 }).value.outcome, 'AVAILABLE', 'view 2 files');
eq(view({ testMinutes: 5 }).value.outcome, 'UNKNOWN', 'view testMinutes'); eq(view({ testMinutes: 5 }).value.reasons, [{ code: 'no-figure', resource: 'testMinutes' }], 'view no-figure');
eq(newBudget(c.capacity).ok, false, 'empty capacity is refused by the broker');
// ROUND-2 additions (Director, 2026-11-07): digit-range boundaries of the date check and symbol keys (mutants that survived the first 86 checks)
eq(V('ChatGPT', [{ ...R0, date: '2026-1:-05' }]).error, 'bad-row', 'date char after 9 is not a digit');
eq(V('ChatGPT', [{ ...R0, date: '2026-/1-05' }]).error, 'bad-row', 'date char before 0 is not a digit');
eq(V('ChatGPT', [{ ...R0, date: '2026-12-09' }]).ok, true, 'date digits 0 and 9 accepted');
eq(V('ChatGPT', [{ ...R0, [Symbol('x')]: 1 }]).error, 'bad-row', 'symbol key on a row');
eq(pb({ cards: mk(1, 5), overheadChars: 0, history: [], [Symbol('x')]: 1 }).error, 'unknown-key', 'symbol key on the pack input');
console.log('BUD6 DIRECTOR CHECKS OK: ' + n + ' checks');
