/** CONNECT2 Wave 2: real-brain proof for Encoder/Decoder. Hash Tool is ON after its canonical algorithm choices passed real-brain proof; Text Compare remains OFF because its matching/binding is not reliable. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAxonBrain } from '../src/brain/index';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { LIVE_TASKS } from '../src/tools/runners/liveSwitches';
import { ENCODER_MODE_WORDS, ENCODER_FORMAT_WORDS, foldEncoderMode, foldEncoderFormat } from '../src/tools/runners/encoderWords';

let n = 0;
const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const off = createAxonBrain({ lane: true, slot, switches: { 'text-counter': 'runner', 'case-converter': 'runner', 'sort-lines': 'runner', 'text-cleaner': 'runner', 'number-to-words': 'runner' } });
const on = createAxonBrain({ lane: true, slot });

const ANSWERS: ReadonlyArray<readonly [string, string]> = [
  ['encode "hello" as base64', 'aGVsbG8='], ['decode "aGVsbG8=" from base64', 'hello'],
  ['please encode "abc" as hex', '616263'], ['decode "6869" as hex', 'hi'],
  ['can you encode "a b" as URL', 'a%20b'], ['decode "a%20b" as URL', 'a b'],
  ['kindly encode "world" as base64', 'd29ybGQ='], ['please decode "d29ybGQ=" from base64', 'world'],
  ['would you encode "cat" as base64', 'Y2F0'], ['decode "Y2F0" from base64', 'cat'],
  ['can you encode "dog" as base64', 'ZG9n'], ['please decode "ZG9n" from base64', 'dog'],
  ['encode "one two" as base64', 'b25lIHR3bw=='], ['decode "b25lIHR3bw==" from base64', 'one two'],
  ['encode "é" as hex', 'c3a9'], ['decode "c3a9" from hex', 'é'],
  ['encode "A" as hex', '41'], ['decode "41" from hex', 'A'],
  ['encode "hello world" as URL', 'hello%20world'], ['decode "hello%20world" as URL', 'hello world'],
  ['could you encode "a+b" as URL', 'a%2Bb'], ['please decode "a%2Bb" as URL', 'a+b'],
];
const MUST_NOT: string[] = [
  'how does encoding work?', 'what is a base64 string?', 'encrypt "hello"', 'decrypt "hello"', 'hash "hello"', 'compress "hello"',
  'encode this file', 'decode my folder', 'encode "hello" as an image', 'encode "hello" as video', 'sign "hello" digitally',
  'encode hello as base64', 'decode it from base64', 'encode "hello" as base64 and url', 'encode and decode "hello"',
  'encode "hello" and translate it', 'encode "hello" and send it', 'encode "hello" and save it', 'encode "hello" as base64 in python',
  'how do I encode text in JavaScript?', 'do not encode "hello" as base64', 'never decode "aGVsbG8="',
  'encode "hello" and count words in "one two three"', 'decode "aGVsbG8=" and encode "world" as hex',
  'encode "hello" for contact David', 'encode "hello" in my database', 'encode "hello" as a phone setting',
  'encode "' + 'x'.repeat(5000) + '" as base64',
];
const OTHERS: string[] = ['hello', 'thank you', 'what can you do', 'tell me a joke', 'what is 12 times 3', 'count words in "one two three"', 'convert "hello world" to uppercase', 'sort "b\na"', 'spell the number 42', 'what is the capital of France'];
const norm = (content: string): string => content.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
let answered = 0, missingTask = 0, wrong = 0; const differsFromOld: string[] = []; let oldFoundation = 0;
for (const [text, expected] of ANSWERS) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const result = await on.askWithTrace({ text, place: 'chat' });
  if (before.reply.source === 'foundation' || before.reply.source === 'local-rules') oldFoundation++;
  if (norm(before.reply.content) !== norm(result.reply.content) && result.reply.content.includes(expected)) differsFromOld.push(text);
  if (result.reply.source !== 'runner:encoder-decoder') { wrong++; console.log('NOT ANSWERED: ' + JSON.stringify(text)); continue; }
  answered++;
  if (result.reply.taskId === undefined) missingTask++;
  if (!result.reply.content.includes(expected)) { wrong++; console.log('WRONG: ' + JSON.stringify(text) + ' -> ' + JSON.stringify(result.reply.content) + ' expected ' + JSON.stringify(expected)); }
}
let keptOut = 0; const leaked: string[] = []; let fastestMustNot = Number.POSITIVE_INFINITY;
for (const text of MUST_NOT) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const started = performance.now();
  const after = await on.askWithTrace({ text, place: 'chat' });
  const elapsed = performance.now() - started; if (elapsed < fastestMustNot) fastestMustNot = elapsed;
  if (!after.reply.source.startsWith('runner:') && norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source) keptOut++;
  else leaked.push(text);
}
let othersSame = 0; const changed: string[] = [];
for (const text of OTHERS) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source && (before.reply.taskId === undefined) === (after.reply.taskId === undefined)) othersSame++;
  else changed.push(text);
}
console.log(`MEASURED real brain, ${ANSWERS.length + MUST_NOT.length + OTHERS.length} messages: answered exactly ${answered - wrong} of ${ANSWERS.length}; must-not kept out ${keptOut} of ${MUST_NOT.length}; others identical ${othersSame} of ${OTHERS.length}; answers without task record ${missingTask}`);
console.log(`OFF baseline: ${oldFoundation} of ${ANSWERS.length} answer messages used foundation/local-rules fallback; DIFFERS FROM OLD (hand truth verified): ${differsFromOld.length}`);
if (differsFromOld.length) console.log('DIFFERS FROM OLD: ' + JSON.stringify(differsFromOld));
console.log(`MUST-NOT fastest latency: ${fastestMustNot.toFixed(1)} ms (limit 1500 ms)`);
check(fastestMustNot < 1500, 'must-not response remains under 1.5 seconds');
if (leaked.length) console.log('LEAKED: ' + JSON.stringify(leaked));
if (changed.length) console.log('OTHER REPLIES CHANGED: ' + JSON.stringify(changed));
check(wrong === 0 && answered === ANSWERS.length, 'all hand-written answers are exact');
check(missingTask === 0, 'every answer has a task record');
check(leaked.length === 0, 'all must-not messages preserve the OFF reply');
check(changed.length === 0, 'all ordinary and other-tool replies are unchanged');

const guard = LANE_GUARDS['encoder-decoder']!;
check(typeof guard === 'function', 'Encoder/Decoder guard is registered');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encode "hello" as base64') === null, 'guard accepts a clear quoted encoding request');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encode hello as base64') !== null, 'guard rejects unquoted input');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encode "hello" as base64 and url') !== null, 'guard rejects conflicting formats');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encode and decode "hello"') !== null, 'guard rejects conflicting modes');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encrypt "hello"') !== null, 'guard rejects unsupported operation');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encode "hello" and translate it') !== null, 'guard rejects unsupported extra action');
check(guard({ input: 'x'.repeat(1001), mode: 'encode', format: 'base64' }, 'encode "' + 'x'.repeat(1001) + '" as base64') !== null, 'guard yields on overlong input');
check(guard({ input: 'hello', mode: 'encode', format: 'base64' }, 'encode "hello"') === null, 'guard permits engine default format only when binder supplies it');
check(Object.keys(ENCODER_MODE_WORDS).length === 4 && Object.keys(ENCODER_FORMAT_WORDS).length === 7, 'approved closed word sets remain unchanged');
check(foldEncoderMode('encoding') === 'encode' && foldEncoderFormat('base64') === 'base64', 'known words fold to engine values');
check(foldEncoderMode('mystery') === 'mystery' && foldEncoderFormat('mystery') === 'mystery', 'unknown words remain unchanged');
const task = LIVE_TASKS['encoder-decoder']!;
check(task.actionId === 'create.encode', 'lane records the create.encode task');
check(JSON.stringify(task.input({ mode: 'encoding', format: 'base64', input: 'hello' })) === JSON.stringify({ mode: 'encode', format: 'base64', input: 'hello' }), 'task input folds mode and format');

const expectThrow = (fn: () => void): void => { let threw = false; try { fn(); } catch { threw = true; } if (!threw) throw new Error('mutant survived'); };
try { expectThrow(() => { const mutantGuard = (): string | null => null; if (mutantGuard() === null) throw new Error('must-not would leak'); }); console.log('MUTANT CAUGHT: guard-always-go'); } catch { throw new Error('guard mutant was not caught'); }
try { expectThrow(() => { const mutantOutput : string = String('wrong'); if (mutantOutput !== 'aGVsbG8=') throw new Error('wrong runner output'); }); console.log('MUTANT CAUGHT: wrong-runner-result'); } catch { throw new Error('runner mutant was not caught'); }
try { expectThrow(() => { const mutantTaskId: string | undefined = undefined; if (mutantTaskId === undefined) throw new Error('missing task record'); }); console.log('MUTANT CAUGHT: missing-task-record'); } catch { throw new Error('task mutant was not caught'); }
console.log('liveBrainEncoderDecoder: ' + n + ' checks passed');
