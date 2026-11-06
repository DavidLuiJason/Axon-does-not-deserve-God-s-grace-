import { BUDGET_VIEW_TABLE } from './budgetView';
import { BUILDER_RESOURCES } from './resources/builderResources';

type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

type FigureReason = 'no-ok-rows' | 'conflict' | 'ok';
type FigureBasis = 'OBSERVED' | 'ESTIMATE';
type FigureValue = {
  readonly figure: number | null; readonly reason: FigureReason;
  readonly okRows: number; readonly badRows: number; readonly basis: FigureBasis | null;
};
type BuilderFigureSet = {
  readonly promptChars: FigureValue; readonly miniBaseFiles: FigureValue;
  readonly filesReturned: FigureValue; readonly directorCommands: FigureValue;
};
type BuilderVectorValue = {
  readonly builder: string; readonly runs: number; readonly figures: BuilderFigureSet;
  readonly capacity: Readonly<Record<string, number>>;
  readonly unknown: readonly { readonly resource: string; readonly reason: string }[];
};
type BatchPlanValue = {
  readonly outcome: 'NOTHING' | 'TOO-FEW' | 'PACKED'; readonly target: number;
  readonly targetReason: 'start' | 'shrink' | 'turns-unknown' | 'raise';
  readonly inMaster: readonly string[];
  readonly inMiniBase: readonly { readonly id: string; readonly reason: 'no-room' | 'target-reached' | 'over-limit' }[];
  readonly usedChars: number;
};

export const BATCH_PLAN_TABLE = Object.freeze({
  masterChars: 16000, minCards: 3, startCards: 6, ceilingCards: 10,
  raiseStep: 2, maxDirectorTurns: 2
});

function failure<T>(error: string, message: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message });
}
function success<T>(value: T): EngineResult<T> {
  return Object.freeze({ ok: true as const, value });
}
function plainObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every(key => typeof key === 'string' && expected.includes(key));
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
function nullablePositiveInteger(value: unknown): value is number | null {
  return value === null || positiveInteger(value);
}
function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value as object)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10) return false;
  const hyphens = value.charCodeAt(4) === 45 && value.charCodeAt(7) === 45;
  if (!hyphens) return false;
  for (let i = 0; i < 10; i += 1) {
    if (i === 4 || i === 7) continue;
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}
const ROW_KEYS = ['id','date','builder','mode','cards','accepted','promptChars','miniBaseFiles','filesReturned','directorCommands','directorTurns','outcome','source'] as const;
type LogRow = {
  id: string; date: string; builder: string; mode: 'A'|'B'|'D'; cards: number; accepted: number|null;
  promptChars: number|null; miniBaseFiles: number|null; filesReturned: number|null;
  directorCommands: number|null; directorTurns: number|null;
  outcome: 'OK'|'PARTIAL'|'FAILED'; source: 'MEASURED'|'REPORTED';
};
function validRow(value: unknown): value is LogRow {
  if (!plainObject(value) || !exactKeys(value, ROW_KEYS)) return false;
  const r = value;
  if (!nonEmptyString(r.id) || !validDate(r.date) || !nonEmptyString(r.builder) ||
      (r.mode !== 'A' && r.mode !== 'B' && r.mode !== 'D') || !positiveInteger(r.cards)) return false;
  if (!(r.accepted === null || (typeof r.accepted === 'number' && Number.isInteger(r.accepted) && r.accepted >= 0 && r.accepted <= r.cards))) return false;
  for (const key of ['promptChars','miniBaseFiles','filesReturned','directorCommands','directorTurns'] as const) {
    if (!nullablePositiveInteger(r[key])) return false;
  }
  if (r.outcome !== 'OK' && r.outcome !== 'PARTIAL' && r.outcome !== 'FAILED') return false;
  if (r.source !== 'MEASURED' && r.source !== 'REPORTED') return false;
  if (r.outcome === 'OK' && r.accepted !== null && r.accepted !== r.cards) return false;
  if (r.outcome === 'PARTIAL' && r.accepted !== null && r.accepted >= r.cards) return false;
  if (r.outcome === 'FAILED' && r.accepted !== null && r.accepted !== 0) return false;
  return true;
}
function figure(rows: readonly LogRow[], key: 'promptChars'|'miniBaseFiles'|'filesReturned'|'directorCommands'): FigureValue {
  const withValue = rows.filter(row => row[key] !== null);
  const good = withValue.filter(row => row.outcome === 'OK').map(row => row[key] as number);
  const bad = withValue.filter(row => row.outcome !== 'OK').map(row => row[key] as number);
  if (good.length === 0) return { figure: null, reason: 'no-ok-rows', okRows: 0, badRows: bad.length, basis: null };
  const safe = Math.max(...good);
  if (bad.length > 0 && Math.min(...bad) <= safe) {
    return { figure: null, reason: 'conflict', okRows: good.length, badRows: bad.length, basis: null };
  }
  return { figure: safe, reason: 'ok', okRows: good.length, badRows: bad.length,
    basis: good.length >= BUDGET_VIEW_TABLE.sampleMinimum ? 'OBSERVED' : 'ESTIMATE' };
}
export function builderVector(input: unknown): EngineResult<BuilderVectorValue> {
  try {
    if (!plainObject(input)) return failure('bad-input', 'Builder vector input is invalid.');
    if (!exactKeys(input, ['rows','builder'])) return failure('unknown-key', 'Builder vector input is invalid.');
    if (!nonEmptyString(input.builder)) return failure('bad-builder', 'Builder vector input is invalid.');
    if (!Array.isArray(input.rows)) return failure('bad-rows', 'Builder vector input is invalid.');
    const rows: LogRow[] = [];
    for (const row of input.rows) {
      if (!validRow(row)) return failure('bad-row', 'Builder vector input is invalid.');
      rows.push(row);
    }
    const ids = new Set<string>();
    for (const row of rows) {
      if (ids.has(row.id)) return failure('duplicate-row-id', 'Builder vector input is invalid.');
      ids.add(row.id);
    }
    const selected = rows.filter(row => row.builder === input.builder);
    const figures = {
      promptChars: figure(selected, 'promptChars'),
      miniBaseFiles: figure(selected, 'miniBaseFiles'),
      filesReturned: figure(selected, 'filesReturned'),
      directorCommands: figure(selected, 'directorCommands')
    };
    const capacity: Record<string, number> = {};
    const unknown: Array<{ resource: string; reason: string }> = [];
    for (const item of BUILDER_RESOURCES) {
      if (item.name === 'repoFiles' && figures.filesReturned.figure !== null) capacity.repoFiles = figures.filesReturned.figure;
      else if (item.name === 'reviewCommands' && figures.directorCommands.figure !== null) capacity.reviewCommands = figures.directorCommands.figure;
      else {
        const reason = item.name === 'repoFiles' ? figures.filesReturned.reason :
          item.name === 'reviewCommands' ? figures.directorCommands.reason : 'no-log-field';
        unknown.push({ resource: item.name, reason });
      }
    }
    return success(deepFreeze({ builder: input.builder, runs: selected.length, figures, capacity, unknown }));
  } catch {
    return failure('bad-input', 'Builder vector input is invalid.');
  }
}

