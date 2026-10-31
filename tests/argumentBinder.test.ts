import { bindArguments } from '../src/brain/mind/bind/argumentBinder';
import type { BindInput, BindValue } from '../src/brain/mind/bind/argumentBinder';
import { SLOT_DEFAULTS } from '../src/brain/mind/bind/bindDefaults';
import { getSchema } from '../src/brain/mind/schema/actionSchemas';
import * as D from '../src/tools/engines/legacyDescriptors';
import { QR_DESCRIPTOR } from '../src/tools/engines/create/qrCode';

let n = 0;
function check(ok: boolean, name: string): void { n++; if (!ok) throw new Error('FAILED: ' + name); }
const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const dur = (ms: number, start = 0, end = 1, confidence = 0.9): BindValue => ({ kind: 'duration', start, end, confidence, ms });
const dt = (date: string, start: number, end: number, extra: Partial<BindValue> = {}): BindValue => ({ kind: 'date', start, end, confidence: 0.9, date, ...extra });
const span = (m: string, t: string) => { const s = m.indexOf(t); if (s < 0) throw new Error('bad test: ' + t); return { start: s, end: s + t.length }; };
const word = (m: string, t: string) => ({ norm: t.toLowerCase(), ...span(m, t) });
const base = (tool: string, message: string, rest: Partial<BindInput> = {}): BindInput => ({ tool, toolName: tool, message, values: [], materials: [], details: [], words: [], choices: {}, ...rest });
const OPS = ['start', 'tick', 'pause', 'resume', 'reset'];
const DATE_OPS = ['add', 'difference', 'weekday', 'day-of-year', 'iso-week', 'count-weekdays'];

// timer: duration filled, operation defaulted and SAID
let m = 'set a timer for 5 minutes';
let r = bindArguments(base('timer', m, { toolName: 'Timer', values: [dur(300000, 16, 25)], choices: { operation: OPS } }));
check(same(r.args, { durationMs: 300000, operation: 'start' }), 'timer args');
check(r.decision === 'run' && r.missing.length === 0, 'timer runs at once');
check(r.assumptions.length === 1 && r.assumptions[0] === 'Starting a new timer.', 'default is listed as an assumption');
check(r.understood === 'I read this as Timer (durationMs: 5 minutes, operation: start). Starting a new timer.', 'plain sentence says what was understood');
// the person said the operation: no default, no assumption
m = 'pause the timer for 90 seconds';
r = bindArguments(base('timer', m, { values: [dur(90000, 0, 1)], words: [word(m, 'pause')], choices: { operation: OPS } }));
check(r.args.operation === 'pause' && r.assumptions.length === 0, 'spoken choice beats default');
check(r.understood.includes('1 minute 30 seconds'), 'duration is spoken in minutes and seconds');
// value-only evidence: confirm first
r = bindArguments(base('timer', 'x', { values: [dur(300000)], choices: { operation: OPS }, evidence: 'value' }));
check(r.decision === 'confirm-first' && r.why.some((w) => w.includes('only carried a value')), 'value-only winner confirms first');
check(bindArguments(base('timer', 'x', { values: [dur(300000)], choices: { operation: OPS }, evidence: 'both' })).decision === 'run', 'concept evidence runs');
// weak value
r = bindArguments(base('timer', 'x', { values: [dur(300000, 0, 1, 0.3)], choices: { operation: OPS } }));
check(r.decision === 'confirm-first' && r.why.some((w) => w.includes('uncertain')), 'weak value confirms first');
// missing duration
r = bindArguments(base('timer', 'start a timer', { choices: { operation: OPS } }));
check(r.decision === 'ask' && r.missing.length === 1 && r.missing[0].slot === 'durationMs', 'no duration asks');
// one value is used once
r = bindArguments(base('timer', 'x', { values: [dur(1000), dur(2000)], choices: { operation: OPS } }));
check(r.args.durationMs === 1000, 'first value used once, in message order');
for (const bad of [-1, NaN, Infinity]) check(bindArguments(base('timer', 'x', { values: [dur(bad)], choices: { operation: OPS } })).decision === 'ask', 'bad duration ' + bad + ' not used');
check(bindArguments(base('timer', 'x', { values: [{ ...dur(1000), error: 'broken' }], choices: { operation: OPS } })).decision === 'ask', 'value with an error is not used');

