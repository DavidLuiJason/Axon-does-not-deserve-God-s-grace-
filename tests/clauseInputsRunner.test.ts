/**
 * B04B2 CLAUSE INPUTS: THE PROOF (Director, 2026-10-27). The builder reads this file and never changes it.
 * Run: node run.mjs tests/clauseInputsRunner.test.ts   -> must end with "CLAUSE INPUTS RUNNER OK".
 * The fixtures are hand-made in the exact shapes of the Meaning stage (no dictionary is needed). Nothing here is a phrase list:
 * the schema-driven part builds its words from the schemas' own concepts.
 */
import { ACTION_SCHEMAS } from '../src/brain/mind/schema/actionSchemas';
import * as M from '../src/brain/mind/resolve/clauseInputs';
import type { AdapterInput, PieceInput, PieceResolution } from '../src/brain/mind/resolve/clauseInputsTypes';

let checks = 0; const failures: string[] = [];
process.on('uncaughtException', (e) => { console.error(`CLAUSE INPUTS RUNNER STOPPED after ${checks} checks: ${String((e as Error)?.message ?? e)}`); for (const f of failures.slice(0, 40)) console.error('  FAIL ' + f); process.exit(1); });
function ok(c: unknown, label: string): void { checks += 1; if (!c) failures.push(label); }
const J = (v: unknown): string => JSON.stringify(v);
const api = M as unknown as { buildResolveInputs: (i: AdapterInput) => PieceInput[]; resolveMessage: (i: AdapterInput, o?: unknown) => PieceResolution[] };
ok(typeof api.buildResolveInputs === 'function' && typeof api.resolveMessage === 'function', 'both functions are exported');

// A text is split into words by spaces; helper builds words and tokens (lemma and part of speech given per word).
type Spec = { s: string; lemma?: string; pos?: string[] };
function make(specs: Spec[], extra: Partial<AdapterInput> = {}): AdapterInput {
  let at = 0; const words: AdapterInput['words'][number][] = []; const tokens: AdapterInput['tokens'][number][] = [];
  for (const sp of specs) { words.push({ norm: sp.s.toLowerCase(), start: at, end: at + sp.s.length }); tokens.push({ lemma: sp.lemma ?? sp.s.toLowerCase(), partsOfSpeech: sp.pos, start: at, end: at + sp.s.length }); at += sp.s.length + 1; }
  return { tokens, segments: [{ kind: 'language', start: 0, end: at }], clauses: [{ act: 'command', polarity: 'positive' }], words, values: [],
    pieces: [{ from: 0, to: specs.length, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: specs.length }, details: [] } }], ...extra };
}
const one = (i: AdapterInput): PieceInput => { const r = api.buildResolveInputs(i); ok(r.length === i.pieces.length, 'one entry per piece'); return r[0]!; };

// 1. verbs, objects, names, provided
const A = make([{ s: 'Convert', lemma: 'Convert', pos: ['verb'] }, { s: '5', pos: undefined }, { s: 'miles', lemma: 'mile', pos: ['noun'] }, { s: 'to', pos: ['preposition'] }, { s: 'KM', lemma: 'km', pos: ['noun', 'adjective'] }],
  { values: [{ kind: 'quantity', start: 8, end: 15 }, { kind: 'number', start: 8, end: 9 }, { kind: 'mystery', start: 8, end: 9 }] });
const a = one({ ...A, pieces: [{ from: 0, to: 5, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: 3 }, details: [{ marker: 'to', from: 3, to: 5 }] } }] });
ok(J(a.input.verbs) === J(['convert:v']), `verb lemma lowercased: ${J(a.input.verbs)}`);
ok(J(a.input.objects) === J(['mile:n', 'km:n', 'km:a']), `objects from object and detail spans: ${J(a.input.objects)}`);
ok(J(a.input.names) === J(['5', 'miles', 'mile', 'to', 'km']), `names (plain words, norm then lemma): ${J(a.input.names)}`);
ok(J(a.input.provided.map((p) => p.kind)) === J(['quantity', 'number']), `provided from values (ties keep input order), unknown kinds ignored: ${J(a.input.provided)}`);
ok(a.input.act === 'command' && a.input.polarity === 'positive' && a.mayRunAlone === true && a.piece === 0 && a.clause === 0, 'act, polarity, flags copied');

