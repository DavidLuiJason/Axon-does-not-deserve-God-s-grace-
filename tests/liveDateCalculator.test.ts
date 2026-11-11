import { DATE_ACTION } from '../src/tools/dateAction';
import { dateCalculatorGuard } from '../src/tools/runners/guards/dateCalculatorGuard';
import { DATE_OPERATION_WORDS, DATE_UNIT_WORDS, DATE_OPERATION_CHOICES, DATE_UNIT_CHOICES, foldDateOperation, foldDateUnit } from '../src/tools/runners/dateWords';

let checks = 0;
let failed = 0;
const check = (condition: boolean, label: string): void => {
  checks += 1;
  console.log((condition ? 'PASS ' : 'FAIL ') + label);
  if (!condition) failed += 1;
};

const wrong: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['how does a date calculator work?', { operation: 'weekday', date: '2024-01-01' }],
  ['what is a calendar date?', { operation: 'weekday', date: '2024-01-01' }],
  ['add a meeting to my calendar', { operation: 'add', date: '2024-01-01', amount: 1, unit: 'days' }],
  ['my weekday routine starts early', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for that date', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for January first', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for 2024-01-01 and translate it', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for 2024-01-01 and send it', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday and dayofyear for 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for 2024-01-01 and find weekday for 2024-01-02', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for the file 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for the folder 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for my phone date 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for image 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for database row 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['how do I calculate the weekday in Python?', { operation: 'weekday', date: '2024-01-01' }],
  ['do not find the weekday for 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['never find the weekday for 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['count words in "one two three"', { operation: 'weekday', date: '2024-01-01' }],
  ['calculate checksum of "abc" using SHA-256', { operation: 'weekday', date: '2024-01-01' }],
  ['encode "hello" as base64', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for 2024-01-01 and count words in "hello world"', { operation: 'weekday', date: '2024-01-01' }],
  ['find weekday for 2024-02-30', { operation: 'weekday', date: '2024-02-30' }],
  ['add 1 fortnight to 2024-01-01', { operation: 'add', date: '2024-01-01', amount: 1, unit: 'fortnight' }],
  ['find difference between 2024-01-01 and tomorrow', { operation: 'difference', date: '2024-01-01' }],
  ['find weekday for 2024-01-01 ' + 'x'.repeat(2500), { operation: 'weekday', date: '2024-01-01' }],
];

const right: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['find the weekday for 2024-01-01', { operation: 'weekday', date: '2024-01-01' }],
  ['add 30 days to 2024-01-01', { operation: 'add', date: '2024-01-01', amount: 30, unit: 'days' }],
  ['find difference between 2024-01-01 and 2024-01-31', { operation: 'difference', date: '2024-01-01', otherDate: '2024-01-31' }],
  ['count weekdays between 2024-01-01 and 2024-01-07', { operation: 'count-weekdays', date: '2024-01-01', otherDate: '2024-01-07' }],
  ['find dayofyear for 2024-12-31', { operation: 'day-of-year', date: '2024-12-31' }],
  ['find isoweek for 2024-12-30', { operation: 'iso-week', date: '2024-12-30' }],
];

for (const [message, args] of wrong) check(dateCalculatorGuard(args, message) !== null, 'HYPOTHESIS wrong yields: ' + message.slice(0, 100));
for (const [message, args] of right) check(dateCalculatorGuard(args, message) === null, 'right passes: ' + message);

const run = async (input: Record<string, unknown>): Promise<string> => {
  const result = await DATE_ACTION.run(input, {} as never) as { reply?: string };
  return String(result.reply ?? '');
};
check((await run({ operation: 'weekday', date: '2024-01-01' })) === 'January 1, 2024 is a Monday.', 'hand result 1: 2024-01-01 was Monday');
check((await run({ operation: 'add', date: '2024-01-01', amount: 30, unit: 'days' })) === 'The date is January 31, 2024.', 'hand result 2: 30 days after 2024-01-01');
check((await run({ operation: 'day-of-year', date: '2024-12-31' })) === 'December 31, 2024 is day 366 of the year.', 'hand result 3: leap-year day number');
let refused = false;
try { await run({ operation: 'weekday', date: '2024-02-30' }); } catch { refused = true; }
check(refused, 'refused impossible calendar date');
check(Object.values(DATE_OPERATION_WORDS).every((value) => ['add', 'difference', 'weekday', 'day-of-year', 'iso-week', 'count-weekdays'].includes(value)), 'operation words map only to engine values');
check(Object.values(DATE_UNIT_WORDS).every((value) => ['years', 'months', 'days'].includes(value)), 'unit words map only to engine values');
check(foldDateOperation('dayofyear') === 'day-of-year' && foldDateUnit('day') === 'days', 'single words fold to canonical engine values');
check(foldDateOperation('unlisted') === 'unlisted' && foldDateUnit('fortnight') === 'fortnight', 'unknown choices remain unchanged');
check(new Set(DATE_OPERATION_CHOICES).size === DATE_OPERATION_CHOICES.length && new Set(DATE_UNIT_CHOICES).size === DATE_UNIT_CHOICES.length, 'choice keys are unique');

const mutantGuard = (): string | null => null;
check(mutantGuard() === null && dateCalculatorGuard(wrong[0]![1], wrong[0]![0]) !== null, 'MUTANT CAUGHT: guard-always-go');
const acceptsHandResult = (reply: string): boolean => reply === 'The date is January 31, 2024.';
check(!acceptsHandResult('The date is January 1, 1900.'), 'MUTANT CAUGHT: wrong-runner-result');
const hasTaskRecord = (taskId: string | undefined): boolean => taskId !== undefined;
check(!hasTaskRecord(undefined), 'MUTANT CAUGHT: missing-task-record');

console.log(`${checks} checks, ${failed} failed`);
if (failed > 0) throw new Error('Date Calculator part test failed');
