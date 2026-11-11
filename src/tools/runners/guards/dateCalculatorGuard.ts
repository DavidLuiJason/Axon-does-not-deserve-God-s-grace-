// The brain boundary (FL12) forbids importing src/brain here; keep this local type identical to LaneGuard.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const OPERATIONS: Readonly<Record<string, true>> = Object.freeze({
  add: true, difference: true, weekday: true, dayofyear: true, isoweek: true, weekdays: true,
});
const UNITS: Readonly<Record<string, true>> = Object.freeze({ year: true, years: true, month: true, months: true, day: true, days: true });
const INTENT: Readonly<Record<string, true>> = Object.freeze({ date: true, dates: true, calendar: true, calculate: true, add: true, difference: true, weekday: true, dayofyear: true, isoweek: true, weekdays: true });
const NEGATION: Readonly<Record<string, true>> = Object.freeze({ not: true, never: true, dont: true });
const UNSUPPORTED: Readonly<Record<string, true>> = Object.freeze({ convert: true, translate: true, summarize: true, email: true, send: true, remind: true, schedule: true, book: true, explain: true, words: true, characters: true, hash: true, encode: true, sort: true, compare: true });
const OTHER_TARGET: Readonly<Record<string, true>> = Object.freeze({ file: true, folder: true, photo: true, image: true, database: true, phone: true, contact: true, document: true });

function wordsOf(value: string): string[] {
  const result: string[] = [];
  let current = '';
  for (const char of value.toLowerCase()) {
    const code = char.charCodeAt(0);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) current += char;
    else if (current) { result.push(current); current = ''; }
  }
  if (current) result.push(current);
  return result;
}

function hasAny(words: readonly string[], set: Readonly<Record<string, true>>): boolean {
  return words.some((word) => Object.prototype.hasOwnProperty.call(set, word));
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10 || value.charAt(4) !== '-' || value.charAt(7) !== '-') return false;
  for (let index = 0; index < value.length; index += 1) {
    if (index === 4 || index === 7) continue;
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (monthDays[month - 1] ?? 0);
}

export const dateCalculatorGuard: LaneGuard = (args, message) => {
  if (message.length > 2000) return 'the request exceeds the direct-lane safety limit';
  const operation = args.operation;
  const date = args.date;
  if (typeof operation !== 'string' || (!Object.prototype.hasOwnProperty.call(OPERATIONS, operation) && !['day-of-year', 'iso-week', 'count-weekdays'].includes(operation))) {
    return 'the calendar operation is not a supported choice';
  }
  if (!isIsoDate(date) || !message.includes(date)) return 'a clearly supplied ISO calendar date is required';
  const outsideDates = message.split(date).join(' ');
  const words = wordsOf(outsideDates);
  if (!hasAny(words, INTENT)) return 'the message does not clearly ask for a calendar calculation';
  if (hasAny(words, NEGATION)) return 'the request is negated';
  if (hasAny(words, UNSUPPORTED)) return 'the message asks for an additional or unsupported operation';
  if (hasAny(words, OTHER_TARGET)) return 'the request targets a file, device or other non-date object';
  const operationWords = words.filter((word) => Object.prototype.hasOwnProperty.call(OPERATIONS, word));
  if (new Set(operationWords).size > 1) return 'the message names more than one calendar operation';
  if (operation === 'add') {
    if (typeof args.amount !== 'number' || !Number.isFinite(args.amount)) return 'the number of units is missing';
    if (typeof args.unit !== 'string' || !Object.prototype.hasOwnProperty.call(UNITS, args.unit) && !['years', 'months', 'days'].includes(args.unit)) return 'the calendar unit is missing or unsupported';
    const unitWords = words.filter((word) => Object.prototype.hasOwnProperty.call(UNITS, word));
    if (unitWords.length !== 1) return 'the message does not name exactly one calendar unit';
  }
  if (operation === 'difference' || operation === 'count-weekdays') {
    if (!isIsoDate(args.otherDate) || !message.includes(args.otherDate)) return 'a second clearly supplied ISO calendar date is required';
  }
  if (operation !== 'add' && operation !== 'difference' && operation !== 'count-weekdays' && operationWords.length !== 1) {
    return 'the message does not clearly name one calendar operation';
  }
  return null;
};
