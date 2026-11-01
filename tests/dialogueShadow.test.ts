/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D2a (shadow): the Mind keeps the dialogue state and writes a real trace, and NO reply changes.
 * A: scripted driver transcripts (parking rule, answer, cancel, unclear, expiry, reset, input never changed).
 * B: the REAL Mind with the real dictionary: replies with the shadow ON are byte-identical to replies with it OFF, on 60 messages.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readsAsRequest, stepDialogue, turnFromResolutions, type DialogueHost } from '../src/brain/mind/dialogue/dialogueDriver';
import { emptyDialogue, recordTurn, setPending } from '../src/brain/mind/dialogue/dialogueState';
import { livePending } from '../src/brain/mind/dialogue/dialogueAnswer';
import type { DialogueState } from '../src/brain/mind/dialogue/dialogueTypes';
import { createMind } from '../src/brain/mind/pipeline';
import { createStages } from '../src/brain/mind/stages';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import type { BrainProvider } from '../src/brain/types';
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');

let checks = 0;
const ok = (value: unknown, message: string): void => { checks += 1; assert.ok(value, `FAIL: ${message}`); };
const eq = (got: unknown, want: unknown, message: string): void => { checks += 1; assert.deepEqual(got, want, `FAIL: ${message}`); };

// ---------- A: driver transcripts ----------
const asked = (): DialogueState => setPending(recordTurn(emptyDialogue(), { id: 't0', at: 1, text: 'convert to uppercase', tool: 'case-converter', outcome: 'asked' }),
  { kind: 'text-slot', question: 'What text should I use?', slot: 'text', tool: 'case-converter' });
{
  const s0 = asked();
  ok(livePending(s0) !== null, 'the scripted question is pending');
  const a = stepDialogue(s0, 'hello world', false);
  eq(a.reading.kind, 'answers', 'an unquoted reply answers a text question');
  eq(a.state.pending, null, 'an answer clears the question');
  const c = stepDialogue(s0, 'cancel', false);
  eq(c.reading.kind, 'cancels', 'cancel is read');
  eq(c.state.pending, null, 'a cancel clears the question');
  // PARKING RULE: a new request keeps the question
  const p = stepDialogue(s0, 'how many words in "a b"', true);
  eq(p.reading.kind, 'new-topic', 'a new request is a new topic');
  ok(p.parked === true, 'the step says parked');
  eq(p.state.pending, s0.pending, 'the parked question is kept exactly');
  ok(p.note.includes('parked'), 'the trace says parked');
  // parked, one turn goes by, then the owner answers: the question is still there
  const after = recordTurn(p.state, { id: 't1', at: 2, text: 'how many words in "a b"', tool: 'text-counter', outcome: 'answered' });
  ok(livePending(after) !== null, 'still parked after one turn');
  eq(after.topic, 'text-counter', 'the topic follows the new request');
  eq(stepDialogue(after, 'good morning', false).reading.kind, 'answers', 'the parked question can still be answered');
  // parked questions still expire (3 turns)
  let aged = after;
  aged = recordTurn(aged, { id: 't2', at: 3, text: 'x', outcome: 'none' });
  aged = recordTurn(aged, { id: 't3', at: 4, text: 'y', outcome: 'none' });
  ok(livePending(aged) === null, 'a parked question expires after 3 turns');
  eq(stepDialogue(aged, 'hello', false).reading.kind, 'none', 'an expired question is not read');
  // unclear keeps it; nothing pending leaves the very same state
  const u = stepDialogue(s0, '   ', false);
  eq(u.reading.kind, 'unclear', 'an empty reply is unclear');
  eq(u.state.pending, s0.pending, 'unclear keeps the question');
  const n = stepDialogue(emptyDialogue(), 'hello', false);
  eq(n.reading.kind, 'none', 'nothing pending reads none');
  ok(n.state.turnCount === 0 && n.state.pending === null, 'nothing pending changes nothing');
  // input is never changed
  const frozen = JSON.stringify(s0); stepDialogue(s0, 'hello world', false); stepDialogue(s0, 'cancel', false); stepDialogue(s0, 'x', true);
  eq(JSON.stringify(s0), frozen, 'the input state is never changed');
  // resolutions
  const m = [{ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind: 'match', tool: 'text-counter', missingSlots: [] } }] as never;
  const na = [{ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind: 'unavailable', tool: 'zip', status: 'x' } }] as never;
  const as = [{ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind: 'ask', choices: ['a', 'b'] } }] as never;
  const no = [{ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind: 'none' } }] as never;
  eq(turnFromResolutions(m), { tool: 'text-counter', outcome: 'answered' }, 'a match is an answered turn');
  eq(turnFromResolutions(na), { tool: 'zip', outcome: 'declined' }, 'an unavailable tool is a declined turn');
  eq(turnFromResolutions(as), { tool: null, outcome: 'asked' }, 'a tool question is an asked turn');
  eq(turnFromResolutions(no), { tool: null, outcome: 'none' }, 'none is a none turn');
  eq(turnFromResolutions(undefined), { tool: null, outcome: 'none' }, 'no resolutions is a none turn');
  ok(readsAsRequest(m) && readsAsRequest(na) && readsAsRequest(as) && !readsAsRequest(no) && !readsAsRequest(undefined), 'only a found tool is a new request');
}
// the stage itself, with a host that holds a live question
{
  let held = asked();
  const host: DialogueHost = { get: () => held, set: (next) => { held = next; } };
  const stage = createStages({ run: async () => ({ content: '', source: 'test' }), holdsConversation: () => false } as never, () => 0, () => 'u', undefined, undefined, undefined, host).find((st) => st.id === 'dialogue')!;
  const ctx = { utterance: { id: 'u1', text: 'hello world', place: 'chat' as const, at: 1 }, entries: [] };
  const done = await stage.run(ctx);
  ok(done.entries[0]?.state === 'ran' && done.entries[0]?.note.includes('answers'), 'the stage runs and says the question was answered');
  eq(held.pending, null, 'the stage cleared the answered question in the host');
  held = asked();
  const parked = await stage.run({ ...ctx, resolutions: [{ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind: 'match', tool: 'text-counter', missingSlots: [] } }] as never });
  ok(parked.entries[0]?.note.includes('parked'), 'the stage says the question is parked');
  ok(held.pending !== null, 'the stage kept the parked question in the host');
  eq(parked.reply, undefined, 'the stage makes no reply');
}

