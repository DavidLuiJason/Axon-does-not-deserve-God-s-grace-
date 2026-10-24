/**
 * B03B1 Values runner. DIRECTOR-OWNED: builders never edit this file.
 * Usage: node run.mjs tests/valuesRunner.test.ts --jobs a        (jobs delivered so far: a, b, c, d; default a,b,c,d)
 * Runs the corpus items of the chosen jobs, the round trips of those jobs, and the checks that always apply
 * (invariants on every corpus output, hostile input, a seeded fuzz, speed). Exit code 1 if any core check fails.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { extractValues, VALUES_LIMITS } from '../src/brain/mind/meaning/values/index';
import type { ExtractedValue, Clock } from '../src/brain/mind/meaning/values/index';
import type { Segment } from '../src/brain/mind/types';
import { UNITS } from '../src/tools/engines/numbers/unitConvert';
import { numberToWords } from '../src/tools/engines/numbers/numberToWords';
import { formatDate, daysInMonth } from '../src/tools/engines/time/dateCalc';
import { CARDINAL_WORDS } from '../src/brain/mind/meaning/valueWords';

const CLOCK: Clock = { year: 2026, month: 10, day: 24, hour: 10, minute: 30 };
const argJobs = process.argv.includes('--jobs') ? String(process.argv[process.argv.indexOf('--jobs') + 1]) : 'a,b,c,d';
const JOBS = new Set(argJobs.split(','));
type Item = { id: string; text: string; expect: Array<Record<string, unknown>>; kind: 'core' | 'stretch'; job: string; now?: Clock };
const corpus = JSON.parse(readFileSync(new URL('./fixtures/values-corpus-b1.json', import.meta.url), 'utf8')) as Item[];

const failures: string[] = [];
let checks = 0;
function check(ok: boolean, message: string): void { checks += 1; if (!ok) failures.push(message); }

/** Quoted text is material, the rest is language (an unpaired quote leaves the rest as language). */
function segmentsFor(text: string): Segment[] {
  const segs: Segment[] = [];
  let i = 0; let from = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const j = text.indexOf('"', i + 1);
      if (j < 0) break;
      if (i > from) segs.push({ kind: 'language', text: text.slice(from, i), start: from, end: i });
      segs.push({ kind: 'material', text: text.slice(i, j + 1), start: i, end: j + 1 });
      i = j + 1; from = i;
    } else i += 1;
  }
  if (text.length > from) segs.push({ kind: 'language', text: text.slice(from), start: from, end: text.length });
  return segs;
}

const brief = (v: ExtractedValue): string => `${v.kind}:"${v.text}"${v.value !== undefined ? '=' + v.value : ''}${v.unit ? ' ' + v.unit : ''}${v.ms !== undefined ? ' ' + v.ms + 'ms' : ''}${v.date ? ' ' + v.date : ''}${v.times ? ' [' + v.times.join(',') + ']' : ''}${v.error ? ' !' + v.error : ''}${v.confidence < 0.5 ? ' (weak)' : ''}`;
const sameSet = (a: string[] | undefined, b: string[]): boolean => !!a && a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** Returns null when the item matches, otherwise a short description of the first problem. */
function mismatch(values: ExtractedValue[], expect: Array<Record<string, unknown>>): string | null {
  if (values.length !== expect.length) return `expected ${expect.length} value(s), got ${values.length}`;
  for (let i = 0; i < expect.length; i++) {
    const e = expect[i]!; const v = values[i]!;
    if (v.kind !== e.kind) return `[${i}] kind ${v.kind}, expected ${String(e.kind)}`;
    if (v.text !== e.text) return `[${i}] text "${v.text}", expected "${String(e.text)}"`;
    if ('value' in e && v.value !== e.value) return `[${i}] value ${String(v.value)}, expected ${String(e.value)}`;
    if ('unit' in e && v.unit !== e.unit) return `[${i}] unit ${String(v.unit)}, expected ${String(e.unit)}`;
    if ('ms' in e && v.ms !== e.ms) return `[${i}] ms ${String(v.ms)}, expected ${String(e.ms)}`;
    if ('date' in e && v.date !== e.date) return `[${i}] date ${String(v.date)}, expected ${String(e.date)}`;
    if ('time' in e) {
      const want = Array.isArray(e.time) ? (e.time as string[]) : [String(e.time)];
      if (!sameSet(v.times, want)) return `[${i}] times ${JSON.stringify(v.times)}, expected ${JSON.stringify(want)}`;
    }
    if ('alternatives' in e && !sameSet(v.dateAlternatives, e.alternatives as string[])) return `[${i}] dateAlternatives ${JSON.stringify(v.dateAlternatives)}, expected ${JSON.stringify(e.alternatives)}`;
    if ('alt' in e && !v.alternatives?.some((a) => a.kind === e.alt)) return `[${i}] alternatives lack kind ${String(e.alt)}`;
    if ('error' in e && v.error !== e.error) return `[${i}] error ${String(v.error)}, expected ${String(e.error)}`;
    if ('form' in e && v.form !== e.form) return `[${i}] form ${String(v.form)}, expected ${String(e.form)}`;
    if (e.weak === true && !(v.confidence < 0.5)) return `[${i}] should be weak (confidence ${v.confidence})`;
    if (!('weak' in e) && !('error' in e) && !(v.confidence >= 0.5)) return `[${i}] confidence ${v.confidence} should be at least 0.5`;
  }
  return null;
}

