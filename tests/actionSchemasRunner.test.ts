/**
 * B04A ACTION SCHEMAS: THE PROOF (Director, 2026-10-27). The builder reads this file and never changes it.
 * Run: node run.mjs tests/actionSchemasRunner.test.ts   -> must end with "ACTION SCHEMAS RUNNER OK".
 * Part 1 checks the DATA of every schema against the facts (completeness, closed labels, slot coverage, effects/undo/approval rules,
 * dictionary lemmas, unique anchors). Part 2 checks the LOOKUP functions. Part 3 breaks the data on purpose (mutants): every
 * break must be caught by Part 1, or the proof itself is too weak and fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import * as M from '../src/brain/mind/schema/actionSchemas';
import {
  ACT_LABELS, SLOT_KIND_LABELS, EFFECT_LABELS, PRECONDITION_LABELS, COST_TIME_LABELS, COST_MEMORY_LABELS, UNDO_LABELS,
  OBJECT_POS_LABELS, PURE_EFFECTS, APPROVAL_EFFECTS, PERMISSION_EFFECTS, DEVICE_EFFECTS, PERSISTENT_EFFECTS, slotKindsFor, deriveStatus,
} from '../src/brain/mind/schema/schemaTypes';
import type { ToolFact } from '../src/brain/mind/schema/schemaTypes';

let checks = 0; const failures: string[] = [];
process.on('uncaughtException', (e) => { console.error(`ACTION SCHEMAS RUNNER STOPPED after ${checks} checks: ${String((e as Error)?.message ?? e)}`); for (const f of failures.slice(0, 40)) console.error(' - ' + f); process.exit(1); });
function ok(cond: unknown, label: string): void { checks += 1; if (!cond) failures.push(label); }
const J = (v: unknown): string => JSON.stringify(v);
const L = (s: string): string[] => s.split(' ');
const ACTS = L(ACT_LABELS); const KINDS = L(SLOT_KIND_LABELS); const EFFECTS = L(EFFECT_LABELS); const PRE = L(PRECONDITION_LABELS);
const TIMES = L(COST_TIME_LABELS); const MEMS = L(COST_MEMORY_LABELS); const UNDOS = L(UNDO_LABELS); const OBJ_POS = L(OBJECT_POS_LABELS);
const PURE = L(PURE_EFFECTS); const APPROVAL = L(APPROVAL_EFFECTS); const PERMISSION = L(PERMISSION_EFFECTS); const DEVICE = L(DEVICE_EFFECTS); const PERSIST = L(PERSISTENT_EFFECTS);

const facts: ToolFact[] = JSON.parse(readFileSync('tests/fixtures/toolFacts.json', 'utf8'));
const lemmas: Map<string, string> | null = existsSync('tests/fixtures/lemmas.txt')
  ? new Map(readFileSync('tests/fixtures/lemmas.txt', 'utf8').split('\n').filter((l) => l !== '').map((l) => { const i = l.indexOf(' '); return [l.slice(0, i), l.slice(i + 1)] as [string, string]; }))
  : null;
if (lemmas === null) console.log('NOT RUN: dictionary lemma check (tests/fixtures/lemmas.txt is missing)');
ok(facts.length >= 60 && facts.every((f) => typeof f.id === 'string'), 'the facts file is read');

const NAME_OK = (s: string): boolean => /^[a-z][a-z0-9]*$/.test(s);
const SLOT_OK = (s: string): boolean => /^[a-z][A-Za-z0-9]*$/.test(s);
const CONCEPT_OK = (s: string): boolean => /^[a-z]+(-[a-z]+)*:[nva]$/.test(s);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const uniq = (a: string[]): boolean => new Set(a).size === a.length;
const sameKeys = (o: unknown, keys: string): boolean => typeof o === 'object' && o !== null && !Array.isArray(o) && J(Object.keys(o as object).sort()) === J(L(keys).sort());

/** PART 1: every rule about the data. Returns the problems found (empty = the data is right). */
function check(schemas: unknown, factList: ToolFact[], dict: Map<string, string> | null): string[] {
  const p: string[] = [];
  if (!Array.isArray(schemas)) return ['ACTION_SCHEMAS is not an array'];
  const ids = schemas.map((s) => (s && typeof s === 'object' ? (s as { tool?: unknown }).tool : undefined));
  const want = factList.map((f) => f.id);
  if (J(ids) !== J(want)) {
    const have = new Set(ids as unknown[]);
    for (const w of want) if (!have.has(w)) p.push(`missing schema for ${w}`);
    const wantSet = new Set(want);
    for (const i of ids) if (!wantSet.has(i as string)) p.push(`schema for an unknown tool ${String(i)}`);
    if (new Set(ids).size !== ids.length) p.push('a tool has two schemas');
    if (p.length === 0) p.push('the schemas are not in the order of toolFacts.json');
  }
  const factOf = new Map(factList.map((f) => [f.id, f]));
  const keyCount = new Map<string, number>();
  const keysOf = new Map<string, string[]>();
  for (const s0 of schemas) {
    const s = s0 as Record<string, any>;
    const id = String(s?.tool);
    const bad = (m: string): void => { p.push(`${id}: ${m}`); };
    // B04C0b-C: `values` (the primary value kinds a tool is for) is OPTIONAL; its own rules are checked by tests/valueEvidenceRunner.test.ts.
    const rest = Object.fromEntries(Object.entries(s).filter(([key]) => key !== 'values'));
    if (!sameKeys(rest, 'tool acts actions objects names slots effects preconditions cost undo')) { bad('keys are not exactly tool acts actions objects names slots effects preconditions cost undo (values is optional)'); continue; }
    const f = factOf.get(id);
    if (!f) continue;
    if (!isStrList(s.acts) || s.acts.length < 1 || s.acts.length > 2 || !uniq(s.acts) || !s.acts.every((a: string) => ACTS.includes(a))) bad('acts must be 1 or 2 different labels');
    const chk = (list: unknown, field: string, min: number, max: number, posOk: string[]): string[] => {
      if (!isStrList(list) || list.length < min || list.length > max || !uniq(list)) { bad(`${field} must be ${min} to ${max} different strings`); return []; }
      for (const c of list) {
        if (!CONCEPT_OK(c)) { bad(`${field}: "${c}" is not lemma:pos (one lowercase word, no spaces)`); continue; }
        const [lemma, pos] = c.split(':') as [string, string];
        if (!posOk.includes(pos)) bad(`${field}: "${c}" has the wrong part of speech`);
        else if (dict) { const have = dict.get(lemma); if (have === undefined || !have.includes(pos)) bad(`${field}: "${c}" is not a dictionary headword with that part of speech`); }
      }
      return list;
    };
    const actions = chk(s.actions, 'actions', 1, 4, ['v']);
    const objects = chk(s.objects, 'objects', 1, 6, OBJ_POS);
    let names: string[] = [];
    if (!isStrList(s.names) || s.names.length > 4 || !uniq(s.names)) bad('names must be 0 to 4 different strings');
    else {
      names = s.names;
      for (const n of names) { if (!NAME_OK(n)) bad(`names: "${n}" must be one lowercase word (letters, digits)`); else if (dict && dict.has(n)) bad(`names: "${n}" is a dictionary word: make it a concept`); }
    }
    keysOf.set(id, [...actions.map((a) => 'c:' + a), ...objects.map((a) => 'c:' + a), ...names.map((a) => 'n:' + a)]);
    // slots
    let slotKinds: string[] = [];
    if (!Array.isArray(s.slots) || s.slots.length > 16) bad('slots must be a list of at most 16');
    else {
      const seen = new Set<string>();
      for (const sl of s.slots as Array<Record<string, unknown>>) {
        if (!sameKeys(sl, 'name kind required')) { bad('a slot has keys other than name, kind, required (no choices, no examples)'); continue; }
        if (typeof sl.name !== 'string' || !SLOT_OK(sl.name)) bad(`slot name ${J(sl.name)} must be lowerCamelCase letters and digits`);
        else if (seen.has(sl.name)) bad(`slot ${sl.name} appears twice`); else seen.add(sl.name);
        if (typeof sl.kind !== 'string' || !KINDS.includes(sl.kind)) bad(`slot ${String(sl.name)} has the kind ${J(sl.kind)}`); else slotKinds.push(sl.kind);
        if (typeof sl.required !== 'boolean') bad(`slot ${String(sl.name)}: required must be true or false`);
      }
      for (const input of f.inputs ?? []) {
        const sl = (s.slots as Array<{ name: string; kind: string }>).find((x) => x && x.name === input.name);
        if (!sl) bad(`no slot for the registry input "${input.name}"`);
        else if (!L(slotKindsFor(input.kind)).includes(sl.kind)) bad(`slot ${input.name} is ${sl.kind} but the registry input is ${input.kind}`);
      }
    }
    // effects, preconditions, cost, undo
    const eff: string[] = isStrList(s.effects) ? s.effects : [];
    if (!isStrList(s.effects) || s.effects.length < 1 || s.effects.length > 5 || !uniq(s.effects) || !s.effects.every((e: string) => EFFECTS.includes(e))) bad('effects must be 1 to 5 different labels');
    const pre: string[] = isStrList(s.preconditions) ? s.preconditions : [];
    if (!isStrList(s.preconditions) || s.preconditions.length > 4 || !uniq(s.preconditions) || !s.preconditions.every((e: string) => PRE.includes(e))) bad('preconditions must be 0 to 4 different labels');
    if (!sameKeys(s.cost, 'time memory basis') || !TIMES.includes(s.cost.time) || !MEMS.includes(s.cost.memory)) bad('cost must be {time, memory, basis} with closed labels');
    else if (s.cost.basis !== 'estimate') bad('cost.basis must be "estimate" (nothing is measured yet)');
    if (typeof s.undo !== 'string' || !UNDOS.includes(s.undo)) { bad('undo is not a label'); continue; }
    // cross rules (the heart of the job)
    const pure = eff.length > 0 && eff.every((e) => PURE.includes(e));
    if (pure && s.undo !== 'not-needed') bad('only shows-result and reads-file: undo must be not-needed');
    if (!pure && s.undo === 'not-needed') bad('it changes something outside the answer: undo cannot be not-needed');
    if (s.undo === 'by-removal' && !eff.some((e) => e === 'writes-file' || e === 'stores-note')) bad('by-removal needs a file or note that was made');
    if (eff.some((e) => APPROVAL.includes(e)) && !pre.includes('owner-approval')) bad('sends, spends or deletes needs the precondition owner-approval (Charter: ASK)');
    if ((eff.includes('sends') || eff.includes('spends')) && s.undo !== 'irreversible') bad('sends or spends is irreversible');
    if (eff.includes('deletes') && s.undo !== 'by-tool' && s.undo !== 'irreversible') bad('deletes is by-tool (kept in a bin) or irreversible');
    if (eff.some((e) => PERMISSION.includes(e)) && !pre.includes('permission')) bad('camera, microphone or network needs the precondition permission');
    if (eff.includes('uses-network') && !pre.includes('network-on')) bad('uses-network needs the precondition network-on');
    if (eff.some((e) => DEVICE.includes(e)) && !pre.includes('device-capable')) bad('camera or microphone needs the precondition device-capable');
    if (pre.includes('network-on') && !eff.includes('uses-network')) bad('network-on without the effect uses-network');
    if (eff.includes('uses-network') && s.cost?.time === 'instant') bad('a network tool is never instant');
    if (slotKinds.includes('file') && !eff.includes('reads-file')) bad('it has a file slot but not the effect reads-file');
    if (eff.includes('reads-file') && !slotKinds.includes('file')) bad('it has the effect reads-file but no file slot');
    if (eff.some((e) => PERSIST.includes(e)) && s.undo === 'not-needed') bad('persistent effect with undo not-needed');
    for (const k of keysOf.get(id) ?? []) keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
  }
  // every schema needs one meaning key that no other schema has (otherwise routing by meaning cannot tell them apart)
  for (const [id, keys] of keysOf) if (keys.length > 0 && !keys.some((k) => keyCount.get(k) === 1)) p.push(`${id}: no concept or name of its own: every one is shared with another tool`);
  return p;
}

