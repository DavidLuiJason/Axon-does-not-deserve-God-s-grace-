import { addOnlyRecord } from '../../../generated/mergeGenerated';
import { GENERATED_SLOT_DEFAULTS } from '../../../generated/wiredBindDefaults';

/**
 * C1 PART 2: DECLARED DEFAULTS for required slots a person rarely says (Director PROPOSAL 2026-10-31; owner confirms each one).
 * One named file (FL13). A default is never silent: the binder lists it in `assumptions` and in `understood`, so the person can correct it.
 * Only choices that start something harmless or that the engine itself defaults to are listed.
 */
export interface SlotDefault { readonly value: string | number | boolean; readonly note: string; /** SLOT2: also fill this slot when it is OPTIONAL (a spoken default of an option the runner would otherwise leave to the engine) */ readonly fillOptional?: true }
const HAND_SLOT_DEFAULTS: Readonly<Record<string, Readonly<Record<string, SlotDefault>>>> = Object.freeze({
  timer: Object.freeze({ operation: { value: 'start', note: 'starting a new timer' } }),
  stopwatch: Object.freeze({ operation: { value: 'start', note: 'starting a new stopwatch' } }),
  'qr-maker': Object.freeze({ level: { value: 'M', note: 'using medium error correction' } }),
  'random-picker': Object.freeze({ count: { value: 1, note: 'a count of one' }, items: { value: '', note: 'no list given' } }),
  calculator: Object.freeze({ angle: { value: 'rad', note: 'using radians for angles' } }),
  'find-replace': Object.freeze({ replaceAll: { value: true, note: 'replacing every match', fillOptional: true as const }, caseSensitive: { value: true, note: 'matching upper and lower case exactly', fillOptional: true as const } }),
  'password-generator': Object.freeze({ length: { value: 16, note: 'a 16 character password' }, options: { value: '{"lower":true,"upper":true,"digits":true,"symbols":true}', note: 'upper and lower case letters, digits and symbols' } }),
  'sort-lines': Object.freeze({ mode: { value: 'ascending', note: 'sorting in ascending order, from a to z' } }),
});

/** AUTO-WIRE part 2: hand defaults plus generated ones (src/generated/wiredBindDefaults.ts); a hand default always wins. */
export const SLOT_DEFAULTS: Readonly<Record<string, Readonly<Record<string, SlotDefault>>>> = Object.freeze(addOnlyRecord(HAND_SLOT_DEFAULTS, GENERATED_SLOT_DEFAULTS, 'bind default'));
