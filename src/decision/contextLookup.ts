type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type ContextKind = 'text' | 'choice' | 'file' | 'number' | 'yes-no' | 'duration' | 'time' | 'date';
export type ContextSource = 'selected' | 'attached' | 'previous-reference' | 'answer';
export type ContextItem =
  | { readonly id: string; readonly source: 'selected' | 'previous-reference'; readonly kind: ContextKind }
  | { readonly id: string; readonly source: 'attached'; readonly kind: 'file'; readonly readable: boolean }
  | { readonly id: string; readonly source: 'attached'; readonly kind: Exclude<ContextKind, 'file'> }
  | { readonly id: string; readonly source: 'answer'; readonly kind: ContextKind; readonly slot: string };
export type MissingSlot = { readonly slot: string; readonly kind: ContextKind };
export type ContextTraceEntry = {
  readonly slot: string;
  readonly outcome: 'context' | 'safe-step' | 'not-filled';
  readonly rule: 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'none';
  readonly itemId: string | null;
  readonly reason: 'ok' | 'ambiguous' | 'no-candidate' | 'decision-slot';
};
export type ContextLookupValue = {
  readonly contextFills: readonly string[];
  readonly safeStepFills: readonly string[];
  readonly trace: readonly ContextTraceEntry[];
};

const MESSAGE = 'Context lookup input is invalid.';
const KINDS: readonly ContextKind[] = ['text','choice','file','number','yes-no','duration','time','date'];
const SOURCES: readonly ContextSource[] = ['selected','attached','previous-reference','answer'];
const CAPS: Readonly<Record<ContextSource, number>> = {
  selected: 4, attached: 8, 'previous-reference': 8, answer: 8
};

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
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function isKind(value: unknown): value is ContextKind {
  return typeof value === 'string' && KINDS.includes(value as ContextKind);
}
function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: MESSAGE });
}
function success(value: ContextLookupValue): EngineResult<ContextLookupValue> {
  return Object.freeze({ ok: true as const, value });
}
function validateMissing(value: unknown): value is MissingSlot[] {
  if (!Array.isArray(value)) return false;
  const slots: string[] = [];
  for (const entry of value) {
    if (!exactKeys(entry, ['slot','kind'])) return false;
    if (!nonEmpty(entry.slot) || !isKind(entry.kind) || slots.includes(entry.slot)) return false;
    slots.push(entry.slot);
  }
  return true;
}
function validateItems(value: unknown): value is ContextItem[] {
  if (!Array.isArray(value)) return false;
  const ids: string[] = [];
  for (const item of value) {
    if (!isObject(item) || !nonEmpty(item.id) || ids.includes(item.id) ||
        typeof item.source !== 'string' || !SOURCES.includes(item.source as ContextSource) || !isKind(item.kind)) return false;
    ids.push(item.id);
    const source = item.source as ContextSource;
    const keys = source === 'answer' ? ['id','source','kind','slot'] :
      source === 'attached' && item.kind === 'file' ? ['id','source','kind','readable'] :
      ['id','source','kind'];
    if (!exactKeys(item, keys)) return false;
    if (source === 'answer' && !nonEmpty(item.slot)) return false;
    if (source === 'attached' && item.kind === 'file' && typeof item.readable !== 'boolean') return false;
  }
  return true;
}
function deepFreezeValue(value: {
  contextFills: string[]; safeStepFills: string[]; trace: ContextTraceEntry[];
}): ContextLookupValue {
  for (const entry of value.trace) Object.freeze(entry);
  Object.freeze(value.contextFills);
  Object.freeze(value.safeStepFills);
  Object.freeze(value.trace);
  return Object.freeze(value);
}

export function lookupContext(input: unknown): EngineResult<ContextLookupValue> {
  try {
    if (!isObject(input)) return failure('bad-input');
    if (!exactKeys(input, ['missing','items'])) return failure('unknown-key');
    if (!validateMissing(input.missing)) return failure('bad-missing');
    if (!validateItems(input.items)) return failure('bad-items');

    const counts: Record<ContextSource, number> = {
      selected: 0, attached: 0, 'previous-reference': 0, answer: 0
    };
    for (const item of input.items) counts[item.source] += 1;
    for (const source of SOURCES) if (counts[source] > CAPS[source]) return failure('too-many-items');

    const contextFills: string[] = [];
    const safeStepFills: string[] = [];
    const trace: ContextTraceEntry[] = [];
    for (const missing of input.missing) {
      const answers = input.items.filter(item => item.source === 'answer' &&
        item.slot === missing.slot && item.kind === missing.kind);
      if (answers.length > 1) {
        trace.push({ slot: missing.slot, outcome: 'not-filled', rule: 'R1', itemId: null, reason: 'ambiguous' });
        continue;
      }
      if (answers.length === 1) {
        contextFills.push(missing.slot);
        trace.push({ slot: missing.slot, outcome: 'context', rule: 'R1', itemId: answers[0].id, reason: 'ok' });
        continue;
      }
      if (missing.kind === 'choice' || missing.kind === 'yes-no') {
        trace.push({ slot: missing.slot, outcome: 'not-filled', rule: 'R0', itemId: null, reason: 'decision-slot' });
        continue;
      }

      const orderedSources: readonly ContextSource[] = ['selected','attached','previous-reference'];
      let decided = false;
      for (const source of orderedSources) {
        const candidates = input.items.filter(item => item.source === source && item.kind === missing.kind);
        if (candidates.length > 1) {
          const rule = source === 'selected' ? 'R2' : source === 'attached' ? 'R3' : 'R4';
          trace.push({ slot: missing.slot, outcome: 'not-filled', rule, itemId: null, reason: 'ambiguous' });
          decided = true;
          break;
        }
        if (candidates.length === 1) {
          const rule = source === 'selected' ? 'R2' : source === 'attached' ? 'R3' : 'R4';
          contextFills.push(missing.slot);
          trace.push({ slot: missing.slot, outcome: 'context', rule, itemId: candidates[0].id, reason: 'ok' });
          decided = true;
          break;
        }
      }
      if (decided) continue;

      if (missing.kind === 'text') {
        const readable = input.items.filter(item => item.source === 'attached' && item.kind === 'file' && item.readable === true);
        if (readable.length > 1) {
          trace.push({ slot: missing.slot, outcome: 'not-filled', rule: 'R5', itemId: null, reason: 'ambiguous' });
          continue;
        }
        if (readable.length === 1) {
          safeStepFills.push(missing.slot);
          trace.push({ slot: missing.slot, outcome: 'safe-step', rule: 'R5', itemId: readable[0].id, reason: 'ok' });
          continue;
        }
      }
      trace.push({ slot: missing.slot, outcome: 'not-filled', rule: 'none', itemId: null, reason: 'no-candidate' });
    }
    return success(deepFreezeValue({ contextFills, safeStepFills, trace }));
  } catch {
    return failure('bad-input');
  }
}
