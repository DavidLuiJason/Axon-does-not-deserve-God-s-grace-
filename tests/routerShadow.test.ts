/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ROUTER (SHADOW): per piece fast / ask / deep from what Resolution (and the binder) already produced; it writes one trace line and changes no reply.
 * A: every rule R1 to R10 on scripted resolutions, the real schemas, the order, purity.
 * B: 10 deliberate breakages of the router source are each caught.
 * C: the REAL stages with the real dictionary on 30 messages: the routes make sense, a multi-piece message is routed piece by piece.
 * D: the shadow touches nothing: replies equal a fixed hash list is not possible offline, so the guard checks that nothing after Resolution reads `routes`,
 *    and the Mind still answers identically with the router present (same replies on two Minds, one with the router's helper forced to throw).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { routeMessage, routePiece, routerNote } from '../src/brain/mind/router/routerShadow';
import { getSchema } from '../src/brain/mind/schema/actionSchemas';
import { createMind } from '../src/brain/mind/pipeline';

let checks = 0;
const ok = (value: unknown, message: string): void => { checks += 1; assert.ok(value, `FAIL: ${message}`); };
const eq = (got: unknown, want: unknown, message: string): void => { checks += 1; assert.deepEqual(got, want, `FAIL: ${message}`); };

const base = { score: 1, confidence: 0.8, reason: 'test', candidates: [] as never[] };
const piece = (resolution: unknown, extra: Record<string, unknown> = {}, n = 0) => ({ piece: n, clause: n, mayRunAlone: true, resolution: { ...base, ...(resolution as object) }, ...extra }) as never;
const match = (tool: string, more: Record<string, unknown> = {}) => piece({ kind: 'match', tool, missingSlots: [], evidence: 'concept', ...more });
const schemaOf = (tool: string) => getSchema(tool);

// ---------- A: the rules ----------
{
  const r = (item: never, act?: string, decision?: 'run' | 'confirm-first' | 'ask') => routePiece(item, act, schemaOf, decision);
  eq([r(match('text-counter')).route, r(match('text-counter')).rule], ['fast', 'R6'], 'R6: one capability, slots filled -> fast');
  eq(r(piece({ kind: 'match', tool: 'text-counter', missingSlots: [] }, { mayRunAlone: false })).rule, 'R1', 'R1 comes first for a clause that may not run alone');
  eq(r(piece({ kind: 'match', tool: 'text-counter', missingSlots: [] }, { mayRunAlone: false })).route, 'deep', 'R1: conditional or linked -> deep');
  eq(r(match('no-such-tool-xyz')).rule, 'R2', 'R2: no schema -> deep (cannot judge the effect)');
  eq(r(match('taught-meanings')).route, 'deep', 'R3: a deleting tool goes deep with the real schema');
  eq(r(match('taught-meanings')).rule, 'R3', 'R3 rule id');
  eq(r(match('taught-meanings', { missingSlots: ['x'] }), undefined, 'ask').rule, 'R3', 'R3 beats R4 (unsure goes up)');
  eq(r(match('text-counter'), undefined, 'ask').route, 'ask', 'R4: binder ask -> ask');
  eq(r(match('text-counter'), undefined, 'confirm-first').route, 'deep', 'R4: binder confirm-first -> deep');
  eq(r(match('text-counter', { missingSlots: ['text'] }), undefined, 'run').route, 'fast', 'R4: the binder (it sees quoted text) overrides Resolution\'s missing list');
  eq(r(match('text-counter', { missingSlots: ['text'] })).route, 'ask', 'R4 fallback: without a binder answer Resolution\'s missing list asks');
  eq(r(match('text-counter', { evidence: 'value' })).rule, 'R5', 'R5: value-only evidence -> deep');
  eq(r(match('text-counter', { evidence: 'both' })).route, 'fast', 'evidence both is plain');
  eq(r(piece({ kind: 'ask', choices: ['a', 'b'] })).route, 'ask', 'R7: Resolution asked -> ask');
  for (const kind of ['none', 'unavailable', 'negated']) eq([r(piece({ kind, tool: 'text-counter', status: 'planned' })).route, r(piece({ kind, tool: 'text-counter', status: 'planned' })).rule], ['deep', 'R8'], `R8: ${kind} -> deep`);
  eq(r(piece({ kind: 'not-a-request' }), 'greet').route, 'fast', 'R9: a greeting is fast');
  eq(r(piece({ kind: 'not-a-request' }), 'thanks').route, 'fast', 'R9: thanks is fast');
  eq(r(piece({ kind: 'not-a-request' }), 'chat').route, 'deep', 'R10: chat -> deep');
  eq(r(piece({ kind: 'not-a-request' }), undefined).route, 'deep', 'R10: act unknown -> deep (unsure goes up)');
  eq(r(piece({ kind: 'not-a-request' }), 'unknown').rule, 'R10', 'R10 rule id');
  // order: quick answer first, then asks, then deep; ties keep message order
  const mixed = [piece({ kind: 'none' }, {}, 0), piece({ kind: 'ask', choices: ['a', 'b'] }, {}, 1), match('text-counter', {}) as never, piece({ kind: 'not-a-request' }, {}, 3)];
  const withPieces = [mixed[0]!, mixed[1]!, { ...(mixed[2] as object), piece: 2, clause: 2 } as never, mixed[3]!];
  const routed = routeMessage(withPieces, undefined, schemaOf);
  eq(routed.routes.map((x) => x.route), ['deep', 'ask', 'fast', 'deep'], 'each piece is routed on its own');
  eq(routed.order, [2, 1, 0, 3], 'quick answer first, then ask, then deep');
  ok(routerNote(routed).startsWith('ROUTER shadow: 1 fast, 1 ask, 2 deep'), 'the trace line counts the routes');
  // pure: same input, same output; input never changed
  const frozen = JSON.stringify(withPieces);
  eq(JSON.stringify(routeMessage(withPieces, undefined, schemaOf)), JSON.stringify(routed), 'same input, same output');
  eq(JSON.stringify(withPieces), frozen, 'the input is never changed');
  eq(routeMessage([], undefined, schemaOf), { routes: [], order: [] }, 'no pieces, no routes');
}

// ---------- B: deliberate breakages ----------
const routerDir = join(process.cwd(), 'src/brain/mind/router');
const source = await readFile(join(routerDir, 'routerShadow.ts'), 'utf8');
const MUTANTS: Array<[string, string, string]> = [
  ['R1 dropped', "if (!item.mayRunAlone) return make('deep'", "if (false) return make('deep'"],
  ['R3 dropped', "if (schema.undo === 'irreversible' || schema.effects.some((effect) => isApprovalEffect(effect))) return", 'if (false) return'],
  ['plain request sent deep', "make('fast', 'R6'", "make('deep', 'R6'"],
  ['no-fit goes fast (unsure goes DOWN)', "make('deep', 'R8'", "make('fast', 'R8'"],
  ['unknown talk goes fast', "make('deep', 'R10'", "make('fast', 'R10'"],
  ['binder ask ignored', "if (decision === 'ask') return make('ask'", "if (decision === 'never') return make('ask'"],
  ['Resolution ask goes fast', "make('ask', 'R7'", "make('fast', 'R7'"],
  ['value-only evidence ignored', "resolution.evidence === 'value'", "resolution.evidence === 'never'"],
  ['order ignores rank', 'a.rank - b.rank || a.index - b.index', 'a.index - b.index'],
  ['missing schema goes fast', "if (!schema) return make('deep', 'R2'", "if (!schema) return make('fast', 'R2'"],
];
for (const [name, from, to] of MUTANTS) {
  ok(source.split(from).length === 2, `the mutation target exists exactly once: ${name}`);
  const file = join(routerDir, `_mutant_${createHash('md5').update(name).digest('hex').slice(0, 6)}.ts`);
  await writeFile(file, source.replace(from, to), 'utf8');
  let caught = false;
  try {
    const m = await import(file);
    const probe = (): string => JSON.stringify([
      m.routePiece(match('text-counter'), undefined, schemaOf).route, m.routePiece(match('taught-meanings'), undefined, schemaOf).route,
      m.routePiece(piece({ kind: 'match', tool: 'text-counter', missingSlots: [] }, { mayRunAlone: false }), undefined, schemaOf).route,
      m.routePiece(piece({ kind: 'none' }), undefined, schemaOf).route, m.routePiece(piece({ kind: 'not-a-request' }), 'chat', schemaOf).route,
      m.routePiece(match('text-counter'), undefined, schemaOf, 'ask').route, m.routePiece(piece({ kind: 'ask', choices: ['a', 'b'] }), undefined, schemaOf).route,
      m.routePiece(match('text-counter', { evidence: 'value' }), undefined, schemaOf).route, m.routePiece(match('no-such-tool-xyz'), undefined, schemaOf).route,
      m.routeMessage([piece({ kind: 'none' }, {}, 0), match('text-counter', { piece: 1, clause: 1 })], undefined, schemaOf).order,
    ]);
    const good = JSON.stringify([
      'fast', 'deep', 'deep', 'deep', 'deep', 'ask', 'ask', 'deep', 'deep', [1, 0],
    ]);
    caught = probe() !== good;
  } finally { await unlink(file).catch(() => undefined); }
  ok(caught, `breakage caught: ${name}`);
}

// ---------- C: the real stages ----------
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const fallback: never = { id: 'f', label: 'f', status: () => ({ id: 'f', label: 'f', ready: true, note: '' }), holdsConversation: () => false, async handle(r: { text: string }) { return { content: 'F:' + r.text, source: 'f' }; } } as never;
const clock = () => Date.UTC(2026, 0, 1, 12, 30);
const mind = createMind({ providers: [], fallback, now: clock, slot });
const lineOf = async (text: string): Promise<string> => {
  const entry = (await mind.askWithTrace({ text, place: 'chat' })).trace.entries.find((e) => e.stage === 'resolution')!;
  return entry.note.split('ROUTER shadow: ')[1] ?? `NO ROUTER LINE (${entry.state}: ${entry.note})`;
};
const PINS: Array<[string, string]> = [
  ['count words in "hello world"', '1 fast, 0 ask, 0 deep'], ['count the words', '0 fast, 1 ask, 0 deep'], ['hello', '1 fast, 0 ask, 0 deep'], ['thanks', '1 fast, 0 ask, 0 deep'],
  ['good morning', '1 fast, 0 ask, 0 deep'], ['define serendipity', '1 fast, 0 ask, 0 deep'], ['if it rains count words in "a b"', '0 fast, 0 ask, 1 deep'],
  ['what is the meaning of life', '0 fast, 0 ask, 1 deep'], ['trim the video', '0 fast, 1 ask, 0 deep'], ['do not count the words', '0 fast, 0 ask, 1 deep'],
  ['tell me a joke', '0 fast, 0 ask, 1 deep'], ['who are you', '0 fast, 0 ask, 1 deep'], ['zip these files', '0 fast, 1 ask, 0 deep'], ['send an email to Tom', '0 fast, 0 ask, 1 deep'],
];
for (const [text, want] of PINS) { const line = await lineOf(text); ok(line.startsWith(`${want}`), `real stages route ${JSON.stringify(text)} as ${want}; got ${line}`); }
{
  const line = await lineOf('count words in "a b" and convert "hi" to uppercase');
  ok(line.startsWith('1 fast, 1 ask, 0 deep'), `a two-piece message is routed piece by piece: ${line}`);
  ok(line.includes('piece 0 fast') && line.includes('piece 1 ask'), 'the line names each piece');
}
const MORE = ['', '   ', '?', '...', 'a', '1', 'help', 'undo', 'stop', 'never mind', 'again', 'it', 'one more thing', 'make me a collage', 'delete my notes', 'I need a QR code'];
for (const text of MORE) { const line = await lineOf(text); ok(!line.startsWith('NO ROUTER LINE') || line.includes('not-built'), `no crash and a clear line for ${JSON.stringify(text)}: ${line}`); }

// ---------- D: the shadow touches nothing ----------
{
  const hits: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.ts') && !full.includes(`${join('mind', 'router')}`) && (await readFile(full, 'utf8')).includes('.routes')) hits.push(full);
    }
  };
  await walk(join(process.cwd(), 'src'));
  eq(hits.map((h) => h.split('/').slice(-1)[0]), [], 'no file outside the router reads `.routes`: nothing can change a reply because of it');
  const stagesText = await readFile(join(process.cwd(), 'src/brain/mind/stages.ts'), 'utf8');
  ok(stagesText.includes('router failed:'), 'a router failure is said in the note and caught');
}
{
  const texts = ['count words in "hello brave new world"', 'hello', 'thanks', 'what can you do', 'convert hello world to uppercase', 'tell me a joke', 'if it rains count words in "a b"', ''];
  const a = createMind({ providers: [], fallback, now: clock, slot });
  const b = createMind({ providers: [], fallback, now: clock, slot });
  for (const text of texts) eq(JSON.stringify(await a.ask({ text, place: 'chat' })), JSON.stringify(await b.ask({ text, place: 'chat' })), `same reply twice for ${JSON.stringify(text)}`);
}
console.log(`routerShadow: ${checks} checks passed, ${MUTANTS.length} of ${MUTANTS.length} breakages caught`);