const schemas = M.ACTION_SCHEMAS as unknown as Array<Record<string, any>>;
const problems = check(schemas, facts, lemmas);
ok(problems.length === 0, `PART 1: ${problems.length} problem(s)\n   ` + problems.slice(0, 60).join('\n   '));
ok(schemas.length === facts.length, `one schema per fact (${schemas.length} of ${facts.length})`);

// PART 1b: the source file itself (pure, no phrases, small)
const source = readFileSync('src/brain/mind/schema/actionSchemas.ts', 'utf8');
ok(source.length <= 30000, `actionSchemas.ts is ${source.length} characters (the limit is 30,000)`);
const importLines = source.split('\n').filter((l) => l.trimStart().startsWith('import '));
ok(importLines.every((l) => l.includes("'./schemaTypes'")), 'the only import is ./schemaTypes');
for (const bannedWord of L('Math.random require( fetch( eval( localStorage setTimeout')) ok(!source.includes(bannedWord), `actionSchemas.ts must not use ${bannedWord}`);
for (const bannedWord of L('Date process performance')) ok(!new RegExp(`\\b${bannedWord}\\b`).test(source), `actionSchemas.ts must not use ${bannedWord}`);
for (const f of facts) for (const ex of f.examples ?? []) ok(!source.includes(ex), `an example phrase from the registry was copied into the schemas: ${ex}`);
ok(source.length >= 3000, 'actionSchemas.ts looks like a stub');

