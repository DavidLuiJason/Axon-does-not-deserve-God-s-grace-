import type { ExtractedValue, ScanContext } from './types';
import { isDigit, isLetter, isSpace } from './charClass';
import { normalizeWord } from '../closedSets';
import { CARDINAL_WORDS, MONTH_WORDS, RELATIVE_DAY_WORDS, WEEKDAY_WORDS } from '../valueWords';
import { addDate, daysInMonth, formatDate, weekday } from '../../../../tools/engines/time/dateCalc';

type Token = { raw: string; word: string; start: number; end: number; numeric: boolean };
type Candidate = { start: number; end: number; kind: 'date' | 'time'; date?: string; dateAlternatives?: string[]; times?: string[]; confidence: number; reason: string; error?: string };
const pad = (n: number): string => String(n).padStart(2, '0');
const dateText = (y: number, m: number, d: number): string => formatDate({ year: y, month: m, day: d });
const make = (ctx: ScanContext, c: Candidate): ExtractedValue => {
  const v: ExtractedValue = { kind: c.kind, text: ctx.text.slice(c.start, c.end), start: c.start, end: c.end, confidence: c.confidence, reason: c.reason, computed: true };
  if (c.date !== undefined) v.date = c.date;
  if (c.dateAlternatives) v.dateAlternatives = c.dateAlternatives;
  if (c.times) v.times = c.times;
  if (c.error) v.error = c.error;
  return v;
};
function tokensIn(text: string, start: number, end: number): Token[] {
  const out: Token[] = [];
  for (let i = start; i < end;) {
    if (isSpace(text[i]) || text[i] === ',' || text[i] === '.') { i++; continue; }
    const s = i;
    if (isDigit(text[i])) {
      while (i < end && isDigit(text[i])) i++;
      out.push({ raw: text.slice(s, i), word: text.slice(s, i), start: s, end: i, numeric: true });
    } else if (isLetter(text[i])) {
      while (i < end && (isLetter(text[i]) || text[i] === "'")) i++;
      const raw = text.slice(s, i);
      out.push({ raw, word: normalizeWord(raw), start: s, end: i, numeric: false });
    } else {
      out.push({ raw: text[i], word: text[i], start: i, end: i + 1, numeric: false }); i++;
    }
  }
  return out;
}
function validDate(y: number, m: number, d: number): string | undefined {
  if (!Number.isInteger(y) || y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return undefined;
  return dateText(y, m, d);
}
function dateCandidate(start: number, end: number, y: number, m: number, d: number, reason: string, confidence = 0.95): Candidate {
  const iso = validDate(y, m, d);
  return { start, end, kind: 'date', date: iso, confidence, reason, error: iso ? undefined : 'invalid-date' };
}
function month(word: string): number | undefined { return MONTH_WORDS.get(word); }
function nextWeekday(ctx: ScanContext, targetSundayZero: number): string {
  const today = dateText(ctx.clock.year, ctx.clock.month, ctx.clock.day);
  const wd = weekday(today);
  if (!wd.ok) return today;
  const sundayZero = wd.value % 7;
  let delta = (targetSundayZero - sundayZero + 7) % 7;
  if (delta === 0) delta = 7;
  const result = addDate(today, delta, 'days');
  return result.ok ? result.value : today;
}
function tokenGap(text: string, a: Token, b: Token): string { return text.slice(a.end, b.start); }
function rangeEndFor(tokens: Token[], at: number): number { return tokens.length ? tokens[tokens.length - 1]!.end : at; }
function onlySpaceOrComma(s: string): boolean { for (const c of s) if (!isSpace(c) && c !== ',') return false; return true; }
function parseTimeWords(tokens: Token[], i: number): { endIndex: number; times: string[]; reason: string } | undefined {
  const w = tokens[i]?.word;
  if (w === 'noon') return { endIndex: i + 1, times: ['12:00'], reason: 'closed clock word noon' };
  if (w === 'midnight') return { endIndex: i + 1, times: ['00:00'], reason: 'closed clock word midnight' };
  if (w === 'half' && tokens[i + 1]?.word === 'past') {
    const h = clockHour(tokens[i + 2]); if (h !== undefined) return { endIndex: i + 3, times: hourOptions(h, 30, tokens[i + 2]!.numeric && tokens[i + 2]!.raw.length > 1 && tokens[i + 2]!.raw[0] === '0'), reason: 'half past plus a clock hour' };
  }
  if (w === 'quarter' && (tokens[i + 1]?.word === 'past' || tokens[i + 1]?.word === 'to')) {
    const direction = tokens[i + 1]!.word; const h = clockHour(tokens[i + 2]);
    if (h !== undefined) { const target = direction === 'past' ? h : (h + 11) % 12 || 12; const min = direction === 'past' ? 15 : 45; return { endIndex: i + 3, times: hourOptions(target, min, tokens[i + 2]!.numeric && tokens[i + 2]!.raw.length > 1 && tokens[i + 2]!.raw[0] === '0'), reason: `quarter ${direction} plus a clock hour` }; }
  }
  if (tokens[i]?.numeric && tokens[i + 1]?.word === 'past' && clockHour(tokens[i + 2]) !== undefined) {
    const m = Number(tokens[i]!.raw), h = clockHour(tokens[i + 2]);
    if (m >= 1 && m <= 59) return { endIndex: i + 3, times: hourOptions(h!, m, false), reason: 'minute number past a clock hour' };
  }
  return undefined;
}
function clockHour(t: Token | undefined): number | undefined {
  if (!t) return undefined;
  if (t.numeric) { const n = Number(t.raw); return n >= 1 && n <= 12 ? n : undefined; }
  return CARDINAL_WORDS.get(t.word) && CARDINAL_WORDS.get(t.word)! >= 1 && CARDINAL_WORDS.get(t.word)! <= 12 ? CARDINAL_WORDS.get(t.word) : undefined;
}
function hourOptions(h: number, m: number, padded: boolean): string[] {
  if (h < 1 || h > 12 || m < 0 || m > 59) return [];
  if (padded && h <= 9) return [`${pad(h)}:${pad(m)}`];
  if (h === 12) return [`00:${pad(m)}`, `12:${pad(m)}`];
  return [`${pad(h)}:${pad(m)}`, `${pad(h + 12)}:${pad(m)}`];
}
function readTimeAt(text: string, tokens: Token[], i: number): { end: number; times: string[]; reason: string; error?: string } | undefined {
  const t = tokens[i]; if (!t) return undefined;
  const words = parseTimeWords(tokens, i);
  if (words) return { end: tokens[words.endIndex - 1]!.end, times: words.times, reason: words.reason };
  if (t.word === 'noon' || t.word === 'midnight') return undefined;
  if (t.numeric) {
    const h = Number(t.raw);
    if (tokens[i + 1]?.word === ':' && tokens[i + 2]?.numeric) {
      const m = Number(tokens[i + 2]!.raw);
      if (h > 23 || m > 59) return { end: tokens[i + 2]!.end, times: [], reason: 'numeric clock has an out-of-range field', error: 'invalid-time' };
      const suffix = tokens[i + 3]?.word;
      if (suffix === 'am' || suffix === 'pm') {
        if (h < 1 || h > 12) return { end: tokens[i + 3]!.end, times: [], reason: '12-hour clock suffix conflicts with hour', error: 'invalid-time' };
        return { end: tokens[i + 3]!.end, times: [`${pad((h % 12) + (suffix === 'pm' ? 12 : 0))}:${pad(m)}`], reason: 'explicit 12-hour clock suffix' };
      }
      if (h === 0 || h >= 13 || (t.raw.length > 1 && t.raw[0] === '0')) return { end: tokens[i + 2]!.end, times: [`${pad(h)}:${pad(m)}`], reason: 'unambiguous 24-hour clock' };
      return { end: tokens[i + 2]!.end, times: hourOptions(h, m, false), reason: '12-hour reading left open without suffix' };
    }
    const suffix = tokens[i + 1]?.word;
    if (suffix === 'am' || suffix === 'pm') {
      if (h < 1 || h > 12) return { end: tokens[i + 1]!.end, times: [], reason: '12-hour clock suffix conflicts with hour', error: 'invalid-time' };
      return { end: tokens[i + 1]!.end, times: [`${pad((h % 12) + (suffix === 'pm' ? 12 : 0))}:00`], reason: 'explicit 12-hour clock suffix' };
    }
    const prev = tokens[i - 1];
    if (prev?.word === 'at' && h >= 0 && h <= 23) {
      if (h === 0 || h >= 13 || (t.raw.length > 1 && t.raw[0] === '0')) return { end: t.end, times: [`${pad(h)}:00`], reason: 'bare hour after at, unambiguous 24-hour reading' };
      return { end: t.end, times: hourOptions(h, 0, false), reason: 'bare hour after at, am and pm left open' };
    }
  }
  return undefined;
}
function dateWordCandidates(ctx: ScanContext, tokens: Token[], text: string): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const rel = RELATIVE_DAY_WORDS.get(t.word);
    if (rel !== undefined) {
      const base = dateText(ctx.clock.year, ctx.clock.month, ctx.clock.day); const r = addDate(base, rel, 'days');
      if (r.ok) out.push({ start: t.start, end: t.end, kind: 'date', date: r.value, confidence: 0.99, reason: 'relative day computed from supplied clock' });
      continue;
    }
    const wd = WEEKDAY_WORDS.get(t.word);
    if (wd !== undefined) { if (tokens[i - 1]?.word !== 'a') out.push({ start: t.start, end: t.end, kind: 'date', date: nextWeekday(ctx, wd), confidence: 0.88, reason: 'strictly next named weekday computed from supplied clock' }); continue; }
    const m = month(t.word);
    if (m !== undefined) {
      const next = tokens[i + 1]; const prev = tokens[i - 1];
      if (next?.numeric && onlySpaceOrComma(tokenGap(text, t, next))) {
        const d = Number(next.raw); let year = ctx.clock.year; let end = next.end; let explicitYear = false;
        let j = i + 2;
        if (tokens[j]?.numeric && onlySpaceOrComma(text.slice(end, tokens[j]!.start)) && tokens[j]!.raw.length === 4) { year = Number(tokens[j]!.raw); end = tokens[j]!.end; explicitYear = true; }
        if (d >= 1 && d <= 31) {
          const c = dateCandidate(t.start, end, year, m, d, 'month name adjacent to day');
          if (!explicitYear && c.date) c.dateAlternatives = [c.date, dateText(year + 1, m, d)].filter(Boolean);
          if (!explicitYear && c.dateAlternatives?.length === 2) { c.date = undefined; c.confidence = 0.4; c.reason = 'yearless month and day, this year or next year'; }
          out.push(c); continue;
        }
      }
      if (prev?.numeric && onlySpaceOrComma(tokenGap(text, prev, t))) {
        const d = Number(prev.raw); let year = ctx.clock.year; let start = prev.start; let end = t.end; let explicitYear = false;
        if (tokens[i + 1]?.numeric && onlySpaceOrComma(text.slice(t.end, tokens[i + 1]!.start)) && tokens[i + 1]!.raw.length === 4) { year = Number(tokens[i + 1]!.raw); end = tokens[i + 1]!.end; explicitYear = true; }
        if (d >= 1 && d <= 31) {
          const c = dateCandidate(start, end, year, m, d, 'day adjacent to month name');
          if (!explicitYear && c.date) c.dateAlternatives = [c.date, dateText(year + 1, m, d)].filter(Boolean);
          if (!explicitYear && c.dateAlternatives?.length === 2) { c.date = undefined; c.confidence = 0.4; c.reason = 'yearless month and day, this year or next year'; }
          out.push(c); continue;
        }
      }
    }
    // Numeric ISO or slash dates. Read fields directly from the source so punctuation tokens cannot shift indexes.
    if (t.numeric) {
      const readField = (at: number): { value: number; end: number; raw: string } | undefined => {
        let j = at; while (j < rangeEndFor(tokens, at) && isDigit(text[j])) j++;
        if (j === at) return undefined;
        const raw = text.slice(at, j); return { value: Number(raw), end: j, raw };
      };
      const first = { value: Number(t.raw), end: t.end, raw: t.raw };
      const sep = text[first.end];
      if ((sep === '-' || sep === '/') && text[first.end + 1] && isDigit(text[first.end + 1])) {
        const second = readField(first.end + 1);
        if (second && text[second.end] === sep && isDigit(text[second.end + 1] ?? '')) {
          const third = readField(second.end + 1);
          if (third && ((sep === '-' && first.raw.length === 4) || (sep === '/' && third.raw.length === 4)) && third.end <= (tokens[tokens.length - 1]?.end ?? third.end)) {
            const a = first.value, b = second.value, c = third.value, start = t.start, end = third.end;
            if (sep === '-' && first.raw.length === 4) out.push(dateCandidate(start, end, a, b, c, 'ISO year-month-day date'));
            else if (sep === '/') {
              if (a > 12 && a <= 31) out.push(dateCandidate(start, end, c, b, a, 'day/month/year with day above twelve'));
              else if (b > 12 && b <= 31) out.push(dateCandidate(start, end, c, a, b, 'month/day/year with day above twelve'));
              else if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
                const dmy = validDate(c, b, a), mdy = validDate(c, a, b);
                if (dmy && mdy && dmy !== mdy) out.push({ start, end, kind: 'date', dateAlternatives: [dmy, mdy], confidence: 0.4, reason: 'ambiguous slash date; day/month and month/day both retained' });
                else if (dmy || mdy) out.push({ start, end, kind: 'date', date: dmy ?? mdy, confidence: 0.9, reason: 'slash date has one valid calendar reading' });
                else out.push({ start, end, kind: 'date', confidence: 0.8, reason: 'slash date has no valid calendar reading', error: 'invalid-date' });
              } else out.push({ start, end, kind: 'date', confidence: 0.8, reason: 'slash date fields out of range', error: 'invalid-date' });
            }
          }
        }
      }
    }
  }
  return out;
}
function addOrdinalDates(ctx: ScanContext, tokens: Token[], text: string): Candidate[] {
  const out: Candidate[] = [];
  const ordinalEnd = (t: Token): { end: number; suffix: string } | undefined => {
    let end = t.end;
    while (end < text.length && isLetter(text[end])) end++;
    const suffix = normalizeWord(text.slice(t.end, end));
    const n = Number(t.raw);
    const wanted = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return suffix === wanted && end > t.end ? { end, suffix } : undefined;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.numeric) {
      const suffix = ordinalEnd(t);
      const monthIndex = suffix && tokens[i + 1]?.word === suffix.suffix ? i + 2 : i + 1;
      const m = month(tokens[monthIndex]?.word ?? '');
      if (m !== undefined && onlySpaceOrComma(text.slice(suffix?.end ?? t.end, tokens[monthIndex]!.start))) {
        let end = tokens[monthIndex]!.end; let year = ctx.clock.year;
        const yearToken = tokens[monthIndex + 1];
        if (yearToken?.numeric && yearToken.raw.length === 4 && onlySpaceOrComma(text.slice(end, yearToken.start))) { year = Number(yearToken.raw); end = yearToken.end; }
        const c = dateCandidate(t.start, end, year, m, Number(t.raw), 'ordinal day adjacent to month name');
        if (end === tokens[monthIndex]!.end && c.date) { c.dateAlternatives = [c.date, validDate(year + 1, m, Number(t.raw))].filter((x): x is string => !!x); c.date = undefined; c.confidence = 0.4; }
        out.push(c);
      }
    }
    const m = month(t.word);
    if (m !== undefined) {
      const dayToken = tokens[i + 1];
      if (!dayToken?.numeric) continue;
      const suffix = ordinalEnd(dayToken);
      const yearIndex = suffix && tokens[i + 2]?.word === suffix.suffix ? i + 3 : i + 2;
      let end = suffix?.end ?? dayToken.end; let year = ctx.clock.year;
      const yearToken = tokens[yearIndex];
      if (yearToken?.numeric && yearToken.raw.length === 4 && onlySpaceOrComma(text.slice(end, yearToken.start))) { year = Number(yearToken.raw); end = yearToken.end; }
      if (!onlySpaceOrComma(text.slice(t.end, dayToken.start))) continue;
      const c = dateCandidate(t.start, end, year, m, Number(dayToken.raw), 'month name adjacent to ordinal day');
      if (end === (suffix?.end ?? dayToken.end) && c.date) { c.dateAlternatives = [c.date, validDate(year + 1, m, Number(dayToken.raw))].filter((x): x is string => !!x); c.date = undefined; c.confidence = 0.4; }
      out.push(c);
    }
  }
  return out;
}