// dates: message order, two date slots, ambiguity asks
m = 'difference between 2026-01-01 and 2026-12-25';
r = bindArguments(base('date-calculator', m, { values: [dt('2026-01-01', 19, 29), dt('2026-12-25', 34, 44)], words: [word(m, 'difference')], choices: { operation: DATE_OPS, unit: ['days'] } }));
check(same(r.args, { operation: 'difference', date: '2026-01-01', otherDate: '2026-12-25' }) && r.decision === 'run', 'two dates in order');
m = 'weekday of 2026-10-31';
r = bindArguments(base('date-calculator', m, { values: [dt('2026-10-31', 11, 21)], words: [word(m, 'weekday')], choices: { operation: DATE_OPS } }));
check(same(r.args, { operation: 'weekday', date: '2026-10-31' }), 'one date, weekday');
r = bindArguments(base('date-calculator', m, { values: [dt('2026-03-04', 11, 21, { dateAlternatives: ['2026-04-03'] })], words: [word(m, 'weekday')], choices: { operation: DATE_OPS } }));
check(r.decision === 'ask' && r.missing[0].slot === 'date' && !('date' in r.args), 'ambiguous date is never guessed');
r = bindArguments(base('date-calculator', m, { values: [dt('2026-10-31', 11, 21)], words: [word(m, 'weekday'), word(m, 'of')], choices: { operation: DATE_OPS } }));
check(r.args.operation === 'weekday', 'a non-choice word is ignored');
m = 'difference weekday 2026-10-31';
r = bindArguments(base('date-calculator', m, { values: [dt('2026-10-31', 19, 29)], words: [word(m, 'difference'), word(m, 'weekday')], choices: { operation: DATE_OPS } }));
check(r.decision === 'ask' && r.missing[0].slot === 'operation' && (r.missing[0].choices ?? []).length === DATE_OPS.length, 'two different choices: not guessed, choices offered');

// text from quotes and from details
m = 'make "hello world" UPPER';
r = bindArguments(base('case-converter', m, { materials: [span(m, '"hello world"')], words: [word(m, 'UPPER')], choices: { mode: ['UPPER', 'lower', 'Title'] } }));
check(same(r.args, { text: 'hello world', mode: 'UPPER' }) && r.decision === 'run', 'quoted text, quotes removed, choice keeps the descriptor spelling');
m = 'convert hello world upper';
r = bindArguments(base('case-converter', m, { details: [span(m, 'hello world upper')], words: [word(m, 'upper')], choices: { mode: ['UPPER', 'lower'] } }));
check(r.args.text === 'hello world' && r.args.mode === 'UPPER', 'detail text with the used choice word cut out');
r = bindArguments(base('case-converter', 'make it upper', { words: [word('make it upper', 'upper')], choices: { mode: ['UPPER'] } }));
check(r.decision === 'ask' && r.missing[0].slot === 'text', 'no text source: ask, never guess');
m = 'hello';
r = bindArguments(base('case-converter', m, { details: [span(m, 'hello')], choices: { mode: ['UPPER', 'lower'] } }));
check(r.decision === 'ask' && r.missing[0].slot === 'mode' && r.args.text === 'hello', 'no mode said: ask with the choices');
m = 'say "a" and "b" upper';
r = bindArguments(base('case-converter', m, { materials: [span(m, '"a"'), span(m, '"b"')], words: [word(m, 'upper')], choices: { mode: ['UPPER'] } }));
check(r.args.text === 'a' && r.assumptions.length === 1, 'extra text is noted, first piece used');
m = 'convert "keep this" more words upper';
r = bindArguments(base('case-converter', m, { materials: [span(m, '"keep this"')], details: [span(m, 'more words')], words: [word(m, 'upper')], choices: { mode: ['UPPER'] } }));
check(r.args.text === 'keep this' && r.assumptions.length === 0, 'quoted text wins over detail text when it is enough');
m = 'hash "abc" sha';
r = bindArguments(base('hash-tool', m, { materials: [span(m, '"abc"')], words: [word(m, 'sha')], choices: { algorithm: ['MD5', 'SHA-256'] } }));
check(r.decision === 'ask' && r.missing[0].slot === 'algorithm', 'multi-part choice name does not match a loose word');