/** Rules every output must obey, whatever the input. Returns a problem or null. */
function invariants(text: string, values: ExtractedValue[]): string | null {
  let end = 0;
  for (const v of values) {
    if (v.text !== text.slice(v.start, v.end)) return `text "${v.text}" is not the slice ${v.start}-${v.end}`;
    if (v.start < end) return `values overlap or are unsorted at ${v.start}`;
    if (!(v.end > v.start)) return `empty value at ${v.start}`;
    if (!(v.confidence >= 0 && v.confidence <= 1)) return `confidence ${v.confidence} outside 0 to 1`;
    if (v.computed !== true || !v.reason) return 'a value lacks computed:true or a reason';
    if (v.value !== undefined && typeof v.value !== 'number') return 'value is not a number';
    for (const p of v.parts ?? []) if (p.start < v.start || p.end > v.end) return `a part of "${v.text}" lies outside it`;
    end = v.end;
  }
  return null;
}

function run(text: string, clock: Clock = CLOCK) { return extractValues(text, segmentsFor(text), clock); }
function strong(text: string, clock: Clock = CLOCK): ExtractedValue[] | null { const r = run(text, clock); return r.ok ? r.values : null; }

// 1. CORPUS (only the jobs delivered so far) + invariants on EVERY item's output.
const confusion: Record<string, number> = {};
const perJob: Record<string, { pass: number; fail: number }> = {};
for (const item of corpus) {
  const r = run(item.text, item.now ?? CLOCK);
  if (r.ok) { const inv = invariants(item.text, r.values); check(inv === null, `INVARIANT ${item.id}: ${inv}`); } else check(false, `INVARIANT ${item.id}: outcome not ok (${r.error})`);
  if (!JOBS.has(item.job)) continue;
  const bucket = (perJob[item.job] ??= { pass: 0, fail: 0 });
  const problem = r.ok ? mismatch(r.values, item.expect) : `outcome error ${r.error}`;
  if (item.kind === 'stretch') { console.log(`STRETCH ${item.id} (${item.job}): ${r.ok ? r.values.map(brief).join(' | ') || 'nothing' : r.error}  ${problem ? '(differs: ' + problem + ')' : '(matches)'}`); continue; }
  if (problem) { bucket.fail += 1; check(false, `CORPUS ${item.id} (${item.job}) ${JSON.stringify(item.text)}: ${problem}; got ${r.ok ? r.values.map(brief).join(' | ') || 'nothing' : r.error}`); }
  else { bucket.pass += 1; checks += 1; for (const e of item.expect) confusion[String(e.kind)] = (confusion[String(e.kind)] ?? 0) + 1; }
}

