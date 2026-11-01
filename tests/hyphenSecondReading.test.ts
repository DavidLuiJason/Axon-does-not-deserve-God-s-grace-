
/** LIVE8-2b part 1c: a hyphenated word the dictionary does not know keeps its known parts as a SECOND reading ("kebab-case" = kebab + case). Pure part, real dictionary part, real brain part (shipped switches). */
import { createHash } from 'node:crypto'; import { readFile } from 'node:fs/promises'; import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary'; import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages'; import { buildResolveInputs } from '../src/brain/mind/resolve/clauseInputs';
import { createAxonBrain } from '../src/brain/index'; import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import type { MindContext } from '../src/brain/mind';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
// pure part
const base = { words: [{ norm: 'convert', start: 0, end: 7 }, { norm: 'kebab-case', start: 8, end: 18 }], pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: 2 }, details: [] } }], clauses: [{ act: 'command', polarity: 'positive' as const }], segments: [], values: [] };
const verb = { lemma: 'convert', partsOfSpeech: ['verb'], start: 0, end: 7 };
const objects = (token: Record<string, unknown>) => buildResolveInputs({ ...base, tokens: [verb, token] } as never)[0]!.input.objects;
const parts = [{ lemma: 'kebab', partsOfSpeech: ['noun'] }, { lemma: 'case', partsOfSpeech: ['noun', 'verb'] }];
check(objects({ lemma: 'kebab-case', start: 8, end: 18, hyphenParts: parts }).join() === 'kebab:n,case:n', 'each part adds its concept (noun parts only)');
check(objects({ lemma: 'kebab-case', start: 8, end: 18 }).length === 0, 'no field: unchanged');
check(objects({ lemma: 'kebab-case', start: 8, end: 18, hyphenParts: 'kebab' }).length === 0, 'hostile field never throws');
check(objects({ lemma: 'kebab-case', start: 8, end: 18, hyphenParts: [null, { lemma: 5 }, { lemma: '', partsOfSpeech: ['noun'] }, { lemma: 'Case', partsOfSpeech: ['noun', 'noun'] }] }).join() === 'case:n', 'bad entries ignored, duplicates and capitals folded');
// real dictionary part
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join('./public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const stages = createStages({ run: async () => ({ content: 'x', source: 't' }) } as never, () => 0, () => 't', slot);
async function tokens(text: string) { let c: MindContext = { utterance: { id: 't', text, place: 'chat', at: 0 }, entries: [] }; for (const s of stages) { if (s.id === 'execution') break; c = await s.run(c); } return c.analysis?.tokens ?? []; }
const kebab = (await tokens('convert "x y" to kebab-case')).find((t) => t.surface === 'kebab-case');
check(kebab?.knowledge === 'unknown' && kebab.lemma === 'kebab-case', 'the token itself stays unknown, lemma unchanged');
check(kebab?.hyphenParts?.map((p) => p.lemma).join() === 'kebab,case', 'real dictionary: the parts are kebab and case');
for (const text of ['what is a well-known fact', 'please check-in my flight', 'my x-ray is ready', 'twenty-one plus five', 'turn the pop-up into a list', 'a state-of-the-art tool', 'convert 10-20 to something', 'a-b and c-d']) {
  for (const t of await tokens(text)) { if (t.hyphenParts) check(t.knowledge === 'unknown' && t.hyphenParts.every((p) => p.lemma.length >= 2), 'only an unknown token carries parts: ' + t.surface); if (t.knowledge === 'known') check(t.hyphenParts === undefined, 'a known word never gets parts: ' + t.surface); }
}
check((await tokens('a-b and c-d')).every((t) => t.hyphenParts === undefined), 'parts shorter than two characters are skipped');
// guard
const guard = LANE_GUARDS['case-converter']!;
check(guard({ text: 'x y' }, 'convert "x y" to kebab-case') === null, 'straight quotes pass'); check(guard({ text: 'x y' }, 'convert \u201Cx y\u201D to kebab-case') === null, 'curly quotes pass');
check(guard({ text: 'png' }, 'convert the kebab-case image to png') !== null, 'unquoted text yields'); check(guard({ text: 'me' }, 'explain kebab-case to me') !== null, 'a leftover word yields');
check(guard({ text: 'hello' }, 'say hello then convert "hello world"') !== null, 'text only inside a longer quote yields'); check(guard({ text: '' }, 'anything') === null, 'empty text is left to the runner');
// real brain, shipped switches
const brain = createAxonBrain({ lane: true, slot });
const norm = (c: string): string => c.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
const TAIL = '\n\nRan as task task-N: COMPLETED in N ms, from your exact input.';
const ANSWERS: ReadonlyArray<readonly [string, string]> = [['convert "x y" to kebab-case', 'x-y'], ['turn "hello there" into kebab-case', 'hello-there'], ['convert "x y" to KEBAB-CASE', 'x-y'], ['change "hello world" to kebab-case', 'hello-world'], ['please convert "a b c" to kebab-case', 'a-b-c'], ['make "my var name" kebab-case', 'my-var-name']];
for (const [text, want] of ANSWERS) { const r = await brain.ask({ text, place: 'chat' }); check(r.source === 'runner:case-converter' && norm(r.content) === want + TAIL && r.taskId !== undefined, 'answers: ' + text); }
const MUST_NOT = ['convert the kebab-case image to png', 'explain kebab-case to me', 'what is kebab-case', 'define kebab-case', 'is kebab-case a style', 'convert kebab-case to snake_case', 'convert hello-world to uppercase', 'convert this-text to uppercase', 'change my on-screen text to upper', 'convert the snake-case file to pdf', 'turn the pop-up into a list', 'please check-in my flight', 'twenty-one plus five', 'convert 10-20 to something', 'convert "x y" to snake-case', 'convert "x y" to camel-case', 'change "hello" to title-case'];
for (const text of MUST_NOT) { const r = await brain.ask({ text, place: 'chat' }); check(r.source !== 'runner:case-converter', 'the case lane does not answer: ' + text); }
console.log('hyphenSecondReading: ' + n + ' checks passed');
