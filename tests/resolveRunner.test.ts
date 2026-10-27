/**
 * B04B RESOLUTION: THE PROOF (Director, 2026-10-27). The builder reads this file and never changes it.
 * Run: node run.mjs tests/resolveRunner.test.ts   -> must end with "RESOLVE RUNNER OK".
 * Every test is built from the schemas themselves (their own concepts), never from phrases (FL13).
 */
import { ACTION_SCHEMAS } from '../src/brain/mind/schema/actionSchemas';
import * as R from '../src/brain/mind/resolve/resolve';
import { ASK_MARGIN, MAX_CANDIDATES } from '../src/brain/mind/resolve/resolveTypes';
import type { ResolveInput, Resolution } from '../src/brain/mind/resolve/resolveTypes';

let checks = 0; const failures: string[] = [];
process.on('uncaughtException', (e) => { console.error(`RESOLVE RUNNER STOPPED after ${checks} checks: ${String((e as Error)?.message ?? e)}`); for (const f of failures.slice(0, 40)) console.error('  FAIL ' + f); process.exit(1); });
function ok(c: unknown, label: string): void { checks += 1; if (!c) failures.push(label); }
const J = (v: unknown): string => JSON.stringify(v);
const r2 = (n: number): number => Math.round(n * 100) / 100;
const resolve = (R as unknown as { resolveClause: (i: ResolveInput, o?: unknown) => Resolution }).resolveClause;
ok(typeof resolve === 'function', 'resolve.ts exports resolveClause');
ok(ASK_MARGIN === 0.5 && MAX_CANDIDATES === 4, 'contract constants unchanged');

const mk = (p: Partial<ResolveInput>): ResolveInput => ({ act: 'command', polarity: 'positive', verbs: [], objects: [], names: [], provided: [], ...p });
const keyCount = new Map<string, number>();
const keysOf = (s: { actions: readonly string[]; objects: readonly string[]; names: readonly string[] }) => [...new Set([...s.actions.map((k) => 'a|' + k), ...s.objects.map((k) => 'o|' + k), ...s.names.map((k) => 'n|' + k)])];
for (const s of ACTION_SCHEMAS) for (const k of keysOf(s)) keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
const full = (s: typeof ACTION_SCHEMAS[number], act: 'command' | 'ask' = 'command'): ResolveInput => mk({ act, verbs: [...s.actions], objects: [...s.objects], names: [...s.names] });

