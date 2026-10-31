/**
 * RESOLVE-TC part 4: three owner-approved changes, proven three ways (parts, adapter, real stages).
 *  A. "how many X ..." = count (closed set in closedSets.ts), X is the counted noun, never the verb.
 *  B. "please" / "kindly" never carry the verb (closed set already in closedSets.ts).
 *  C. rule 16, two readings of a compound ("word count"): the second reading wins only as a match with strictly fewer empty required slots.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readClauseParts } from '../src/brain/mind/meaning/structure/clauseParts';
import { buildResolveInputs } from '../src/brain/mind/resolve/clauseInputs';
import type { PartFacts } from '../src/brain/mind/meaning/structure/partsTypes';

let checks = 0; const fails: string[] = [];
const ok = (c: boolean, m: string): void => { checks += 1; if (!c) fails.push(m); };

// ---------- A and B on the clause parts (independent fact table, no dictionary) ----------
const VERBS = new Set('count words lines tell please kindly set'.split(' '));
const AUX = new Set('are is do does'.split(' '));
const NOUNS = new Set('words lines count letters timer'.split(' '));
const DET = new Set('the a'.split(' '));
const facts = (t: string): PartFacts[] => t.split(' ').map((w) => ({ norm: w, verb: VERBS.has(w) || AUX.has(w), aux: AUX.has(w), noun: NOUNS.has(w), determiner: DET.has(w) }));
const parts = (t: string) => readClauseParts(facts(t), [{ from: 0, to: t.split(' ').length }])[0]!;
const w = (t: string) => t.split(' ');
const q1 = parts('how many words are in it');
ok(q1.quantity?.from === 2 && q1.quantity?.to === 3, 'A: quantity span is the noun after how many');
ok(q1.copula === true && w('how many words are in it')[q1.verb!] === 'are', 'A: the verb is the copula, not the counted noun');
const q2 = parts('how many lines');
ok(q2.quantity?.from === 2 && q2.quantity?.to === 3 && q2.verb === null, 'A: no copula: span reaches the end, no verb');
ok(parts('how many').quantity === null, 'A: "how many" with nothing after it has no span');
ok(parts('tell how many words are in it').quantity?.from === 3, 'A: works after another verb');
ok(w('tell how many words are in it')[parts('tell how many words are in it').verb!] === 'tell', 'A: the real verb stays the verb');
ok(parts('count words').quantity === null, 'A: other clauses unchanged');
const p1 = parts('please count words');
ok(w('please count words')[p1.verb!] === 'count' && p1.object?.from === 2, 'B: please is skipped, count is the verb');
ok(w('kindly count words')[parts('kindly count words').verb!] === 'count', 'B: kindly is skipped');
ok(parts('count please').verb === 0, 'B: a verb before the politeness word stays');

// ---------- adapter (hand-built tokens) ----------
const tok = (lemma: string, start: number, pos: string[], alt?: string[]) => ({ lemma, start, end: start + lemma.length, partsOfSpeech: pos, ...(alt ? { alternativeNounLemmas: alt } : {}) });
const word = (norm: string, start: number) => ({ norm, start, end: start + norm.length });
const clauses = [{ act: 'ask', polarity: 'positive' }];
const quant = buildResolveInputs({
  words: [word('how', 0), word('many', 4), word('words', 9), word('are', 15)], tokens: [tok('how', 0, ['r']), tok('many', 4, ['a']), tok('word', 9, ['n', 'v'], ['word']), tok('be', 15, ['v'])],
  segments: [], values: [], clauses, pieces: [{ from: 0, to: 4, clause: 0, mayRunAlone: true, parts: { verb: 3, copula: true, object: null, details: [], quantity: { from: 2, to: 3 } } }],
} as never)[0]!;
ok(quant.input.verbs.length === 1 && quant.input.verbs[0] === 'count:v', 'A adapter: verbs = [count:v] only, the copula is no verb key');
ok(quant.input.objects.includes('word:n') && !quant.input.objects.some((k) => k.startsWith('many') || k.startsWith('how')), 'A adapter: objects come from the counted noun only');
const cmp = (first: string, second: string) => buildResolveInputs({
  words: [word(first, 0), word(second, first.length + 1)], tokens: [tok(first, 0, ['n', 'v']), tok(second, first.length + 1, ['n', 'v'])],
  segments: [], values: [], clauses: [{ act: 'command', polarity: 'positive' }], pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, copula: false, object: { from: 1, to: 2 }, details: [] } }],
} as never)[0]!;
const wc = cmp('word', 'count');
ok(wc.input.verbs[0] === 'word:v' && wc.input.objects.includes('count:n'), 'C: first reading is verb word + object count');
ok(wc.alternative?.verbs[0] === 'count:v' && wc.alternative?.objects.includes('word:n') && !wc.alternative.objects.includes('count:n'), 'C: second reading is verb count + object word');
const cw = buildResolveInputs({
  words: [word('count', 0), word('words', 6)], tokens: [tok('count', 0, ['n', 'v']), tok('word', 6, ['n', 'v'])],
  segments: [], values: [], clauses: [{ act: 'command', polarity: 'positive' }], pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, copula: false, object: { from: 1, to: 2 }, details: [] } }],
} as never)[0]!;
ok(cw.alternative === undefined, 'C: a plural second word (surface differs from lemma) gives no second reading');
const noverb = buildResolveInputs({
  words: [word('word', 0), word('count', 5)], tokens: [tok('word', 0, ['n', 'v']), tok('count', 5, ['n'])],
  segments: [], values: [], clauses, pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, copula: false, object: { from: 1, to: 2 }, details: [] } }],
} as never)[0]!;
ok(noverb.alternative === undefined, 'C: no second reading when the second word cannot be a verb');

// ---------- real stages, real dictionary ----------
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const { createStages } = await import('../src/brain/mind/stages');
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const stages = createStages({ run: async () => ({ content: 'x', source: 'test' }) } as never, () => Date.UTC(2026, 0, 1, 12, 30), () => 'test', createDictionarySlot(async () => dictionary));
const first = async (text: string): Promise<{ label: string; reading: unknown }> => {
  let ctx: any = { utterance: { id: 't', text, place: 'chat', at: 0 }, entries: [] };
  for (const st of stages) ctx = await st.run(ctx);
  const r = (ctx.resolutions ?? [])[0];
  const x = r?.resolution;
  return { label: x ? (x.kind === 'match' ? `match:${x.tool}` : x.kind) : 'none', reading: r?.reading };
};
const TC = 'match:text-counter';
const positive = [
  'how many words are in "the quick brown fox"', 'how many characters are in "good morning"', 'how many letters in "hello"', 'how many lines in "x\ny"', 'how many word in "hi"',
  'how many words are in the quick brown fox', 'how many lines in one two', 'how many characters in "x"', 'how many words are there in "a b"', 'how many lines', 'how many characters are in it',
  'please count words in "thanks a lot"', 'please count letters', 'kindly count the lines in "a\nb"',
  'word count of "hello there world"', 'character count of "hello"', 'letter count "abc"', 'line count of "a\nb"', 'word count', 'word count: plain words follow',
];
for (const text of positive) { const r = await first(text); ok(r.label === TC, `E2E ${JSON.stringify(text)} expected ${TC}, got ${r.label}`); }
ok((await first('word count of "hello there world"')).reading === 'alternative', 'E2E: the compound is reported as the alternative reading (loud, FL15)');
ok((await first('count words in "hello brave new world"')).reading === undefined, 'E2E: a plain request does not use the alternative');
// controls: other families must not be pulled to the Text Counter
for (const text of ['set a timer for 5 minutes', 'translate hello to french', 'what is 12 times 3', 'how many days until friday', 'please set a timer']) { const r = await first(text); ok(r.label !== TC, `E2E control ${JSON.stringify(text)} must not be the Text Counter, got ${r.label}`); }

if (fails.length > 0) { console.error(fails.join('\n')); throw new Error(`RESOLVE-TC part 4: ${fails.length} of ${checks} failed`); }
console.log(`RESOLVE-TC part 4 test OK: ${checks} checks`);
