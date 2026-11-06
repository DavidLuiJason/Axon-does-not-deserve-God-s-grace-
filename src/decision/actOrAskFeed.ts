type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

import type { ActOrAskInput } from './actOrAsk';

export type FeedEffect = 'shows-result'|'reads-file'|'writes-file'|'stores-note'|'changes-setting'|'uses-camera'|'uses-microphone'|'uses-network'|'sends'|'spends'|'deletes';
export type FeedPrecondition = 'permission'|'owner-approval'|'network-on'|'device-capable';
export type FeedSchema = { readonly tool:string; readonly effects:readonly FeedEffect[]; readonly preconditions:readonly FeedPrecondition[]; readonly undo:'not-needed'|'by-tool'|'by-removal'|'irreversible'; readonly slots:readonly { readonly name:string; readonly required:boolean }[] };
export type FeedResolution =
  | { readonly kind:'match'; readonly tool:string; readonly missingSlots:readonly string[]; readonly evidence?:'concept'|'value'|'both' }
  | { readonly kind:'ask'; readonly choices:readonly string[] }
  | { readonly kind:'none' } | { readonly kind:'not-a-request' } | { readonly kind:'negated' } | { readonly kind:'unavailable' };
export type ActOrAskFeedArgs = { readonly resolution:FeedResolution; readonly schemas:readonly FeedSchema[]; readonly slotDefaults:readonly { readonly tool:string; readonly slot:string }[]; readonly extraReadingTools:readonly string[]; readonly contextFills:readonly string[]; readonly safeStepFills:readonly string[]; readonly charter:{ readonly never:readonly string[]; readonly ask:readonly string[] }; readonly costly:boolean };

const ERROR_MESSAGE = 'Act or ask feed input is invalid.';
const ARG_KEYS = ['resolution','schemas','slotDefaults','extraReadingTools','contextFills','safeStepFills','charter','costly'];
const EFFECTS: readonly FeedEffect[] = ['shows-result','reads-file','writes-file','stores-note','changes-setting','uses-camera','uses-microphone','uses-network','sends','spends','deletes'];
const PRECONDITIONS: readonly FeedPrecondition[] = ['permission','owner-approval','network-on','device-capable'];
const PURE_EFFECTS: readonly FeedEffect[] = ['shows-result','reads-file','uses-camera','uses-microphone','uses-network'];

