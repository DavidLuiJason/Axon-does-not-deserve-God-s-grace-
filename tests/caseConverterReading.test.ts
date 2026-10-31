/** LIVE8-2 and LIVE8-3: the REAL brain (real rules, real dictionary) with the SHIPPED switches. MEASURED lists, no targets: which requests the lane answers with the right words, which it must not touch. */
import { createHash } from 'node:crypto'; import { readFile } from 'node:fs/promises'; import { join } from 'node:path';
import { createAxonBrain } from '../src/brain/index';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const brain = createAxonBrain({ lane: true, slot });
const off = createAxonBrain({ lane: false, slot });
const norm = (c: string): string => c.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
const TAIL = '\n\nRan as task task-N: COMPLETED in N ms, from your exact input.';
// hand-written known answers: [request, the converted text]
const ANSWERS: ReadonlyArray<readonly [string, string]> = [
  ['convert "hello world" to uppercase', 'HELLO WORLD'], ['make "Hello World" lowercase', 'hello world'], ['change "hello world" to title case', 'Hello World'],
  ['convert "hello world" to camelCase', 'helloWorld'], ['convert "hello big world" to snake_case', 'hello_big_world'], ['change "hello big world" to PascalCase', 'HelloBigWorld'],
  ['make "hello world" sentence case', 'Hello world'], ['convert "hello world" to constant case', 'HELLO_WORLD'], ['convert "hello world" to upper case', 'HELLO WORLD'],
  ['make "HELLO" lower case', 'hello'], ['turn "my var name" into camel case', 'myVarName'], ['turn "my var name" into snake case', 'my_var_name'],
  ['please convert "hello" to uppercase', 'HELLO'], ['can you make "hello world" uppercase', 'HELLO WORLD'], ['turn "hello world" into upper', 'HELLO WORLD'],
  ['make "ab" UPPER', 'AB'], ['convert "x y" to Snake_Case', 'x_y'], ['convert "hello" to uppercase please', 'HELLO'],
];
for (const [text, want] of ANSWERS) {
  const r = await brain.ask({ text, place: 'chat' });
  check(r.source === 'runner:case-converter' && norm(r.content) === want + TAIL && r.taskId !== undefined, 'lane answers with the right words and a task record: ' + text);
}
const MUST_NOT_ANSWER = ['hello', 'what can you do', 'translate "hello" to french', 'what is uppercase', 'convert "hello" to', 'do not convert "abc" to uppercase', 'convert "a b" to uppercase and count its words', 'convert 5 miles to km', 'count words in "a b c"'];
for (const text of MUST_NOT_ANSWER) { const r = await brain.ask({ text, place: 'chat' }); check(r.source !== 'runner:case-converter', 'the case lane does not answer: ' + text); }
// everything the case lane does NOT answer is word for word what the brain said before LIVE8-3
for (const text of [...MUST_NOT_ANSWER, 'tell me a joke', 'what is 12 times 3', 'thank you', 'how many words are in "a b"']) {
  const a = await off.ask({ text, place: 'chat' }); const b = await brain.ask({ text, place: 'chat' });
  if (b.source !== 'runner:case-converter' && b.source !== 'runner:text-counter') check(norm(a.content) === norm(b.content) && a.source === b.source, 'unchanged reply: ' + text);
}
// KNOWN NOT YET READ (LIVE8-2b, causes NOT measured): the lane yields to the old handler, which says it has no way; nothing wrong is ever answered
const KNOWN_MISSES = ['uppercase "abc def"', 'lowercase "ABC DEF"', 'turn "hello there" into kebab-case', 'convert "x y" to KEBAB-CASE', 'change "hello world" to Title'];
for (const text of KNOWN_MISSES) { const r = await brain.ask({ text, place: 'chat' }); check(r.source !== 'runner:case-converter', 'known miss still yields (no wrong answer): ' + text); }
console.log('caseConverterReading: ' + n + ' checks passed');