// PART 2: the lookup functions
function frozenDeep(v: unknown): boolean { if (typeof v !== 'object' || v === null) return true; if (!Object.isFrozen(v)) return false; return Object.values(v as object).every(frozenDeep); }
ok(Array.isArray(M.ACTION_SCHEMAS) && frozenDeep(M.ACTION_SCHEMAS), 'ACTION_SCHEMAS is deeply frozen');
for (const name of L('getSchema listSchemas schemasByConcept schemasByName')) ok(typeof (M as Record<string, unknown>)[name] === 'function', `${name} is exported`);
for (const [i, s] of schemas.entries()) {
  const g = M.getSchema(String(s.tool));
  ok(g !== null && J(g) === J(s), `getSchema(${String(s.tool)}) returns its schema`);
  ok(M.listSchemas()[i] !== undefined && J(M.listSchemas()[i]) === J(s), `listSchemas()[${i}] is in order`);
}
for (const bad of ['', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'Calculator', ' calculator', 'calculator ', 'nope'] as unknown[]) ok(M.getSchema(bad as string) === null, `getSchema(${J(bad)}) is null`);
for (const bad of [5, null, undefined, {}, [], true] as unknown[]) { ok(M.getSchema(bad as string) === null, `getSchema(${J(bad)}) is null`); ok(J(M.schemasByConcept(bad as string)) === '[]', `schemasByConcept(${J(bad)}) is []`); ok(J(M.schemasByName(bad as string)) === '[]', `schemasByName(${J(bad)}) is []`); }
const listA = M.listSchemas(); const listB = M.listSchemas();
ok(listA !== listB && listA.length === facts.length, 'listSchemas returns a new array each call');
(listA as unknown[]).pop(); (listA as unknown[]).reverse();
ok(M.listSchemas().length === facts.length && J(M.listSchemas()) === J(schemas), 'changing a returned list changes nothing');
const allConcepts = new Set<string>(); const allNames = new Set<string>();
for (const s of schemas) { for (const c of [...s.actions, ...s.objects]) allConcepts.add(c); for (const n of s.names) allNames.add(n); }
for (const c of allConcepts) {
  const expected = schemas.filter((s) => s.actions.includes(c) || s.objects.includes(c)).map((s) => s.tool);
  ok(J(M.schemasByConcept(c)) === J(expected), `schemasByConcept(${c})`);
}
for (const n of allNames) ok(J(M.schemasByName(n)) === J(schemas.filter((s) => s.names.includes(n)).map((s) => s.tool)), `schemasByName(${n})`);
for (const c of ['count:v', 'COUNT:V', 'count', 'count:', ':v', '__proto__:v', 'constructor:n', 'zzzzz:n', 'a b:n']) if (!allConcepts.has(c)) ok(J(M.schemasByConcept(c)) === '[]', `schemasByConcept(${J(c)}) finds nothing`);
for (const n of ['Json', 'JSON', '', '__proto__', 'constructor', 'nothing']) if (!allNames.has(n)) ok(J(M.schemasByName(n)) === '[]', `schemasByName(${J(n)}) finds nothing`);
const r1 = M.schemasByConcept([...allConcepts][0]!); r1.push('x');
ok(!M.schemasByConcept([...allConcepts][0]!).includes('x'), 'a returned id list is a copy');
{
  const t0 = Date.now(); const concepts = [...allConcepts]; const hostile = 'x'.repeat(100000) + ':v';
  for (let i = 0; i < 30000; i++) { M.getSchema(facts[i % facts.length]!.id); M.schemasByConcept(concepts[i % concepts.length]!); M.schemasByName('json'); }
  for (let i = 0; i < 50; i++) { M.schemasByConcept(hostile); M.getSchema(hostile); M.schemasByName(hostile); }
  const ms = Date.now() - t0;
  ok(ms < 1500, `90,000 lookups and hostile strings took ${ms} ms (limit 1,500)`);
}

