/**
 * B04C0d-A (Director): a STATEMENT OF NEED ("I need a QR code", "I'd like to count the words") is read as a request. The corpus
 * (tests/fixtures/needCases.json) holds need statements with their plain commands and statements that must stay conversation.
 * DIFFERENTIAL rule (so nothing is tuned to a sentence): the need form gives the SAME resolution as its plain command when that is a
 * match or unavailable, and not-a-request when the plain form asks or finds nothing (contract rule 13 in resolveTypes.ts).
 * Runs the real stages and the real dictionary, like tests/toolRequestAccuracy.test.ts.
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

interface NeedCases {
  request: Array<{ text: string; plain: string; tool: string; knownPlainMiss: boolean }>;
  stayConversation: Array<{ text: string; why: string; viaRule13: boolean }>;
}

async function main(): Promise<void> {
  const cases = JSON.parse(await readFile('./tests/fixtures/needCases.json', 'utf8')) as NeedCases;
  assert(cases.request.length >= 14 && cases.stayConversation.length >= 13, 'the corpus keeps its size');
  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
  const slot = createDictionarySlot(async () => dictionary);
  const executor = { run: async () => ({ content: 'unused', source: 'test' }) } as never;
  const stages = createStages(executor, () => Date.UTC(2026, 9, 28, 12, 0), () => 'need', slot,
    () => buildLiveFacts({ catalog: CATALOG_TOOLS, capabilities: listCapabilities(), abilities: ABILITY_SOURCES, leftOut: LEFT_OUT_TOOL_IDS, chatLinks: CHAT_ACTION_LINKS }));

  async function read(text: string): Promise<{ result: string; needFlags: number; kinds: string[] }> {
    let context: MindContext = { utterance: { id: 'n', text, place: 'chat', at: 0 }, entries: [] };
    for (const stage of stages) context = await stage.run(context);
    const resolutions = (context.resolutions ?? []).map((entry) => entry.resolution);
    const result = resolutions.map((r) => (r.kind === 'ask' ? `ask:${r.choices.join('|')}` : r.kind === 'match' || r.kind === 'unavailable' ? `${r.kind}:${r.tool}` : r.kind)).join(' ; ');
    const frames = ((context.meaning as unknown as { clauses?: Array<{ need?: boolean }> } | undefined)?.clauses ?? []);
    return { result, needFlags: frames.filter((frame) => frame.need === true).length, kinds: resolutions.map((r) => r.kind) };
  }

  for (const item of cases.request) {
    const need = await read(item.text);
    const plain = await read(item.plain);
    assert(need.needFlags === 1, `"${item.text}" is read as a statement of need (${need.needFlags})`);
    assert(plain.needFlags === 0, `the plain command "${item.plain}" is not a need statement`);
    const plainPasses = plain.kinds.length === 1 && (plain.kinds[0] === 'match' || plain.kinds[0] === 'unavailable');
    if (plainPasses) assert(need.result === plain.result, `"${item.text}" gives the same as "${item.plain}": ${need.result} against ${plain.result}`);
    else assert(need.result === 'not-a-request', `"${item.text}" stays conversation when its plain form is "${plain.result}" (got ${need.result})`);
    if (!item.knownPlainMiss) assert(need.result === `match:${item.tool}`, `"${item.text}" reaches ${item.tool} (got ${need.result})`);
  }
  for (const item of cases.stayConversation) {
    const read1 = await read(item.text);
    assert(read1.kinds.every((kind) => kind === 'not-a-request'), `"${item.text}" stays conversation (${item.why}): got ${read1.result}`);
    if (!item.viaRule13) assert(read1.needFlags === 0, `"${item.text}" is not read as a need (${item.why})`);
  }
  console.log(`NEED CASES OK: ${checks} checks, ${cases.request.length} need statements, ${cases.stayConversation.length} that stay conversation`);
}
main().catch((error) => { console.error(error); process.exit(1); });
