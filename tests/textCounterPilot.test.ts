/** C1 PART 3: text-counter pilot. SHADOW comparison: the runner path (binder + runner) against the old chat handler on 50 requests. */
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { bindArguments } from '../src/brain/mind/bind/argumentBinder';
import type { BindInput } from '../src/brain/mind/bind/argumentBinder';
import { TEXT_COUNTER_RUNNER, TEXT_COUNTER_UNITS } from '../src/tools/runners/textCounterRunner';
import { countText } from '../src/kernel/textCount';
import { execute, findRunner, runnerToolIds } from '../src/tools/runners/runnerRegistry';
import { getSchema } from '../src/brain/mind/schema/actionSchemas';

let n = 0;
function check(ok: boolean, name: string): void { n++; if (!ok) throw new Error('FAILED: ' + name); }
const deps = { now: 0, randomBelow: () => 0, random01: () => 0 };
const POINTERS = ['this text', 'this', 'that', 'the text', 'the following', 'the following text', 'it', 'the above', 'above', 'this sentence', 'that text'];
const UNIT_WORDS = ['words', 'word', 'characters', 'character', 'chars', 'char', 'letters', 'letter', 'lines', 'line'];

/** What the Meaning stage would hand over for a request: the unit word, the quoted material, or the detail span after "in/of/:". */
function bindInputFor(message: string): BindInput {
  const lower = message.toLowerCase();
  const words = [] as { norm: string; start: number; end: number }[];
  let best: { norm: string; start: number; end: number } | null = null;
  for (const u of UNIT_WORDS) { const at = lower.search(new RegExp(`\\b${u}\\b`)); if (at >= 0 && (best === null || at < best.start)) best = { norm: u, start: at, end: at + u.length }; }
  if (best) words.push(best);
  const materials = [] as { start: number; end: number }[];
  const q = /"[^"]*"/.exec(message);
  if (q) materials.push({ start: q.index, end: q.index + q[0].length });
  const details = [] as { start: number; end: number }[];
  if (!q) { const d = /(?:\bin\b|\bof\b|:)\s*(\S[\s\S]*)$/.exec(message); if (d) details.push({ start: message.length - d[1].length, end: message.length }); }
  // STAND-IN for the references stage (B03B2c): the test marks the pointer words itself. Wiring the real stage output is go-live work, NOT RUN.
  const references = [] as { start: number; end: number }[];
  for (const d of details) { const body = message.slice(d.start, d.end).toLowerCase().replace(/[?.!]+$/, ''); if (POINTERS.includes(body)) references.push(d); }
  return { tool: 'text-counter', toolName: 'Text Counter', message, values: [], materials, details, references, words, choices: { unit: TEXT_COUNTER_UNITS }, evidence: 'concept' };
}

async function legacyReply(message: string): Promise<string | null> {
  const m = TEXT_COUNT_COMMAND.match(message);
  if (!m || m.ask) return null;
  const out = countText(String(m.input.text));
  return TEXT_COUNT_COMMAND.describe(out, m.input);
}
const stripNote = (s: string): string => s.split('\n\nNote:')[0];

async function runnerReply(message: string): Promise<string | null> {
  const b = bindArguments(bindInputFor(message));
  if (b.decision !== 'run') return null;
  const r = await TEXT_COUNTER_RUNNER.run(b.args, deps);
  return r.ok ? r.reply : 'FAILURE: ' + r.message;
}

// registry, schema, switch
check(getSchema('text-counter')!.slots.map((s) => s.name).join() === 'text,unit', 'schema has text and unit');
check(findRunner('text-counter') === TEXT_COUNTER_RUNNER && runnerToolIds().length === 19, 'registered');
check((await execute('text-counter', { text: 'a b' }, deps)).route === 'legacy', 'switch OFF by default: legacy answers');
const live = await execute('text-counter', { text: 'a b' }, deps, { 'text-counter': 'runner' });
check(live.route === 'runner' && live.outcome.ok === true, 'switch ON: runner answers');

// binder: a detail span that is only a reference is not text (mutant guard)
const refMsg = 'count words in the above';
const refAt = refMsg.indexOf('the above');
const refBind = (references: { start: number; end: number }[]) => bindArguments({ tool: 'text-counter', toolName: 'Text Counter', message: refMsg, values: [], materials: [], details: [{ start: refAt, end: refMsg.length }], references, words: [{ norm: 'words', start: 6, end: 11 }], choices: { unit: TEXT_COUNTER_UNITS } });
check(refBind([{ start: refAt, end: refMsg.length }]).decision === 'ask', 'a reference alone asks for the text');
check(refBind([]).decision === 'run', 'without reference info the span is still text (old behaviour kept)');

