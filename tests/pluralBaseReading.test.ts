/** RESOLVE-TC part 2: a plural that is itself a headword ("words") keeps its noun base ("word") as a second reading. Pure part + real dictionary part. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import { buildResolveInputs } from '../src/brain/mind/resolve/clauseInputs';
import type { MindContext } from '../src/brain/mind';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const base = {
  words: [{ norm: 'count', start: 0, end: 5 }, { norm: 'words', start: 6, end: 11 }],
  pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: 2 }, details: [] } }],
  clauses: [{ act: 'command', polarity: 'positive' as const }], segments: [], values: [],
};
const verbToken = { lemma: 'count', partsOfSpeech: ['verb'], start: 0, end: 5 };
const objects = (token: Record<string, unknown>) => buildResolveInputs({ ...base, tokens: [verbToken, token] } as never)[0]!.input.objects;

// pure part
assert(objects({ lemma: 'words', partsOfSpeech: ['noun', 'verb'], alternativeNounLemmas: ['word'], start: 6, end: 11 }).join() === 'words:n,word:n', 'both readings, own first');
assert(objects({ lemma: 'words', partsOfSpeech: ['noun', 'verb'], start: 6, end: 11 }).join() === 'words:n', 'no field: unchanged');
assert(objects({ lemma: 'words', partsOfSpeech: ['verb'], alternativeNounLemmas: ['word'], start: 6, end: 11 }).length === 0, 'token without a noun reading gets no noun base');
assert(objects({ lemma: 'words', partsOfSpeech: ['noun'], alternativeNounLemmas: ['word', 'WORD', ''], start: 6, end: 11 }).join() === 'words:n,word:n', 'duplicates and empty ignored');
assert(objects({ lemma: 'words', partsOfSpeech: ['noun'], alternativeNounLemmas: 'word', start: 6, end: 11 }).join() === 'words:n', 'hostile field never throws');

// real dictionary part
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const executor = { run: async () => ({ content: 'x', source: 'test' }) } as never;
const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
const stages = createStages(executor, () => 0, () => 't', createDictionarySlot(async () => dictionary));
async function tokens(text: string) {
  let context: MindContext = { utterance: { id: 't', text, place: 'chat', at: 0 }, entries: [] };
  for (const stage of stages) context = await stage.run(context);
  return context.analysis?.tokens ?? [];
}
const plural = (await tokens('count words in "a b"')).find((t) => t.surface.toLowerCase() === 'words');
assert(plural?.lemma === 'words' && plural.alternativeNounLemmas?.includes('word') === true, 'real dictionary: "words" keeps its noun base word');
const regular = (await tokens('count lines in "a"')).find((t) => t.surface.toLowerCase() === 'lines');
assert(regular?.lemma === 'line' && regular.alternativeNounLemmas === undefined, 'real dictionary: "lines" is lemmatised as before, no extra field');
console.log(`PLURAL BASE READING OK: ${checks} checks`);
