/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MR1 (Director): the second, looser reading of a message. Proves through the real Mind that (1) messages with several requests are cut into the right number of
 * pieces, (2) ordinary joined nouns stay ONE piece, (3) the second reading is adopted only when every piece is a sure tool match or a greeting/thanks and at
 * least one is a tool match, (4) the first reading stays when a piece would be a question or unknown, (5) the whole context follows an adopted reading.
 * Run from the repo root: tsx tests/mr1Split.test.ts
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMind } from '../src/brain/mind/pipeline';
import { createStages } from '../src/brain/mind/stages';
import { createLegacyExecutor } from '../src/brain/mind/legacy';
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
let n = 0;
const check = (ok: boolean, name: string): void => { n += 1; if (!ok) throw new Error('FAILED: ' + name); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const fb: any = { id: 'f', label: 'f', status: () => ({ id: 'f', label: 'f', ready: true, note: '' }), holdsConversation: () => false, async handle(r: any) { return { content: 'F:' + r.text, source: 'fallback' }; } };
const mind = createMind({ providers: [], fallback: fb, now: () => Date.UTC(2026, 0, 1, 12, 30), slot: createDictionarySlot(async () => dictionary) });
async function resolutionNote(text: string): Promise<string> {
  const entry = (await mind.askWithTrace({ text, place: 'chat' })).trace.entries.find((e) => e.stage === 'resolution');
  return entry ? entry.note : '';
}
const pieces = async (text: string): Promise<number> => Number(((await resolutionNote(text)).match(/^(\d+) pieces/) ?? [])[1] ?? NaN);

// (1) several requests: the MR0 corpus (8 first x 5 connectors, plus 10 three-request messages) must be 50 of 50
const FIRST = ['define serendipity', 'count words in "a b c"', 'count lines in "a b"', 'convert "hi" to uppercase', 'hello', 'thanks', 'make a qr code', 'count characters in "abc"'];
const SECOND = ['define ephemeral', 'count words in "x y"', 'convert "yo" to lowercase', 'what can you do', 'count lines in "q"', 'thanks', 'hello', 'make a qr code'];
const GLUE = [' and ', ', then ', '. ', '; ', ' also '];
for (let c = 0; c < GLUE.length; c += 1) for (let i = 0; i < FIRST.length; i += 1) {
  const text = FIRST[i]! + GLUE[c]! + SECOND[(i + c) % SECOND.length]!;
  check((await pieces(text)) === 2, `two requests are two pieces: ${JSON.stringify(text)}`);
}
const THREE = ['define serendipity, count words in "a b" and convert "hi" to uppercase', 'hello, define serendipity and count lines in "a b"', 'count words in "a b", then count lines in "a b", then define ephemeral', 'define serendipity and define ephemeral and define tranquil', 'hello and thanks and define serendipity', 'make a qr code, define serendipity, count words in "a b"', 'count words in "a b"; count lines in "a b"; count characters in "a b"'];
for (const text of THREE) check((await pieces(text)) === 3, `three requests are three pieces: ${JSON.stringify(text)}`);
check((await pieces('define serendipity and define ephemeral')) === 2, 'the case the first reading lost: define x and define y');

// (2) ordinary joined nouns and phrases stay ONE piece, and the second reading is never adopted for them
const ONE = ['salt and pepper', '5 miles and 3 feet', 'bread and butter', 'count the days and nights', 'tom and jerry', 'black and white', 'rock and roll', 'ladies and gentlemen', 'fish and chips', 'I like cats and dogs', 'red, green and blue', 'trial and error', 'tea or coffee', 'rice, beans and corn'];
for (const text of ONE) {
  const note = await resolutionNote(text);
  check(/^1 pieces/.test(note) && !note.includes('second reading adopted'), `one piece, no adoption: ${JSON.stringify(text)} -> ${note.slice(0, 60)}`);
}

// (3) a single request keeps its trace without any adoption words
const single = await resolutionNote('define serendipity');
check(/^1 pieces/.test(single) && !single.includes('second reading adopted'), 'a single request is untouched');

// (4) the gate: a piece that would be a question or nothing known keeps the FIRST reading
const GATED = ['count words in "a b" and wibble flurp quux', 'go and get tea', 'count words in "a b" and plorp "x"', 'count words in "a b" and go get tea', 'define serendipity also take tea', 'define serendipity, also make tea', 'count words in "a b", also go get tea'];
for (const text of GATED) {
  const note = await resolutionNote(text);
  check(!note.includes('second reading adopted'), `gate keeps the first reading: ${JSON.stringify(text)} -> ${note.slice(0, 80)}`);
}
check(/^1 pieces/.test(await resolutionNote('go and get tea')), 'go and get tea stays one piece');
// a comma plus also: the first reading finds one clause, the second finds two sure matches, so it is adopted
check((await pieces('count words in "a b", also count lines')) === 2, 'comma plus also is two requests');

// (5) when the second reading is adopted the WHOLE context follows it: meaning, structure and resolutions all say two pieces (real stages)
{
  const stages = createStages(createLegacyExecutor([], fb), () => Date.UTC(2026, 0, 1, 12, 30), () => 'id-1', createDictionarySlot(async () => dictionary));
  const run = async (text: string): Promise<any> => {
    let context: any = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const stage of stages) { if (stage.id === 'dialogue') break; context = await stage.run(context); }
    return context;
  };
  const adopted = await run('define serendipity and define ephemeral');
  check(adopted.meaning.clauses.length === 2 && adopted.meaning.structure.pieces.length === 2 && adopted.resolutions.length === 2, 'adopted: meaning, structure and resolutions agree on two pieces');
  const kept = await run('go and get tea');
  check(kept.meaning.clauses.length === 1 && kept.resolutions.length === 1 && kept.splitMeaning !== undefined, 'not adopted: the first reading stays, the second is only kept as an alternative');
}
// (6) when the second reading is adopted the trace says so, in plain words
check((await resolutionNote('define serendipity and define ephemeral')).includes('second reading adopted (2 requests'), 'adoption is stated in the trace');
console.log(`MR1 SPLIT TEST OK: ${n} checks`);
