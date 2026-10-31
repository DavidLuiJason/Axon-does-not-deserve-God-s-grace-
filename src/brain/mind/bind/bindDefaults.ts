/**
 * C1 PART 2: DECLARED DEFAULTS for required slots a person rarely says (Director PROPOSAL 2026-10-31; owner confirms each one).
 * One named file (FL13). A default is never silent: the binder lists it in `assumptions` and in `understood`, so the person can correct it.
 * Only choices that start something harmless or that the engine itself defaults to are listed.
 */
export interface SlotDefault { readonly value: string | number; readonly note: string }
export const SLOT_DEFAULTS: Readonly<Record<string, Readonly<Record<string, SlotDefault>>>> = Object.freeze({
  timer: Object.freeze({ operation: { value: 'start', note: 'starting a new timer' } }),
  stopwatch: Object.freeze({ operation: { value: 'start', note: 'starting a new stopwatch' } }),
  'qr-maker': Object.freeze({ level: { value: 'M', note: 'using medium error correction' } }),
  'random-picker': Object.freeze({ count: { value: 1, note: 'picking one' } }),
  calculator: Object.freeze({ angle: { value: 'rad', note: 'using radians for angles' } }),
});