// 2. values: every kind, order by start, only inside the piece
const kinds: Array<[string, string[]]> = [['number', ['number']], ['percent', ['number']], ['roman', ['number']], ['quantity', ['quantity']], ['duration', ['duration']], ['date', ['date']], ['time', ['time']], ['datetime', ['date', 'time']]];
for (const [k, want] of kinds) { const i = make([{ s: 'x', pos: ['verb'] }, { s: 'yy', pos: ['noun'] }], { values: [{ kind: k, start: 2, end: 4 }] }); ok(J(one(i).input.provided.map((p) => p.kind)) === J(want), `value kind ${k}`); }
const outside = make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: ['noun'] }, { s: 'cc', pos: ['noun'] }], { values: [{ kind: 'number', start: 5, end: 7 }], pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: 2 }, details: [] } }] });
ok(one(outside).input.provided.length === 0, 'a value outside the piece is not provided');
const two = make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: ['noun'] }, { s: 'q', pos: ['verb'] }, { s: 'dd', pos: ['noun'] }], { clauses: [{ act: 'command', polarity: 'positive' }, { act: 'ask', polarity: 'negative' }], values: [{ kind: 'number', start: 7, end: 9 }],
  pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: 2 }, details: [] } }, { from: 2, to: 4, clause: 1, mayRunAlone: false, parts: { verb: 2, object: { from: 3, to: 4 }, details: [] } }] });
const t2 = api.buildResolveInputs(two);
ok(t2.length === 2 && t2[0]!.input.provided.length === 0 && t2[1]!.input.provided.length === 1, 'values go to the piece that holds them');
ok(t2[1]!.input.act === 'ask' && t2[1]!.input.polarity === 'negative' && t2[1]!.mayRunAlone === false && t2[1]!.clause === 1 && t2[1]!.piece === 1, 'second piece takes its own clause and flag');

// 3. material becomes text, merged with values by start
const mat = make([{ s: 'a', pos: ['verb'] }, { s: '"zz"', pos: undefined }, { s: 'bb', pos: ['noun'] }], { segments: [{ kind: 'language', start: 0, end: 2 }, { kind: 'material', start: 2, end: 6 }, { kind: 'language', start: 6, end: 9 }], values: [{ kind: 'number', start: 7, end: 9 }] });
ok(J(one(mat).input.provided.map((p) => p.kind)) === J(['text', 'number']), 'material text then number, by start');

// 4. acts
for (const act of ['ask', 'command', 'greet', 'thanks', 'chat', 'unknown']) ok(one(make([{ s: 'a', pos: ['verb'] }], { clauses: [{ act, polarity: 'positive' }] })).input.act === act, `act ${act} passes`);
ok(one(make([{ s: 'a', pos: ['verb'] }], { clauses: [{ act: 'banana', polarity: 'positive' }] })).input.act === 'unknown', 'a strange act becomes unknown');
ok(one(make([{ s: 'a', pos: ['verb'] }], { clauses: [] })).input.act === 'unknown', 'a missing clause gives unknown');

// 5. tokens: no token, no pos, first token wins, no duplicates
const ntok = make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: ['noun'] }], { tokens: [{ lemma: 'a', partsOfSpeech: ['verb'], start: 0, end: 1 }] });
ok(J(one(ntok).input.objects) === '[]' && J(one(ntok).input.names) === J(['bb']), 'a word with no token gives a name only');
const gap = make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: ['noun'] }, { s: 'cc', pos: ['noun'] }], { tokens: [{ lemma: 'a', partsOfSpeech: ['verb'], start: 0, end: 1 }, { lemma: 'zz', partsOfSpeech: ['noun'], start: 5, end: 7 }], pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: 0, object: { from: 1, to: 2 }, details: [] } }] });
ok(J(one(gap).input.objects) === '[]', 'a word never borrows a later token');
const dup = make([{ s: 'a', pos: ['verb'] }, { s: 'bb', lemma: 'bb', pos: ['noun', 'noun'] }, { s: 'bb', lemma: 'bb', pos: ['noun'] }]);
ok(J(one(dup).input.objects) === J(['bb:n']) && J(one(dup).input.names) === J(['bb']), 'duplicates removed');
const sym = make([{ s: 'a', pos: ['verb'] }, { s: 'e-mail', lemma: 'e-mail', pos: ['noun'] }]);
ok(J(one(sym).input.names) === '[]' && J(one(sym).input.objects) === J(['e-mail:n']), 'names keep only letters and digits');
const noVerb = make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: ['noun'] }], { pieces: [{ from: 0, to: 2, clause: 0, mayRunAlone: true, parts: { verb: null, object: { from: 1, to: 2 }, details: [] } }] });
ok(one(noVerb).input.verbs.length === 0 && one(noVerb).input.objects.length === 1, 'no verb gives no verbs');
for (const p of ['s', 'a', 'adjective', 'adj']) ok(J(one(make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: [p] }])).input.objects) === J(['bb:a']), `pos ${p} gives an adjective key`);
ok(one(make([{ s: 'a', pos: ['verb'] }, { s: 'bb', pos: ['adverb'] }])).input.objects.length === 0, 'adverbs are not objects');

