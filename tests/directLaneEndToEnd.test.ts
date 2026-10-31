/** LIVE1b: the lane inside the real Mind pipeline on the 50 text requests. Lane OFF must be byte-identical; lane ON must never answer differently from the old handler. Counts are derived, never targeted. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMind } from '../src/brain/mind/pipeline';
import type { LaneConfig } from '../src/brain/mind/directLane';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { countText } from '../src/kernel/textCount';
import { execute } from '../src/tools/runners/runnerRegistry';
import { STATE_TOOL_IDS } from '../src/tools/runners/liveSwitches';
import { TEXT_COUNTER_UNITS } from '../src/tools/runners/textCounterRunner';
import type { BrainProvider } from '../src/brain/types';
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
let holding = false;
const legacy: BrainProvider = {
  id: 'legacy-stub', label: 'legacy', status: () => ({ id: 'legacy-stub', label: 'legacy', ready: true, note: '' }), holdsConversation: () => holding,
  async handle(request) { const m = TEXT_COUNT_COMMAND.match(request.text); if (!m) return null; if (m.ask) return { content: 'ASK:' + m.ask.question, source: 'legacy-stub' }; return { content: TEXT_COUNT_COMMAND.describe(countText(String(m.input.text)), m.input), source: 'legacy-stub' }; },
};
const fallback: BrainProvider = { id: 'fallback', label: 'fallback', status: () => ({ id: 'fallback', label: 'f', ready: true, note: '' }), holdsConversation: () => false, async handle() { return { content: 'FALLBACK', source: 'fallback' }; } };
const lane = (on: boolean): LaneConfig => ({
  isOn: (t) => on && t === 'text-counter', needsState: (t) => STATE_TOOL_IDS.includes(t), guards: LANE_GUARDS,
  run: (t, a, d) => execute(t, a, d, on ? { 'text-counter': 'runner' } : {}), record: async () => ({ taskId: 'task-0', line: 'Ran as task task-0: COMPLETED in 0 ms, from your exact input.' }), choicesFor: () => ({ unit: TEXT_COUNTER_UNITS }), toolNameFor: () => 'Text Counter', deps: () => ({ now: 0, randomBelow: () => 0, random01: () => 0 }),
});
const STUB_LINE = '\n\nRan as task task-0: COMPLETED in 0 ms, from your exact input.';
const bare = (content: string): string => (content.endsWith(STUB_LINE) ? content.slice(0, -STUB_LINE.length) : content);
const clock = () => Date.UTC(2026, 0, 1, 12, 30);
const base = createMind({ providers: [legacy], fallback, now: clock, slot });
const off = createMind({ providers: [legacy], fallback, now: clock, slot, lane: lane(false) });
const on = createMind({ providers: [legacy], fallback, now: clock, slot, lane: lane(true) });
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
let byteSame = 0, traceSame = 0, laneAnswers = 0, equalLegacy = 0, equalWithSaidPrefix = 0; const wrong: string[] = []; const yields = new Map<string, number>();
for (const text of REQUESTS) {
  const b = await base.askWithTrace({ text, place: 'chat' } as never);
  const o = await off.askWithTrace({ text, place: 'chat' } as never);
  if (JSON.stringify(b.reply) === JSON.stringify(o.reply)) byteSame++;
  const strip = (t: { entries: { stage: string; note: string }[] }) => t.entries.map((e) => (e.stage === 'execution' ? e.stage + e.note.split(';')[0] : e.stage + e.note)).join('|');
  if (strip(b.trace) === strip(o.trace)) traceSame++;
  const a = await on.askWithTrace({ text, place: 'chat' } as never);
  if (a.reply.source.startsWith('runner:')) {
    laneAnswers++;
    if (bare(a.reply.content) === b.reply.content) equalLegacy++;
    else if (bare(a.reply.content).endsWith('\n\n' + b.reply.content)) equalWithSaidPrefix++;
    else wrong.push(`${JSON.stringify(text)} legacy=${JSON.stringify(b.reply.content)} lane=${JSON.stringify(a.reply.content)}`);
  } else {
    if (JSON.stringify(a.reply) !== JSON.stringify(b.reply)) wrong.push(`${JSON.stringify(text)} yielded but reply differs`);
    const note = a.trace.entries.find((e) => e.stage === 'execution')!.note; const why = note.split('yielded: ')[1] ?? '(no note)';
    yields.set(why, (yields.get(why) ?? 0) + 1);
  }
}
console.log(`lane OFF: replies byte-identical ${byteSame}/50, trace identical (apart from the yield note) ${traceSame}/50`);
console.log(`lane ON: answered by the lane ${laneAnswers}/50 (equal to old reply ${equalLegacy}, equal after the said-aloud sentence ${equalWithSaidPrefix}), different or wrong ${wrong.length}`);
for (const [why, count] of yields) console.log(`  yielded ${count}x: ${why}`);
if (wrong.length) console.log('DIFFERENT:\n' + wrong.join('\n'));
check(byteSame === 50, 'lane OFF: all 50 replies byte-identical to a mind with no lane');
check(traceSame === 50, 'lane OFF: trace identical apart from the yield note');
check(wrong.length === 0, 'lane ON: no answer differs from the old handler');
// several instructions that Meaning reads as ONE piece (FINDING, LIVE1b): the lane must still not answer differently from the old handler
const MULTI = ['count words in "a b" and count lines in "c"', 'count words in "a b" and then count lines in "c"', 'count words in hello and count lines in world'];
for (const text of MULTI) {
  const b = await base.ask({ text, place: 'chat' } as never); const a = await on.ask({ text, place: 'chat' } as never);
  if (!(bare(a.content) === b.content || bare(a.content).endsWith('\n\n' + b.content))) console.log('MULTI DIFF', JSON.stringify(text), '\n legacy=', JSON.stringify(b.content), '\n lane  =', JSON.stringify(a.content));
  check(bare(a.content) === b.content || bare(a.content).endsWith('\n\n' + b.content), 'multi-instruction message answers like the old handler: ' + text);
}
// a conversation waiting stops the lane
holding = true; const held = await on.askWithTrace({ text: REQUESTS[0]!, place: 'chat' } as never); holding = false;
check(!held.reply.source.startsWith('runner:'), 'a waiting conversation owns the message');
// a throwing lane never breaks the answer
const broken = createMind({ providers: [legacy], fallback, now: clock, slot, lane: { ...lane(true), run: async () => { throw new Error('boom'); } } });
const brokenReply = await broken.ask({ text: REQUESTS[0]!, place: 'chat' } as never);
check(brokenReply.content === (await base.ask({ text: REQUESTS[0]!, place: 'chat' } as never)).content, 'a failing runner still gives the old answer');
console.log('directLaneEndToEnd: ' + n + ' checks passed');
