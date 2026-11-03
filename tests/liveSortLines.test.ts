/** LIVE9-3: the REAL brain (real local rules, real dictionary, real catalog) with Sort Lines OFF against ON (the other two live tools ON in both). Sort Lines goes live; Sort Lines has no old chat handler, so the proof is known answers, a task record on every answer and "0 changes to any other reply". Expected sorted texts are hand-written. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildLaneConfig, createAxonBrain } from '../src/brain/index';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { SORT_OPTION_WORDS, sortWordsOf } from '../src/tools/runners/sortOptionWords';
import { LIVE_TASKS } from '../src/tools/runners/liveSwitches';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
// the baseline is the brain as merged before LIVE9-3: the two earlier live tools ON, Sort Lines OFF
const off = createAxonBrain({ lane: true, slot, switches: { 'text-counter': 'runner', 'case-converter': 'runner' } });
const on = createAxonBrain({ lane: true, slot });
check(buildLaneConfig().isOn('sort-lines') === true && buildLaneConfig().isOn('timer') === false && buildLaneConfig().isOn('calculator') === false, 'the shipped lane wiring has Sort Lines ON and the not-yet-live tools OFF');
// message, exact sorted text the reply must carry (hand-written)
const ANSWERS: ReadonlyArray<readonly [string, string, number]> = [
  ['sort the lines "pear\napple\nfig"', 'apple\nfig\npear', 3], ['sort "b\na\nc" descending', 'c\nb\na', 3], ['sort "ccc\na\nbb" by length', 'a\nbb\nccc', 3],
  ['please sort "b\na"', 'a\nb', 2], ['sort the lines "b\na"', 'a\nb', 2], ['sort "item10\nitem2\nitem1" natural', 'item1\nitem2\nitem10', 3],
  ['sort "b\na" ascending', 'a\nb', 2], ['sort "b\na" alphabetically', 'a\nb', 2], ['alphabetize "b\na"', 'a\nb', 2], ['reverse the lines "a\nb\nc"', 'c\nb\na', 3],
  ['can you sort "z\ny\nx"', 'x\ny\nz', 3], ['could you please sort the lines "q\np"', 'p\nq', 2], ['sort these lines: "b\na"', 'a\nb', 2],
  ['arrange "b\na\nc" in descending order', 'c\nb\na', 3], ['sort "3\n20\n100"', '100\n20\n3', 3], ['sort "apple\nBanana\ncherry"', 'Banana\napple\ncherry', 3],
  ['sort "é\na\nz"', 'a\nz\né', 3], ['sort the lines "only one"', 'only one', 1], ['sort "b\na" please', 'a\nb', 2], ['sort "dd\nc\nbbb" by length', 'c\ndd\nbbb', 3],
];
// MUST NOT be answered by the lane (each would have been a WRONG answer, measured): second order word, option the lane does not fill, order outside the mode words, text not in quotes
const MUST_NOT: string[] = [
  'sort "b\na" in reverse alphabetical order', 'sort "b\na" and remove duplicates', 'sort "b\na\nb" and remove duplicates', 'sort "B\na" ignoring case', 'sort "b\n\na" ignoring blank lines',
  'sort "b\na" descending alphabetically', 'sort "b\na" by length descending', 'sort "b\na" naturally', 'sort "b\na" z to a', 'sort "x\ny" backwards', 'sort "b\na" numerically',
  'sort the files in my folder', 'how do I sort a list in python', 'sort b a c', 'sort the lines b\na', 'sort my list', 'sort', 'sort lines', 'what is sorting', 'sort 5 miles', 'do not sort "b\na"', 'sort ""',
  'sort out my life', 'sort of', 'sort the array [3,1,2]', 'reverse the word "hello"',
];
const OTHERS: string[] = ['hello', 'thank you', 'what can you do', 'what is 12 times 3', 'tell me a joke', 'count words in "one two three"', 'convert "hello world" to uppercase', 'sort "a\nb" and count words in "x y"', 'what is the capital of France', 'how many lines in "x\ny"'];
const norm = (content: string): string => content.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
let answered = 0, recordMissing = 0, wrong = 0;
for (const [text, want, lines] of ANSWERS) {
  const r = await on.askWithTrace({ text, place: 'chat' });
  if (r.reply.source !== 'runner:sort-lines') { wrong++; console.log('NOT ANSWERED: ' + JSON.stringify(text)); continue; }
  answered++; if (r.reply.taskId === undefined) recordMissing++;
  if (!r.reply.content.includes(want + '\nLine count: ' + lines + '.')) { wrong++; console.log('WRONG: ' + JSON.stringify(text) + ' -> ' + JSON.stringify(r.reply.content)); }
}
let notAnsweredOk = 0; const leaked: string[] = [];
for (const text of MUST_NOT) { const a = await off.askWithTrace({ text, place: 'chat' }); const b = await on.askWithTrace({ text, place: 'chat' }); if (!b.reply.source.startsWith('runner:') && norm(a.reply.content) === norm(b.reply.content) && a.reply.source === b.reply.source) notAnsweredOk++; else leaked.push(text); }
let sameOthers = 0; const otherDiffs: string[] = [];
for (const text of OTHERS) { const a = await off.askWithTrace({ text, place: 'chat' }); const b = await on.askWithTrace({ text, place: 'chat' }); if (norm(a.reply.content) === norm(b.reply.content) && a.reply.source === b.reply.source && (a.reply.taskId === undefined) === (b.reply.taskId === undefined)) sameOthers++; else otherDiffs.push(text); }
console.log(`MEASURED real brain, ${ANSWERS.length + MUST_NOT.length + OTHERS.length} messages: answered with the exact sorted text ${answered - wrong} of ${ANSWERS.length}; must-not-answer kept out ${notAnsweredOk} of ${MUST_NOT.length}; other replies identical ${sameOthers} of ${OTHERS.length}; answers without a task record ${recordMissing}`);
if (leaked.length) console.log('LEAKED (answered when it must not): ' + JSON.stringify(leaked));
if (otherDiffs.length) console.log('OTHER REPLIES CHANGED: ' + JSON.stringify(otherDiffs));
check(wrong === 0 && answered === ANSWERS.length, 'every known request is answered with the exact hand-written sorted text and line count');
check(recordMissing === 0, 'every lane answer carries a task record');
check(leaked.length === 0, 'every must-not-answer message gets exactly the reply it got before (no wrong sort)');
check(otherDiffs.length === 0, '0 other replies changed');
// shuffle keeps the same lines (random order is not hand-written)
const sh = await on.askWithTrace({ text: 'shuffle the lines "a\nb\nc"', place: 'chat' });
check(sh.reply.source === 'runner:sort-lines' && sh.reply.taskId !== undefined && sh.reply.content.includes('Line count: 3.') && ['a', 'b', 'c'].every((l) => sh.reply.content.includes(l)), 'shuffle answers with the same three lines and a task record');
// a default is said aloud
const said = await on.askWithTrace({ text: 'sort the lines "b\na"', place: 'chat' });
check(said.reply.content.includes('ascending') && said.reply.content.includes('a to z'), 'a default order is said aloud');
// the guard itself, called directly (known answers)
const guard = LANE_GUARDS['sort-lines']!;
check(typeof guard === 'function', 'Sort Lines declares a lane guard');
check(guard({ text: 'b\na' }, 'sort "b\na" in reverse alphabetical order') !== null, 'guard: two different orders yield');
check(guard({ text: 'b\na' }, 'sort "b\na" and remove duplicates') !== null, 'guard: duplicates yield');
check(guard({ text: 'b\na' }, 'sort "b\na" ignoring case') !== null && guard({ text: 'b\na' }, 'sort "b\na" ignoring blank lines') !== null, 'guard: case and blank lines yield');
check(guard({ text: 'my folder' }, 'sort the files in my folder') !== null, 'guard: text not in quote marks yields');
check(guard({ text: 'b\na' }, 'sort "b\na" ascending') === null && guard({ text: 'b\na' }, 'sort "b\na" descending') === null, 'guard: one clear order passes');
check(guard({ text: 'reverse\nrandom\nduplicates' }, 'sort "reverse\nrandom\nduplicates"') === null, 'guard: words INSIDE the person\'s own text never count');
// the closed set and the task record
check(JSON.stringify(Object.keys(SORT_OPTION_WORDS).sort()) === JSON.stringify(['backward', 'backwards', 'blank', 'dedupe', 'duplicate', 'duplicates', 'empty', 'ignore', 'ignoring', 'insensitive', 'insensitively', 'naturally', 'numeric', 'numerical', 'numerically', 'repeated', 'reversed', 'unique', 'z']), 'the guard word set is exactly the pinned set (a new word must change this test on purpose)');
check(JSON.stringify(sortWordsOf('Sort "x" A-to-Z, now!')) === JSON.stringify(['sort', 'x', 'a-to-z', 'now']), 'sortWordsOf splits plain letter runs');
const task = LIVE_TASKS['sort-lines']!; check(task.actionId === 'text.sort', 'the lane records the run as the text.sort task');
check(JSON.stringify(task.input({ text: 'b\na', mode: 'Alphabetically' })) === JSON.stringify({ text: 'b\na', mode: 'ascending' }) && JSON.stringify(task.input({ text: 'b\na' })) === JSON.stringify({ text: 'b\na' }), 'the task input folds the mode word and adds no mode when none was given');
console.log('liveSortLines: ' + n + ' checks passed');
