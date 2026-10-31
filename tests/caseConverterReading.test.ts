/** LIVE8-2: the REAL brain (real rules, real dictionary) with the Case Converter switch on for this test only. MEASURED lists, no targets: which requests reach the runner and which must not. After LIVE8-3 (task record) the reached note changes on purpose. */
import { createHash } from 'node:crypto'; import { readFile } from 'node:fs/promises'; import { join } from 'node:path';
import { createAxonBrain } from '../src/brain/index';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const brain = createAxonBrain({ lane: true, slot: createDictionarySlot(async () => dictionary), switches: { 'text-counter': 'runner', 'case-converter': 'runner' } });
const REACHED = 'no task could be recorded for case-converter';
const why = async (text: string): Promise<string> => { const r = await brain.askWithTrace({ text, place: 'chat' }); const note = (r.trace as { entries: { stage: string; note?: string }[] }).entries.find((e) => e.stage === 'execution')?.note ?? ''; return /yielded: (.*)$/.exec(note)?.[1] ?? 'ANSWERED ' + r.reply.source; };
const MUST_REACH = ['convert "hello world" to uppercase', 'make "Hello World" lowercase', 'change "hello world" to title case', 'convert "hello world" to camelCase', 'convert "hello big world" to snake_case', 'change "hello big world" to PascalCase', 'make "hello world" sentence case', 'convert "hello world" to constant case', 'convert "hello world" to upper case', 'make "HELLO" lower case', 'turn "my var name" into camel case', 'turn "my var name" into snake case', 'please convert "hello" to uppercase', 'can you make "hello world" uppercase', 'turn "hello world" into upper', 'make "ab" UPPER', 'convert "x y" to Snake_Case', 'convert "hello" to uppercase please'];
const MUST_NOT_REACH = ['hello', 'what can you do', 'translate "hello" to french', 'what is uppercase', 'convert "hello" to', 'do not convert "abc" to uppercase', 'convert "a b" to uppercase and count its words', 'convert 5 miles to km', 'count words in "a b c"'];
for (const text of MUST_REACH) check((await why(text)) === REACHED, 'reaches the runner: ' + text);
for (const text of MUST_NOT_REACH) check((await why(text)) !== REACHED, 'does not reach the runner: ' + text);
// KNOWN NOT YET READ (LIVE8-2b, reading work, causes NOT measured): the lane yields to the old handler, which says it has no way; nothing wrong is ever answered
const KNOWN_MISSES = ['uppercase "abc def"', 'lowercase "ABC DEF"', 'turn "hello there" into kebab-case', 'convert "x y" to KEBAB-CASE', 'change "hello world" to Title'];
for (const text of KNOWN_MISSES) check((await why(text)) !== REACHED, 'known miss still yields (no wrong answer): ' + text);
console.log('caseConverterReading: ' + n + ' checks passed');