function adjacentForDateTime(text: string, date: ExtractedValue, time: ExtractedValue): boolean {
  if (time.start < date.end) return false;
  const gap = text.slice(date.end, time.start);
  if (gap.length === 0) return false;
  let hasSpace = false;
  for (const c of gap) { if (isSpace(c)) hasSpace = true; else if (c !== ',' && c !== 'a' && c !== 't' && c !== 'o' && c !== 'n') return false; }
  const trimmed = gap.split(' ').join('').split('\t').join('').split('\n').join('').split('\r').join('').split(',').join('');
  return hasSpace && (trimmed === '' || trimmed === 'at' || trimmed === 'on');
}
export function readDatesTimes(ctx: ScanContext, found: ExtractedValue[]): ExtractedValue[] {
  const candidates: Candidate[] = [];
  for (const range of ctx.ranges) {
    const toks = tokensIn(ctx.text, range.start, range.end);
    candidates.push(...dateWordCandidates(ctx, toks, ctx.text), ...addOrdinalDates(ctx, toks, ctx.text));
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (t.word === 'noon' || t.word === 'midnight' || t.word === 'half' || t.word === 'quarter' || t.numeric) {
        const prev = toks[i - 1]; const afterAt = prev?.word === 'at';
        const parsed = readTimeAt(ctx.text, toks, i);
        if (parsed && (parsed.reason.startsWith('explicit') || parsed.reason.includes('24-hour') || parsed.reason.includes('suffix') || parsed.reason.includes('half past') || parsed.reason.includes('quarter') || parsed.reason.includes('closed clock word') || parsed.reason.includes('minute number') || afterAt)) {
          candidates.push({ start: t.start, end: parsed.end, kind: 'time', times: parsed.times, confidence: parsed.error ? 0.8 : parsed.times.length === 2 ? 0.65 : 0.95, reason: parsed.reason, error: parsed.error });
        }
      }
    }
  }
  // Prefer the longest interpretation when token-level alternatives overlap (e.g. a date over its day number).
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || b.confidence - a.confidence);
  const accepted: Candidate[] = [];
  for (const c of candidates) {
    const previous = accepted[accepted.length - 1];
    if (previous && c.start < previous.end) {
      if (c.end > previous.end && c.confidence > previous.confidence) accepted[accepted.length - 1] = c;
      continue;
    }
    accepted.push(c);
  }
  let values = accepted.map(c => make(ctx, c));
  // Merge a nearby date and time into one datetime. Preserve consumed numeric values as parts.
  const merged: ExtractedValue[] = [];
  for (let i = 0; i < values.length; i++) {
    const d = values[i]!; const t = values[i + 1];
    if (d.kind === 'date' && d.date && t?.kind === 'time' && adjacentForDateTime(ctx.text, d, t)) {
      const parts = found.filter(v => v.start >= d.start && v.end <= t.end && v.end > v.start);
      const dt: ExtractedValue = { kind: 'datetime', text: ctx.text.slice(d.start, t.end), start: d.start, end: t.end, confidence: Math.min(d.confidence, t.confidence), reason: 'adjacent date and time combined without crossing a language range', computed: true, date: d.date, times: t.times, parts };
      if (t.error) dt.error = t.error;
      merged.push(dt); i++; continue;
    }
    merged.push(d);
  }
  // Remove number values that are now fully contained in a date/time/datetime; keep them as parts.
  const result: ExtractedValue[] = [];
  for (const v of merged) {
    if (v.kind === 'date' || v.kind === 'time' || v.kind === 'datetime') {
      const contained = found.filter(n => n.kind === 'number' && n.start >= v.start && n.end <= v.end);
      if (contained.length) v.parts = [...(v.parts ?? []), ...contained];
      result.push(v);
    }
  }
  const consumed = result.filter(v => v.kind === 'date' || v.kind === 'time' || v.kind === 'datetime');
  for (const v of found) {
    if (consumed.some(c => v.start >= c.start && v.end <= c.end)) continue;
    result.push(v);
  }
  return result.sort((a, b) => a.start - b.start || a.end - b.end);
}
