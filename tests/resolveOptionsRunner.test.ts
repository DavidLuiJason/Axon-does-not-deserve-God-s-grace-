/**
 * B04B3 RESOLUTION OPTIONS: THE PROOF (Director, 2026-10-27). The builder reads this file and never changes it.
 * Run: node run.mjs tests/resolveOptionsRunner.test.ts   -> must end with "RESOLVE OPTIONS RUNNER OK".
 * The graph below is made of invented keys on purpose (FL13: closeness is proven on structure, never on remembered phrases).
 */
import { readFileSync } from 'node:fs';
import { ACTION_SCHEMAS } from '../src/brain/mind/schema/actionSchemas';
import { deriveStatus } from '../src/brain/mind/schema/schemaTypes';
import type { ToolFact } from '../src/brain/mind/schema/schemaTypes';
import * as R from '../src/brain/mind/resolve/resolve';
import * as O from '../src/brain/mind/resolve/options';
import { SYNONYM_SIMILARITY, ONE_STEP_SIMILARITY, TWO_STEP_SIMILARITY, MAX_LIST_ENTRIES } from '../src/brain/mind/resolve/optionsTypes';
import type { RelationLookup, Relations, OptionsApi } from '../src/brain/mind/resolve/optionsTypes';
import type { ResolveInput, Resolution } from '../src/brain/mind/resolve/resolveTypes';

let checks = 0; const failures: string[] = [];
process.on('uncaughtException', (e) => { console.error(`RESOLVE OPTIONS RUNNER STOPPED after ${checks} checks: ${String((e as Error)?.message ?? e)}`); for (const f of failures.slice(0, 40)) console.error('  FAIL ' + f); process.exit(1); });
function ok(c: unknown, label: string): void { checks += 1; if (!c) failures.push(label); }
const J = (v: unknown): string => JSON.stringify(v);
const api = O as unknown as OptionsApi;
ok(typeof api.makeRelated === 'function' && typeof api.statusMapFrom === 'function', 'options.ts exports makeRelated and statusMapFrom');
ok(SYNONYM_SIMILARITY === 0.8 && ONE_STEP_SIMILARITY === 0.5 && TWO_STEP_SIMILARITY === 0.25 && MAX_LIST_ENTRIES === 8, 'contract constants unchanged');
const deepFreeze = <T,>(v: T): T => { if (v && typeof v === 'object') { for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k]); Object.freeze(v); } return v; };

// ---------- 1. closeness on an invented graph ----------
const G: Record<string, Relations> = {
  'aa:v': { synonyms: ['bb:v'], broader: ['cc:v'], narrower: ['dd:v'] },
  'cc:v': { synonyms: [], broader: ['ee:v'], narrower: ['aa:v', 'gg:v'] },
  'dd:v': { synonyms: [], broader: ['hh:v'], narrower: ['ff:v'] },
  'xx:v': { synonyms: ['xx:n'], broader: [], narrower: [] },
  'ss:v': { synonyms: ['tt:v'], broader: ['tt:v'], narrower: [] },
};
deepFreeze(G);
let calls = 0;
const lookup: RelationLookup = (k) => { calls += 1; return Object.prototype.hasOwnProperty.call(G, k) ? G[k] as Relations : null; };
const rel = api.makeRelated(lookup);
ok(typeof rel === 'function', 'makeRelated returns a function');
ok(api.makeRelated(lookup) !== rel, 'each call returns a NEW function');
const eq = (a: string, b: string, want: number, why: string): void => { ok(rel(a, b) === want, `${why}: related(${a}, ${b}) is ${want}, got ${rel(a, b)}`); };
eq('aa:v', 'aa:v', 1, 'identical');
eq('aa:v', 'bb:v', 0.8, 'synonym listed by the first only'); eq('bb:v', 'aa:v', 0.8, 'synonym is symmetric');
eq('aa:v', 'cc:v', 0.5, 'one step broader'); eq('cc:v', 'aa:v', 0.5, 'one step narrower (seen from the parent)');
eq('aa:v', 'dd:v', 0.5, 'one step narrower'); eq('dd:v', 'aa:v', 0.5, 'one step broader (seen from the child)');
eq('aa:v', 'ee:v', 0.25, 'two steps broader'); eq('ee:v', 'aa:v', 0.25, 'two steps narrower, symmetric');
eq('aa:v', 'ff:v', 0.25, 'two steps narrower'); eq('ff:v', 'aa:v', 0.25, 'two steps broader, symmetric');
eq('aa:v', 'gg:v', 0, 'siblings through a shared parent are not related'); eq('gg:v', 'aa:v', 0, 'siblings, other way');
eq('aa:v', 'hh:v', 0, 'narrower then broader is not related'); eq('hh:v', 'aa:v', 0, 'broader then narrower, other way');
eq('ss:v', 'tt:v', 0.8, 'the best applicable value wins');
eq('xx:v', 'xx:n', 0, 'different parts of speech are never related, even when listed');
eq('aa:v', 'zz:v', 0, 'unknown key'); eq('zz:v', 'yy:v', 0, 'both unknown');
const nodes = [...Object.keys(G), 'bb:v', 'ee:v', 'ff:v', 'gg:v', 'hh:v', 'tt:v', 'zz:n'];
const allowed = new Set([0, 0.25, 0.5, 0.8, 1]);
for (const a of nodes) for (const b of nodes) { const v = rel(a, b); ok(allowed.has(v), `value of (${a}, ${b}) is one of the five levels`); ok(v === rel(b, a), `symmetric (${a}, ${b})`); ok(v === rel(a, b), `same answer twice (${a}, ${b})`); }
for (const a of nodes) ok(rel(a, a) === 1, `identical ${a} is 1`);