// runner on its own
const r1 = await TEXT_COUNTER_RUNNER.run({ text: 'hello brave new world' }, deps);
check(r1.ok && (r1.result as { words: number }).words === 4 && r1.reply.startsWith('Here are the counts'), 'default unit all');
check((await TEXT_COUNTER_RUNNER.run({ text: '' }, deps)).ok === true, 'empty text is a present value: counts zero');
check((await TEXT_COUNTER_RUNNER.run({}, deps)).ok === false, 'no text refused');
const bad = await TEXT_COUNTER_RUNNER.run({ text: 5 }, deps);
check(!bad.ok && bad.kind === 'invalid-input' && bad.slot === 'text', 'number as text refused');
const bu = await TEXT_COUNTER_RUNNER.run({ text: 'x', unit: 'pages' }, deps);
check(!bu.ok && bu.slot === 'unit', 'unknown unit refused');
check(!(await TEXT_COUNTER_RUNNER.run({ text: 'x', extra: 1 }, deps)).ok, 'unknown slot refused');
check((await TEXT_COUNTER_RUNNER.run({ text: 'a\nb\n' }, deps)).ok, 'lines');
const frozen = Object.freeze({ text: 'keep', unit: 'words' });
await TEXT_COUNTER_RUNNER.run(frozen, deps);
check(frozen.text === 'keep', 'args untouched');
const emoji = await TEXT_COUNTER_RUNNER.run({ text: '😀😀', unit: 'chars' }, deps);
check(emoji.ok && (emoji.result as { characters: number }).characters === 2 && emoji.reply.includes('2 characters'), 'code points and short unit');

// SHADOW: 50 requests
const REQUESTS: string[] = [
  'count words in "hello brave new world"', 'count the words in "one"', 'count characters in "good morning"', 'count the characters of "a b c"',
  'count letters in "abc 123"', 'count lines in "a\nb\nc"', 'how many words are in "the quick brown fox"', 'how many characters are in "good morning"',
  'how many letters in "hello"', 'how many lines in "x\ny"', 'how many word in "hi"', 'word count of "hello there world"',
  'character count of "hello"', 'letter count "abc"', 'line count of "a\nb"', 'please count words in "thanks a lot"',
  'can you count words in "it is fine"', 'could you count the letters in "kind"', 'count words: "colon form here"', 'count chars in "abcd"',
  'count words in hello brave new world', 'count characters in good morning', 'how many words are in the quick brown fox', 'how many lines in one two',
  'count the words in this is plain text', 'count letters of abcdef', 'word count: plain words follow', 'count lines in alpha beta',
  'count words in "  spaced   out  "', 'count characters in "émigré naïve"', 'count words in "😀 😀 ok"', 'count words in ""',
  'count words in "tab\tseparated\tparts"', 'count lines in "last line\n"', 'how many characters in "x"', 'count letters in "ab-cd ef"',
  'count words in "one, two; three."', 'how many words are there in "a b"', 'count the lines of "only one"', 'count words in "日本語 テキスト"',
  'count words', 'count the characters', 'how many lines', 'count letters in this text', 'count words in the following', 'word count',
  'count lines in that', 'how many characters are in it', 'count words in the above', 'please count letters',
];
check(REQUESTS.length === 50, 'exactly 50 requests');
let same = 0; const diffs: string[] = [];
for (const msg of REQUESTS) {
  const l = await legacyReply(msg);
  const r = await runnerReply(msg);
  if (l === null && r === null) { same++; continue; }       // both ask for the text
  if (l !== null && r !== null && stripNote(l) === r) { same++; continue; }
  diffs.push(`${JSON.stringify(msg)} legacy=${JSON.stringify(l)} runner=${JSON.stringify(r)}`);
}
if (diffs.length) console.log('SHADOW DIFFERENCES (' + diffs.length + '):\n' + diffs.join('\n'));
check(same === 50, 'pilot reply identical on 50 requests (' + same + ' of 50)');
console.log('textCounterPilot: ' + n + ' checks passed; shadow ' + same + '/50 identical');