// 2. ROUND TRIPS per job (derived independently of the code under test).
if (JOBS.has('a')) {
  let skipped = 0;
  for (let n = 0; n <= 99999; n++) {
    const w = numberToWords(String(n));
    if (!w.ok) { skipped += 1; continue; }
    const parts = w.words.split(' ').join('-').split('-');
    if (!parts.every((p) => CARDINAL_WORDS.has(p))) { skipped += 1; continue; }
    const v = strong(w.words);
    check(!!v && v.length === 1 && v[0]!.kind === 'number' && v[0]!.value === n && v[0]!.text === w.words, `ROUNDTRIP-NUMBER ${n} "${w.words}" gave ${v ? v.map(brief).join(' | ') : 'error'}`);
    if (n >= 100 && n % 1000 >= 100 && n % 100 !== 0) {
      const idx = w.words.lastIndexOf('hundred') + 'hundred'.length; // British "and" after the last hundred
      const withAnd = w.words.slice(0, idx) + ' and' + w.words.slice(idx);
      const v2 = strong(withAnd);
      check(!!v2 && v2.length === 1 && v2[0]!.value === n, `ROUNDTRIP-AND ${n} "${withAnd}" gave ${v2 ? v2.map(brief).join(' | ') : 'error'}`);
    }
  }
  console.log(`round trip numbers 0..99999: skipped ${skipped} (word outside the closed set)`);
}
if (JOBS.has('b')) {
  let skipped = 0;
  const bySymbol: Record<string, number> = {};
  for (const list of Object.values(UNITS)) for (const u of list) bySymbol[u.symbol] = (bySymbol[u.symbol] ?? 0) + 1;
  for (const list of Object.values(UNITS)) for (const u of list) {
    const kind = u.category === 'time' ? 'duration' : 'quantity';
    const byName = strong(`3 ${u.name}`);
    check(!!byName && byName.length === 1 && byName[0]!.kind === kind && byName[0]!.unit === u.name && byName[0]!.value === 3, `UNIT-NAME "3 ${u.name}" gave ${byName ? byName.map(brief).join(' | ') : 'error'}`);
    if (u.symbol.includes(' ') || bySymbol[u.symbol]! > 1) { skipped += 1; continue; }
    const bySym = strong(`3${u.symbol}`);
    check(!!bySym && bySym.length === 1 && bySym[0]!.kind === kind && bySym[0]!.unit === u.name && bySym[0]!.value === 3, `UNIT-SYMBOL "3${u.symbol}" gave ${bySym ? bySym.map(brief).join(' | ') : 'error'}`);
  }
  console.log(`unit round trip: ${skipped} symbols skipped (contain a space or are shared)`);
  // SINGLE SOURCE: no unit name or symbol (2+ characters) is written as a string literal anywhere in the values folder.
  const dir = new URL('../src/brain/mind/meaning/values/', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(new URL(file, dir), 'utf8');
    for (const list of Object.values(UNITS)) for (const u of list) for (const word of [u.name, u.symbol]) {
      if (word.length < 2) continue;
      for (const q of ["'", '"', '`']) check(!src.includes(q + word + q), `SINGLE-SOURCE: the unit text ${q}${word}${q} is copied into values/${file}`);
    }
  }
  // INJECTION: a unit added to a copy of the table is found, so the reader really reads UNITS.
  const extended = { ...UNITS, length: [...UNITS.length, { name: 'furlong', symbol: 'fur', category: 'length' as const, factor: 201.168 }] };
  const injected = extractValues('go 3 furlongs', segmentsFor('go 3 furlongs'), CLOCK, { units: extended });
  check(injected.ok && injected.values.length === 1 && injected.values[0]!.kind === 'quantity' && injected.values[0]!.unit === 'furlong', 'INJECTION: an added unit "furlong" is found');
  const plain = strong('go 3 furlongs');
  check(!!plain && !plain.some((v) => v.kind === 'quantity'), 'INJECTION: without the added unit, furlong is not a quantity');
}
if (JOBS.has('c')) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; // test-only list
  let seed = 20261024; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pad = (n: number): string => String(n).padStart(2, '0');
  for (let k = 0; k < 2000; k++) {
    const year = 1900 + Math.floor(rnd() * 201); const month = 1 + Math.floor(rnd() * 12); const day = 1 + Math.floor(rnd() * daysInMonth(year, month));
    const iso = formatDate({ year, month, day });
    for (const text of [`on ${day} ${MONTHS[month - 1]} ${year}`, `on ${MONTHS[month - 1]} ${day}, ${year}`, `on ${year}-${pad(month)}-${pad(day)}`]) {
      const v = strong(text);
      check(!!v && v.length === 1 && v[0]!.kind === 'date' && v[0]!.date === iso, `ROUNDTRIP-DATE "${text}" expected ${iso}, got ${v ? v.map(brief).join(' | ') : 'error'}`);
    }
    if (day > 12) { const v = strong(`on ${day}/${month}/${year}`); check(!!v && v.length === 1 && v[0]!.date === iso, `ROUNDTRIP-SLASH "${day}/${month}/${year}" expected ${iso}`); }
    else if (day !== month) {
      const v = strong(`on ${day}/${month}/${year}`); const other = formatDate({ year, month: day, day: month });
      check(!!v && v.length === 1 && v[0]!.date === undefined && sameSet(v[0]!.dateAlternatives, [iso, other]) && v[0]!.confidence < 0.5, `SLASH-AMBIGUOUS "${day}/${month}/${year}" must stay open with both readings`);
    }
  }
  // 24-hour clock text. A leading zero, hour 0 or an hour of 13 to 23 is plainly 24-hour (one candidate); an hour of 1 to 12 written
  // without a leading zero keeps am and pm open (two candidates; 12 gives 00 and 12).
  const want24 = (h: number, m: number, padded: boolean): string[] => {
    const one = [`${pad(h)}:${pad(m)}`];
    if (h === 0 || h >= 13 || (padded && h <= 9)) return one;
    return h === 12 ? [`00:${pad(m)}`, `12:${pad(m)}`] : [`${pad(h)}:${pad(m)}`, `${pad(h + 12)}:${pad(m)}`];
  };
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) {
    const written = `${pad(h)}:${pad(m)}`; const v = strong(`meet at ${written}`);
    check(!!v && v.length === 1 && v[0]!.kind === 'time' && sameSet(v[0]!.times, want24(h, m, true)) && v[0]!.text === written, `ROUNDTRIP-24H ${written} gave ${v ? v.map(brief).join(' | ') : 'error'}`);
    if (h >= 1 && h <= 9) {
      const bare = `${h}:${pad(m)}`; const w = strong(`meet at ${bare}`);
      check(!!w && w.length === 1 && w[0]!.kind === 'time' && sameSet(w[0]!.times, want24(h, m, false)) && w[0]!.text === bare, `ROUNDTRIP-24H-BARE ${bare} gave ${w ? w.map(brief).join(' | ') : 'error'}`);
    }
  }
  for (let h12 = 1; h12 <= 12; h12++) for (const ampm of ['am', 'pm']) for (const m of [0, 5, 30, 59]) {
    const h24 = (h12 % 12) + (ampm === 'pm' ? 12 : 0); const want = `${pad(h24)}:${pad(m)}`;
    const text = m === 0 ? `at ${h12}${ampm}` : `at ${h12}:${pad(m)}${ampm}`;
    const v = strong(text);
    check(!!v && v.length === 1 && v[0]!.kind === 'time' && sameSet(v[0]!.times, [want]), `ROUNDTRIP-12H "${text}" expected ${want}, got ${v ? v.map(brief).join(' | ') : 'error'}`);
  }
}