// cap of eight entries per list, and a bound on lookup calls
const wide = (k: string): Relations | null => (k === 'p0:v' ? { synonyms: Array.from({ length: 9 }, (_, i) => `q${i}:v`), broader: [], narrower: [] } : null);
const relWide = api.makeRelated(wide);
ok(relWide('p0:v', 'q7:v') === 0.8, 'the eighth entry is read');
ok(relWide('p0:v', 'q8:v') === 0, 'the ninth entry is not read');
let heavy = 0;
const bigLookup: RelationLookup = (k) => { heavy += 1; return { synonyms: Array.from({ length: 20 }, (_, i) => `${k}s${i}:v`), broader: Array.from({ length: 20 }, (_, i) => `${k}b${i}:v`), narrower: Array.from({ length: 20 }, (_, i) => `${k}n${i}:v`) }; };
const relBig = api.makeRelated(bigLookup);
heavy = 0; relBig('a1:v', 'z9:v'); ok(heavy <= 34, `lookup calls are bounded (got ${heavy}, at most 34)`);
heavy = 0; relBig('a1:v', 'a1:v'); ok(heavy <= 34, 'identical keys stay bounded');

// robustness: a throwing, null or malformed lookup, and garbage arguments
const boom = api.makeRelated(() => { throw new Error('boom'); });
ok(boom('aa:v', 'bb:v') === 0, 'a throwing lookup gives 0, no throw'); ok(boom('aa:v', 'aa:v') === 1, 'identical still 1 with a throwing lookup');
const nulls = api.makeRelated(() => null); ok(nulls('aa:v', 'bb:v') === 0, 'null lookup result gives 0');
const bad = api.makeRelated((() => ({ synonyms: 'nope', broader: [1, 2, {}], narrower: null })) as unknown as RelationLookup);
ok(bad('aa:v', 'bb:v') === 0, 'malformed relations give 0');
const odd = api.makeRelated((() => 42) as unknown as RelationLookup); ok(odd('aa:v', 'bb:v') === 0, 'a lookup returning a number gives 0');
const garbage: unknown[] = [undefined, null, 42, {}, [], '', ':', '__proto__:v', 'constructor:n', 'toString:a', NaN, true];
for (const a of garbage) for (const b of garbage) { let v: unknown; try { v = (rel as unknown as (x: unknown, y: unknown) => number)(a, b); } catch { v = 'threw'; } ok(typeof v === 'number' && allowed.has(v as number), `garbage arguments give a legal number (${J(a)}, ${J(b)})`); }
ok((rel as unknown as (x: unknown, y: unknown) => number)('', '') === 0, 'two empty strings give 0');
ok(Object.keys(G).length === 5, 'the lookup data was not changed');