// 6. hostile
const hostile: unknown[] = [null, undefined, {}, { pieces: 'x' }, { pieces: [null] }, { pieces: [{}] }, { ...A, pieces: [{ from: 9, to: 99, clause: 7, mayRunAlone: true, parts: { verb: 50, object: { from: -3, to: 99 }, details: [{ marker: 'x', from: 80, to: 90 }] } }] }, { ...A, tokens: null, words: null }];
for (const h of hostile) { let threw = false; let r: PieceInput[] = []; try { r = api.buildResolveInputs(h as AdapterInput); api.resolveMessage(h as AdapterInput); } catch { threw = true; } ok(!threw, `hostile input never throws: ${J(h)?.slice(0, 40)}`); ok(Array.isArray(r), 'hostile gives an array'); }
ok(api.buildResolveInputs({} as AdapterInput).length === 0 && api.buildResolveInputs({ pieces: [{}] } as unknown as AdapterInput).length === 1, 'pieces decide the count');
const damaged = api.buildResolveInputs({ pieces: [{}] } as unknown as AdapterInput)[0]!;
ok(damaged.input.verbs.length === 0 && damaged.input.objects.length === 0 && damaged.input.provided.length === 0 && damaged.mayRunAlone === false, 'a damaged piece gives an empty input');

// 7. purity
const frozen = JSON.parse(J(A)) as AdapterInput; const deep = (o: unknown): void => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deep(v); } }; deep(frozen);
const before = J(frozen); const r1 = api.buildResolveInputs(frozen); const r2 = api.buildResolveInputs(frozen);
ok(J(r1) === J(r2) && J(frozen) === before, 'frozen input, same output, nothing changed');

// 8. built from the schemas: the adapter output equals the expected resolver input, and the resolver gives a well-formed answer
for (const s of ACTION_SCHEMAS) {
  const verb = s.actions[0]!;
  const specs: Spec[] = [{ s: verb.split(':')[0]!, pos: ['verb'] }, ...s.objects.map((o) => ({ s: o.split(':')[0]!, pos: [o.endsWith(':a') ? 'adjective' : 'noun'] })), ...s.names.map((n) => ({ s: n, pos: ['noun'] }))];
  const input = make(specs);
  const r = api.buildResolveInputs(input)[0]!;
  const expectedObjects = [...new Set(s.objects)];
  ok(J(r.input.verbs) === J([verb]), `${s.tool}: verb`);
  ok(J(r.input.objects) === J([...new Set([...s.objects, ...s.names.map((n) => n + ':n')])]) , `${s.tool}: objects (names listed as nouns here are objects too)`);
  void expectedObjects;
  const res = api.resolveMessage(input)[0]!;
  ok(res.piece === 0 && ['match', 'ask'].includes(res.resolution.kind) && res.resolution.reason.length > 3, `${s.tool}: resolves to a match or a question, got ${res.resolution.kind}`);
}
if (failures.length) { console.error(`CLAUSE INPUTS RUNNER FAILED: ${failures.length} of ${checks} checks`); for (const f of failures.slice(0, 60)) console.error('  FAIL ' + f); process.exit(1); }
console.log(`CLAUSE INPUTS RUNNER OK (${checks} checks, 0 failures)`);