// ---------- B: the real Mind ----------
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const legacy: BrainProvider = {
  id: 'legacy-stub', label: 'legacy', status: () => ({ id: 'legacy-stub', label: 'legacy', ready: true, note: '' }), holdsConversation: () => false,
  async handle(request) { const m = TEXT_COUNT_COMMAND.match(request.text); return m && !m.ask ? { content: 'COUNT:' + request.text, source: 'legacy-stub' } : null; },
};
const fallback: BrainProvider = { id: 'fallback', label: 'fallback', status: () => ({ id: 'fallback', label: 'f', ready: true, note: '' }), holdsConversation: () => false, async handle(request) { return { content: 'FALLBACK:' + request.text, source: 'fallback' }; } };
const clock = () => Date.UTC(2026, 0, 1, 12, 30);
const off = createMind({ providers: [legacy], fallback, now: clock, slot, dialogue: false });
const on = createMind({ providers: [legacy], fallback, now: clock, slot });
const MESSAGES: string[] = [
  'count words in "hello brave new world"', 'how many characters are in "good morning"', 'count lines in "a\nb\nc"', 'hello', 'thanks', 'what can you do',
  'convert "hello world" to uppercase', 'convert hello world to uppercase', 'change hello world to title case', 'what is uppercase', 'make "Hello" lowercase',
  'cancel', 'yes', 'no', '1', 'hello world', '"hello world"', 'qr code please', 'zip these files', 'trim the video',
  'what is a kebab', 'convert a snake to a string', 'count chars in "abcd"', 'word count of "hello there"', 'letter count "abc"', '', '   ', '?', '...', 'a',
  'what time is it', 'tell me about the moon', 'define serendipity', 'how do I reset my router', 'I need a QR code', 'make me a collage', 'resize my picture',
  'count the words', 'count words in', 'uppercase', 'Title', 'camelCase this: helloWorld', 'convert helloWorld to snake case', 'kebab-case "hello world"',
  'please count the letters in "kind"', 'could you count words in "it is fine"', 'good morning', 'good night', 'who are you', 'help', 'undo', 'stop', 'never mind',
  'remember that my cat is Tom', 'what is my cat called', 'forget it', 'again', 'more', 'that one', 'it', 'one more thing',
];
ok(MESSAGES.length >= 60, 'the corpus has at least 60 messages');
let same = 0;
for (const text of MESSAGES) {
  const a = await off.ask({ text, place: 'chat' });
  const b = await on.ask({ text, place: 'chat' });
  eq(JSON.stringify(b), JSON.stringify(a), `replies are byte-identical with the shadow on: ${JSON.stringify(text)}`);
  same += 1;
}
const snap = on.dialogueSnapshot();
eq(snap.turnCount, MESSAGES.length, 'the Mind counted every turn');
ok(snap.pending === null, 'nothing asks a question in D2a, so nothing is ever pending');
ok(snap.turns.length <= 8 && snap.turns.length > 0, 'the state keeps only the last 8 turns');
eq(snap.turns.map((t) => t.text).slice(-3), MESSAGES.slice(-3).map((t) => t.trim()), 'the last turns are the last messages');
eq(off.dialogueSnapshot().turnCount, 0, 'with the shadow off nothing is recorded');
const trace = await on.askWithTrace({ text: 'count words in "a b"', place: 'chat' });
const entry = trace.trace.entries.find((e) => e.stage === 'dialogue');
ok(entry?.state === 'ran' && entry.note.startsWith('shadow:'), 'the dialogue trace entry is real');
const traceOff = await off.askWithTrace({ text: 'count words in "a b"', place: 'chat' });
ok(traceOff.trace.entries.find((e) => e.stage === 'dialogue')?.state === 'not-built', 'with the shadow off the stage is as before');
// reset: a new chat starts empty, and counting starts again from 0
on.resetDialogue();
eq(on.dialogueSnapshot(), emptyDialogue(), 'resetDialogue empties the state');
await on.ask({ text: 'hello', place: 'chat' });
eq(on.dialogueSnapshot().turnCount, 1, 'counting starts again after a reset');
off.resetDialogue();
eq(off.dialogueSnapshot(), emptyDialogue(), 'reset on a Mind with the shadow off is harmless');
console.log(`dialogueShadow: ${checks} checks passed (driver transcripts, stage, ${same} messages byte-identical on/off, trace, reset)`);