// 1. Every schema, spoken with all its own concepts, resolves to itself with the exact score and confidence of the rule.
for (const s of ACTION_SCHEMAS) {
  const act = s.acts.includes('command') ? 'command' : 'ask';
  const r = resolve(full(s, act));
  ok(r.kind === 'match', `${s.tool}: full concepts give a match, got ${r.kind}`);
  if (r.kind !== 'match') continue;
  ok(r.tool === s.tool, `${s.tool}: matched ${r.tool}`);
  const expected = keysOf(s).reduce((t, k) => t + 1 / (keyCount.get(k) ?? 1), 0);
  const top = r.candidates[0]; const second = r.candidates[1];
  ok(top && top.tool === s.tool && Math.abs(top.score - expected) < 1e-9, `${s.tool}: score ${top?.score} expected ${expected}`);
  ok(r.confidence === r2(expected / (expected + (second?.score ?? 0) + 0.25)), `${s.tool}: confidence follows the rule`);
  ok(r.confidence > 0 && r.confidence <= 1 && typeof r.reason === 'string' && r.reason.length > 3, `${s.tool}: confidence and reason present`);
  ok(r.candidates.length >= 1 && r.candidates.length <= 4, `${s.tool}: 1 to 4 candidates`);
  ok(r.candidates.every((c, i, a) => i === 0 || a[i - 1]!.score > c.score || (a[i - 1]!.score === c.score && a[i - 1]!.tool < c.tool)), `${s.tool}: candidates sorted`);
  const required = s.slots.filter((x) => x.required);
  ok(J(r.missingSlots) === J(required.map((x) => x.name)), `${s.tool}: all required slots reported missing`);
  const r3 = resolve({ ...full(s, act), provided: required.map((x) => ({ kind: x.kind })) });
  ok(r3.kind === 'match' && r3.missingSlots.length === 0, `${s.tool}: provided values fill the required slots`);
  if (required.length > 0) {
    const r4 = resolve({ ...full(s, act), provided: required.slice(1).map((x) => ({ kind: x.kind })) });
    ok(r4.kind === 'match' && r4.missingSlots.length === 1 || required.slice(1).some((x) => x.kind === required[0]!.kind), `${s.tool}: one value short reports one missing slot`);
  }
  // 2. one unique key alone is enough
  const unique = keysOf(s).find((k) => keyCount.get(k) === 1)!;
  const g = unique[0]; const word = unique.slice(2);
  const only = resolve(mk({ act, verbs: g === 'a' ? [word] : [], objects: g === 'o' ? [word] : [], names: g === 'n' ? [word] : [] }));
  ok(only.kind === 'match' && only.tool === s.tool, `${s.tool}: its unique key alone resolves to it`);
  // 3. related words: an invented concept near the unique key resolves with LOWER confidence, never calling related for names
  if (g !== 'n') {
    let badCall = false;
    const fk = g === 'a' ? 'zzfake:v' : 'zzfake:n';
    const rel2 = (a: string, b: string): number => { if (!b.includes(':')) badCall = true; return a === fk && b === word ? 0.6 : 0; };
    const near = resolve(mk({ act, verbs: g === 'a' ? [fk] : [], objects: g === 'o' ? [fk] : [], names: ['zzname'] }), { related: rel2 });
    ok(near.kind === 'match' && near.tool === s.tool && near.confidence < only.confidence && near.confidence > 0, `${s.tool}: related concept matches with lower confidence`);
    ok(!badCall, `${s.tool}: related is never asked about names`);
    const bad = resolve(mk({ act, verbs: g === 'a' ? [fk] : [], objects: g === 'o' ? [fk] : [] }), { related: () => Number.NaN });
    ok(bad.kind === 'none', `${s.tool}: NaN similarity counts as zero`);
    const big = resolve(mk({ act, verbs: g === 'a' ? [fk] : [], objects: g === 'o' ? [fk] : [] }), { related: () => 2 });
    ok(big.kind === 'none', `${s.tool}: similarity above 1 counts as zero`);
  }
  // 4. status
  for (const st of ['unbuilt', 'left-out'] as const) { const u = resolve(full(s, act), { status: { [s.tool]: st } }); ok(u.kind === 'unavailable' && u.tool === s.tool && u.status === st, `${s.tool}: ${st} is reported as unavailable`); }
  for (const st of ['ready', 'built'] as const) { const u = resolve(full(s, act), { status: { [s.tool]: st } }); ok(u.kind === 'match', `${s.tool}: ${st} stays a match`); }
  // 5. negation never chooses
  const neg = resolve({ ...full(s, act), polarity: 'negative' });
  ok(neg.kind === 'negated' && neg.tool === s.tool, `${s.tool}: negated request names the tool but does not match`);
  // 6. acts: a tool that does not accept 'ask' is never offered for an ask
  if (!s.acts.includes('ask')) { const a = resolve(full(s, 'ask')); ok(!a.candidates.some((c) => c.tool === s.tool), `${s.tool}: not offered for a question`); }
  if (!s.acts.includes('command')) { const a = resolve(full(s, 'command')); ok(!a.candidates.some((c) => c.tool === s.tool), `${s.tool}: not offered for a request`); }
}

// 7. A key shared by several tools, alone, is a question with choices (never a silent guess).
let shared = 0;
for (const [k, n] of keyCount) {
  if (n < 2 || k[0] === 'n') continue;
  const tools = ACTION_SCHEMAS.filter((s) => keysOf(s).includes(k) && s.acts.includes('command')).map((s) => s.tool).sort();
  if (tools.length < 2) continue;
  const word = k.slice(2);
  const r = resolve(mk({ verbs: k[0] === 'a' ? [word] : [], objects: k[0] === 'o' ? [word] : [] }));
  if (r.kind === 'ask') { shared += 1; ok(r.choices.length >= 2 && r.choices.length <= 4 && r.choices.every((c) => tools.includes(c)), `${k}: choices come from the sharing tools`); ok(r.confidence < 0.5, `${k}: asking has low confidence`); }
  else ok(r.kind === 'match' && tools.includes(r.tool), `${k}: a shared key is an ask, or a match only when another weighting decides, got ${r.kind}`);
}
ok(shared > 0, 'at least one shared key produced an ask');


