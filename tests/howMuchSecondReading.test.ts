/** RESOLVE-TC part 5: "how much" is a SECOND reading of the count question (adapter rule 18), never the only one. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readClauseParts } from '../src/brain/mind/meaning/structure/clauseParts';
import { buildResolveInputs } from '../src/brain/mind/resolve/clauseInputs';
import type { PartFacts } from '../src/brain/mind/meaning/structure/partsTypes';
let checks = 0; const fails: string[] = [];
const ok = (c: boolean, m: string): void => { checks += 1; if (!c) fails.push(m); };
const VERBS = new Set('words lines is does cost'.split(' ')); const AUX = new Set('are is does do'.split(' ')); const NOUNS = new Set('words lines money time'.split(' '));
const parts = (t: string) => readClauseParts(t.split(' ').map((w): PartFacts => ({ norm: w, verb: VERBS.has(w) || AUX.has(w), aux: AUX.has(w), noun: NOUNS.has(w), determiner: false })), [{ from: 0, to: t.split(' ').length }])[0]!;
const a = parts('how much words are in it');
ok(a.quantitySecond?.from === 2 && a.quantitySecond?.to === 3 && a.quantity === null, 'parts: noun phrase after how much is the second-reading span');
ok(parts('how much is it').quantitySecond === null && parts('how much does it cost').quantitySecond === null, 'parts: no span when the verb follows right away');
ok(parts('how many words are in it').quantitySecond === null && parts('how many words are in it').quantity !== null, 'parts: how many keeps the first reading only');
ok(parts('how much').quantitySecond === null, 'parts: nothing after how much');
const tok = (lemma: string, start: number, pos: string[]) => ({ lemma, start, end: start + lemma.length, partsOfSpeech: pos });
const word = (norm: string, start: number) => ({ norm, start, end: start + norm.length });
const piece = (q: unknown) => buildResolveInputs({ words: [word('how', 0), word('much', 4), word('word', 9), word('are', 14)], tokens: [tok('how', 0, ['r']), tok('much', 4, ['a']), tok('word', 9, ['n', 'v']), tok('be', 14, ['v'])], segments: [], values: [], clauses: [{ act: 'ask', polarity: 'positive' }], pieces: [{ from: 0, to: 4, clause: 0, mayRunAlone: true, parts: { verb: 2, copula: false, object: { from: 3, to: 4 }, details: [], ...(q as object) } }] } as never)[0]!;
const withIt = piece({ quantitySecond: { from: 2, to: 3 } });
ok(withIt.alternative?.verbs.length === 1 && withIt.alternative.verbs[0] === 'count:v' && withIt.alternative.objects.includes('word:n'), 'adapter: count reading kept as the alternative');
ok(withIt.input.verbs[0] === 'word:v', 'adapter: the first reading is unchanged');
ok(piece({}).alternative === undefined, 'adapter: no span, no alternative');
ok(piece({ quantitySecond: { from: 2, to: 3 }, quantity: { from: 2, to: 3 } }).alternative === undefined, 'adapter: how many wins, how much reading not added');
const { Dictionary } = await import('../src/brain/dictionary'); const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot'); const { createStages } = await import('../src/brain/mind/stages');
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const stages = createStages({ run: async () => ({ content: 'x', source: 'test' }) } as never, () => Date.UTC(2026, 0, 1, 12, 30), () => 'test', createDictionarySlot(async () => dictionary));
const first = async (text: string): Promise<{ label: string; reading: unknown }> => { let ctx: any = { utterance: { id: 't', text, place: 'chat', at: 0 }, entries: [] }; for (const st of stages) ctx = await st.run(ctx); const r = (ctx.resolutions ?? [])[0]; const x = r?.resolution; return { label: x ? (x.kind === 'match' ? `match:${x.tool}` : x.kind) : 'none', reading: r?.reading }; };
const TC = 'match:text-counter';
const slips = ['how much words are in "the quick brown fox"', 'how much characters are in "good morning"', 'how much letters in "hello"', 'how much lines in "x\ny"', 'how much words in the quick brown fox', 'how much words are there in "a b"', 'how much characters are in it', 'how much lines', 'how much word in "hi"', 'please how much letters in "abc"'];
for (const t of slips) { const r = await first(t); ok(r.label === TC, `E2E slip ${JSON.stringify(t)} expected ${TC}, got ${r.label}`); }
const controls = ['how much is 12 times 3', 'how much does it cost', 'how much time is left', 'how much money do I have', 'how much is a dozen eggs', 'how much sugar is in tea', 'how much is 5 plus 7', 'how much is the total'];
const seen: string[] = [];
for (const t of controls) { const r = await first(t); seen.push(`${t} -> ${r.label}${r.reading ? ' [alternative]' : ''}`); ok(r.label !== TC && r.reading === undefined, `E2E control ${JSON.stringify(t)} must keep its first reading and not be the Text Counter, got ${r.label}${r.reading ? ' via alternative' : ''}`); }
console.log(seen.join('\n'));
if (fails.length > 0) { console.error(fails.join('\n')); throw new Error(`RESOLVE-TC part 5: ${fails.length} of ${checks} failed`); }
console.log(`RESOLVE-TC part 5 test OK: ${checks} checks`);
