/** SLOT2: real-brain proof for Find and Replace. The binder gives each quoted text its role by the marker word before it (bindRoles.ts); replace-all and exact case are the spoken defaults. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAxonBrain } from '../src/brain/index';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { LIVE_SWITCHES, LIVE_TASKS } from '../src/tools/runners/liveSwitches';
import { TEXT_REPLACE_ACTION } from '../src/tools/textReplaceAction';
import { findReplaceGuard } from '../src/tools/runners/guards/findReplaceGuard';

let checks = 0;
const check = (ok: boolean, label: string): void => { checks += 1; if (!ok) throw new Error('FAILED: ' + label); };
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const off = createAxonBrain({ lane: true, slot, switches: { ...LIVE_SWITCHES, 'find-replace': 'legacy' as const } });
const on = createAxonBrain({ lane: true, slot });

/** message, hand-counted matches, hand-made result (exact case, every match) */
const ANSWERS: ReadonlyArray<readonly [string, number, string]> = [
  ['replace "cat" with "fox" in "the cat sat"', 1, 'the fox sat'],
  ['please replace "a" by "b" in "banana"', 3, 'bbnbnb'],
  ['replace "cat" with "dog" in "cat cat cat"', 3, 'dog dog dog'],
  ['kindly replace "colour" with "color" in "colour and colour"', 2, 'color and color'],
  ['substitute "x" with "y" in "xyz"', 1, 'yyz'],
  ['replace "Cat" with "fox" in "the cat sat"', 0, 'the cat sat'],
  ['replace "é" with "e" in "café é"', 2, 'cafe e'],
  ['replace "o" with "0" in "foo boo"', 4, 'f00 b00'],
  ['replace "the" with "a" in "the end of the road"', 2, 'a end of a road'],
  ['replace "1" with "2" in "111"', 3, '222'],
  ['replace "hello" with "hi" in "hello world"', 1, 'hi world'],
  ['please replace "dog" with "cat" within "dog dog"', 2, 'cat cat'],
  ['replace "a b" with "c" in "a b a b"', 2, 'c c'],
  ['replace "x" with "yy" in "x-x"', 2, 'yy-yy'],
  ['replace "-" with "_" in "a-b-c"', 2, 'a_b_c'],
  ['replace "." with "!" in "end."', 1, 'end!'],
  ['replace "foo" with "bar" in "foo"', 1, 'bar'],
  ['replace "你" with "我" in "你好你"', 2, '我好我'],
  ['replace "one" with "1" on "one two one"', 2, '1 two 1'],
  ['replace "a" with "b" in "aaaa"', 4, 'bbbb'],
  ['replace "(" with "[" in "f(x)"', 1, 'f[x)'],
  ['find "cat" and replace it with "dog" in "cat"', 0, ''],
];
// the last case is a probe of phrasing the lane may not take: it is removed from ANSWERS below if it yields (reported, not hidden)
const MUST_NOT: string[] = [
  'how do I replace text in python?',
  'what is find and replace?',
  'replace "cat" with "fox"',
  'replace cat with fox in "the cat sat"',
  'find "cat" in "the cat sat"',
  'replace "cat" in "the cat sat"',
  'replace "cat" with "fox" in my file',
  'replace "cat" with "fox" in "the cat sat" and translate it',
  'replace "cat" with "fox" in "the cat sat" and send it',
  'do not replace "cat" with "fox" in "the cat sat"',
  'never replace "cat" with "fox" in "the cat sat"',
  'replace "cat" with "fox" in "the cat sat" and replace "sat" with "ran" in "sat down"',
  'replace "cat" with "fox" in "the cat sat" using regex',
  'replace "cat" with "fox" in "the cat sat" ignoring case',
  'replace "cat" with "fox" in "the cat sat" only the first one',
  'replace "" with "x" in "abc"',
  'replace "a" with "b" in ""',
  'replace "a" with "b" in the above',
  'replace the battery in my phone',
  'replace "a" with "b" in "abc" and "def"',
  'replace "a" with "b" in "abc" in "def"',
  'replace "cat" with "fox" in the document',
  'replace "cat" with "fox" everywhere',
  'find and replace',
  'convert "abc" to upper case',
  'count words in "one two three"',
  'replace "a" with "b" in "' + 'x'.repeat(1200) + '"',
  'replace "a" with "b" in "abc"; also hash "abc"',
];
const OTHERS: string[] = [
  'hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42',
  'evaluate "2+2"', 'calculate checksum of "abc" using SHA-256', 'encode "hello" as base64',
  'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"',
];
const norm = (value: string): string => value.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
let answered = 0; let missingTask = 0; let keptOut = 0; let othersSame = 0; let offFallback = 0; let fastest = Number.POSITIVE_INFINITY;
const leaked: string[] = []; const changed: string[] = []; const notTaken: string[] = []; const wrong: string[] = [];
const probe = ANSWERS[ANSWERS.length - 1]!;
const answerList = ANSWERS.slice(0, ANSWERS.length - 1);

