/** B04B2: real dictionary and real stages prove shadow-only Resolution wiring. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import type { MindContext, MindStage } from '../src/brain/mind';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const executor = { run: async () => ({ content: 'legacy reply unchanged', source: 'test' }) } as never;

async function run(stages: MindStage[], text: string): Promise<MindContext> {
  let context: MindContext = { utterance: { id: 'test', text, place: 'chat', at: 0 }, entries: [] };
  for (const stage of stages) context = await stage.run(context);
  return context;
}
async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
  const stages = createStages(executor, () => Date.UTC(2026, 0, 1, 12, 30), () => 'test', createDictionarySlot(async () => dictionary));
  const baseline = stages.map((stage) => stage.id === 'resolution'
    ? { id: 'resolution' as const, run: async (context: MindContext): Promise<MindContext> => ({ ...context, entries: [...context.entries, { stage: 'resolution', state: 'not-built', note: 'legacy baseline' }] }) }
    : stage);
  const messages = [
    'Convert 5 miles to km',
    'Set a timer for 5 minutes',
    'What time is it?',
    'Open the file and convert it',
    'If it rains, set a timer for 5 minutes',
    'Tell Tom to call me',
    'Delete the last file',
    'Send the file to me',
  ];
  for (const text of messages) {
    const actual = await run(stages, text);
    const old = await run(baseline, text);
    assert(actual.entries.find((entry) => entry.stage === 'resolution')?.state === 'ran', `resolution ran: ${text}`);
    const pieces = actual.meaning?.structure?.pieces ?? [];
    assert(actual.resolutions?.length === pieces.length, `one resolution per piece: ${text}`);
    for (const entry of actual.resolutions ?? []) {
      assert(['match', 'ask', 'none', 'not-a-request', 'negated', 'unavailable'].includes(entry.resolution.kind), `known resolution kind: ${text}`);
      assert(typeof entry.resolution.reason === 'string' && entry.resolution.reason.trim().length > 0, `non-empty reason: ${text}`);
    }
    assert(JSON.stringify(actual.reply) === JSON.stringify(old.reply), `legacy reply byte-equivalent as JSON: ${text}`);
    assert(JSON.stringify(actual.frame) === JSON.stringify(old.frame), `frame unchanged: ${text}`);
  }
  for (const text of ['', '?!...###']) {
    let failed = false;
    try { await run(stages, text); } catch { failed = true; }
    assert(!failed, `empty/symbol-only does not throw: ${JSON.stringify(text)}`);
  }
  console.log(`RESOLUTION STAGE OK: ${checks} checks`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
