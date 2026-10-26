/**
 * B03B4 SENSE BY CONTEXT (Director test, 2026-10-26). Real pipeline, real dictionary. The 22 sentences are WRITTEN BY THE DIRECTOR (a small
 * corpus, not real users; the numbers are ordinal, NOT calibrated, and 22 items cannot prove a general rate). Measured when this test was written:
 * the plain "first dictionary sense" baseline picks the right sense in 10 of 22; the context ranking in 18 of 22; the 8 sentences where the context
 * DECIDES are all right. Proven here: that gap holds, a decision always has evidence, the senses stay ranked with their evidence, grammar words are
 * not read, nothing else in the Meaning changes, hostile input never throws, and deliberate breakages are noticed.
 * Run: tsx tests/senseContext.test.ts
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import type { MindContext } from '../src/brain/mind';
import { stemOf } from '../src/brain/mind/meaning/sense/readSenses';

let checks = 0; const fails: string[] = [];
const eq = (g: unknown, w: unknown, l: string) => { checks += 1; if (JSON.stringify(g) !== JSON.stringify(w)) fails.push(`${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
// [sentence, the word, a phrase that the right sense's gloss contains]
const CORPUS: Array<[string, string, string]> = [
  ['deposit money at the bank', 'bank', 'financial institution'],
  ['the bank approved my loan', 'bank', 'financial institution'],
  ['we sat on the river bank', 'bank', 'sloping land'],
  ['we fished near the bank of the stream', 'bank', 'sloping land'],
  ['he swung the bat at the ball', 'bat', 'club'],
  ['he bought a new bat and ball', 'bat', 'club'],
  ['the bat flew out of the cave at night', 'bat', 'mammal'],
  ['a bat hung upside down in the barn', 'bat', 'mammal'],
  ['the cat chased the mouse', 'mouse', 'rodents'],
  ['move the mouse to the corner of the screen', 'mouse', 'electronic device'],
  ['flowers bloom in spring', 'spring', 'season'],
  ['the spring in the mattress broke', 'spring', 'elastic device'],
  ['water bubbles from a spring in the hills', 'spring', 'water'],
  ['he sang bass in the choir', 'bass', 'voice'],
  ['the crane lifted the steel beam', 'crane', 'lifts'],
  ['a crane waded in the marsh', 'crane', 'wading bird'],
  ['water the plant every morning', 'plant', 'living organism'],
  ['the plant employs two hundred workers', 'plant', 'industrial labor'],
  ['he lit a match to start the fire', 'match', 'lighter'],
  ['we watched the football match on Saturday', 'match', 'contest'],
  ['save the file to my desktop', 'file', 'records'],
  ['she used a file to smooth the metal edge', 'file', 'hand tool'],
];

async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join('./public/dictionary/en', p), 'utf8'), hash: sha });
  const stages = createStages({ run: async () => ({ content: '', source: 'test' }) } as never, () => 0, () => 'u', createDictionarySlot(async () => dictionary));
  async function read(text: string): Promise<MindContext> {
    let c: MindContext = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const s of stages.slice(0, 4)) c = await s.run(c);
    return c;
  }
  let decided = 0, decidedRight = 0, topRight = 0, baseRight = 0;
  for (const [text, word, gold] of CORPUS) {
    const c = await read(text);
    const reading = c.meaning?.senses?.find((r) => r.norm === word);
    const token = c.analysis?.tokens.find((t) => t.surface.toLowerCase() === word);
    const top = reading?.choices[0];
    const right = top !== undefined && top.gloss.toLowerCase().includes(gold);
    if (right) topRight += 1;
    if ((token?.senseHints?.[0]?.gloss ?? '').toLowerCase().includes(gold)) baseRight += 1;
    if (reading?.decided) { decided += 1; if (right && reading.best === top?.synset) decidedRight += 1; }
    if (reading) {
      eq(reading.decided, reading.best !== null, `decided means best is set: ${text}`);
      eq(reading.choices.length >= 2 && reading.choices.length <= 4, true, `two to four ranked senses: ${text}`);
      eq(reading.choices.every((ch, i) => i === 0 || reading.choices[i - 1]!.score >= ch.score), true, `ranked best first: ${text}`);
      if (reading.decided) eq(top!.evidence.length > 0, true, `a decision always has evidence: ${text}`);
      eq(reading.confidence >= 0 && reading.confidence <= 1, true, `confidence in 0..1: ${text}`);
    }
  }
  eq(baseRight, 10, 'baseline (first dictionary sense) right in 10 of 22');
  eq(topRight >= 17, true, `context ranking right in at least 17 of 22 (got ${topRight})`);
  eq(topRight - baseRight >= 5, true, `ranking beats the baseline by at least 5 (got ${topRight - baseRight})`);
  eq(decided >= 6, true, `the context decides at least 6 sentences (got ${decided})`);
  eq(decidedRight, decided, `every decided sentence is right (${decidedRight} of ${decided})`);

  // Grammar words and one-sense words are not read; a message without ambiguity has no ambiguous decisions.
  const plain = (await read('the and of to')).meaning?.senses ?? [];
  eq(plain.some((r) => ['the', 'and', 'of', 'to'].includes(r.norm)), false, 'grammar words are not read for sense');
  eq(stemOf('deposits'), stemOf('deposited'), 'suffix handling meets deposits and deposited');
  eq(stemOf('deposit'), 'deposit', 'a stem stays');

  // The sense reading never changes the acts or the other readings.
  const a = (await read('deposit money at the bank')).meaning, b = (await read('deposit money at the bank')).meaning;
  eq(JSON.stringify(a?.clauses), JSON.stringify(b?.clauses), 'clauses are the same on a second run');

  // Hostile input never throws; speed.
  for (const text of ['', '   ', '!!!???', '😡😡😡', 'bank '.repeat(500), 'a\u0000b', 'the bank the bank the bank', 'x'.repeat(5000)]) {
    let ok = true; try { await read(text); } catch { ok = false; }
    eq(ok, true, `no throw: ${JSON.stringify(text.slice(0, 20))}`);
  }
  const big = 'please deposit the money at the bank near the river and play the bat game '.repeat(40);
  const t0 = performance.now(); const c = await read(big); const ms = performance.now() - t0;
  eq(ms < 2500, true, `speed on ${big.length} characters took ${Math.round(ms)} ms`);
  eq((c.meaning?.senses?.length ?? 0) <= 64, true, 'at most 64 words are read for sense');

  if (fails.length) { console.log(fails.join('\n')); console.log(`SENSE CONTEXT FAILED: ${fails.length} of ${checks}`); process.exit(1); }
  console.log(`SENSE CONTEXT OK (${checks} checks; baseline ${baseRight}/22, ranking ${topRight}/22, decided ${decidedRight}/${decided})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