// ---------- 2. status map from the real tool facts ----------
const facts = JSON.parse(readFileSync('tests/fixtures/toolFacts.json', 'utf8')) as ToolFact[];
deepFreeze(facts);
const map = api.statusMapFrom(facts);
ok(Object.isFrozen(map), 'the status map is frozen');
ok(Object.getPrototypeOf(map) === null, 'the status map has no prototype');
ok(map['constructor' as string] === undefined && map['toString' as string] === undefined && map['hasOwnProperty' as string] === undefined, 'inherited names find nothing');
ok(Object.keys(map).length === facts.length, `one entry per fact (${Object.keys(map).length} of ${facts.length})`);
for (const f of facts) ok(map[f.id] === deriveStatus(f), `status of ${f.id} equals deriveStatus`);
const count = (s: string): number => Object.values(map).filter((v) => v === s).length;
ok(count('ready') === 3 && count('built') === 37 && count('unbuilt') === 18 && count('left-out') === 5, `status counts 3 / 37 / 18 / 5, got ${count('ready')} / ${count('built')} / ${count('unbuilt')} / ${count('left-out')}`);
ok(map['text-counter'] === 'ready', 'text-counter is ready');
ok(api.statusMapFrom(facts) !== map, 'each call returns a NEW object');
const mk = (p: Record<string, unknown>): ToolFact => ({ kind: 'tool', id: 'x', name: 'X', description: 'd', group: 'g', screen: true, chat: 'not-built', leftOut: false, ...p }) as ToolFact;
const messy = api.statusMapFrom(deepFreeze([mk({ id: 'one', chat: 'available' }), mk({ id: 'one', screen: false }), mk({ id: '' }), mk({ id: 7 }), mk({ id: '__proto__' }), mk({ id: 'two', screen: false }), mk({ id: 'three', leftOut: true }), null as unknown as ToolFact]));
ok(J(Object.keys(messy).sort()) === J(['one', 'three', 'two']), `only valid ids are kept, got ${J(Object.keys(messy))}`);
ok(messy['one'] === 'ready', 'the FIRST fact of a repeated id wins');
ok(messy['two'] === 'unbuilt' && messy['three'] === 'left-out', 'derived statuses of the small cases');
for (const bad2 of [null, undefined, {}, 'text', 5]) ok(Object.keys(api.statusMapFrom(bad2 as never)).length === 0, `non-array input gives an empty map (${J(bad2)})`);

// ---------- 3. together with the real Resolution (B04B) ----------
const resolve = (R as unknown as { resolveClause: (i: ResolveInput, o?: unknown) => Resolution }).resolveClause;
const mkIn = (p: Partial<ResolveInput>): ResolveInput => ({ act: 'command', polarity: 'positive', verbs: [], objects: [], names: [], provided: [], ...p });
const fullOf = (s: typeof ACTION_SCHEMAS[number]): ResolveInput => mkIn({ act: s.acts.includes('command') ? 'command' : 'ask', verbs: [...s.actions], objects: [...s.objects], names: [...s.names] });
let unavailableSeen = 0;
for (const s of ACTION_SCHEMAS) {
  const input = fullOf(s); const plain = resolve(input); const withMap = resolve(input, { status: map });
  const st = map[s.tool];
  if (st === 'unbuilt' || st === 'left-out') { ok(withMap.kind === 'unavailable' && (withMap as { status?: string }).status === st && (withMap as { tool?: string }).tool === s.tool, `${s.tool}: ${st} tool answers "unavailable"`); unavailableSeen += 1; }
  else ok(J(withMap) === J(plain), `${s.tool}: a ready or built tool resolves exactly as without a status map`);
}
ok(unavailableSeen >= 20, `at least 20 tools were checked as unavailable (got ${unavailableSeen})`);
const first = ACTION_SCHEMAS.find((s) => s.acts.includes('command') && s.actions.length > 0);
if (first) {
  const key = first.actions[0] as string; const word = 'zzq:v';
  const near = api.makeRelated((k) => (k === word ? { synonyms: [key], broader: [], narrower: [] } : null));
  const seen: Array<[unknown, unknown, unknown]> = [];
  const spy = (a: string, b: string): number => { const v = near(a, b); seen.push([a, b, v]); return v; };
  const input = mkIn({ verbs: [word] });
  const without = resolve(input);
  ok(without.kind === 'none', 'the invented verb alone finds nothing without closeness');
  const withRel = resolve(input, { related: spy });
  ok(withRel.kind !== 'none' && withRel.kind !== 'not-a-request', `with closeness the invented synonym finds a tool, got ${withRel.kind}`);
  const owners = ACTION_SCHEMAS.filter((s) => s.acts.includes('command') && s.actions.includes(key)).map((s) => s.tool);
  ok(withRel.candidates.length > 0 && withRel.candidates.every((c) => owners.includes(c.tool)), 'every candidate owns the synonym concept');
  const top = withRel.candidates[0];
  ok(!!top && Math.abs(top.score - 0.8 / owners.length) < 1e-9, `the best score is 0.8 divided by the number of owners (${top?.score} vs ${0.8 / owners.length})`);
  ok(seen.length > 0 && seen.every(([a, b, v]) => typeof a === 'string' && typeof b === 'string' && (a as string).endsWith(':v') && (b as string).endsWith(':v') && typeof v === 'number' && (v as number) >= 0 && (v as number) <= 1), 'Resolution only asks about verb keys and always gets a number from 0 to 1');
}

if (failures.length) { console.error(`RESOLVE OPTIONS RUNNER FAILED: ${failures.length} of ${checks} checks`); for (const f of failures.slice(0, 40)) console.error('  FAIL ' + f); process.exit(1); }
console.log(`RESOLVE OPTIONS RUNNER OK: ${checks} checks`);
