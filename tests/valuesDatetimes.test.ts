import { extractValues } from '../src/brain/mind/meaning/values/index';
import type { Clock, ExtractedValue } from '../src/brain/mind/meaning/values/index';
import type { Segment } from '../src/brain/mind/types';

const CLOCK: Clock = { year: 2026, month: 10, day: 24, hour: 10, minute: 30 };
let checks = 0;
function assert(ok: boolean, message: string): void { checks++; if (!ok) throw new Error(message); }
function segments(text: string): Segment[] { return [{ kind: 'language', text, start: 0, end: text.length }]; }
function values(text: string, clock: Clock = CLOCK): ExtractedValue[] {
  const r = extractValues(text, segments(text), clock);
  if (!r.ok) throw new Error(`unexpected extraction error: ${r.error}`);
  return r.values;
}
function one(text: string, kind: ExtractedValue['kind']): ExtractedValue {
  const got = values(text);
  assert(got.length === 1 && got[0]!.kind === kind, `${JSON.stringify(text)} expected one ${kind}, got ${got.map(v => v.kind + ':' + v.text).join('|')}`);
  return got[0]!;
}
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }

const dateCases: Array<[string, string]> = [
  ['1 March 2027', '2027-03-01'], ['1st March 2027', '2027-03-01'], ['March 1, 2027', '2027-03-01'], ['March 1st, 2027', '2027-03-01'], ['2027-03-01', '2027-03-01'],
  ['13/3/2027', '2027-03-13'], ['tomorrow', '2026-10-25'], ['yesterday', '2026-10-23'], ['today', '2026-10-24'],
  ['Friday', '2026-10-30'],
];
for (const [text, date] of dateCases) assert(one(text, 'date').date === date, `date ${text} should be ${date}`);
const ambiguous = one('1/3/2027', 'date');
assert(ambiguous.date === undefined && ambiguous.confidence < 0.5 && same(ambiguous.dateAlternatives, ['2027-03-01', '2027-01-03']), 'ambiguous slash date must preserve both readings');
assert(one('31 February 2027', 'date').error === 'invalid-date', 'invalid calendar date must be returned as an error');
assert(values('may I convert this').length === 0, 'may as a verb must not become a date');
assert(values('open the timer in march').length === 0, 'month without adjacent day/year must not become a date');

const timeCases: Array<[string, string[]]> = [
  ['7:30am', ['07:30']], ['20:15', ['20:15']], ['8pm', ['20:00']], ['12am', ['00:00']], ['12pm', ['12:00']],
  ['noon', ['12:00']], ['midnight', ['00:00']], ['half past eight', ['08:30', '20:30']],
  ['quarter to nine', ['08:45', '20:45']], ['quarter past 3', ['03:15', '15:15']],
];
for (const [text, times] of timeCases) assert(same(one(text, 'time').times, times), `time ${text} should be ${JSON.stringify(times)}`);
assert(values('8').every(v => v.kind !== 'time'), 'a bare number is not a time');
assert(same(one('at 8', 'time').times, ['08:00', '20:00']), 'bare hour after at should preserve both readings');
assert(one('13pm', 'time').error === 'invalid-time', '13pm must be an invalid time, not silently normalized');
const dt = one('tomorrow at 8', 'datetime');
assert(dt.date === '2026-10-25' && same(dt.times, ['08:00', '20:00']) && dt.text === 'tomorrow at 8', 'date and time should combine into a datetime');
const unrelated = values('set an alarm for 8 tomorrow');
assert(unrelated.length === 2 && unrelated[0]!.kind === 'number' && unrelated[0]!.value === 8 && unrelated[1]!.kind === 'date', 'unattached number must remain a number');

// Every returned value must be an exact, non-overlapping source slice with an explanation.
for (const text of ['meet at 20:15 tomorrow', 'remind me 1/3/2027', '31 February 2027', 'call at 8pm', 'half past eight']) {
  const got = values(text); let end = 0;
  for (const v of got) {
    assert(v.text === text.slice(v.start, v.end), `source slice invariant failed for ${text}`);
    assert(v.start >= end && v.end > v.start, `overlap or empty span for ${text}`);
    assert(v.computed === true && v.reason.length > 0 && v.confidence >= 0 && v.confidence <= 1, `trace invariant failed for ${text}`);
    end = v.end;
  }
}
// A separate range must not be crossed by a date/time candidate.
const split = extractValues('tomorrow at 8', [
  { kind: 'language', text: 'tomorrow', start: 0, end: 8 },
  { kind: 'material', text: ' at 8', start: 8, end: 13 },
], CLOCK);
assert(split.ok && split.values.length === 1 && split.values[0]!.kind === 'date', 'dates and times must not cross language-range boundaries');

console.log(`valuesDatetimes.test.ts: ${checks} checks passed`);