// 7b. Independent oracle on partial inputs (shared keys only, and growing prefixes): the kind must follow the rule exactly.
let oracleCases = 0;
for (const s of ACTION_SCHEMAS) {
  const ks = keysOf(s).filter((k) => k[0] !== 'n');
  for (const subset of [ks.filter((k) => (keyCount.get(k) ?? 0) > 1), ks.slice(0, 1), ks.slice(0, 2), ks.slice(0, 3)]) {
    if (subset.length === 0) continue;
    const inp = mk({ verbs: subset.filter((k) => k[0] === 'a').map((k) => k.slice(2)), objects: subset.filter((k) => k[0] === 'o').map((k) => k.slice(2)) });
    const scores = ACTION_SCHEMAS.filter((x) => x.acts.includes('command')).map((x) => ({ tool: x.tool, score: keysOf(x).reduce((t, k) => t + (subset.includes(k) ? 1 / (keyCount.get(k) ?? 1) : 0), 0) })).filter((c) => c.score > 1e-12).sort((a, b) => b.score - a.score || (a.tool < b.tool ? -1 : 1));
    const r = resolve(inp); oracleCases += 1;
    if (scores.length === 0) { ok(r.kind === 'none', `${s.tool}: oracle none`); continue; }
    const askExpected = scores.length > 1 && scores[0]!.score - scores[1]!.score < ASK_MARGIN - 1e-9;
    const matchExpected = !(scores.length > 1 && scores[0]!.score - scores[1]!.score < ASK_MARGIN + 1e-9) ;
    if (askExpected) ok(r.kind === 'ask' && J(r.choices) === J(scores.slice(0, 4).map((c) => c.tool)), `${s.tool}: oracle ask [${subset}] got ${r.kind}`);
    else if (matchExpected) ok(r.kind === 'match' && r.tool === scores[0]!.tool, `${s.tool}: oracle match [${subset}] got ${r.kind}`);
  }
}
ok(oracleCases > 100, 'oracle ran over many partial inputs');

// 8. nothing known, empty, hostile, not a request
for (const act of ['greet', 'thanks', 'chat', 'unknown'] as const) { const r = resolve(mk({ act, verbs: [ACTION_SCHEMAS[0]!.actions[0]!] })); ok(r.kind === 'not-a-request' && r.confidence === 0 && r.reason.length > 3, `${act}: not a request`); }
const nothing = resolve(mk({ verbs: ['zzqx:v'], objects: ['zzqy:n'], names: ['zzqz'] }));
ok(nothing.kind === 'none' && nothing.confidence === 0 && nothing.candidates.length === 0 && nothing.reason.length > 3, 'unknown concepts give none');
ok(resolve(mk({})).kind === 'none', 'empty input gives none');
let threw = false; try { const h = resolve({} as unknown as ResolveInput); ok(h.kind === 'none' || h.kind === 'not-a-request', 'missing fields give a plain answer'); } catch { threw = true; } ok(!threw, 'missing fields never throw');
threw = false; try { resolve(null as unknown as ResolveInput); } catch { threw = true; } ok(!threw, 'null input never throws');
const s0 = ACTION_SCHEMAS[0]!;
ok(J(resolve({ ...full(s0), verbs: [...s0.actions, ...s0.actions] })) === J(resolve(full(s0))), 'duplicate input concepts count once');

// 9. purity: frozen input, repeat calls, nothing changed, JSON-safe output
const frozen = Object.freeze(mk({ verbs: Object.freeze([...s0.actions]) as string[], objects: Object.freeze([...s0.objects]) as string[], names: Object.freeze([...s0.names]) as string[], provided: Object.freeze([]) as never }));
const before = J(frozen); const a1 = resolve(frozen); const a2 = resolve(frozen);
ok(J(a1) === J(a2) && J(frozen) === before, 'same input, same output, input unchanged');
ok(J(JSON.parse(J(a1))) === J(a1), 'output survives JSON');
const t0 = Date.now(); for (let i = 0; i < 500; i += 1) resolve(full(ACTION_SCHEMAS[i % ACTION_SCHEMAS.length]!)); ok(Date.now() - t0 < 2000, '500 resolutions in under 2 seconds');

if (failures.length) { console.error(`RESOLVE RUNNER FAILED: ${failures.length} of ${checks} checks`); for (const f of failures.slice(0, 60)) console.error('  FAIL ' + f); process.exit(1); }
console.log(`RESOLVE RUNNER OK (${checks} checks, 0 failures; schemas ${ACTION_SCHEMAS.length}; shared-key asks ${shared})`);
