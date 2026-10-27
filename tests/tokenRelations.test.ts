/** B04B3 GLUE (Director, 2026-10-27): synonyms of the message's own words reach Resolution; the legacy reply never changes. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import { relationLookupFromTokens } from '../src/brain/mind/resolve/tokenRelations';
import { makeRelated } from '../src/brain/mind/resolve/options';
import { ACTION_SCHEMAS } from '../src/brain/mind/schema/actionSchemas';
import type { MindContext, MindStage } from '../src/brain/mind';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const deepFreeze = <T,>(v: T): T => { if (v && typeof v === 'object') { for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k]); Object.freeze(v); } return v; };
async function run(stages: MindStage[], text: string): Promise<MindContext> {
  let context: MindContext = { utterance: { id: 'test', text, place: 'chat', at: 0 }, entries: [] };
  for (const stage of stages) context = await stage.run(context);
  return context;
}
async function main(): Promise<void> {
  // 1. the pure lookup, on small invented tokens (frozen: it must not change them)
  const tokens = deepFreeze([
    { lemma: 'Zork', senseHints: [{ pos: 'verb', synonyms: ['Blip', 'zork', 'two words'] }, { pos: 'noun', synonyms: ['glob'] }, { pos: 'adverb', synonyms: ['quickly'] }] },
    { lemma: 'zork', senseHints: [{ pos: 'v', synonyms: ['blip', 'snag'] }, { pos: 's', synonyms: ['odd'] }] },
    { lemma: 'plain' }, null, { lemma: 7, senseHints: 'x' },
  ]);
  const look = relationLookupFromTokens(tokens as never);
  const v = look('zork:v'); const n = look('zork:n'); const a = look('zork:a');
  assert(v !== null && JSON.stringify(v.synonyms) === JSON.stringify(['blip:v', 'two words:v', 'snag:v']), `verb synonyms, lowercased, own lemma dropped, no repeats: ${JSON.stringify(v)}`);
  assert(v !== null && v.broader.length === 0 && v.narrower.length === 0, 'broader and narrower stay empty (the shipped dictionary has none)');
  assert(n !== null && JSON.stringify(n.synonyms) === JSON.stringify(['glob:n']), 'noun synonyms only from noun senses');
  assert(a !== null && JSON.stringify(a.synonyms) === JSON.stringify(['odd:a']), 'satellite adjective counts as adjective');
  assert(look('zork:r') === null || look('zork:r')!.synonyms.length === 0, 'adverbs give nothing');
  assert(look('plain:v') === null || look('plain:v')!.synonyms.length === 0, 'a token without hints gives nothing');
  for (const bad of [undefined, null, 5, '', ':', 'zork', ':v'] as unknown[]) assert((() => { try { const r = (look as unknown as (k: unknown) => unknown)(bad); return r === null || (r as { synonyms: unknown[] }).synonyms.length === 0; } catch { return false; } })(), `hostile key does not throw: ${String(bad)}`);
  for (const bad of [undefined, null, 'text', 5, {}] as unknown[]) assert((relationLookupFromTokens(bad as never)('zork:v') ?? { synonyms: [] }).synonyms.length === 0, `hostile token list: ${String(bad)}`);
  const rel = makeRelated(look);
  assert(rel('zork:v', 'blip:v') === 0.8 && rel('blip:v', 'zork:v') === 0.8, 'a tool word listed as a synonym of a message word is 0.8 either way');
  assert(rel('zork:v', 'glob:n') === 0 && rel('zork:v', 'odd:a') === 0, 'other parts of speech stay unrelated');

  // 2. the real pipeline and dictionary
  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
  const executor = { run: async () => ({ content: 'legacy reply unchanged', source: 'test' }) } as never;
  const stages = createStages(executor, () => Date.UTC(2026, 0, 1, 12, 30), () => 'test', createDictionarySlot(async () => dictionary));
  const baseline = stages.map((stage) => stage.id === 'resolution'
    ? { id: 'resolution' as const, run: async (c: MindContext): Promise<MindContext> => ({ ...c, entries: [...c.entries, { stage: 'resolution', state: 'not-built', note: 'legacy baseline' }] }) }
    : stage);
  const owners = ACTION_SCHEMAS.filter((s) => s.actions.includes('convert:v') && s.acts.includes('command')).map((s) => s.tool);
  assert(owners.length > 0, 'some tool owns the verb convert');
  const ctx = await run(stages, 'Change 5 miles to km');
  const first = ctx.resolutions?.[0]?.resolution;
  assert(!!first && first.kind !== 'none' && first.kind !== 'not-a-request', `"change" reaches a tool through its synonym convert, got ${first?.kind}`);
  const cands = first ? first.candidates.map((c) => c.tool) : [];
  assert(cands.some((t) => owners.includes(t)), `a tool that owns convert is among the candidates: ${JSON.stringify(cands)}`);
  for (const text of ['Change 5 miles to km', 'Convert 5 miles to km', 'Set a timer for 5 minutes', 'What time is it?', 'Delete the last file', 'Tell Tom to call me', '', '?!...###']) {
    const actual = await run(stages, text); const old = await run(baseline, text);
    assert(JSON.stringify(actual.reply) === JSON.stringify(old.reply), `legacy reply unchanged: ${JSON.stringify(text)}`);
    assert(JSON.stringify(actual.frame) === JSON.stringify(old.frame), `frame unchanged: ${JSON.stringify(text)}`);
    for (const r of actual.resolutions ?? []) assert(['match', 'ask', 'none', 'not-a-request', 'negated', 'unavailable'].includes(r.resolution.kind) && r.resolution.reason.length > 0, `known kind and a reason: ${JSON.stringify(text)}`);
  }
  console.log(`TOKEN RELATIONS OK: ${checks} checks`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