// PART 3: mutants. Each one breaks a COPY of the data on purpose; the checker of Part 1 must report a problem.
const clone = (): Array<Record<string, any>> => JSON.parse(J(schemas));
const indexOf = (arr: Array<Record<string, any>>, pred: (s: Record<string, any>) => boolean): number => arr.findIndex(pred);
const withFact = (arr: Array<Record<string, any>>, pred: (f: ToolFact) => boolean): number => arr.findIndex((s) => { const f = facts.find((x) => x.id === s.tool); return f !== undefined && pred(f); });
type Mutant = { name: string; needsLemmas?: boolean; apply: (a: Array<Record<string, any>>) => boolean };
const mutants: Mutant[] = [
  { name: 'drop the first schema', apply: (a) => { a.shift(); return true; } },
  { name: 'drop the last schema', apply: (a) => { a.pop(); return true; } },
  { name: 'duplicate a schema', apply: (a) => { a.push(JSON.parse(J(a[3]))); return true; } },
  { name: 'swap two schemas', apply: (a) => { const t = a[1]; a[1] = a[2]; a[2] = t; return true; } },
  { name: 'a schema for an unknown tool', apply: (a) => { a[5]!.tool = 'no-such-tool'; return true; } },
  { name: 'an extra key (examples)', apply: (a) => { a[2]!.examples = ['count my words']; return true; } },
  { name: 'a missing key (names)', apply: (a) => { delete a[2]!.names; return true; } },
  { name: 'no acts', apply: (a) => { a[2]!.acts = []; return true; } },
  { name: 'an act that is not a label', apply: (a) => { a[2]!.acts = ['shout']; return true; } },
  { name: 'a phrase as an action', apply: (a) => { a[2]!.actions = ['count words:v']; return true; } },
  { name: 'an action that is a noun', apply: (a) => { a[2]!.actions = ['count:n']; return true; } },
  { name: 'five actions', apply: (a) => { a[2]!.actions = L('count:v tally:v total:v add:v sum:v'); return true; } },
  { name: 'an object in capitals', apply: (a) => { a[2]!.objects = ['Word:n']; return true; } },
  { name: 'an object that is not in the dictionary', needsLemmas: true, apply: (a) => { a[2]!.objects = ['zzyzx:n']; return true; } },
  { name: 'a name that is a dictionary word', needsLemmas: true, apply: (a) => { a[2]!.names = ['word']; return true; } },
  { name: 'a name in capitals', apply: (a) => { a[2]!.names = ['JSON']; return true; } },
  { name: 'a slot kind that is not a label', apply: (a) => { a[2]!.slots.push({ name: 'extra', kind: 'integer', required: false }); return true; } },
  { name: 'a slot with choices', apply: (a) => { a[2]!.slots.push({ name: 'extra', kind: 'choice', required: false, choices: ['a'] }); return true; } },
  { name: 'a slot name twice', apply: (a) => { a[2]!.slots.push({ name: 'x', kind: 'text', required: false }, { name: 'x', kind: 'text', required: false }); return true; } },
  { name: 'a registry input without a slot', apply: (a) => { const i = withFact(a, (f) => (f.inputs?.length ?? 0) > 0); if (i < 0) return false; const f = facts.find((x) => x.id === a[i]!.tool)!; a[i]!.slots = a[i]!.slots.filter((x: any) => x.name !== f.inputs![0]!.name); return true; } },
  { name: 'a file input given the kind text', apply: (a) => { const i = withFact(a, (f) => (f.inputs ?? []).some((x) => x.kind === 'file')); if (i < 0) return false; const f = facts.find((x) => x.id === a[i]!.tool)!; const nm = f.inputs!.find((x) => x.kind === 'file')!.name; a[i]!.slots.find((x: any) => x.name === nm).kind = 'text'; return true; } },
  { name: 'a yes-no input given the kind choice', apply: (a) => { const i = withFact(a, (f) => (f.inputs ?? []).some((x) => x.kind === 'yes-no')); if (i < 0) return false; const f = facts.find((x) => x.id === a[i]!.tool)!; const nm = f.inputs!.find((x) => x.kind === 'yes-no')!.name; a[i]!.slots.find((x: any) => x.name === nm).kind = 'choice'; return true; } },
  { name: 'required that is not a boolean', apply: (a) => { const i = indexOf(a, (s) => s.slots.length > 0); a[i]!.slots[0].required = 'yes'; return true; } },
  { name: 'no effects', apply: (a) => { a[2]!.effects = []; return true; } },
  { name: 'an effect that is not a label', apply: (a) => { a[2]!.effects = ['explodes']; return true; } },
  { name: 'sends added without owner-approval', apply: (a) => { const i = indexOf(a, (s) => J(s.effects) === '["shows-result"]'); a[i]!.effects.push('sends'); a[i]!.undo = 'irreversible'; return true; } },
  { name: 'a pure tool with undo by-tool', apply: (a) => { const i = indexOf(a, (s) => J(s.effects) === '["shows-result"]'); a[i]!.undo = 'by-tool'; return true; } },
  { name: 'a file-writing tool with undo not-needed', apply: (a) => { const i = indexOf(a, (s) => s.effects.includes('writes-file')); if (i < 0) return false; a[i]!.undo = 'not-needed'; return true; } },
  { name: 'by-removal on a pure tool', apply: (a) => { const i = indexOf(a, (s) => J(s.effects) === '["shows-result"]'); a[i]!.undo = 'by-removal'; return true; } },
  { name: 'by-removal when nothing was made', apply: (a) => { const i = indexOf(a, (s) => s.effects.includes('changes-setting') && !s.effects.includes('writes-file') && !s.effects.includes('stores-note')); if (i < 0) return false; a[i]!.undo = 'by-removal'; return true; } },
  { name: 'uses-network but instant', apply: (a) => { const i = indexOf(a, (s) => s.effects.includes('uses-network')); if (i < 0) return false; a[i]!.cost.time = 'instant'; return true; } },
  { name: 'uses-network without network-on', apply: (a) => { const i = indexOf(a, (s) => s.effects.includes('uses-network')); if (i < 0) return false; a[i]!.preconditions = a[i]!.preconditions.filter((x: string) => x !== 'network-on'); return true; } },
  { name: 'uses-network without permission', apply: (a) => { const i = indexOf(a, (s) => s.effects.includes('uses-network')); if (i < 0) return false; a[i]!.preconditions = a[i]!.preconditions.filter((x: string) => x !== 'permission'); return true; } },
  { name: 'a microphone tool without device-capable', apply: (a) => { const i = indexOf(a, (s) => s.effects.includes('uses-microphone')); if (i < 0) return false; a[i]!.preconditions = a[i]!.preconditions.filter((x: string) => x !== 'device-capable'); return true; } },
  { name: 'network-on without the network effect', apply: (a) => { const i = indexOf(a, (s) => J(s.effects) === '["shows-result"]'); a[i]!.preconditions = ['network-on']; return true; } },
  { name: 'cost basis measured', apply: (a) => { a[2]!.cost.basis = 'measured'; return true; } },
  { name: 'cost time that is not a label', apply: (a) => { a[2]!.cost.time = 'fast'; return true; } },
  { name: 'cost memory that is not a label', apply: (a) => { a[2]!.cost.memory = 'huge'; return true; } },
  { name: 'undo that is not a label', apply: (a) => { a[2]!.undo = 'maybe'; return true; } },
  { name: 'a file slot without reads-file', apply: (a) => { const i = indexOf(a, (s) => s.slots.some((x: any) => x.kind === 'file')); if (i < 0) return false; a[i]!.effects = a[i]!.effects.filter((x: string) => x !== 'reads-file'); if (a[i]!.effects.length === 0) a[i]!.effects = ['shows-result']; return true; } },
  { name: 'reads-file without a file slot', apply: (a) => { const i = indexOf(a, (s) => !s.slots.some((x: any) => x.kind === 'file') && J(s.effects) === '["shows-result"]'); a[i]!.effects = ['shows-result', 'reads-file']; return true; } },
  { name: 'a precondition twice', apply: (a) => { a[2]!.preconditions = ['permission', 'permission']; return true; } },
  { name: 'a tool whose every concept is shared', apply: (a) => { a[7]!.actions = [...a[8]!.actions]; a[7]!.objects = [...a[8]!.objects]; a[7]!.names = [...a[8]!.names]; return true; } },
  { name: 'two tools with the same meaning', apply: (a) => { a[9]!.actions = [...a[10]!.actions]; a[9]!.objects = [...a[10]!.objects]; a[9]!.names = [...a[10]!.names]; return true; } },
];
let killed = 0; let skipped = 0;
if (problems.length === 0) {
  for (const m of mutants) {
    if (m.needsLemmas && lemmas === null) { skipped += 1; console.log(`NOT RUN: mutant "${m.name}" needs the lemma file`); continue; }
    const copy = clone();
    let applied = false;
    try { applied = m.apply(copy); } catch { applied = false; }
    if (!applied) { skipped += 1; console.log(`NOT APPLICABLE: mutant "${m.name}"`); continue; }
    const found = check(copy, facts, lemmas);
    checks += 1;
    if (found.length === 0) failures.push(`MUTANT SURVIVED (the proof is too weak): ${m.name}`); else killed += 1;
  }
  ok(killed >= 40, `only ${killed} mutants were caught (at least 40 are required; ${skipped} not applicable)`);
} else console.log('Part 3 (mutants) not run because Part 1 reported problems');
// The statuses the Director derives from the facts exist for every tool (sanity of the contract helper).
const statuses = new Map<string, number>(); for (const f of facts) statuses.set(deriveStatus(f), (statuses.get(deriveStatus(f)) ?? 0) + 1);
ok(statuses.size >= 3, 'the facts hold at least three statuses');

if (failures.length > 0) {
  console.error(`ACTION SCHEMAS RUNNER FAILED: ${failures.length} failure(s) in ${checks} checks`);
  for (const f of failures.slice(0, 60)) console.error(' - ' + f);
  process.exit(1);
}
console.log(`tools: ${facts.length}; schemas: ${schemas.length}; statuses: ${J([...statuses])}; mutants caught: ${killed}, not applicable or not run: ${skipped}`);
console.log(`ACTION SCHEMAS RUNNER OK (${checks} checks, 0 failures)`);
