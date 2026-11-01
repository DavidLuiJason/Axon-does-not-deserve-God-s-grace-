/**
 * MR0 (Director, 2026-11-01): how often does the real Meaning stage find the right NUMBER of pieces in a message with several requests?
 * Run from the repo root: tsx docs/director/mr0_split_measure.ts   (needs public/dictionary). Read-only measurement: it changes nothing.
 * The corpus is systematic: 8 first requests x 5 connectors (40 two-request messages) plus 10 three-request messages. Expected pieces = requests intended.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMind } from '../../src/brain/mind/pipeline';
const { Dictionary } = await import('../../src/brain/dictionary');
const { createDictionarySlot } = await import('../../src/brain/knowledge/dictionarySlot');
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const fb: any = { id: 'f', label: 'f', status: () => ({ id: 'f', label: 'f', ready: true, note: '' }), holdsConversation: () => false, async handle(r: any) { return { content: 'F:' + r.text, source: 'f' }; } };
const mind = createMind({ providers: [], fallback: fb, now: () => Date.UTC(2026, 0, 1, 12, 30), slot: createDictionarySlot(async () => dictionary) });
const FIRST = ['define serendipity', 'count words in "a b c"', 'count lines in "a b"', 'convert "hi" to uppercase', 'hello', 'thanks', 'make a qr code', 'count characters in "abc"'];
const SECOND = ['define ephemeral', 'count words in "x y"', 'convert "yo" to lowercase', 'what can you do', 'count lines in "q"', 'thanks', 'hello', 'make a qr code'];
const CONNECTORS: Array<[string, string]> = [['and', ' and '], ['then', ', then '], ['full stop', '. '], ['semicolon', '; '], ['also', ' also ']];
const cases: Array<{ text: string; want: number; connector: string }> = [];
for (const [name, glue] of CONNECTORS) FIRST.forEach((first, i) => cases.push({ text: first + glue + SECOND[(i + CONNECTORS.findIndex(([n]) => n === name)) % SECOND.length]!, want: 2, connector: name }));
const THREE = ['define serendipity, count words in "a b" and convert "hi" to uppercase', 'hello, define serendipity and count lines in "a b"', 'count words in "a b", then count lines in "a b", then define ephemeral', 'thanks. define serendipity. count words in "x"', 'define serendipity and define ephemeral and define tranquil', 'convert "a" to uppercase, convert "b" to uppercase and convert "c" to uppercase', 'hello and thanks and define serendipity', 'make a qr code, define serendipity, count words in "a b"', 'count words in "a b"; count lines in "a b"; count characters in "a b"', 'good morning. what can you do? define serendipity'];
for (const text of THREE) cases.push({ text, want: 3, connector: 'three' });
const rows: string[] = [];
const byConnector = new Map<string, { ok: number; all: number; lost: number }>();
for (const c of cases) {
  const trace = (await mind.askWithTrace({ text: c.text, place: 'chat' })).trace.entries.find((e) => e.stage === 'resolution');
  const n = Number((trace?.note.match(/^(\d+) pieces/) ?? [])[1] ?? NaN);
  const slot = byConnector.get(c.connector) ?? { ok: 0, all: 0, lost: 0 };
  slot.all += 1; if (n === c.want) slot.ok += 1; if (n < c.want) slot.lost += 1;
  byConnector.set(c.connector, slot);
  rows.push(`${n === c.want ? 'OK  ' : n < c.want ? 'LOST' : 'MORE'} want ${c.want} got ${Number.isNaN(n) ? '?' : n} | ${c.connector} | ${JSON.stringify(c.text)}${trace && trace.state !== 'ran' ? ' | ' + trace.state + ': ' + trace.note.slice(0, 60) : ''}`);
}
console.log(rows.join('\n'));
let ok = 0, all = 0, lost = 0;
for (const [name, s] of byConnector) { console.log(`SUMMARY ${name}: ${s.ok} of ${s.all} right, ${s.lost} lost a request`); ok += s.ok; all += s.all; lost += s.lost; }
console.log(`TOTAL: ${ok} of ${all} right (${Math.round((100 * ok) / all)}%), ${lost} lost at least one request`);
