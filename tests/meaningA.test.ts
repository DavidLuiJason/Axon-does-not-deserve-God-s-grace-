/**
 * B03A: the Meaning stage, part A (clauses, material attachment, speech act, polarity).
 *
 * Replays the corpus and a negative suite through the REAL pipeline stages with the REAL dictionary, prints a
 * confusion table, verifies the concept anchors and the owner-listed conversation words against the dictionary,
 * replays the golden transcript with the Meaning stage on, runs a seeded fuzz, measures time, and finally breaks
 * the code on purpose (mutation tests) to prove the corpus notices.
 *
 * Run: tsx tests/meaningA.test.ts   (MEANING_CORPUS_ONLY=1 prints only the number of failing core items.)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { CONVERSATION_WORDS, conversationActOf } from '../src/brain/knowledge/conversationWords';
import { createMind } from '../src/brain/mind';
import { createStages } from '../src/brain/mind/stages';
import type { Analysis, MindContext, Meaning } from '../src/brain/mind';
import { buildMeaning, GREETING_IDS, THANKS_IDS, MEANING_LIMITS } from '../src/brain/mind/meaning';
import { splitClitic, isNegativeClitic, isQuestionWord, isAuxiliary, isGrammarWord, normalizeWord } from '../src/brain/mind/meaning/closedSets';
import { classifyGap } from '../src/brain/mind/meaning/clauses';
import { RUN_AT, ASK_AT } from '../src/brain/matcher';
import { createFoundation } from '../src/brain/foundation';
import { createUserLexicon, type KeyValueStore } from '../src/brain/lexicon';
import { createLocalRules } from '../src/brain/localRules';
import { createDictionaryProvider } from '../src/brain/knowledge/dictionaryProvider';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { PLANNED_SOURCES } from '../src/brain/brain';
import { createAxonEngine } from '../src/kernel/axonEngine';
import { answerAbilityQuestion, answerRequestFallback, describeAbilities } from '../src/brain/abilities';
import { registerSettingsCapability } from '../src/capabilities/registerSettings';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerAxonSourceCapability } from '../src/capabilities/registerAxonSource';
import { registerInterfaceCaptureCapability } from '../src/capabilities/registerInterfaceCapture';
import { registerBackgroundProofCapability } from '../src/capabilities/registerBackgroundProof';
import { registerDictionaryCapability } from '../src/capabilities/registerDictionary';
import { registerPlannedCapabilities } from '../src/capabilities/registerPlanned';
import { registerTaughtMeaningsCapability } from '../src/capabilities/registerTaughtMeanings';
import { registerPlannedMediaCapabilities } from '../src/capabilities/registerPlannedMedia';

type Expected = { act: string; material: number; polarity: string };
interface Item { id: string; text: string; clauses: Expected[]; kind?: 'core' | 'stretch'; note?: string }

const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
const CORPUS_ONLY = process.env.MEANING_CORPUS_ONLY === '1';
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function openDictionary(): Promise<Dictionary> {
  return Dictionary.open({ read: async (path: string) => readFile(join(DIR, path), 'utf8'), hash: sha });
}

async function main(): Promise<void> {
  const dictionary = await openDictionary();
  const slot = createDictionarySlot(async () => dictionary);
  const stages = createStages({ run: async () => ({ content: '', source: 'test' }) } as never, () => 0, () => 'u', slot);

  async function read(text: string): Promise<MindContext> {
    let context: MindContext = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const stage of stages.slice(0, 4)) context = await stage.run(context);
    return context;
  }
  const shape = (meaning: Meaning | undefined): Expected[] | null => meaning ? meaning.clauses.map((f) => ({ act: f.act, material: f.clause.materialIds.length, polarity: f.polarity })) : null;

  const corpus = load<Item[]>('meaning-corpus-a.json').map((item) => ({ kind: 'core' as const, ...item }));
  const negative = load<Item[]>('meaning-negative-a.json').map((item) => ({ kind: 'core' as const, ...item }));

  // ---- 1. corpus replay -------------------------------------------------------------------------------------------
  const failures: string[] = [];
  const confusion = new Map<string, number>();
  const stretch: string[] = [];
  let coreCount = 0;
  let corePass = 0;
  const preAnalysis = new Map<string, MindContext>();
  for (const item of corpus) {
    const context = await read(item.text);
    preAnalysis.set(item.id, context);
    const got = shape(context.meaning);
    const ok = same(got, item.clauses);
    if (item.kind === 'core') { coreCount += 1; if (ok) corePass += 1; else failures.push(`${item.id} ${JSON.stringify(item.text)} expected ${JSON.stringify(item.clauses)} got ${JSON.stringify(got)}`); }
    else stretch.push(`${item.id} ${ok ? 'PASS' : 'not yet'} ${JSON.stringify(item.text)}${ok ? '' : ` got ${JSON.stringify(got)}`}`);
    const expectedAct = item.clauses[0]?.act ?? 'none';
    const actualAct = got?.[0]?.act ?? 'none';
    if (item.kind === 'core') confusion.set(`${expectedAct}|${actualAct}`, (confusion.get(`${expectedAct}|${actualAct}`) ?? 0) + 1);
  }
  if (CORPUS_ONLY) {
    for (const item of negative) { if (!same(shape((await read(item.text)).meaning), item.clauses)) failures.push(item.id); }
    console.log(`CORPUS_FAILURES=${failures.length}`);
    return;
  }
  assert(failures.length === 0, `every core corpus item passes:\n${failures.join('\n')}`);
  assert(corpus.length === 46 && coreCount === 44, 'the corpus has 46 items, 44 of them core');

  const acts = ['ask', 'command', 'greet', 'thanks', 'chat', 'unknown', 'none'];
  console.log('\nCONFUSION TABLE, first clause (rows: expected, columns: actual)');
  console.log(`${''.padEnd(9)}${acts.map((a) => a.padStart(8)).join('')}`);
  for (const row of acts) console.log(`${row.padEnd(9)}${acts.map((col) => String(confusion.get(`${row}|${col}`) ?? 0).padStart(8)).join('')}`);
  for (const act of acts) {
    const tp = confusion.get(`${act}|${act}`) ?? 0;
    const predicted = acts.reduce((sum, row) => sum + (confusion.get(`${row}|${act}`) ?? 0), 0);
    const actual = acts.reduce((sum, col) => sum + (confusion.get(`${act}|${col}`) ?? 0), 0);
    if (actual === 0 && predicted === 0) continue;
    console.log(`  ${act.padEnd(8)} precision ${predicted ? (tp / predicted * 100).toFixed(0) : '-'}%  recall ${actual ? (tp / actual * 100).toFixed(0) : '-'}%`);
  }
  console.log(`CORPUS: ${corePass} of ${coreCount} core items pass; stretch items:\n  ${stretch.join('\n  ')}`);

  // Specific promises of the job.
  const p12 = (preAnalysis.get('P12')!.meaning!.clauses[0]!);
  assert(p12.act === 'ask' && p12.alternatives.some((alt) => alt.act === 'command'), 'P12 polite request is an ask whose alternatives contain a command');
  for (const item of corpus) {
    const meaning = preAnalysis.get(item.id)!.meaning!;
    for (const frame of meaning.clauses) {
      assert(frame.confidence >= 0 && frame.confidence <= 1 && frame.reason.length > 8, `${item.id} has a confidence in [0,1] and a recorded reason`);
      assert(frame.alternatives.every((alt) => alt.confidence > 0.2 && alt.act !== frame.act), `${item.id} alternatives are other readings above 0.2`);
      if (frame.act !== 'unknown') assert(frame.confidence >= ASK_AT, `${item.id} a chosen act is at or above ASK_AT`);
    }
    const trace = preAnalysis.get(item.id)!.entries.find((entry) => entry.stage === 'meaning')!;
    assert(trace.state === 'ran', `${item.id} the Meaning stage is traced as ran`);
    const first = meaning.clauses[0];
    assert(first ? preAnalysis.get(item.id)!.frame?.act === first.act : preAnalysis.get(item.id)!.frame?.act === 'unknown', `${item.id} frame comes from the first clause`);
  }
  assert(RUN_AT === 0.8 && ASK_AT === 0.5, 'thresholds are the matcher constants');
  assert(preAnalysis.get('M04')!.entries.find((e) => e.stage === 'meaning')!.note === '2 clauses: thanks, command', 'trace note names the clauses');
  assert(preAnalysis.get('X09')!.entries.find((e) => e.stage === 'meaning')!.note === '1 clause: command (negative)', 'trace note names polarity');

  // ---- 2. negative suite (messages written before the code was run) -----------------------------------------------------
  assert(negative.length >= 40, 'at least 40 new negative messages');
  const negFailures: string[] = [];
  for (const item of negative) {
    const got = shape((await read(item.text)).meaning);
    if (!same(got, item.clauses)) negFailures.push(`${item.id} ${JSON.stringify(item.text)} expected ${JSON.stringify(item.clauses)} got ${JSON.stringify(got)}`);
  }
  assert(negFailures.length === 0, `every negative message passes:\n${negFailures.join('\n')}`);
  console.log(`NEGATIVE SUITE: ${negative.length} of ${negative.length} messages pass`);

  // Known limits: reported, not required. They are real and are listed in docs/reports/B03A_REPORT.md.
  const limits: Array<[string, string]> = [
    ['light travels fast', 'a noun-verb word first and a plain statement: no structural cue separates it from a command'],
    ['stop', 'one bare word that is both noun and verb is not guessed'],
    ['I thank you', 'the dictionary phrase "thank you" swallows the verb, so no subject-verb pair is seen'],
    ['cuont the wrods in "a b"', 'typos are not repaired in this part'],
  ];
  console.log('KNOWN LIMITS (reported, not required):');
  for (const [text, why] of limits) {
    const got = shape((await read(text)).meaning);
    console.log(`  ${JSON.stringify(text)} -> ${got ? got.map((g) => g.act).join(',') : 'not read'}   (${why})`);
  }

  // ---- 3. anchors and conversation words are checked against the real dictionary -------------------------------------
  const evidence: Array<{ id: string; word: string; hypernym?: string; gloss?: string }> = [
    { id: 'oewn-06645018-n', word: 'hello', hypernym: 'greeting' },
    { id: 'oewn-06645178-n', word: 'good morning', hypernym: 'greeting' },
    { id: 'oewn-06645314-n', word: 'good afternoon', hypernym: 'greeting' },
    { id: 'oewn-80042148-n', word: 'good evening', hypernym: 'greeting' },
    { id: 'oewn-06644428-n', word: 'ciao', gloss: 'say hello' },
    { id: 'oewn-06642524-n', word: 'greetings', gloss: 'on meeting' },
    { id: 'oewn-07243631-n', word: 'thanks', gloss: 'appreciation' },
    { id: 'oewn-07243905-n', word: 'thank you', hypernym: 'thanks' },
  ];
  assert(evidence.length === GREETING_IDS.length + THANKS_IDS.length && evidence.every((e) => [...GREETING_IDS, ...THANKS_IDS].includes(e.id)), 'every anchor id has an evidence row');
  for (const row of evidence) {
    const result = await dictionary.lookup(row.word);
    assert(result.found, `${row.word} is in the dictionary`);
    let seen = false;
    for (const match of result.matches) {
      const relations = await dictionary.relations(match.word);
      match.entries.forEach((entry, i) => entry.senses.forEach((sense, j) => {
        if (sense.synset !== row.id) return;
        seen = true;
        if (row.hypernym) assert((relations[i]?.[j]?.relations?.hypernym ?? []).includes(row.hypernym), `${row.id} (${row.word}) has hypernym ${row.hypernym}`);
        if (row.gloss) assert((sense.definition ?? '').includes(row.gloss), `${row.id} (${row.word}) gloss mentions "${row.gloss}"`);
        assert(entry.pos_tag === 'n', `${row.id} is a noun sense`);
      }));
    }
    assert(seen, `${row.id} is a sense of ${row.word}`);
  }
  const anchorIds = new Set([...GREETING_IDS, ...THANKS_IDS]);
  for (const entry of CONVERSATION_WORDS) {
    const result = await dictionary.lookup(entry.word);
    assert(entry.reason.length > 10 && entry.status === 'proposed', `${entry.word} carries a reason and is waiting for the owner`);
    assert(conversationActOf(entry.word) === entry.act, `${entry.word} maps to ${entry.act}`);
    if (entry.dictionary === 'absent') assert(!result.found, `${entry.word} is really absent from the dictionary`);
    else assert(result.found && !result.matches.some((m) => m.entries.some((e) => e.senses.some((s) => anchorIds.has(s.synset)))), `${entry.word} is in the dictionary but without the greeting or thanks meaning`);
  }
  assert(conversationActOf('hello') === null, 'a word the dictionary knows is not in the conversation file');
  assert(CONVERSATION_WORDS.length <= 12, 'the conversation-word file stays small');

  // ---- 4. closed sets and gap classification ---------------------------------------------------------------------------
  assert(isQuestionWord('what') && !isQuestionWord('count') && isAuxiliary('is') && !isAuxiliary('open'), 'closed sets recognise grammar words only');
  assert(isNegativeClitic("don't") && !isNegativeClitic("it's") && same(splitClitic("it's"), { stem: 'it', ending: 's' }) && splitClitic("tom's") === null, 'clitics');
  assert(normalizeWord('Don\u2019T') === "don't" && isGrammarWord('the') && !isGrammarWord('timer'), 'normalising and grammar words');
  assert(classifyGap(' ') === 'none' && classifyGap(', ') === 'weak' && classifyGap('? ') === 'strong' && classifyGap('.5') === 'none' && classifyGap('. ') === 'strong', 'gap classes (a decimal point is not punctuation)');

  // ---- 5. input limits and failure isolation -----------------------------------------------------------------------------
  const fake: Analysis = { segments: [{ kind: 'language', text: 'x', start: 0, end: 1 }], tokens: Array.from({ length: MEANING_LIMITS.maxTokens + 1 }, (_, i) => ({ surface: 'x', lemma: 'x', start: 0, end: 1, knowledge: 'unknown' as const, partsOfSpeech: [] as string[] })) };
  const tooLong = buildMeaning(fake, 'x');
  assert(!tooLong.ok && tooLong.error === 'too-long', 'a huge message is refused with a typed error');
  const bad = buildMeaning({ segments: [], tokens: 'no' } as never, 'x');
  assert(!bad.ok && bad.error === 'invalid-input', 'wrong input types are refused with a typed error');
  const broken: MindContext = { utterance: { id: 'b', text: 'count words', place: 'chat', at: 0 }, entries: [], analysis: { segments: [{ kind: 'language', text: 'count words', start: 0, end: 11 }], tokens: 42 as never, metrics: { lookupCalls: 0, cacheHits: 0, budget: 1, budgetExhausted: false } } };
  const afterBroken = await stages[3]!.run(broken);
  assert(afterBroken.entries.at(-1)?.stage === 'meaning' && afterBroken.entries.at(-1)?.state === 'not-built' && afterBroken.frame?.act === 'unknown', 'a failure inside the stage is traced and does not throw');
  const noAnalysis = await stages[3]!.run({ utterance: { id: 'b', text: 'hello', place: 'chat', at: 0 }, entries: [] });
  assert(noAnalysis.entries.at(-1)?.state === 'not-built', 'no analysis: honestly not read');
  const longText = Array.from({ length: 2500 }, () => 'count the words').join(' ');
  const longContext = await read(longText);
  assert(longContext.entries.find((e) => e.stage === 'meaning') !== undefined, 'a 7,500-word message does not crash the stage');

  // ---- 6. golden transcript with the Meaning stage ON --------------------------------------------------------------------
  registerSettingsCapability(); registerAxonToolsCapability(); registerAxonSourceCapability(); registerInterfaceCaptureCapability();
  registerBackgroundProofCapability(); registerDictionaryCapability(); registerPlannedCapabilities(); registerTaughtMeaningsCapability(); registerPlannedMediaCapabilities();
  const fixedNow = () => 1700000000000;
  const memory = (): KeyValueStore => { const values = new Map<string, string>(); return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: (k) => { values.delete(k); } }; };
  const freshBrain = () => {
    const localRules = createLocalRules({
      commands: [TEXT_COUNT_COMMAND], engine: createAxonEngine({ now: fixedNow }), planned: PLANNED_SOURCES, lexicon: createUserLexicon(memory(), fixedNow), now: fixedNow,
      abilities: { describe: () => describeAbilities({ lexiconExists: true }), answer: answerAbilityQuestion },
    });
    return createMind({ providers: [localRules, createDictionaryProvider(createDictionarySlot(async () => dictionary))], fallback: createFoundation({ abilities: { answerRequestFallback } }), planned: PLANNED_SOURCES, now: fixedNow, slot });
  };
  const golden = load<Array<{ message: string; reply: Record<string, unknown> }>>('brainGolden.json');
  const expectedStates = 'intake:ran,reading:ran,analysis:ran,resolution:not-built,dialogue:not-built,planning:not-built,execution:ran,verification:not-built,response:passed-through';
  let meaningRan = 0;
  for (const item of golden) {
    const { reply, trace } = await freshBrain().askWithTrace({ text: item.message, place: 'chat' });
    const keys = [...new Set([...Object.keys(item.reply), ...Object.keys(reply)])];
    for (const key of keys) assert(same((item.reply as Record<string, unknown>)[key], (reply as unknown as Record<string, unknown>)[key]), `golden reply unchanged for ${JSON.stringify(item.message)} field ${key}`);
    assert(trace.entries.filter((e) => e.stage !== 'meaning').map((e) => `${e.stage}:${e.state}`).join(',') === expectedStates, `only the meaning trace entry is new for ${JSON.stringify(item.message)}`);
    const meaningEntry = trace.entries.find((e) => e.stage === 'meaning')!;
    assert(meaningEntry.state === 'ran' || meaningEntry.state === 'not-built', 'meaning entry present');
    if (meaningEntry.state === 'ran') meaningRan += 1;
  }
  console.log(`GOLDEN TRANSCRIPT: ${golden.length} replies byte-identical; the Meaning stage ran on ${meaningRan} of them; every other trace entry unchanged`);
  assert(meaningRan > golden.length / 2, 'the Meaning stage really ran on most golden messages');

  // ---- 7. seeded fuzz: invariants -------------------------------------------------------------------------------------
  let seed = 0xb03a;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  const pieces = ['count', 'the', 'words', 'in', 'and', 'then', ',', '.', '?', '!', 'hello', 'thanks', 'what', 'is', 'it', 'I', "don't", 'not', '"quoted text"', '`code`', '\n', '\u{1F642}', 'sort', 'lines', '5', 'miles', 'to', 'salt', 'pepper', 'good morning', 'hey', '\u0633\u0644\u0627\u0645', '   ', '...', 'x=1'];
  let fuzzCount = 0;
  for (let n = 0; n < 400; n += 1) {
    const length = 1 + Math.floor(rnd() * 14);
    const text = Array.from({ length }, () => pieces[Math.floor(rnd() * pieces.length)]!).join(rnd() < 0.5 ? ' ' : '');
    const context = await read(text);
    const again = await read(text);
    assert(same(context.meaning, again.meaning), `fuzz ${n}: same input, same meaning`);
    const meaning = context.meaning!;
    const materialCount = context.analysis!.segments.filter((s) => s.kind === 'material').length;
    const assigned = meaning.clauses.flatMap((f) => f.clause.materialIds);
    assert(meaning.clauses.length === 0 || (assigned.length === materialCount && new Set(assigned).size === assigned.length), `fuzz ${n}: each material region belongs to exactly one clause`);
    let previousEnd = -1;
    for (const frame of meaning.clauses) {
      const { span, tokenRange } = frame.clause;
      assert(span.start >= 0 && span.end <= text.length && span.start <= span.end && span.start >= previousEnd, `fuzz ${n}: spans are ordered and inside the text`);
      assert(tokenRange.from >= 0 && tokenRange.to >= tokenRange.from && tokenRange.to <= context.analysis!.tokens.length, `fuzz ${n}: token ranges are inside the analysis`);
      assert(['ask', 'command', 'greet', 'thanks', 'chat', 'unknown'].includes(frame.act) && frame.confidence >= 0 && frame.confidence <= 1, `fuzz ${n}: a valid act and confidence`);
      previousEnd = span.start;
    }
    assert(!meaning.onlyMaterial || meaning.clauses.length === 0, `fuzz ${n}: onlyMaterial means no clauses`);
    fuzzCount += 1;
  }
  console.log(`FUZZ: ${fuzzCount} seeded random messages, invariants hold`);

  // ---- 8. budget ---------------------------------------------------------------------------------------------------------
  const timed = [...corpus, ...negative];
  const contexts: Array<{ analysis: Analysis; text: string }> = [];
  for (const item of timed) { const ctx = await read(item.text); contexts.push({ analysis: ctx.analysis!, text: item.text }); }
  let max = 0;
  const t0 = performance.now();
  for (let round = 0; round < 20; round += 1) for (const c of contexts) { const s = performance.now(); buildMeaning(c.analysis, c.text); max = Math.max(max, performance.now() - s); }
  const total = performance.now() - t0;
  const perMessage = total / (20 * contexts.length);
  console.log(`BUDGET (MEASURED, this machine, Meaning stage only): ${perMessage.toFixed(3)} ms per message on average, ${max.toFixed(3)} ms worst, over ${contexts.length} messages x 20`);
  assert(perMessage < 25, 'the Meaning stage stays far below the half-second understanding budget');

  // ---- 9. mutation tests: break the code on purpose; the corpus must notice ------------------------------------------------
  const root = resolve('.');
  const mutations: Array<{ name: string; file: string; from: string; to: string }> = [
    { name: 'question words forgotten', file: 'src/brain/mind/meaning/closedSets.ts', from: "'what', 'who', 'whom'", to: "'who', 'whom'" },
    { name: 'and and then never start a clause', file: 'src/brain/mind/meaning/clauses.ts', from: 'if (startsClause(units, after)) { ranges.push({ from, to: k }); from = k; }', to: 'if (false) { ranges.push({ from, to: k }); from = k; }' },
    { name: 'negation ignored', file: 'src/brain/mind/meaning/acts.ts', from: "units.some((unit) => unit.neg) ? 'negative' : 'positive'", to: "'positive'" },
    { name: 'thanks anchors removed', file: 'src/brain/mind/meaning/concepts.ts', from: "['oewn-07243631-n', 'oewn-07243905-n']", to: '[]' },
    { name: 'material attaches to nothing', file: 'src/brain/mind/meaning/build.ts', from: 'frames[target]!.clause.materialIds.push(segmentIndex);', to: '' },
    { name: 'a conjunction between nouns splits the clause', file: 'src/brain/mind/meaning/clauses.ts', from: 'if (hasVerb(unit) && !unit.grammar && strongObjectCue(unit, next)) return true;\n  return false;', to: 'if (!unit.grammar) return true;\n  return false;' },
    { name: 'statements read as commands', file: 'src/brain/mind/meaning/acts.ts', from: "if (auxAt >= 0) readings.push({ act: 'chat'", to: "if (false) readings.push({ act: 'chat'" },
  ];
  let killed = 0;
  for (const mutation of mutations) {
    const dir = mkdtempSync(join(tmpdir(), 'axon-mutation-'));
    try {
      cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
      cpSync(join(root, 'tests', 'meaningA.test.ts'), join(dir, 'tests', 'meaningA.test.ts'));
      for (const fixture of ['meaning-corpus-a.json', 'meaning-negative-a.json', 'brainGolden.json']) cpSync(join(root, 'tests', 'fixtures', fixture), join(dir, 'tests', 'fixtures', fixture));
      const target = join(dir, mutation.file);
      const original = readFileSync(target, 'utf8');
      assert(original.includes(mutation.from), `mutation "${mutation.name}" finds its target text`);
      writeFileSync(target, original.replace(mutation.from, mutation.to));
      const run = spawnSync('tsx', [join(dir, 'tests', 'meaningA.test.ts')], { cwd: root, env: { ...process.env, MEANING_CORPUS_ONLY: '1', DICT_DIR: resolve(DIR) }, encoding: 'utf8' });
      const line = (run.stdout ?? '').split('\n').find((l) => l.startsWith('CORPUS_FAILURES='));
      const failing = line ? Number(line.split('=')[1]) : -1;
      assert(failing > 0 || run.status !== 0, `mutation "${mutation.name}" is caught (the corpus fails ${failing} items; exit ${run.status})`);
      if (failing > 0 || run.status !== 0) killed += 1;
      console.log(`  mutation killed: ${mutation.name} (${failing >= 0 ? `${failing} corpus items fail` : 'the run crashed'})`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  assert(killed === mutations.length && mutations.length >= 5, 'every mutation is killed');

  console.log(`\nB03A MEANING TEST OK: ${checks} checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
