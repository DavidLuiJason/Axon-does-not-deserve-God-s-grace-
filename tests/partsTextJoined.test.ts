import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const R = process.cwd();
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const { createStages } = await import('../src/brain/mind/stages');
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { buildBindInputs } = await import('../src/brain/mind/bind/bindFeed');
const { bindArguments } = await import('../src/brain/mind/bind/argumentBinder');
const { TEXT_COUNTER_RUNNER, TEXT_COUNTER_UNITS } = await import('../src/tools/runners/textCounterRunner');
type BindInput = import('../src/brain/mind/bind/argumentBinder').BindInput;
const { extractValues } = await import('../src/brain/mind/meaning/values');
const executor = { run: async () => ({ content: 'x', source: 'test' }) } as never;
const R2 = process.cwd();
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(R2, 'public/dictionary/en', p), 'utf8'), hash: sha });
const stages = createStages(executor, () => Date.UTC(2026, 0, 1, 12, 30), () => 'test', createDictionarySlot(async () => dictionary));
const clock = { year: 2026, month: 1, day: 1, hour: 12, minute: 30 };
/** PARTS-TEXT part 2 (real stages, real dictionary): what the binder decides for unquoted text. */
async function bound(text: string) {
  let ctx: any = { utterance: { id: 't', text, place: 'chat', at: 0 }, entries: [] };
  for (const st of stages) ctx = await st.run(ctx);
  const ex = extractValues(text, ctx.analysis.segments, clock);
  const items = ctx.meaning?.structure ? buildBindInputs({ message: text, segments: ctx.analysis.segments, structure: ctx.meaning.structure, values: ex.ok ? ex.values : [], resolutions: ctx.resolutions ?? [], choicesFor: () => ({ unit: TEXT_COUNTER_UNITS }), toolNameFor: () => 'Text Counter' }) : [];
  const item = items.find((i) => i.input.tool === 'text-counter');
  return item ? bindArguments(item.input) : null;
}
const fails: string[] = [];
const check = (ok: boolean, name: string) => { if (!ok) fails.push(name); };
const a = await bound('count the words in this is plain text');
check(a?.decision === 'run' && a.args.text === 'this is plain text' && a.args.unit === 'words', 'joined "in this" keeps the whole text');
const b = await bound('count letters of abcdef');
check(b?.decision === 'run' && b.args.text === 'abcdef', '"of" starts the text');
const c = await bound('count letters in this text');
check(c !== null && c.decision !== 'run', '"this text" is a pointer: ask, never count it');
const d = await bound('count lines in that');
check(d !== null && d.decision !== 'run', '"that" alone is a pointer: ask');
const e = await bound('count words in "hello brave new world"');
check(e?.decision === 'run' && e.args.text === 'hello brave new world', 'quoted text unchanged');
const f = await bound('how many words are in the quick brown fox');
check(f?.decision === 'run' && f.args.text === 'the quick brown fox' && f.args.unit === 'words', '"brown" inside the detail is not the main verb');
const g = await bound('word count: plain words follow');
check(g?.decision === 'run' && g.args.text === 'plain words follow' && g.args.unit === 'word', 'unquoted text after a colon is the text, its words are not clause words');
const h = await bound('count words: "red green"');
check(h?.decision === 'run' && h.args.text === 'red green', 'quoted text after a colon unchanged');
if (fails.length) { console.error(fails.join('\n')); throw new Error(`partsTextJoined: ${fails.length} failed`); }
console.log('partsTextJoined: 8 checks passed');
