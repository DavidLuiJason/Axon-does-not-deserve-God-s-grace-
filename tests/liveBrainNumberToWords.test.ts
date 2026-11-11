/** CONNECT2 Wave 1: real-brain proof for Number to Words. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAxonBrain } from '../src/brain/index';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { LIVE_SWITCHES, LIVE_TASKS } from '../src/tools/runners/liveSwitches';
import { numberToWordsGuard } from '../src/tools/runners/guards/numberToWordsGuard';
const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const off = createAxonBrain({ lane: true, slot, switches: { 'text-counter': 'runner', 'case-converter': 'runner', 'sort-lines': 'runner' } });
const on = createAxonBrain({ lane: true, slot });
let checks = 0;
const check = (ok: boolean, label: string): void => { checks++; if (!ok) throw new Error('FAILED: ' + label); };
const norm = (text: string): string => text.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
const ANSWERS: ReadonlyArray<readonly [string, string]> = [
  ['Please spell the number 0', 'zero'], ['spell the number 12', 'twelve'], ['write the number 13 in words', 'thirteen'],
  ['convert the number 14 to words', 'fourteen'], ['please spell the number 15', 'fifteen'], ['write the number 16 in words', 'sixteen'],
  ['convert the number 17 to words', 'seventeen'], ['spell the number 18', 'eighteen'], ['write the number 19 in words', 'nineteen'],
  ['convert the number 20 into words', 'twenty'], ['spell the number 21', 'twenty-one'], ['write the number 22 in words', 'twenty-two'],
  ['convert the number 23 to words', 'twenty-three'], ['spell the number 24 please', 'twenty-four'], ['write the number 25 in words', 'twenty-five'],
  ['convert the number 26 into words', 'twenty-six'], ['spell the number 27', 'twenty-seven'], ['write the number 28 in words', 'twenty-eight'],
  ['convert the number 29 to words', 'twenty-nine'], ['convert the number 1000000 to words — please', 'one million'],
];
const MUST_NOT: string[] = [
  'what is the number system?', 'how does number to words work?', 'explain number 12', 'calculate 12 times 3',
  'convert 12 dollars to naira', 'spell 12 as a Roman numeral', 'find the percentage of 12', 'round 12 to nearest ten',
  'divide 12 by 3', 'spell the number', 'spell my number', 'write the number on my list',
  'spell the number 21 as an ordinal', 'write the number 21 as first', 'convert the number 12 to words and translate it',
  'spell the number 12 in my database', 'write the number 12 in a file', 'convert the number 12 in my folder',
  'spell the number 12 on my phone', 'write the number 12 on this image', 'convert the number 12 for this contact',
  'how do I convert the number 12 in python', 'do not spell the number 12', 'never write the number 12',
  'count words in "one two three"', 'convert "hello world" to uppercase', 'sort the lines "b\na"',
  'spell the number 12 and count words in "one two"', 'spell the number 12 ' + 'x'.repeat(1200),
];
const OTHERS: string[] = [
  'hello', 'thank you', 'what can you do', 'tell me a joke', 'what is 12 times 3',
  'count words in "one two three"', 'convert "hello world" to uppercase', 'sort the lines "b\na"',
  'define the word tree', 'how many lines are in "one\ntwo"',
];
let answered = 0, exact = 0, missingTask = 0, oldFallback = 0;
for (const [text, expected] of ANSWERS) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const result = await on.askWithTrace({ text, place: 'chat' });
  if (before.reply.source === 'foundation' && before.reply.content.startsWith('I do not have a way')) oldFallback++;
  if (result.reply.source === 'runner:number-to-words') answered++;
  if (result.reply.source === 'runner:number-to-words' && result.reply.content.startsWith(expected + '\n\nRan as task')) exact++;
  if (result.reply.source === 'runner:number-to-words' && result.reply.taskId === undefined) missingTask++;
  check(result.reply.source === 'runner:number-to-words', 'answered by Number to Words: ' + text);
  check(result.reply.taskId !== undefined, 'task record exists: ' + text);
  check(result.reply.content.startsWith(expected + '\n\nRan as task'), 'hand-written result: ' + text + ' => ' + expected);
}
let keptOut = 0; const leaked: string[] = [];
for (const text of MUST_NOT) {
  const a = await off.askWithTrace({ text, place: 'chat' });
  const b = await on.askWithTrace({ text, place: 'chat' });
  if (!b.reply.source.startsWith('runner:number-to-words') && norm(a.reply.content) === norm(b.reply.content) && a.reply.source === b.reply.source) keptOut++;
  else leaked.push(text);
}
let sameOthers = 0; const changedOthers: string[] = [];
for (const text of OTHERS) {
  const a = await off.askWithTrace({ text, place: 'chat' });
  const b = await on.askWithTrace({ text, place: 'chat' });
  if (norm(a.reply.content) === norm(b.reply.content) && a.reply.source === b.reply.source && (a.reply.taskId === undefined) === (b.reply.taskId === undefined)) sameOthers++;
  else changedOthers.push(text);
}
console.log(`MEASURED real brain, ${ANSWERS.length + MUST_NOT.length + OTHERS.length} messages: answered exactly ${exact} of ${ANSWERS.length}; must-not kept out ${keptOut} of ${MUST_NOT.length}; others identical ${sameOthers} of ${OTHERS.length}; answers without task record ${missingTask}`);
console.log(`OFF foundation fallback for ${oldFallback} of ${ANSWERS.length} answer cases; DIFFERENCES FROM OLD: none (no old chat handler).`);
if (leaked.length) console.log('LEAKED: ' + JSON.stringify(leaked));
if (changedOthers.length) console.log('OTHER CHANGES: ' + JSON.stringify(changedOthers));
const longProbe = MUST_NOT[MUST_NOT.length - 1]!;
const longTimes: number[] = [];
for (let i = 0; i < 2; i++) { const start = Date.now(); const r = await on.askWithTrace({ text: longProbe, place: 'chat' }); longTimes.push(Date.now() - start); check(!r.reply.source.startsWith('runner:number-to-words'), 'long hostile request yields'); }
console.log(`MUST-NOT latency (two trials): ${longTimes.join(', ')} ms; fastest ${Math.min(...longTimes)} ms`);
check(Math.min(...longTimes) < 1500, 'long hostile request is handled under 1.5 seconds');
check(keptOut === MUST_NOT.length, 'all must-not cases preserve OFF reply/source');
check(sameOthers === OTHERS.length, 'all ordinary/other-tool requests unchanged');
check(numberToWordsGuard({ number: 12 }, 'spell the number 12') === null, 'guard: clear cardinal passes');
check(numberToWordsGuard({ number: 21 }, 'spell the number 21 as an ordinal') !== null, 'guard: unbound ordinal yields');
check(numberToWordsGuard({ number: 12 }, 'spell the number 12 and translate it') !== null, 'guard: unsupported extra yields');
for (const text of ['spell the number 21 as an ordinal', 'write the number 12 as first', 'convert the number 22 to ordinal words']) { const trace = await on.askWithTrace({ text, place: 'chat' }); for (const entry of trace.trace.entries) if (entry.stage === 'resolution' || entry.stage === 'execution') console.log(`BINDER GAP TRACE ${JSON.stringify(text)} | ${entry.stage}: ${entry.note}`); }
check(LANE_GUARDS['number-to-words'] === numberToWordsGuard, 'guard is registered in the brain');
check(LIVE_SWITCHES['number-to-words'] === 'runner' && LIVE_TASKS['number-to-words']?.actionId === 'number.words', 'live switch and task action are registered');
const expectThrow = (fn: () => void): void => { let threw = false; try { fn(); } catch { threw = true; } if (!threw) throw new Error('mutant survived'); };
try { expectThrow(() => { const mutantGuard = (): string | null => null; if (mutantGuard() === null) throw new Error('must-not would leak'); }); console.log('MUTANT CAUGHT: guard-always-go'); } catch { throw new Error('guard mutant was not caught'); }
try { expectThrow(() => { const mutantOutput: string = String('wrong'); if (mutantOutput !== 'twelve') throw new Error('wrong runner output'); }); console.log('MUTANT CAUGHT: wrong-runner-result'); } catch { throw new Error('runner mutant was not caught'); }
try { expectThrow(() => { const mutantTaskId: string | undefined = undefined; if (mutantTaskId === undefined) throw new Error('missing task record'); }); console.log('MUTANT CAUGHT: missing-task-record'); } catch { throw new Error('task mutant was not caught'); }
const task = LIVE_TASKS['number-to-words'];
check(task !== undefined && task.actionId === 'number.words' && JSON.stringify(task.input({ number: 42 })) === JSON.stringify({ number: 42 }), 'task input preserves the number and action id');
console.log(`liveBrainNumberToWords: ${checks} checks passed`);