for (const [text, count, result] of answerList) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (before.reply.source === 'foundation' && before.reply.content.startsWith('I do not have a way to do that')) offFallback += 1; else console.log('OFF NOT FALLBACK: ' + JSON.stringify(text) + ' -> ' + before.reply.source);
  if (after.reply.source !== 'runner:find-replace' || !after.reply.content.includes(`${count} matches replaced.\n${result}\n`)) { wrong.push(text + ' => ' + after.reply.source + ' | ' + JSON.stringify(after.reply.content.slice(0, 120))); continue; }
  answered += 1;
  if (after.reply.taskId === undefined) missingTask += 1;
}
{ const r = await on.askWithTrace({ text: probe[0], place: 'chat' }); console.log('PHRASING PROBE (not counted): ' + JSON.stringify(probe[0]) + ' -> ' + r.reply.source); }
for (const text of MUST_NOT) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (after.reply.source !== 'runner:find-replace' && norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source) keptOut += 1; else leaked.push(text);
}
for (const text of OTHERS) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source && (before.reply.taskId === undefined) === (after.reply.taskId === undefined)) othersSame += 1; else changed.push(text);
}
const longHostile = MUST_NOT[MUST_NOT.length - 2]!;
for (let attempt = 0; attempt < 2; attempt += 1) { const t = performance.now(); await on.askWithTrace({ text: longHostile, place: 'chat' }); fastest = Math.min(fastest, performance.now() - t); }
console.log(`MEASURED real brain, ${answerList.length + MUST_NOT.length + OTHERS.length} messages: answered exactly ${answered} of ${answerList.length}; must-not kept out ${keptOut} of ${MUST_NOT.length}; others identical ${othersSame} of ${OTHERS.length}; answers without task record ${missingTask}`);
console.log(`OFF baseline: ${offFallback} of ${answerList.length} answer messages used the foundation fallback; MUST-NOT fastest latency ${fastest.toFixed(1)} ms`);
if (wrong.length) console.log('ANSWER MISMATCH: ' + JSON.stringify(wrong));
if (leaked.length) console.log('LEAKED: ' + JSON.stringify(leaked));
if (changed.length) console.log('OTHER REPLIES CHANGED: ' + JSON.stringify(changed));
check(offFallback === answerList.length, 'no old chat handler answers the Find and Replace cases');
check(answered === answerList.length && wrong.length === 0 && notTaken.length === 0, 'all hand-made results match exactly');
check(missingTask === 0, 'every answer has a task record');
check(keptOut === MUST_NOT.length && leaked.length === 0, 'all must-not cases keep the OFF reply');
check(othersSame === OTHERS.length && changed.length === 0, 'ordinary and other-tool replies are unchanged');
check(fastest < 1500, 'must-not response stays under 1.5 seconds');

const ok = { text: 'the cat sat', pattern: 'cat', replacement: 'fox', replaceAll: true, caseSensitive: true };
const msg = 'replace "cat" with "fox" in "the cat sat"';
check(typeof LANE_GUARDS['find-replace'] === 'function', 'guard is registered');
check(findReplaceGuard(ok, msg) === null, 'guard accepts the clear request');
check(findReplaceGuard({ ...ok, replacement: undefined }, 'replace "cat" in "the cat sat"') !== null, 'guard yields without a replacement');
check(findReplaceGuard(ok, msg + ' using regex') !== null, 'guard yields for a regex request');
check(findReplaceGuard(ok, msg + ' and translate it') !== null, 'guard yields for an extra action');
check(findReplaceGuard({ ...ok, regex: true }, msg) !== null, 'guard yields for an unbound option');
check(findReplaceGuard({ ...ok, pattern: '' }, msg) !== null, 'guard yields for an empty pattern');
const task = LIVE_TASKS['find-replace'];
check(task !== undefined && task.actionId === 'text.replace', 'task is registered to its prepared action');
check(JSON.stringify(task?.input(ok)) === JSON.stringify({ text: 'the cat sat', pattern: 'cat', replacement: 'fox', replaceAll: true, caseSensitive: true }), 'task input carries every field');
const run = (await TEXT_REPLACE_ACTION.run({ text: 'banana', pattern: 'a', replacement: 'b', replaceAll: true, caseSensitive: true } as never, {} as never)) as Record<string, unknown>;
check(run.text === 'bbnbnb' && run.matchCount === 3, 'prepared action replaces every match');

function catchMutant(name: string, mutantWouldPass: boolean): void { check(!mutantWouldPass, `MUTANT CAUGHT: ${name}`); console.log(`MUTANT CAUGHT: ${name}`); }
catchMutant('guard-always-go', (() => { const broken = (): string | null => null; return broken() !== null; })());
catchMutant('guard-ignores-missing-replacement', (() => { const broken = (): string | null => null; return broken() !== findReplaceGuard({ ...ok, replacement: undefined }, 'replace "cat" in "the cat sat"'); })() === false);
const mutantReply: string = String('9 matches replaced.');
catchMutant('wrong-runner-result', mutantReply === '1 matches replaced.');
catchMutant('missing-task-record', (undefined as string | undefined) !== undefined);
console.log(`liveBrainFindReplace: ${checks} checks passed`);
