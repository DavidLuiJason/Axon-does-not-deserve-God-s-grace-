/** B03P: synset ids pass through the knowledge slot without additional lookups. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import type { KnowledgeLookupResult, KnowledgeSlot } from '../src/brain/knowledge/slot';
import { createAnalyzer } from '../src/brain/mind/analysis/analyze';
import type { Segment } from '../src/brain/mind/types';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}
const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const segment = (text: string): Segment[] => [{ kind: 'language', text, start: 0, end: text.length }];
const uniqueIds = (result: Awaited<ReturnType<Dictionary['lookup']>>): string[] => [...new Set(result.matches.flatMap((match) => match.entries.flatMap((entry) => entry.senses.map((sense) => sense.synset))))];

async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (path) => readFile(join(DIR, path), 'utf8'), hash: sha });
  const slot = createDictionarySlot(async () => dictionary);

  // Derive the expected identifiers from the dictionary's own data, not remembered values.
  let manySenseWord: string | undefined;
  let manySenseIds: string[] = [];
  for (const candidate of ['bank', 'run', 'set', 'make', 'get', 'take', 'go', 'play', 'break', 'light', 'point']) {
    const raw = await dictionary.lookup(candidate);
    const ids = uniqueIds(raw);
    if (raw.found && ids.length > 5) { manySenseWord = candidate; manySenseIds = ids; break; }
  }
  assert(Boolean(manySenseWord), 'real dictionary contains a word with more than five unique synsets');
  if (manySenseWord) {
    const raw = await dictionary.lookup(manySenseWord);
    const result = await slot.lookup(manySenseWord);
    const expected = uniqueIds(raw).slice(0, 40);
    assert(result.status === 'found', 'multi-sense word found through slot');
    if (result.status === 'found') {
      assert(JSON.stringify(result.synsetIds) === JSON.stringify(expected), 'ids are unique, in dictionary order, and derived from all senses');
      assert(result.synsetIds!.length > result.senses.length, 'synset ids exceed the five displayed senses');
      assert(result.senses.length <= 5, 'displayed sense cap remains five');
      assert(result.senses.every((sense) => sense.synset !== undefined), 'each displayed sense exposes its synset');
    }
    assert(manySenseIds.length > 5, 'the chosen raw dictionary entry has multiple unique synsets');
  }

  let cappedWord: string | undefined;
  let cappedExpected: string[] = [];
  for (const candidate of ['set', 'run', 'make', 'get', 'take', 'go', 'play', 'break', 'point', 'come', 'turn']) {
    const raw = await dictionary.lookup(candidate);
    const ids = uniqueIds(raw);
    if (raw.found && ids.length > 40) { cappedWord = candidate; cappedExpected = ids.slice(0, 40); break; }
  }
  assert(Boolean(cappedWord), 'real dictionary contains a word with more than 40 unique synsets');
  if (cappedWord) {
    const capped = await slot.lookup(cappedWord);
    assert(capped.status === 'found' && capped.synsetIds?.length === 40, 'synset ids are capped at 40');
    assert(capped.status === 'found' && JSON.stringify(capped.synsetIds) === JSON.stringify(cappedExpected), 'cap keeps the first 40 unique ids in dictionary order');
  }

  const analyze = createAnalyzer(slot, { maxLookups: 64, maxPhraseWords: 5 });
  const plural = await analyze(segment('mice'));
  const mouse = await slot.lookup('mice');
  assert(plural.ok && plural.tokens[0]?.knowledge === 'known', 'irregular plural is resolved');
  assert(plural.ok && mouse.status === 'found' && JSON.stringify(plural.tokens[0]?.synsetIds) === JSON.stringify(mouse.synsetIds), 'irregular plural receives the ids of its own lookup result');

  const unknown = await analyze(segment('qzxvbnunknownword'));
  assert(unknown.ok && unknown.tokens[0]?.knowledge === 'unknown', 'unknown word remains unknown');
  assert(unknown.ok && unknown.tokens[0]?.synsetIds === undefined, 'unknown word has no synset ids');

  let phraseHit: { text: string; ids: string[] } | undefined;
  for (const phrase of ['hot dog', 'ice cream', 'New York', 'take off', 'give up', 'black hole', 'computer science']) {
    const raw = await dictionary.lookup(phrase);
    const ids = uniqueIds(raw);
    if (raw.found && ids.length) { phraseHit = { text: phrase, ids: ids.slice(0, 40) }; break; }
  }
  assert(Boolean(phraseHit), 'dictionary contains a tested multi-word entry with synsets');
  if (phraseHit) {
    const phraseResult = await analyze(segment(phraseHit.text));
    assert(phraseResult.ok && JSON.stringify(phraseResult.tokens[0]?.synsetIds) === JSON.stringify(phraseHit.ids), 'phrase hit puts phrase synset ids on its first token');
    assert(phraseResult.ok && phraseResult.tokens[0]?.entry?.surface.toLowerCase() === phraseHit.text.toLowerCase(), 'phrase remains attached to its first token');
  }

  const samples = [
    'hello there', 'thanks for helping', 'good morning', 'bank account', 'mice went home',
    'running quickly', 'set the table', 'make a plan', 'unknownwordqx', 'hot dog',
    'what can you do', 'tell me a joke', 'read this text', 'count these words', 'open the file',
    'light rain today', 'take off your coat', 'the dogs were running', 'I went to school', 'ice cream',
    'please help me', 'what is this', 'a quick brown fox', 'write a short note', 'give up now',
    'this is not a dictionary word', 'make it bigger', 'turn left', 'show me more', 'thank you very much',
  ];
  const lookupCounts: number[] = [];
  for (const text of samples) {
    let actualCalls = 0;
    const counted: KnowledgeSlot = {
      status: () => slot.status(), credits: () => slot.credits(),
      lookup: async (word): Promise<KnowledgeLookupResult> => { actualCalls += 1; return slot.lookup(word); },
    };
    const result = await createAnalyzer(counted, { maxLookups: 64, maxPhraseWords: 5 })(segment(text));
    assert(result.ok, `sample analysis succeeds: ${text}`);
    if (result.ok) {
      lookupCounts.push(result.metrics.lookupCalls);
      assert(result.metrics.lookupCalls === actualCalls, `reported calls equal actual slot calls: ${text}`);
      assert(result.metrics.lookupCalls <= result.metrics.budget, `lookup budget is respected: ${text}`);
    }
  }
  console.log(`B03P lookupCalls for 30 BASE comparison samples (post-change): ${lookupCounts.join(',')}`);
  console.log('BASE-before-change lookupCalls: NOT MEASURED (the sandbox could not install the repository test runner; see report).');

  // Verify that the knowledge-slot extension leaves existing result fields unchanged.
  const oldFields = await slot.lookup('bank');
  assert(oldFields.status === 'found' && oldFields.word === 'bank', 'existing word field unchanged');
  assert(oldFields.status === 'found' && oldFields.source === 'Open English WordNet' && oldFields.version === '2025', 'existing source/version fields unchanged');
  assert(oldFields.status === 'found' && oldFields.senses.length <= 5 && oldFields.senses.every((sense) => typeof sense.meaning === 'string' && typeof sense.partOfSpeech === 'string'), 'existing sense fields and display cap unchanged');
  assert(oldFields.status === 'found' && (!oldFields.pronunciations || oldFields.pronunciations.every((item) => typeof item === 'string')), 'existing pronunciations field unchanged');
  console.log(`B03P SYNSET IDS TEST: ${checks} checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