type Card = { id: string; chars: number };
type History = { cards: number; accepted: number; directorTurns: number|null };
export function packBatch(input: unknown): EngineResult<BatchPlanValue> {
  try {
    if (!plainObject(input)) return failure('bad-input', 'Batch plan input is invalid.');
    if (!exactKeys(input, ['cards','overheadChars','history'])) return failure('unknown-key', 'Batch plan input is invalid.');
    if (!Array.isArray(input.cards) || input.cards.length === 0) return failure('bad-cards', 'Batch plan input is invalid.');
    const cards: Card[] = [];
    const ids = new Set<string>();
    for (const item of input.cards) {
      if (!plainObject(item) || !exactKeys(item, ['id','chars']) || !nonEmptyString(item.id) ||
          !positiveInteger(item.chars) || ids.has(item.id)) return failure('bad-cards', 'Batch plan input is invalid.');
      ids.add(item.id);
      cards.push({ id: item.id, chars: item.chars });
    }
    if (typeof input.overheadChars !== 'number' || !Number.isInteger(input.overheadChars) || input.overheadChars < 0) {
      return failure('bad-overhead', 'Batch plan input is invalid.');
    }
    if (!Array.isArray(input.history)) return failure('bad-history', 'Batch plan input is invalid.');
    const history: History[] = [];
    for (const item of input.history) {
      if (!plainObject(item) || !exactKeys(item, ['cards','accepted','directorTurns']) ||
          !positiveInteger(item.cards) || typeof item.accepted !== 'number' || !Number.isInteger(item.accepted) ||
          item.accepted < 0 || item.accepted > item.cards || !nullablePositiveInteger(item.directorTurns)) {
        return failure('bad-history', 'Batch plan input is invalid.');
      }
      history.push({ cards: item.cards, accepted: item.accepted, directorTurns: item.directorTurns });
    }
    let desired: number;
    let targetReason: BatchPlanValue['targetReason'];
    if (history.length === 0) { desired = BATCH_PLAN_TABLE.startCards; targetReason = 'start'; }
    else {
      const last = history[history.length - 1];
      if (last.accepted < last.cards || (last.directorTurns !== null && last.directorTurns > BATCH_PLAN_TABLE.maxDirectorTurns)) {
        desired = last.cards - 1; targetReason = 'shrink';
      } else if (last.directorTurns === null) { desired = last.cards; targetReason = 'turns-unknown'; }
      else { desired = last.cards + BATCH_PLAN_TABLE.raiseStep; targetReason = 'raise'; }
    }
    const target = Math.max(BATCH_PLAN_TABLE.minCards, Math.min(BATCH_PLAN_TABLE.ceilingCards, desired));
    const usable = BATCH_PLAN_TABLE.masterChars - input.overheadChars;
    const inMaster: string[] = [];
    const inMiniBase: Array<{ id: string; reason: 'no-room'|'target-reached'|'over-limit' }> = [];
    let usedChars = 0;
    for (const card of cards) {
      if (usable <= 0) inMiniBase.push({ id: card.id, reason: 'no-room' });
      else if (inMaster.length >= target) inMiniBase.push({ id: card.id, reason: 'target-reached' });
      else if (card.chars > usable) inMiniBase.push({ id: card.id, reason: 'over-limit' });
      else if (usedChars + card.chars > usable) inMiniBase.push({ id: card.id, reason: 'no-room' });
      else { inMaster.push(card.id); usedChars += card.chars; }
    }
    const outcome = inMaster.length === 0 ? 'NOTHING' : inMaster.length < BATCH_PLAN_TABLE.minCards ? 'TOO-FEW' : 'PACKED';
    return success(deepFreeze({ outcome, target, targetReason, inMaster, inMiniBase, usedChars }));
  } catch {
    return failure('bad-input', 'Batch plan input is invalid.');
  }
}
