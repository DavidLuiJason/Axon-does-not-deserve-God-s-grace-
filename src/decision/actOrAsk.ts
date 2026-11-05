type EngineSuccess<T> = { readonly ok: true; readonly value: T };
type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type ActOrAskInput = { readonly permission:'ALLOW'|'ASK'|'NEVER'; readonly undo:'READ-ONLY'|'UNDOABLE'|'NOT-UNDOABLE'; readonly outward:'NONE'|'SEND'|'DELETE'|'MONEY'; readonly costly:boolean; readonly readings:'ONE-CLEAR'|'TWO-CLOSE'|'NO-READING'; readonly missing:'NONE'|'CONTEXT-ANSWERS'|'SAFE-STEP-ANSWERS'|'OWNER-ONLY'; readonly readingChangesResult:boolean; readonly inputChangesResult:boolean };
export type ActOrAskResult = { readonly outcome:'ACT'|'ASK'|'BLOCK'; readonly askKind:null|'CLARIFICATION'|'MISSING-INPUT'|'APPROVAL'; readonly sayReading:boolean; readonly reasonCodes:readonly string[] };

const ERROR_MESSAGE = 'Act or ask input is invalid.';
const ALLOWED_KEYS = ['permission','undo','outward','costly','readings','missing','readingChangesResult','inputChangesResult'];

function failure<T>(error: string): EngineResult<T> {
  return Object.freeze({ ok: false as const, error, message: ERROR_MESSAGE });
}

export function decideActOrAsk(input: ActOrAskInput): EngineResult<ActOrAskResult> {
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return failure('bad-input');
    const raw = input as unknown as Record<PropertyKey, unknown>;
    if (Object.prototype.hasOwnProperty.call(raw, 'confidence')) return failure('confidence-not-allowed');
    for (const key of Reflect.ownKeys(raw)) {
      if (typeof key !== 'string' || !ALLOWED_KEYS.includes(key)) return failure('unknown-key');
    }
    if (raw.permission !== 'ALLOW' && raw.permission !== 'ASK' && raw.permission !== 'NEVER') return failure('bad-permission');
    if (raw.undo !== 'READ-ONLY' && raw.undo !== 'UNDOABLE' && raw.undo !== 'NOT-UNDOABLE') return failure('bad-undo');
    if (raw.outward !== 'NONE' && raw.outward !== 'SEND' && raw.outward !== 'DELETE' && raw.outward !== 'MONEY') return failure('bad-outward');
    if (typeof raw.costly !== 'boolean') return failure('bad-costly');
    if (raw.readings !== 'ONE-CLEAR' && raw.readings !== 'TWO-CLOSE' && raw.readings !== 'NO-READING') return failure('bad-readings');
    if (raw.missing !== 'NONE' && raw.missing !== 'CONTEXT-ANSWERS' && raw.missing !== 'SAFE-STEP-ANSWERS' && raw.missing !== 'OWNER-ONLY') return failure('bad-missing');
    if (typeof raw.readingChangesResult !== 'boolean') return failure('bad-reading-changes');
    if (typeof raw.inputChangesResult !== 'boolean') return failure('bad-input-changes');
    if (raw.undo === 'READ-ONLY' && raw.outward !== 'NONE') return failure('read-only-with-effect');

    if (raw.permission === 'NEVER') {
      return success({ outcome: 'BLOCK', askKind: null, sayReading: false, reasonCodes: ['permission-never'] });
    }
    if (raw.readings === 'NO-READING') {
      return success({ outcome: 'ASK', askKind: 'CLARIFICATION', sayReading: false, reasonCodes: ['no-reading'] });
    }

    const canUndo = raw.undo !== 'NOT-UNDOABLE' && raw.outward === 'NONE';
    const actReasons: string[] = [];
    let sayReading = false;
    if (raw.readings === 'ONE-CLEAR') {
      actReasons.push('one-reading');
    } else if (raw.readingChangesResult === false) {
      actReasons.push('readings-same-result');
    } else if (canUndo) {
      actReasons.push('two-readings-undoable');
      sayReading = true;
    } else {
      return success({ outcome: 'ASK', askKind: 'CLARIFICATION', sayReading: false, reasonCodes: ['two-readings', 'not-undoable'] });
    }

    if (raw.missing === 'OWNER-ONLY' && raw.inputChangesResult === true) {
      return success({ outcome: 'ASK', askKind: 'MISSING-INPUT', sayReading: false, reasonCodes: ['missing-input'] });
    }
    if (raw.missing === 'OWNER-ONLY') actReasons.push('default-used');
    else if (raw.missing === 'CONTEXT-ANSWERS') actReasons.push('context-answers');
    else if (raw.missing === 'SAFE-STEP-ANSWERS') actReasons.push('safe-step-answers');

    const approvalReasons: string[] = [];
    if (raw.permission === 'ASK') approvalReasons.push('permission-ask');
    if (raw.undo === 'NOT-UNDOABLE') approvalReasons.push('not-undoable');
    if (raw.outward === 'SEND') approvalReasons.push('sends');
    if (raw.outward === 'DELETE') approvalReasons.push('deletes');
    if (raw.outward === 'MONEY') approvalReasons.push('spends-money');
    if (raw.costly === true) approvalReasons.push('costly');
    if (approvalReasons.length > 0) {
      return success({ outcome: 'ASK', askKind: 'APPROVAL', sayReading: false, reasonCodes: approvalReasons });
    }
    return success({ outcome: 'ACT', askKind: null, sayReading, reasonCodes: actReasons });
  } catch {
    return failure('bad-input');
  }
}

function success(value: ActOrAskResult): EngineResult<ActOrAskResult> {
  const reasonCodes = Object.freeze(value.reasonCodes.slice());
  const frozenValue = Object.freeze({ ...value, reasonCodes });
  return Object.freeze({ ok: true as const, value: frozenValue });
}
