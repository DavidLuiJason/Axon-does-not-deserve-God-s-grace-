/** LIVE1a: the direct lane. Every condition of docs/LIVE0_DESIGN.md section 2 has a check that yields and a check that runs. Real stages, real dictionary. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runDirectLane, type LaneConfig, type LaneInput } from '../src/brain/mind/directLane';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { execute } from '../src/tools/runners/runnerRegistry';
import { STATE_TOOL_IDS } from '../src/tools/runners/liveSwitches';
import { TEXT_COUNTER_UNITS } from '../src/tools/runners/textCounterRunner';
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot'); const { createStages } = await import('../src/brain/mind/stages');
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const stages = createStages({ run: async () => ({ content: 'x', source: 'test' }), holdsConversation: () => false } as never, () => Date.UTC(2026, 0, 1, 12, 30), () => 't', createDictionarySlot(async () => dictionary));
const read = async (text: string): Promise<LaneInput> => {
  let ctx: any = { utterance: { id: 't', text, place: 'chat', at: 0 }, entries: [] };
  for (const st of stages) { if (st.id === 'dialogue') break; ctx = await st.run(ctx); }
  return { message: text, holdsConversation: false, segments: ctx.analysis?.segments ?? [], values: ctx.values ?? [], meaning: ctx.meaning, resolutions: ctx.resolutions };
};
const DEPS = { now: 0, randomBelow: () => 0, random01: () => 0 };
const config = (over: Partial<LaneConfig> = {}): LaneConfig => ({
  isOn: (t) => t === 'text-counter', needsState: (t) => STATE_TOOL_IDS.includes(t), guards: LANE_GUARDS,
  run: (t, a, d) => execute(t, a, d, { 'text-counter': 'runner' }), choicesFor: () => ({ unit: TEXT_COUNTER_UNITS }), toolNameFor: () => 'Text Counter', deps: () => DEPS, ...over,
});
const GOOD = 'count words in "hello brave new world"';
const good = await read(GOOD);
const ran = await runDirectLane(good, config());
check(ran.kind === 'answer' && ran.reply.source === 'runner:text-counter' && ran.reply.content.includes('4 words'), 'RUN: a plain single request answers through the runner');
check(ran.kind === 'answer' && !ran.note.includes('said aloud'), 'RUN: no default used, nothing added to the reply');
// 1 conversation
const y1 = await runDirectLane({ ...good, holdsConversation: true }, config());
check(y1.kind === 'yield' && y1.reason.includes('conversation'), 'YIELD 1: a conversation is waiting');
// 2 switch
const y2 = await runDirectLane(good, config({ isOn: () => false }));
check(y2.kind === 'yield' && y2.reason.includes('switch'), 'YIELD 2: switch off');
check((await runDirectLane(good, config({ run: (t, a, d) => execute(t, a, d, {}) }))).kind === 'yield', 'YIELD 2b: the registry switch off also yields');
// 3 pieces
const two = await read('count words in "a b" then reverse it');
const y3 = await runDirectLane(two, config());
check(y3.kind === 'yield', 'YIELD 3: two pieces');
const noRes = await runDirectLane({ ...good, resolutions: [...(good.resolutions ?? []), ...(good.resolutions ?? [])] }, config());
check(noRes.kind === 'yield', 'YIELD 3b: two resolutions');
// 4 negation, teaching, relay, needsPrevious
const neg = await read('do not count words in "a b"');
check((await runDirectLane(neg, config())).kind === 'yield', 'YIELD 4a: negation (real reading)');
const m = good.meaning as any;
check((await runDirectLane({ ...good, meaning: { ...m, teaching: [{ kind: 'teach' }] } }, config())).kind === 'yield', 'YIELD 4b: teaching');
const withRefs = (refs: object): LaneInput => ({ ...good, meaning: { ...m, structure: { ...m.structure, pieces: [{ ...m.structure.pieces[0], refs: { ...m.structure.pieces[0].refs, ...refs } }] } } });
check((await runDirectLane(withRefs({ relay: { kind: 'x' } }), config())).kind === 'yield', 'YIELD 4c: relay');
check((await runDirectLane(withRefs({ needsPrevious: true }), config())).kind === 'yield', 'YIELD 4d: needs the one before');
check((await runDirectLane({ ...good, meaning: { ...m, clauses: [{ ...m.clauses[0], polarity: 'negative' }] } }, config())).kind === 'yield', 'YIELD 4e: negative polarity');
check((await runDirectLane({ ...good, meaning: { ...m, structure: { ...m.structure, links: [{}] } } }, config())).kind === 'yield', 'YIELD 4f: linked pieces');
check((await runDirectLane({ ...good, meaning: undefined }, config())).kind === 'yield', 'YIELD 4g: no meaning');
// 5 binder ask
const ask = await read('count words');
const y5 = await runDirectLane(ask, config());
check(y5.kind === 'yield', 'YIELD 5: no text, the binder asks');
// 6 state tool
check((await runDirectLane(good, config({ needsState: () => true }))).kind === 'yield', 'YIELD 6: tool that needs state');
const timer = await read('set a timer for 5 minutes');
check((await runDirectLane(timer, config({ isOn: () => true }))).kind === 'yield', 'YIELD 6b: a real timer request yields even with every switch on');
// 7 guard
const code = '```js\nconst a = 1;\n```';
check(LANE_GUARDS['text-counter']!({ text: code }, 'x') !== null && LANE_GUARDS['text-counter']!({ text: 'hello world' }, 'hello world') === null, 'GUARD: code in the text refuses, plain text passes');
check(LANE_GUARDS['text-counter']!({ text: 'x' }, 'count words in ' + code) !== null, 'GUARD: code in the message refuses');
check((await runDirectLane(good, config({ guards: { 'text-counter': () => 'test guard says no' } }))).kind === 'yield', 'YIELD 7: an injected guard is honoured');
check((await runDirectLane(await read('count words in ' + code), config())).kind === 'yield', 'YIELD 7b: real code message yields');
// 8 runner failure and throw
check((await runDirectLane(good, config({ run: async () => ({ route: 'runner', outcome: { ok: false, toolId: 'text-counter', kind: 'engine-refused', message: 'no' } }) }))).kind === 'yield', 'YIELD 8a: runner refuses');
check((await runDirectLane(good, config({ run: async () => { throw new Error('boom'); } }))).kind === 'yield', 'YIELD 8b: runner throws');
check((await runDirectLane(good, config({ run: async () => ({ route: 'legacy' }) }))).kind === 'yield', 'YIELD 8c: route legacy');
check((await runDirectLane(good, config({ choicesFor: () => { throw new Error('boom'); } }))).kind === 'yield', 'YIELD 8d: a throwing helper never escapes');
// 9 defaults: the lane yields unless the owner allowed said-aloud answers
const andForm = await read('count words in "a b" and count lines in "c"');
check((await runDirectLane(andForm, config())).kind === 'yield', 'YIELD 9: the binder assumed something, lane yields by default');
const said = await runDirectLane(andForm, config({ allowDefaults: true }));
check(said.kind === 'answer' && said.reply.content.startsWith('I read this as') && said.note.includes('said aloud'), 'RUN 9: allowed, the assumption is said aloud first');
const always = (reply: string) => ({ run: async () => ({ route: 'runner' as const, outcome: { ok: true as const, toolId: 'text-counter', result: {}, reply } }) });
check((await runDirectLane(ask, config(always('X')))).kind === 'yield', 'YIELD 5b: the binder asks, so even a runner that would answer is not asked');
const m2 = good.meaning as any;
check((await runDirectLane({ ...good, meaning: { ...m2, structure: { ...m2.structure, pieces: [m2.structure.pieces[0], m2.structure.pieces[0]] } } }, config(always('X')))).kind === 'yield', 'YIELD 3c: two pieces with one clause and one resolution');
// input untouched
const frozen = JSON.stringify(good); await runDirectLane(good, config()); check(JSON.stringify(good) === frozen, 'the input is not changed');
console.log('directLane: ' + n + ' checks passed');