// 3. ALWAYS: hostile input, invalid arguments, seeded fuzz, speed.
const hostile: string[] = ['', ' ', '???', '😀', 'مرحبا 5', '1'.repeat(400), '1 '.repeat(10000), '5'.repeat(20000), ':'.repeat(20000), '1/'.repeat(10000), 'March '.repeat(3000), '12:'.repeat(5000), '-'.repeat(19999) + '5', 'one '.repeat(4000), 'a '.repeat(8000), '"5 miles', '5 miles"', '""', '"" 5 ""', 'one hundred and '.repeat(1000), '1,'.repeat(9000), 'XIV '.repeat(4000), '\n\n5\n\n', '٣ ٤', '１２３'];
for (const text of hostile) {
  const t0 = Date.now(); let r; let threw = false;
  try { r = run(text); } catch { threw = true; }
  check(!threw, `HOSTILE no throw for ${JSON.stringify(text.slice(0, 20))} (${text.length} chars)`);
  if (threw || !r) continue;
  check(Date.now() - t0 < 1500, `HOSTILE under 1.5 s for ${JSON.stringify(text.slice(0, 20))} (${text.length} chars, took ${Date.now() - t0} ms)`);
  if (r.ok) { const inv = invariants(text, r.values); check(inv === null, `HOSTILE invariants for ${JSON.stringify(text.slice(0, 20))}: ${inv}`); }
}
const tooLong = extractValues('1'.repeat(VALUES_LIMITS.maxCharacters + 1), [], CLOCK);
check(!tooLong.ok && tooLong.error === 'too-long', 'HOSTILE 20,001 characters is too-long');
const exact = extractValues('1 '.repeat(VALUES_LIMITS.maxCharacters / 2), segmentsFor('1 '.repeat(VALUES_LIMITS.maxCharacters / 2)), CLOCK);
check(exact.ok, 'HOSTILE exactly 20,000 characters is accepted');
const badClocks: unknown[] = [undefined, null, {}, { ...CLOCK, month: 13 }, { ...CLOCK, month: 0 }, { ...CLOCK, day: 31, month: 2 }, { ...CLOCK, hour: 24 }, { ...CLOCK, minute: 60 }, { ...CLOCK, year: NaN }, { ...CLOCK, day: 1.5 }];
for (const c of badClocks) { const r = extractValues('5', segmentsFor('5'), c as Clock); check(!r.ok && r.error === 'invalid-clock', `ARGS invalid clock ${JSON.stringify(c)}`); }
for (const bad of [undefined, null, 5, {}] as unknown[]) { const r = extractValues(bad as string, [], CLOCK); check(!r.ok && r.error === 'invalid-input', 'ARGS non-string text is invalid-input'); }
check(extractValues('5', 'x' as unknown as Segment[], CLOCK).ok === false, 'ARGS non-list segments is refused');
{
  const material = extractValues('5 miles', [{ kind: 'material', text: '5 miles', start: 0, end: 7 }], CLOCK);
  check(material.ok && material.values.length === 0, 'MATERIAL a value inside a material segment is never read');
  const odd = extractValues('5 miles', [{ kind: 'language', text: '', start: -5, end: 99 }, { kind: 'language', text: '', start: 3, end: 3 }], CLOCK);
  check(odd.ok && invariants('5 miles', odd.values) === null, 'ARGS out-of-range segments are clipped, never crash');
}
{
  let seed = 1234567; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pieces = ['one', 'two', 'ten', 'twenty', 'hundred', 'thousand', 'million', 'and', 'a', 'half', 'an', 'first', 'second', 'one', '5', '12', '1,000', '3.5', '-', '+', '/', ':', '.', ',', '%', '°C', 'am', 'pm', 'at', 'to', 'past', 'quarter', 'noon', 'midnight', 'today', 'tomorrow', 'Friday', 'March', 'may', '2027', '1/3/2027', '7:30', 'miles', 'km', 'hours', 'min', 'h', 's', 'm', 'in', 'percent', 'per', 'cent', 'MIX', 'XIV', 'IIII', 'x', '"', "'", '(', ')', 'é', '😀', 'ا', '1h30m', '5-3', ' '];
  for (let k = 0; k < 2000; k++) {
    let text = ''; const n = 1 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) text += pieces[Math.floor(rnd() * pieces.length)]! + (rnd() < 0.7 ? ' ' : '');
    let r; let threw = false;
    try { r = run(text); } catch { threw = true; }
    check(!threw, `FUZZ no throw for ${JSON.stringify(text)}`);
    if (!threw && r && r.ok) { const inv = invariants(text, r.values); check(inv === null, `FUZZ invariants for ${JSON.stringify(text)}: ${inv}`); }
  }
}
{
  const t0 = performance.now(); let calls = 0;
  for (let r = 0; r < 20; r++) for (const item of corpus) { run(item.text, item.now ?? CLOCK); calls += 1; }
  const avg = (performance.now() - t0) / calls;
  console.log(`speed: ${avg.toFixed(3)} ms per message on average over ${calls} calls`);
  check(avg < 1, `SPEED average ${avg.toFixed(3)} ms must be under 1 ms`);
}

console.log(`jobs checked: ${[...JOBS].join(',')}`);
for (const [j, c] of Object.entries(perJob).sort()) console.log(`  job ${j}: core items passed ${c.pass}, failed ${c.fail}`);
console.log('  kinds proven by passing items:', JSON.stringify(confusion));
if (failures.length) {
  console.log(`\nFAILED ${failures.length} of ${checks} checks. First ${Math.min(40, failures.length)}:`);
  for (const f of failures.slice(0, 40)) console.log('  ' + f);
  process.exit(1);
}
console.log(`VALUES RUNNER OK: ${checks} checks`);
