/**
 * B03B1 Values: shared contract. DIRECTOR-OWNED: builders never edit this file.
 * Every reader is a pure function of a ScanContext; it never reads the real clock and never touches the dictionary.
 */
import type { Unit } from '../../../../tools/engines/numbers/unitConvert';

/** Local wall time given by the caller. Code never calls Date.now or new Date. */
export type Clock = { year: number; month: number; day: number; hour: number; minute: number };

export type ExtractedValue = {
  kind: 'number' | 'quantity' | 'percent' | 'duration' | 'date' | 'time' | 'datetime' | 'roman';
  /** Always equals the original text sliced by start and end. */
  text: string;
  start: number;
  end: number;
  /** 0 to 1. Weak means below 0.5. */
  confidence: number;
  /** Which structural facts decided it, in plain words. */
  reason: string;
  computed: true;
  value?: number;
  form?: 'digits' | 'words' | 'ordinal' | 'mixed';
  unit?: string;
  unitSymbol?: string;
  category?: string;
  ms?: number;
  /** ISO YYYY-MM-DD. */
  date?: string;
  dateAlternatives?: string[];
  /** HH:MM, 24-hour; two entries when am or pm is not stated. */
  times?: string[];
  error?: string;
  alternatives?: { kind: string; note: string }[];
  /** Smaller values that make this one (the number inside a quantity or duration). */
  parts?: ExtractedValue[];
};

export type ValuesOutcome =
  | { ok: true; values: ExtractedValue[] }
  | { ok: false; error: 'invalid-input' | 'too-long' | 'invalid-clock'; message: string };

export const VALUES_LIMITS = { maxCharacters: 20000 } as const;

/** Same shape as UNITS in unitConvert.ts. Tests may inject a different table. */
export type UnitTable = Readonly<Record<string, readonly Unit[]>>;
export type ExtractOptions = { units?: UnitTable };

/** The stretches of the message that are language (quotes and code are never read). Sorted, not overlapping. */
export type TextRange = { start: number; end: number };

export interface ScanContext {
  readonly text: string;
  readonly ranges: ReadonlyArray<TextRange>;
  readonly clock: Clock;
  readonly units: UnitTable;
}

/**
 * The four readers. Each receives what the earlier ones found and returns the COMPLETE list after its own work:
 * - readNumbers (B03B1a): numbers only.
 * - readQuantities (B03B1b): takes the numbers; a number that becomes part of a quantity, percent or duration is REMOVED
 *   from the list and kept in `parts` of the bigger value; every other value passes through unchanged.
 * - readDatesTimes (B03B1c): same idea for dates, times and datetimes (numbers inside them move into `parts`).
 * - readRoman (B03B1d): independent; finds Roman numerals only.
 * A value never crosses the edge of a TextRange.
 */
export type ValueReader = (ctx: ScanContext, found: ExtractedValue[]) => ExtractedValue[];
