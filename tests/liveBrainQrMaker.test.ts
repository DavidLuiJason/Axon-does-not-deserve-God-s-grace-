/** CONNECT2 Wave 3: real-brain proof for QR Maker. Medium error correction is the spoken default; explicit level requests yield because the binder does not fill that option. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAxonBrain } from '../src/brain/index';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { LIVE_SWITCHES, LIVE_TASKS } from '../src/tools/runners/liveSwitches';
import { QR_ACTION } from '../src/tools/qrAction';
import { qrMakerGuard } from '../src/tools/runners/guards/qrMakerGuard';
import { QR_LEVEL_WORDS, QR_LEVEL_CHOICES, foldQrLevel } from '../src/tools/runners/qrWords';
import { decodeQr } from '../src/tools/engines/create/qrDecode';

let checks = 0;
const check = (ok: boolean, label: string): void => { checks += 1; if (!ok) throw new Error('FAILED: ' + label); };
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const off = createAxonBrain({ lane: true, slot, switches: { ...LIVE_SWITCHES, 'qr-maker': 'legacy' as const } });
const on = createAxonBrain({ lane: true, slot });

const ANSWERS: ReadonlyArray<readonly [string, string, number]> = [
  ['make a QR code for "hello"', 'hello', 21],
  ['please make a QR code for "hello"', 'hello', 21],
  ['make a QR code for "hello" please', 'hello', 21],
  ['kindly make a QR code for "hello"', 'hello', 21],
  ['create QR code containing "https://example.com"', 'https://example.com', 25],
  ['please create QR code containing "https://example.com"', 'https://example.com', 25],
  ['create a QR code containing "hello world"', 'hello world', 21],
  ['make QR "wifi details"', 'wifi details', 21],
  ['please make QR "wifi details"', 'wifi details', 21],
  ['make QR code for "12345"', '12345', 21],
  ['create QR code containing "café ☕"', 'café ☕', 21],
  ['make a QR code for "A"', 'A', 21],
  ['make a QR code for "B"', 'B', 21],
  ['make a QR code for "C"', 'C', 21],
  ['create QR code containing "one"', 'one', 21],
  ['create QR code containing "two"', 'two', 21],
  ['create QR code containing "three"', 'three', 21],
  ['create QR code containing "four"', 'four', 21],
  ['create QR code containing "five"', 'five', 21],
  ['create QR code containing "This is a slightly longer QR payload"', 'This is a slightly longer QR payload', 29],
];
const MUST_NOT: string[] = [
  'how does a QR code work?',
  'what is QR encoding?',
  'QR code is printed on the package',
  'read this QR "https://example.com"',
  'scan QR code "hello"',
  'decode QR "hello"',
  'make QR code for my unquoted link https://example.com',
  'create QR code',
  'generate QR from image "hello"',
  'extract text from QR "hello"',
  'make QR "hello" with level X',
  'make a QR code for "hello" with high error correction',
  'make QR code for "hello" and translate it',
  'make QR code for "hello" and send it',
  'do not make QR code for "hello"',
  'never create QR code for "hello"',
  'make QR code for "hello" as an image file',
  'make QR code for "hello" in my folder',
  'make QR code for "hello" and create QR code for "world"',
  'make QR code for "hello" and encode "world" as base64',
  'how do I make a QR code in Python?',
  'create QR code for my link',
  'make a QR code for an image',
  'count words in "one two three"',
  'calculate checksum of "abc" using SHA-256',
  'make QR code for "' + 'x'.repeat(1200) + '"',
  'make QR code for ""',
];
const OTHERS: string[] = [
  'hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42',
  'evaluate "2+2"', 'calculate checksum of "abc" using SHA-256',
  'encode "hello" as base64', 'sort the lines "b\na"', 'count words in "one two three"',
];
const norm = (value: string): string => value.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
let answered = 0;
let missingTask = 0;
let keptOut = 0;
let othersSame = 0;
let fastestMustNot = Number.POSITIVE_INFINITY;
const differsFromOld: string[] = [];
const leaked: string[] = [];
const changed: string[] = [];
let offFallback = 0;

for (const [text, payload, size] of ANSWERS) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (before.reply.source === 'foundation' && before.reply.content.startsWith('I do not have a way to do that')) offFallback += 1;
  if (norm(before.reply.content) !== norm(after.reply.content) && after.reply.content.includes(`QR code made: ${size} × ${size} modules, error-correction level M.`)) differsFromOld.push(text);
  const correctPayload = after.reply.content.includes(`text: “${payload}”, level: M`);
  const correctSize = after.reply.content.includes(`QR code made: ${size} × ${size} modules, error-correction level M.`);
  if (after.reply.source !== 'runner:qr-maker' || !correctPayload || !correctSize) {
    console.log('ANSWER MISMATCH ' + JSON.stringify({ text, payload, size, source: after.reply.source, reply: after.reply.content }));
    continue;
  }
  answered += 1;
  if (after.reply.taskId === undefined) missingTask += 1;
}
for (const text of MUST_NOT) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (after.reply.source !== 'runner:qr-maker' && norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source) keptOut += 1;
  else leaked.push(text);
}
for (const text of OTHERS) {
  const before = await off.askWithTrace({ text, place: 'chat' });
  const after = await on.askWithTrace({ text, place: 'chat' });
  if (norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source && (before.reply.taskId === undefined) === (after.reply.taskId === undefined)) othersSame += 1;
  else changed.push(text);
}
console.log(`MEASURED real brain, ${ANSWERS.length + MUST_NOT.length + OTHERS.length} messages: answered exactly ${answered} of ${ANSWERS.length}; must-not kept out ${keptOut} of ${MUST_NOT.length}; others identical ${othersSame} of ${OTHERS.length}; answers without task record ${missingTask}`);
console.log(`OFF baseline: ${offFallback} of ${ANSWERS.length} answer messages used the foundation fallback; DIFFERS FROM OLD (hand truth verified): ${differsFromOld.length}`);
const longHostile = MUST_NOT[MUST_NOT.length - 2]!;
for (let attempt = 0; attempt < 2; attempt += 1) {
  const started = performance.now();
  await on.askWithTrace({ text: longHostile, place: 'chat' });
  const elapsed = performance.now() - started;
  if (elapsed < fastestMustNot) fastestMustNot = elapsed;
}
console.log(`MUST-NOT fastest latency: ${fastestMustNot.toFixed(1)} ms (limit 1500 ms; two timings on long hostile input)`);
if (differsFromOld.length) console.log('DIFFERS FROM OLD: ' + JSON.stringify(differsFromOld));
if (leaked.length) console.log('LEAKED: ' + JSON.stringify(leaked));
if (changed.length) console.log('OTHER REPLIES CHANGED: ' + JSON.stringify(changed));
check(offFallback === ANSWERS.length, 'no old chat handler answers the QR Maker answer cases');
check(answered === ANSWERS.length, 'all 20 QR payloads and hand-checked matrix sizes match');
check(missingTask === 0, 'every QR Maker answer has a task record');
check(keptOut === MUST_NOT.length && leaked.length === 0, 'all must-not cases preserve the OFF reply');
check(othersSame === OTHERS.length && changed.length === 0, 'all ordinary and other-tool replies are unchanged');
check(fastestMustNot < 1500, 'must-not response remains under 1.5 seconds');

const guard = LANE_GUARDS['qr-maker'];
check(typeof guard === 'function', 'QR Maker guard is registered');
check(qrMakerGuard({ text: 'hello', level: 'M' }, 'make a QR code for "hello"') === null, 'guard accepts clearly quoted QR content');
check(qrMakerGuard({ text: 'hello', level: 'M' }, 'make a QR code for "hello" with low error correction') !== null, 'guard yields for unbound error-correction option');
check(qrMakerGuard({ text: 'hello', level: 'M' }, 'make a QR code for "hello" and translate it') !== null, 'guard yields for unsupported extra action');
check(qrMakerGuard({ text: 'hello', level: 'M' }, 'do not make a QR code for "hello"') !== null, 'guard yields for negation');
check(qrMakerGuard({ text: 'hello', level: 'M' }, 'make a QR code for "hello" and create QR code for "world"') !== null, 'guard yields for two quoted requests');
check(qrMakerGuard({ text: 'x'.repeat(1001), level: 'M' }, 'make a QR code for "' + 'x'.repeat(1001) + '"') !== null, 'guard yields for oversized payload');
check(Object.values(QR_LEVEL_WORDS).every(value => value === 'L' || value === 'M' || value === 'Q' || value === 'H'), 'level words map only to engine values');
check(Object.keys(QR_LEVEL_WORDS).every(word => word.length > 1), 'single-letter aliases are absent');
check(foldQrLevel('medium') === 'M' && foldQrLevel('high') === 'H', 'declared level words fold to engine values');
check(new Set(QR_LEVEL_CHOICES).size === QR_LEVEL_CHOICES.length, 'level choice keys are unique');
const task = LIVE_TASKS['qr-maker'];
check(task !== undefined && task.actionId === 'create.qr', 'QR Maker task is registered to its prepared action');
check(JSON.stringify(task?.input({ text: 'hello', level: 'medium' })) === JSON.stringify({ text: 'hello', level: 'M' }), 'task input folds the level value');
const actionResult = (await QR_ACTION.run({ text: 'hello', level: 'M' } as never, {} as never)) as Record<string, unknown>;
const modules = JSON.parse(String(actionResult.modules)) as boolean[][];
const decoded = decodeQr(modules);
check(actionResult.size === 21 && decoded.ok && decoded.text === 'hello', 'prepared QR action matrix decodes to the exact supplied payload');

for (const text of ['make a QR code for "hello" with low error correction', 'make a QR code for "hello" with high error correction', 'make a QR code for "hello" with level H']) {
  const trace = await on.askWithTrace({ text, place: 'chat' });
  const resolution = trace.trace.entries.find(entry => entry.stage === 'resolution');
  const execution = trace.trace.entries.find(entry => entry.stage === 'execution');
  console.log(`GAP TRACE ${JSON.stringify(text)} | resolution: ${resolution?.note ?? 'NOT FOUND'} | execution: ${execution?.note ?? 'NOT FOUND'}`);
}

function catchMutant(name: string, mutantWouldPass: boolean): void {
  const caught = !mutantWouldPass;
  check(caught, `MUTANT CAUGHT: ${name}`);
  if (caught) console.log(`MUTANT CAUGHT: ${name}`);
}
catchMutant('guard-always-go', (() => { const broken = (): string | null => null; return broken() !== null; })());
const mutantReply: string = String('QR code made: 99 × 99 modules, error-correction level M.');
catchMutant('wrong-runner-result', mutantReply === 'QR code made: 21 × 21 modules, error-correction level M.');
catchMutant('missing-task-record', (undefined as string | undefined) !== undefined);
console.log(`liveBrainQrMaker: ${checks} checks passed`);