// numbers, defaults and radians
r = bindArguments(base('random-picker', 'pick', { words: [word('pick', 'pick')], materials: [], details: [], choices: { operation: ['pick', 'shuffle'] } }));
check(r.args.count === 1 && r.assumptions[0] === 'Picking one.' && r.decision === 'ask' && r.missing.length === 1 && r.missing[0].slot === 'items', 'count default is said, missing items asks');
r = bindArguments(base('random-picker', 'pick 3 from "a, b, c"', { words: [word('pick 3 from "a, b, c"', 'pick')], values: [{ kind: 'number', start: 5, end: 6, confidence: 0.9, value: 3 }], materials: [span('pick 3 from "a, b, c"', '"a, b, c"')], choices: { operation: ['pick'] } }));
check(r.args.count === 3 && r.args.items === 'a, b, c' && r.args.operation === 'pick' && r.decision === 'run' && r.assumptions.length === 0, 'number fills count, quotes fill items');
for (const kind of ['roman', 'percent']) check(bindArguments(base('random-picker', 'x', { words: [word('x pick', 'pick')], values: [{ kind, start: 0, end: 1, confidence: 0.9, value: 7 }], choices: { operation: ['pick'] } })).args.count === 7, kind + ' fills a number slot');
check(bindArguments(base('random-picker', 'x', { values: [{ kind: 'number', start: 0, end: 1, confidence: 0.9, value: NaN }], choices: { operation: ['pick'] } })).args.count === 1, 'NaN number is not used');
m = 'calculate "sin(30)"';
r = bindArguments(base('calculator', m, { materials: [span(m, '"sin(30)"')] }));
check(same(r.args, { expression: 'sin(30)', angle: 'rad' }) && r.assumptions[0] === 'Using radians for angles.' && r.understood.includes('radians'), 'calculator says it uses radians');
m = 'calculate "sin(30)" deg';
r = bindArguments(base('calculator', m, { materials: [span(m, '"sin(30)"')], words: [word(m, 'deg')], choices: { angle: ['deg', 'rad'] } }));
check(r.args.angle === 'deg' && r.assumptions.length === 0, 'spoken angle beats the radians default');

// effects: confirm first
m = 'convert "a,b" "a,b" json csv';
r = bindArguments(base('converter', m, { materials: [span(m, '"a,b"')], words: [word(m, 'json'), word(m, 'csv')], choices: { toFormat: ['json'], from: ['csv'], to: ['json'] } }));
m = 'convert "a,b" "1,2" json csv';
r = bindArguments(base('converter', m, { materials: [span(m, '"a,b"'), span(m, '"1,2"')], words: [word(m, 'json'), word(m, 'csv')], choices: { toFormat: ['json'], from: ['csv'], to: ['json'] } }));
check(r.missing.length === 0 && r.decision === 'confirm-first' && r.why.length === 2, 'a tool with file effects and a non-trivial undo confirms first');
check(same(r.args, { text: 'a,b', input: '1,2', toFormat: 'json', from: 'csv', to: 'json' }), 'converter args bound');
r = bindArguments(base('file-converter', 'convert it'));
check(r.decision === 'ask' && r.missing.some((x) => x.kind === 'file' && x.reason === 'This needs a file.'), 'a required file is always missing');

// robustness
check(bindArguments(base('no-such-tool', 'x')).decision === 'ask', 'unknown tool asks');
const hostile = { tool: 'timer', message: undefined, values: null, materials: undefined, details: 5, words: undefined, choices: null, toolName: 7 } as unknown as BindInput;
check(bindArguments(hostile).decision === 'ask', 'hostile input does not throw');
check(bindArguments(undefined as unknown as BindInput).decision === 'ask', 'missing input does not throw');
r = bindArguments(base('case-converter', 'abc', { details: [{ start: -5, end: 99 }, { start: 2, end: 2 }], choices: { mode: ['UPPER'] } }));
check(r.missing.some((x) => x.slot === 'text'), 'bad spans are ignored');
const frozen = Object.freeze(base('timer', 'x', { values: Object.freeze([Object.freeze(dur(1000))]), choices: Object.freeze({ operation: Object.freeze(OPS) }) }));
const a1 = bindArguments(frozen); const a2 = bindArguments(frozen);
check(same(a1, a2) && a1.args.durationMs === 1000, 'same input, same output, input unchanged');
check(same(JSON.parse(JSON.stringify(a1)), a1), 'result survives JSON');

// every declared default is a real slot, required, with a legal value
const all = Object.values(D).filter((v) => v !== null && typeof v === 'object' && 'toolId' in (v as object)) as unknown as Array<{ toolId: string; inputs: Array<{ name: string; choices?: readonly string[] }> }>;
all.push(QR_DESCRIPTOR as never);
for (const [tool, slots] of Object.entries(SLOT_DEFAULTS)) for (const [slot, def] of Object.entries(slots)) {
  const spec = getSchema(tool)?.slots.find((s) => s.name === slot);
  check(spec !== undefined && spec.required, `default ${tool}.${slot} is a required slot`);
  if (spec!.kind === 'choice') {
    const choices = all.find((x) => x.toolId === tool)?.inputs.find((i) => i.name === slot)?.choices ?? [];
    check(choices.includes(def.value as string), `default ${tool}.${slot} is one of the descriptor's choices`);
  } else check(spec!.kind === 'number' && typeof def.value === 'number', `default ${tool}.${slot} fits its kind`);
  check(def.note !== '' && def.note === def.note.toLowerCase(), `default ${tool}.${slot} has a plain note`);
}
console.log(`argumentBinder.test.ts: ${n} checks passed.`);
