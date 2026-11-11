/** PROPOSED for Wave 4 Director review: single-word aliases to the Date Calculator's own values only. */
export const DATE_OPERATION_WORDS: Readonly<Record<string, string>> = Object.freeze({
  add: 'add',
  difference: 'difference',
  weekday: 'weekday',
  dayofyear: 'day-of-year',
  isoweek: 'iso-week',
  weekdays: 'count-weekdays',
});

export const DATE_UNIT_WORDS: Readonly<Record<string, string>> = Object.freeze({
  year: 'years',
  years: 'years',
  month: 'months',
  months: 'months',
  day: 'days',
  days: 'days',
});

export const DATE_OPERATION_CHOICES: readonly string[] = Object.freeze(Object.keys(DATE_OPERATION_WORDS));
export const DATE_UNIT_CHOICES: readonly string[] = Object.freeze(Object.keys(DATE_UNIT_WORDS));

export function foldDateOperation(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(DATE_OPERATION_WORDS, key) ? DATE_OPERATION_WORDS[key] : value;
}

export function foldDateUnit(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(DATE_UNIT_WORDS, key) ? DATE_UNIT_WORDS[key] : value;
}
