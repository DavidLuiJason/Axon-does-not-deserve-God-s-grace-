/** LIVE2: the REAL brain (real local rules, real dictionary, real catalog) with the lane OFF against ON. Text Counter is live; no reply may differ from the old handler's. Counts are derived, never targeted. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildLaneConfig, createAxonBrain, getUserLexicon } from '../src/brain/index';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const off = createAxonBrain({ lane: false, slot });
// the measurement switches Text Counter ON for this test only; the shipped switches are pinned OFF (liveSwitches.test.ts)
const on = createAxonBrain({ lane: true, slot, switches: { 'text-counter': 'runner' } });
check(buildLaneConfig().isOn('text-counter') === true && buildLaneConfig().isOn('timer') === false && buildLaneConfig().isOn('calculator') === false, 'the shipped lane wiring has Text Counter ON and the others OFF');
const shipped = createAxonBrain({ lane: true, slot });
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
const EXTRAS: string[] = [
  'hello', 'thank you', 'what can you do', 'what is 12 times 3', 'how many words are in "a b" and count lines in "c"',
  'count words in "a b" and count lines in "c"', 'do not count words in "x y"', 'count words in ```js\nconst a = 1;\n```', 'count the characters in the following: const a = 1;',
  'tell me a joke', 'count words in "one two three" please', 'count LETTERS in "AbC"', 'what is the capital of France',
];
let laneAnswered = 0, taskLost = 0, sameAll = 0; const diffs: string[] = []; const otherDiffs: string[] = [];
// only what legitimately varies is normalised: the task number and the milliseconds
const norm = (content: string): string => content.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
const compare = async (text: string): Promise<void> => {
  const a = await off.askWithTrace({ text, place: 'chat' });
  const b = await on.askWithTrace({ text, place: 'chat' });
  const viaLane = b.reply.source.startsWith('runner:');
  if (viaLane) { laneAnswered++; if ((a.reply.taskId === undefined) !== (b.reply.taskId === undefined)) taskLost++; }
  const sameSource = viaLane ? a.reply.source === 'local-rules' : a.reply.source === b.reply.source;
  if (norm(a.reply.content) === norm(b.reply.content) && sameSource && (a.reply.taskId === undefined) === (b.reply.taskId === undefined)) sameAll++;
  else if (viaLane) diffs.push(`${JSON.stringify(text)}\n  old =${JSON.stringify(norm(a.reply.content))}\n  lane=${JSON.stringify(norm(b.reply.content))}`);
  else otherDiffs.push(`${JSON.stringify(text)} off=${JSON.stringify(a.reply).slice(0, 160)} on=${JSON.stringify(b.reply).slice(0, 160)}`);
};
for (const text of [...REQUESTS, ...EXTRAS]) await compare(text);
const total = REQUESTS.length + EXTRAS.length;
console.log(`MEASURED real brain, ${total} messages: answered by the lane ${laneAnswered}; reply identical to the old one apart from task number and milliseconds ${sameAll}; lane answers with a task record missing or extra ${taskLost}; lane answers that differ ${diffs.length}; non-lane replies that differ ${otherDiffs.length}`);
if (diffs.length) console.log('LANE ANSWERS THAT DIFFER:\n' + diffs.join('\n'));
if (otherDiffs.length) console.log('OTHER DIFFS:\n' + otherDiffs.join('\n'));
// the ONE accepted difference (owner, 'go' on the Director's recommendation): the old handler counts the polite word 'please' as part of the text; the lane does not
const ACCEPTED = JSON.stringify('count words in "one two three" please');
check(diffs.every((d) => d.startsWith(ACCEPTED)), 'the only lane answer that differs is the accepted please case');
check(otherDiffs.length === 0, 'a message the lane does not answer gets exactly the old reply');
check(taskLost === 0, 'every lane answer carries a task record, like the old path');
// the SHIPPED brain (switches as merged) answers exactly like the old one, task line and id included
for (const text of ['count words in "hello brave new world"', 'hello', 'how many lines in "x\ny"']) {
  const a = await off.ask({ text, place: 'chat' }); const b = await shipped.ask({ text, place: 'chat' });
  check((a.source === b.source || b.source === 'runner:text-counter') && norm(a.content) === norm(b.content) && (a.taskId === undefined) === (b.taskId === undefined), 'shipped brain (Text Counter live): same words and task record as the old brain: ' + text);
}
// a taught meaning in the owner's own lexicon is never bypassed
getUserLexicon();
const taught = await off.ask({ text: 'when I say tally I mean count', place: 'chat' });
console.log('teach reply: ' + JSON.stringify(taught).slice(0, 160));
for (const text of ['tally the words in "a b c"', 'tally words in "x y"']) {
  const a = await off.ask({ text, place: 'chat' }); const b = await on.ask({ text, place: 'chat' });
  check(norm(a.content) === norm(b.content), 'taught word: same words with and without the lane: ' + text);
}
console.log('liveTextCounter: ' + n + ' checks passed');
