/**
 * B03B3c GLUE (Director test, 2026-10-25). Real pipeline, real dictionary. The sentences are WRITTEN BY THE DIRECTOR, not collected from
 * real users. Proven here: the dictionary's sense groups give the tone reading its word facts (strong and mild urgency, anger, curses),
 * the quarter rule keeps ordinary words clean ("now", "press", "get to", "dirt"), negated and quoted cues are marked as doubts, loud
 * alone is not urgent, the tone never changes the clauses, hostile input never throws, and it is fast.
 * Run: tsx tests/toneGlue.test.ts
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import type { MindContext } from '../src/brain/mind';
import { toneSenseFlags } from '../src/brain/mind/meaning/tone/toneSenses';

let checks = 0; const fails: string[] = [];
const eq = (g: unknown, w: unknown, l: string) => { checks += 1; if (JSON.stringify(g) !== JSON.stringify(w)) fails.push(`${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

// [message, urgency, frustration, answerStyle, aimedAtAxon]
type Row = [string, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 'normal' | 'brief' | 'calm', true | null];
const ROWS: Row[] = [
  // strong urgency
  ['this is urgent', 2, 0, 'brief', null],
  ['I need this asap', 2, 0, 'brief', null],
  ['it is an emergency', 2, 0, 'brief', null],
  ['please do it urgently', 2, 0, 'brief', null],
  // mild urgency
  ['do it immediately please', 1, 0, 'brief', null],
  ['hurry', 1, 0, 'brief', null],
  ['send it right away', 1, 0, 'brief', null],
  // ordinary messages stay neutral (the quarter rule)
  ['set a timer for 5 minutes', 0, 0, 'normal', null],
  ['what is the time now', 0, 0, 'normal', null],
  ['press the button', 0, 0, 'normal', null],
  ['get to the settings', 0, 0, 'normal', null],
  ['remove the dirt from the picture', 0, 0, 'normal', null],
  ['who is to blame for this bug', 0, 0, 'normal', null],
  ['convert the screw diagram to png', 0, 0, 'normal', null],
  ['a pinch of salt', 0, 0, 'normal', null],
  ['the bull market report', 0, 0, 'normal', null],
  // anger and frustration
  ['I am furious', 0, 2, 'calm', null],
  ['this is annoying', 0, 1, 'normal', null],
  ['I hate this', 0, 1, 'normal', null],
  ['I am so frustrated', 0, 1, 'normal', null],
  ['you are so annoying', 0, 1, 'calm', true],
  ['your answer made me livid', 0, 2, 'calm', true],
  // curses
  ['damn it', 0, 1, 'normal', null],
  ['this app is crap', 0, 1, 'normal', null],
  ['you piece of shit', 0, 1, 'calm', true],
  // loud alone is not urgent or angry
  ['SET A TIMER', 0, 0, 'brief', null],
  ['convert this now!!!', 0, 0, 'brief', null],
  // both
  ['URGENT!!! you are useless and annoying', 3, 2, 'calm', true],
  // words inside quotes are material, not tone
  ['the word "furious" has a long history', 0, 0, 'normal', null],
];
// Doubts: a negated cue is marked and does not count.
const DOUBTS: Array<[string, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, string[]]> = [
  ['it is not urgent', 0, 0, ['negated']],
  ['I am not angry', 0, 0, ['negated']],
];
// KNOWN LIMITS written down: weak flags that are false positives, and cues that are not read.
  // (also clean: 'I have a sore throat' is a dictionary phrase, 'the team was defeated' is under the quarter)
const KNOWN_FALSE_POSITIVES: Array<[string, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> = [
  ['he is sore', 0, 1],
  ['I have a sore throat', 0, 0],
  ['the team was defeated', 0, 0],
];
const KNOWN_MISSES = ['you are useless', 'I am fed up', 'I am sick of this', 'this frustrates me'];

async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join('./public/dictionary/en', p), 'utf8'), hash: sha });
  const stages = createStages({ run: async () => ({ content: '', source: 'test' }) } as never, () => 0, () => 'u', createDictionarySlot(async () => dictionary));
  async function read(text: string): Promise<MindContext> {
    let c: MindContext = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const s of stages.slice(0, 4)) c = await s.run(c);
    return c;
  }

  for (const [text, urgency, frustration, style, aimed] of ROWS) {
    const tone = (await read(text)).meaning?.tone;
    eq(tone ? [tone.urgency, tone.frustration, tone.answerStyle, tone.aimedAtAxon] : 'NO TONE', [urgency, frustration, style, aimed], `tone: ${text}`);
    eq(tone?.changesActions, false, `never changes actions: ${text}`);
  }
  for (const [text, urgency, frustration, doubts] of DOUBTS) {
    const tone = (await read(text)).meaning?.tone;
    eq(tone ? [tone.urgency, tone.frustration, ...doubts.map((d) => tone.doubts.includes(d as never))] : 'NO TONE', [urgency, frustration, ...doubts.map(() => true)], `doubt: ${text}`);
  }
  for (const [text, urgency, frustration] of KNOWN_FALSE_POSITIVES) {
    const tone = (await read(text)).meaning?.tone;
    eq(tone ? [tone.urgency, tone.frustration, tone.answerStyle] : 'NO TONE', [urgency, frustration, 'normal'], `known false positive (weak flag, answer style stays normal): ${text}`);
  }
  for (const text of KNOWN_MISSES) {
    const tone = (await read(text)).meaning?.tone;
    eq(tone ? [tone.urgency, tone.frustration] : 'NO TONE', [0, 0], `known miss (not read): ${text}`);
  }

  // The tone is only a reading: the clauses and acts of a message do not change when tone words are added.
  for (const [plain, tonal] of [['set a timer for 5 minutes', 'set a timer for 5 minutes asap'], ['convert it to png', 'convert it to png you idiot']] as const) {
    const a = (await read(plain)).meaning, b = (await read(tonal)).meaning;
    eq(a?.clauses.map((c) => c.act), b?.clauses.map((c) => c.act), `acts unchanged by tone words: ${tonal}`);
  }

  // Sense rule on its own (no dictionary): a quarter of the senses, and a phrase counts only whole.
  eq(toneSenseFlags(['oewn-00717023-s'], false), { urgent: 2, anger: 0, harsh: false }, 'urgent sense alone');
  eq(toneSenseFlags(['oewn-00049277-r', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], false).urgent, 0, 'one of eight senses is not enough');
  eq(toneSenseFlags(['oewn-00049277-r', 'a', 'b'], false).urgent, 1, 'one of three senses is enough (weak)');
  eq(toneSenseFlags(['oewn-00114629-a', 'a', 'b'], true).anger, 0, 'a phrase must be whole');
  eq(toneSenseFlags(['oewn-00115265-s'], true).anger, 2, 'a whole phrase counts');
  eq(toneSenseFlags(undefined, false), { urgent: 0, anger: 0, harsh: false }, 'no ids');
  eq(toneSenseFlags([], false), { urgent: 0, anger: 0, harsh: false }, 'empty ids');

  // Hostile input never throws; speed.
  for (const text of ['', '   ', '!!!???', '😡😡😡', '"' + 'x'.repeat(2000) + '"', 'URGENT '.repeat(500), 'a\u0000b', '\n\n\t', 'furious '.repeat(300)]) {
    let ok = true; try { await read(text); } catch { ok = false; }
    eq(ok, true, `no throw: ${JSON.stringify(text.slice(0, 20))}`);
  }
  const big = 'please convert this file now it is urgent and annoying '.repeat(120);
  const t0 = performance.now(); await read(big); const ms = performance.now() - t0;
  eq(ms < 1500, true, `speed on ${big.length} characters took ${Math.round(ms)} ms`);

  if (fails.length) { console.log(fails.join('\n')); console.log(`TONE GLUE FAILED: ${fails.length} of ${checks}`); process.exit(1); }
  console.log(`TONE GLUE OK (${checks} checks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
