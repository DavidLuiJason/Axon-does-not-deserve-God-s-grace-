/**
 * B04C0a (Director): HOW OFTEN does Resolution reach the RIGHT tool for a plain request? B04C (typed execution) cannot run a tool
 * from chat if Resolution picks the wrong one. The corpus (tests/fixtures/toolRequests.json) is clear requests, one expected tool
 * each, across the B04C families (text, numbers, time, create, files, converter). This test is a RATCHET: the count of exact
 * matches may never fall below tests/fixtures/toolRequestsBaseline.json. To raise the baseline after an improvement, run with
 * UPDATE_BASELINE=1. Failures are listed so a builder can fix the schemas (data), never the corpus.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATALOG_TOOLS } from '../src/tools/toolCatalog';
import { LEFT_OUT_TOOL_IDS } from '../src/tools/leftOutTools';
import { ABILITY_SOURCES, CHAT_ACTION_LINKS } from '../src/tools/toolFactSources';
import { listCapabilities } from '../src/capabilities';
import { registerSettingsCapability } from '../src/capabilities/registerSettings';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerEngineTools } from '../src/capabilities/registerEngineTools';
import { registerAxonSourceCapability } from '../src/capabilities/registerAxonSource';
import { registerInterfaceCaptureCapability } from '../src/capabilities/registerInterfaceCapture';
import { registerBackgroundProofCapability } from '../src/capabilities/registerBackgroundProof';
import { registerDictionaryCapability } from '../src/capabilities/registerDictionary';
import { registerPlannedCapabilities } from '../src/capabilities/registerPlanned';
import { registerTaughtMeaningsCapability } from '../src/capabilities/registerTaughtMeanings';
import { registerPlannedMediaCapabilities } from '../src/capabilities/registerPlannedMedia';
import { buildLiveFacts } from '../src/brain/mind/resolve/liveFacts';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import type { MindContext } from '../src/brain/mind';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
for (const register of [registerSettingsCapability, registerAxonToolsCapability, registerEngineTools, registerAxonSourceCapability,
  registerInterfaceCaptureCapability, registerBackgroundProofCapability, registerDictionaryCapability, registerPlannedCapabilities,
  registerTaughtMeaningsCapability, registerPlannedMediaCapabilities]) register();

interface Case { text: string; tool: string }
type Outcome = 'exact' | 'asked-with-right-choice' | 'wrong-tool' | 'none';

async function main(): Promise<void> {
  const custom = process.env.CORPUS; // a HELD-OUT corpus kept outside the repository: only scored, never ratcheted
  const corpus = JSON.parse(await readFile(custom ?? './tests/fixtures/toolRequests.json', 'utf8')) as Case[];
  const facts = JSON.parse(await readFile('./tests/fixtures/toolFacts.json', 'utf8')) as Array<{ id: string; group: string }>;
  const ids = new Set(facts.map((fact) => fact.id));
  assert(custom !== undefined || corpus.length >= 56, `the corpus holds at least 56 requests (${corpus.length})`);
  assert(new Set(corpus.map((item) => item.text)).size === corpus.length, 'no duplicate request');
  const perTool = new Map<string, number>();
  for (const item of corpus) { assert(ids.has(item.tool), `expected tool ${item.tool} exists`); perTool.set(item.tool, (perTool.get(item.tool) ?? 0) + 1); }
  for (const [tool, count] of perTool) assert(custom !== undefined || count >= 2, `tool ${tool} has at least 2 requests (${count})`);

  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
  const slot = createDictionarySlot(async () => dictionary);
  const executor = { run: async () => ({ content: 'unused', source: 'test' }) } as never;
  const stages = createStages(executor, () => Date.UTC(2026, 9, 28, 12, 0), () => 'accuracy', slot,
    () => buildLiveFacts({ catalog: CATALOG_TOOLS, capabilities: listCapabilities(), abilities: ABILITY_SOURCES, leftOut: LEFT_OUT_TOOL_IDS, chatLinks: CHAT_ACTION_LINKS }));

  const counts: Record<Outcome, number> = { exact: 0, 'asked-with-right-choice': 0, 'wrong-tool': 0, none: 0 };
  const failures: string[] = [];
  const byGroup = new Map<string, { exact: number; total: number }>();
  const groupOf = new Map(facts.map((fact) => [fact.id, fact.group]));
  for (const item of corpus) {
    let context: MindContext = { utterance: { id: 'a', text: item.text, place: 'chat', at: 0 }, entries: [] };
    for (const stage of stages) context = await stage.run(context);
    const found = (context.resolutions ?? []).map((entry) => entry.resolution);
    let outcome: Outcome = 'none';
    let seen = 'nothing';
    for (const resolution of found) {
      if ((resolution.kind === 'match' || resolution.kind === 'unavailable') && resolution.tool === item.tool) { outcome = 'exact'; seen = resolution.tool; break; }
    }
    if (outcome !== 'exact') {
      for (const resolution of found) {
        if (resolution.kind === 'ask' && resolution.choices.includes(item.tool)) { outcome = 'asked-with-right-choice'; seen = `ask ${resolution.choices.join('|')}`; break; }
      }
    }
    if (outcome === 'none') {
      const wrong = found.find((resolution) => resolution.kind === 'match' || resolution.kind === 'unavailable' || resolution.kind === 'ask');
      if (wrong) { outcome = 'wrong-tool'; seen = wrong.kind === 'ask' ? `ask ${wrong.choices.join('|')}` : `${wrong.kind} ${wrong.tool}`; }
    }
    counts[outcome] += 1;
    const group = groupOf.get(item.tool) ?? 'unknown';
    const entry = byGroup.get(group) ?? { exact: 0, total: 0 };
    entry.total += 1; if (outcome === 'exact') entry.exact += 1; byGroup.set(group, entry);
    if (outcome !== 'exact') failures.push(`  ${outcome.padEnd(24)} expected ${item.tool.padEnd(19)} got ${seen.padEnd(52)} | ${item.text}`);
  }
  console.log(`TOOL REQUEST ACCURACY: exact ${counts.exact}/${corpus.length}; asked with the right choice ${counts['asked-with-right-choice']}; wrong tool ${counts['wrong-tool']}; nothing ${counts.none}`);
  for (const [group, entry] of byGroup) console.log(`  ${group.padEnd(20)} ${entry.exact}/${entry.total}`);
  if (process.env.SHOW_FAILURES === '1') console.log(failures.join('\n'));

  if (custom !== undefined) { console.log(`HELD-OUT SCORE: exact ${counts.exact}/${corpus.length} (no ratchet on a held-out corpus)`); return; }
  const baselinePath = './tests/fixtures/toolRequestsBaseline.json';
  if (process.env.UPDATE_BASELINE === '1') {
    await writeFile(baselinePath, `${JSON.stringify({ exact: counts.exact, total: corpus.length }, null, 1)}\n`, 'utf8');
    console.log(`baseline written: ${counts.exact}/${corpus.length}`);
  }
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as { exact: number; total: number };
  assert(baseline.total === corpus.length, `the baseline was made for ${baseline.total} requests, the corpus has ${corpus.length}: rerun with UPDATE_BASELINE=1`);
  assert(counts.exact >= baseline.exact, `accuracy fell: ${counts.exact} exact, the baseline is ${baseline.exact}`);
  console.log(`TOOL REQUEST ACCURACY OK: ${checks} checks (ratchet at ${baseline.exact}/${baseline.total})`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
