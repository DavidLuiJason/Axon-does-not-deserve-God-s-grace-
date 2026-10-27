/**
 * B04B4P2 (Director): ORACLE for the live tool facts. buildLiveFacts, fed by the real catalog, the real capability registry
 * (every register* function called) and the data files, must equal tests/fixtures/toolFacts.json, all 63 facts, field by field.
 * Then: the status map and the wiring in stages.ts (SHADOW: replies and frames byte-identical with and without status).
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
import { statusMapFrom } from '../src/brain/mind/resolve/options';
import { deriveStatus } from '../src/brain/mind/schema/schemaTypes';
import type { ToolFact } from '../src/brain/mind/schema/schemaTypes';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import type { MindContext, MindStage } from '../src/brain/mind';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

for (const register of [registerSettingsCapability, registerAxonToolsCapability, registerEngineTools, registerAxonSourceCapability,
  registerInterfaceCaptureCapability, registerBackgroundProofCapability, registerDictionaryCapability, registerPlannedCapabilities,
  registerTaughtMeaningsCapability, registerPlannedMediaCapabilities]) register();

const liveInput = () => ({ catalog: CATALOG_TOOLS, capabilities: listCapabilities(), abilities: ABILITY_SOURCES, leftOut: LEFT_OUT_TOOL_IDS, chatLinks: CHAT_ACTION_LINKS });
const FIELDS = ['kind', 'id', 'name', 'description', 'group', 'subgroup', 'screen', 'chat', 'leftOut'] as const;

async function run(stages: MindStage[], text: string): Promise<MindContext> {
  let context: MindContext = { utterance: { id: 'test', text, place: 'chat', at: 0 }, entries: [] };
  for (const stage of stages) context = await stage.run(context);
  return context;
}

async function main(): Promise<void> {
  const fixture = JSON.parse(await readFile('./tests/fixtures/toolFacts.json', 'utf8')) as ToolFact[];
  const live = buildLiveFacts(liveInput());
  assert(fixture.length === 63, 'fixture holds 63 facts');
  assert(live.length === fixture.length, `live count ${live.length} equals fixture count ${fixture.length}`);
  fixture.forEach((expected, index) => {
    const actual = live[index] as unknown as Record<string, unknown>;
    const want = expected as unknown as Record<string, unknown>;
    for (const field of FIELDS) assert(actual[field] === want[field], `fact ${index} (${String(want.id)}) field ${field}: live ${String(actual[field])} vs fixture ${String(want[field])}`);
  });
  assert(new Set(live.map((fact) => fact.id)).size === 63, 'ids are unique');
  assert(live.filter((fact) => fact.leftOut).map((fact) => fact.id).join(',') === [...LEFT_OUT_TOOL_IDS].join(','), 'exactly the five left-out ids, in order');
  assert(!LEFT_OUT_TOOL_IDS.includes('video-downloader') && !LEFT_OUT_TOOL_IDS.includes('text-to-speech'), 'Video Downloader and Text to Speech are not left out (owner, 2026-10-27)');

  // The facts do not depend on call order and do not mutate their inputs.
  const again = buildLiveFacts(liveInput());
  assert(JSON.stringify(again) === JSON.stringify(live), 'same input, same facts');
  assert(buildLiveFacts({ ...liveInput(), capabilities: [] }).every((fact) => fact.chat === 'not-built'), 'an empty registry makes every chat status not-built (loud, never silent)');

  // Status map: derived from the facts, one entry per id.
  const status = statusMapFrom(live);
  assert(Object.keys(status).length === 63, 'status map has 63 entries');
  fixture.forEach((fact) => assert(status[fact.id] === deriveStatus(fact), `status of ${fact.id}`));
  assert(status['collage-maker'] === 'left-out' && status['market-scope'] === 'left-out', 'left-out tools are left-out');
  assert(status['text-counter'] === 'ready', 'Text Counter is ready');

  // Wiring in stages.ts: SHADOW. Replies and frames are byte-identical with and without the live facts.
  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
  const slot = createDictionarySlot(async () => dictionary);
  const executor = { run: async () => ({ content: 'legacy reply unchanged', source: 'test' }) } as never;
  const clock = () => Date.UTC(2026, 0, 1, 12, 30);
  const without = createStages(executor, clock, () => 'test', slot);
  const withFacts = createStages(executor, clock, () => 'test', slot, () => buildLiveFacts(liveInput()));
  const messages = ['Convert 5 miles to km', 'Set a timer for 5 minutes', 'What time is it?', 'Open the file and convert it',
    'If it rains, set a timer for 5 minutes', 'Tell Tom to call me', 'Delete the last file', 'Send the file to me', 'Make a collage of my photos', 'Count the words in this text'];
  let unavailableSeen = 0;
  for (const text of messages) {
    const a = await run(without, text);
    const b = await run(withFacts, text);
    assert(b.entries.find((entry) => entry.stage === 'resolution')?.state === 'ran', `resolution ran with facts: ${text}`);
    assert(JSON.stringify(a.reply) === JSON.stringify(b.reply), `reply byte-identical: ${text}`);
    assert(JSON.stringify(a.frame) === JSON.stringify(b.frame), `frame identical: ${text}`);
    assert(b.resolutions?.length === a.resolutions?.length, `same number of resolutions: ${text}`);
    for (const item of b.resolutions ?? []) if (item.resolution.kind === 'unavailable') unavailableSeen += 1;
  }
  console.log(`unavailable resolutions seen with live facts: ${unavailableSeen}`);

  // A failing facts source must not break the stage (loud in the note, never a crash).
  const broken = createStages(executor, clock, () => 'test', slot, () => { throw new Error('facts broke'); });
  const c = await run(broken, 'Convert 5 miles to km');
  assert(JSON.stringify(c.reply) === JSON.stringify((await run(without, 'Convert 5 miles to km')).reply), 'broken facts source: reply unchanged');
  console.log(`LIVE FACTS OK: ${checks} checks`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