function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: ERROR_MESSAGE });
}
function success<T>(value: T): EngineResult<T> {
  return Object.freeze({ ok: true as const, value: Object.freeze(value) });
}
function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: readonly string[]): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) return false;
  for (const key of own) if (typeof key !== 'string' || !keys.includes(key)) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  return true;
}
function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function distinctStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const seen: string[] = [];
  for (const item of value) {
    if (!nonEmptyString(item) || seen.includes(item)) return false;
    seen.push(item);
  }
  return true;
}
function enumArray<T extends string>(value: unknown, allowed: readonly T[]): value is T[] {
  if (!Array.isArray(value)) return false;
  const seen: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item as T) || seen.includes(item)) return false;
    seen.push(item);
  }
  return true;
}
function validateResolution(value: unknown): value is FeedResolution {
  if (!isObject(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'match') {
    const keys = Object.prototype.hasOwnProperty.call(value, 'evidence')
      ? ['kind','tool','missingSlots','evidence'] : ['kind','tool','missingSlots'];
    if (!exactKeys(value, keys) || !nonEmptyString(value.tool) || !distinctStrings(value.missingSlots)) return false;
    return !Object.prototype.hasOwnProperty.call(value, 'evidence') ||
      value.evidence === 'concept' || value.evidence === 'value' || value.evidence === 'both';
  }
  if (value.kind === 'ask') return exactKeys(value, ['kind','choices']) &&
    Array.isArray(value.choices) && value.choices.length >= 2 && value.choices.length <= 4 && distinctStrings(value.choices);
  if (value.kind === 'none' || value.kind === 'not-a-request' || value.kind === 'negated' || value.kind === 'unavailable') {
    return exactKeys(value, ['kind']);
  }
  return false;
}
function validateSchemas(value: unknown): value is FeedSchema[] {
  if (!Array.isArray(value)) return false;
  const tools: string[] = [];
  for (const item of value) {
    if (!exactKeys(item, ['tool','effects','preconditions','undo','slots'])) return false;
    if (!nonEmptyString(item.tool) || tools.includes(item.tool)) return false;
    tools.push(item.tool);
    if (!enumArray(item.effects, EFFECTS) || !enumArray(item.preconditions, PRECONDITIONS)) return false;
    if (item.undo !== 'not-needed' && item.undo !== 'by-tool' && item.undo !== 'by-removal' && item.undo !== 'irreversible') return false;
    if (!Array.isArray(item.slots)) return false;
    const names: string[] = [];
    for (const slot of item.slots) {
      if (!exactKeys(slot, ['name','required']) || !nonEmptyString(slot.name) || names.includes(slot.name) || typeof slot.required !== 'boolean') return false;
      names.push(slot.name);
    }
  }
  return true;
}
function validateSlotDefaults(value: unknown): value is Array<{ readonly tool:string; readonly slot:string }> {
  if (!Array.isArray(value)) return false;
  for (const item of value) {
    if (!exactKeys(item, ['tool','slot']) || !nonEmptyString(item.tool) || !nonEmptyString(item.slot)) return false;
  }
  return true;
}
function validateStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (const item of value) if (!nonEmptyString(item)) return false;
  return true;
}
function findSchema(schemas: readonly FeedSchema[], tool: string): FeedSchema | undefined {
  return schemas.find(schema => schema.tool === tool);
}
function hasEffect(schema: FeedSchema, effect: FeedEffect): boolean {
  return schema.effects.includes(effect);
}
function undoRank(value: 'READ-ONLY'|'UNDOABLE'|'NOT-UNDOABLE'): number {
  return value === 'NOT-UNDOABLE' ? 3 : value === 'UNDOABLE' ? 2 : 1;
}
function outwardRank(value: 'NONE'|'SEND'|'DELETE'|'MONEY'): number {
  return value === 'MONEY' ? 4 : value === 'DELETE' ? 3 : value === 'SEND' ? 2 : 1;
}
function permissionRank(value: 'ALLOW'|'ASK'|'NEVER'): number {
  return value === 'NEVER' ? 3 : value === 'ASK' ? 2 : 1;
}
export function makeActOrAskInput(args: ActOrAskFeedArgs): EngineResult<ActOrAskInput> {
  try {
    if (!isObject(args)) return failure('bad-input');
    if (Object.prototype.hasOwnProperty.call(args, 'confidence')) return failure('confidence-not-allowed');
    for (const key of Reflect.ownKeys(args)) {
      if (typeof key !== 'string' || !ARG_KEYS.includes(key)) return failure('unknown-key');
    }
    if (!hasOwn(args, 'resolution') || !validateResolution(args.resolution)) return failure('bad-resolution');
    if (!hasOwn(args, 'schemas') || !validateSchemas(args.schemas)) return failure('bad-schemas');
    if (!hasOwn(args, 'slotDefaults') || !validateSlotDefaults(args.slotDefaults)) return failure('bad-slot-defaults');
    if (!hasOwn(args, 'extraReadingTools') || !Array.isArray(args.extraReadingTools) || args.extraReadingTools.length > 4 ||
        !validateStrings(args.extraReadingTools) || (args.extraReadingTools.length > 0 && args.resolution.kind === 'none')) {
      return failure('bad-extra-readings');
    }
    if (!hasOwn(args, 'contextFills') || !validateStrings(args.contextFills)) return failure('bad-context-fills');
    if (!hasOwn(args, 'safeStepFills') || !validateStrings(args.safeStepFills)) return failure('bad-safe-fills');
    if (!hasOwn(args, 'charter') || !exactKeys(args.charter, ['never','ask']) || !validateStrings(args.charter.never) || !validateStrings(args.charter.ask)) {
      return failure('bad-charter');
    }
    if (!hasOwn(args, 'costly') || typeof args.costly !== 'boolean') return failure('bad-costly');
    if (args.resolution.kind === 'not-a-request' || args.resolution.kind === 'negated' || args.resolution.kind === 'unavailable') {
      return failure('not-for-j6');
    }

    const readingTools: string[] = [];
    if (args.resolution.kind === 'match') readingTools.push(args.resolution.tool);
    else if (args.resolution.kind === 'ask') readingTools.push(...args.resolution.choices);
    readingTools.push(...args.extraReadingTools);
    const schemasForReadings: FeedSchema[] = [];
    for (const tool of readingTools) {
      if (!findSchema(args.schemas, tool)) return failure('unknown-tool');
      if (!schemasForReadings.includes(findSchema(args.schemas, tool)!)) schemasForReadings.push(findSchema(args.schemas, tool)!);
    }
    if (args.resolution.kind === 'match') {
      const matched = findSchema(args.schemas, args.resolution.tool)!;
      for (const missing of args.resolution.missingSlots) {
        if (!matched.slots.some(slot => slot.name === missing && slot.required === true)) return failure('bad-missing-slot');
      }
    }

    let permission: 'ALLOW'|'ASK'|'NEVER' = 'ALLOW';
    let undo: 'READ-ONLY'|'UNDOABLE'|'NOT-UNDOABLE' = 'READ-ONLY';
    let outward: 'NONE'|'SEND'|'DELETE'|'MONEY' = 'NONE';
    let readings: 'ONE-CLEAR'|'TWO-CLOSE'|'NO-READING' = 'ONE-CLEAR';
    let missing: 'NONE'|'CONTEXT-ANSWERS'|'SAFE-STEP-ANSWERS'|'OWNER-ONLY' = 'NONE';
    let readingChangesResult = false;
    let inputChangesResult = false;

    if (args.resolution.kind === 'none') {
      readings = 'NO-READING';
    } else {
      readings = schemasForReadings.length > 1 ||
        (args.resolution.kind === 'match' && args.resolution.evidence === 'value') ? 'TWO-CLOSE' : 'ONE-CLEAR';
      readingChangesResult = readings === 'TWO-CLOSE';

      for (const schema of schemasForReadings) {
        let toolUndo: 'READ-ONLY'|'UNDOABLE'|'NOT-UNDOABLE';
        if (schema.undo === 'irreversible') toolUndo = 'NOT-UNDOABLE';
        else if (schema.undo === 'not-needed') {
          toolUndo = schema.effects.some(effect => !PURE_EFFECTS.includes(effect)) ? 'NOT-UNDOABLE' : 'READ-ONLY';
        } else toolUndo = 'UNDOABLE';
        if (undoRank(toolUndo) > undoRank(undo)) undo = toolUndo;

        const toolOutward = hasEffect(schema, 'spends') ? 'MONEY' :
          hasEffect(schema, 'deletes') ? 'DELETE' : hasEffect(schema, 'sends') ? 'SEND' : 'NONE';
        if (outwardRank(toolOutward) > outwardRank(outward)) outward = toolOutward;

        const toolPermission = args.charter.never.includes(schema.tool) ? 'NEVER' :
          (args.charter.ask.includes(schema.tool) || schema.preconditions.includes('owner-approval') ||
          hasEffect(schema, 'sends') || hasEffect(schema, 'spends') || hasEffect(schema, 'deletes')) ? 'ASK' : 'ALLOW';
        if (permissionRank(toolPermission) > permissionRank(permission)) permission = toolPermission;
      }

      if (args.resolution.kind === 'match') {
        const matchedTool = args.resolution.tool;
        let missingRank = 0;
        for (const slot of args.resolution.missingSlots) {
          const slotKind = args.contextFills.includes(slot) ? 'CONTEXT-ANSWERS' :
            args.safeStepFills.includes(slot) ? 'SAFE-STEP-ANSWERS' : 'OWNER-ONLY';
          const rank = slotKind === 'OWNER-ONLY' ? 3 : slotKind === 'SAFE-STEP-ANSWERS' ? 2 : 1;
          if (rank > missingRank) missingRank = rank;
          if (slotKind === 'OWNER-ONLY' &&
              !args.slotDefaults.some(entry => entry.tool === matchedTool && entry.slot === slot)) inputChangesResult = true;
        }
        missing = missingRank === 3 ? 'OWNER-ONLY' : missingRank === 2 ? 'SAFE-STEP-ANSWERS' :
          missingRank === 1 ? 'CONTEXT-ANSWERS' : 'NONE';
      }
    }

    const value: ActOrAskInput = {
      permission, undo, outward, costly: args.costly, readings, missing, readingChangesResult, inputChangesResult
    };
    return success(value);
  } catch {
    return failure('bad-input');
  }
}

