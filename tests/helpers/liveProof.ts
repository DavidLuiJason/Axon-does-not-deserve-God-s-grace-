/** Director 471: the shared real-brain proof for one live tool (see tests/liveBrainFindReplace.test.ts for the long form). OFF brain against ON brain,
 * hand-made ANSWER checks, MUST-NOT (OFF and ON identical), OTHERS identical, task record, latency, and a REAL mutant: the same brain with this
 * tool's guard wide open must leak at least one MUST-NOT message (so the MUST-NOT list really tests the guard). */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAxonBrain } from '../../src/brain/index';
import { LANE_GUARDS } from '../../src/brain/mind/laneGuards';
import { LIVE_SWITCHES } from '../../src/tools/runners/liveSwitches';

export interface ProofReply { readonly content: string; readonly source: string; readonly taskId?: string }
/** returns null when the reply is right, otherwise why it is wrong */
export type AnswerCheck = (reply: ProofReply) => string | null;
export interface ProofSpec {
  readonly name: string; readonly toolId: string;
  readonly answers: ReadonlyArray<readonly [string, AnswerCheck]>;
  readonly mustNot: readonly string[]; readonly others: readonly string[];
  /** messages the OLD chat path may already answer: ON must still equal the hand truth (answers) but OFF is allowed to differ */
  readonly oldMayAnswer?: readonly string[];
}
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const norm = (value: string): string => value.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');

export async function makeSlot(): Promise<ReturnType<typeof import('../../src/brain/knowledge/dictionarySlot').createDictionarySlot>> {
  const { Dictionary } = await import('../../src/brain/dictionary');
  const { createDictionarySlot } = await import('../../src/brain/knowledge/dictionarySlot');
  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'), hash: sha });
  return createDictionarySlot(async () => dictionary);
}

export async function runLiveProof(spec: ProofSpec): Promise<void> {
  let checks = 0;
  const check = (ok: boolean, label: string): void => { checks += 1; if (!ok) throw new Error(spec.name + ' FAILED: ' + label); };
  const { Dictionary } = await import('../../src/brain/dictionary');
  const { createDictionarySlot } = await import('../../src/brain/knowledge/dictionarySlot');
  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'), hash: sha });
  const slot = createDictionarySlot(async () => dictionary);
  const off = createAxonBrain({ lane: true, slot, switches: { ...LIVE_SWITCHES, [spec.toolId]: 'legacy' as const } });
  const on = createAxonBrain({ lane: true, slot });
  const open = createAxonBrain({ lane: true, slot, guards: { ...LANE_GUARDS, [spec.toolId]: () => null } });
  const wrong: string[] = []; const leaked: string[] = []; const changed: string[] = []; const oldAnswers: string[] = [];
  let answered = 0; let noTask = 0; let kept = 0; let same = 0; let offFallback = 0; let fastest = Number.POSITIVE_INFINITY; let openLeaks = 0;
  for (const [text, verdict] of spec.answers) {
    const before = await off.askWithTrace({ text, place: 'chat' });
    const after = await on.askWithTrace({ text, place: 'chat' });
    if (before.reply.source === 'foundation' && before.reply.content.startsWith('I do not have a way to do that')) offFallback += 1; else oldAnswers.push(text + ' -> ' + before.reply.source);
    const why = after.reply.source === 'runner:' + spec.toolId ? verdict(after.reply as ProofReply) : 'source ' + after.reply.source + ' | ' + after.reply.content.slice(0, 100);
    if (why !== null) { wrong.push(text + ' => ' + why); continue; }
    answered += 1; if (after.reply.taskId === undefined) noTask += 1;
  }
  for (const text of spec.mustNot) {
    const before = await off.askWithTrace({ text, place: 'chat' });
    const after = await on.askWithTrace({ text, place: 'chat' });
    if (!after.reply.source.startsWith('runner:') && norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source) kept += 1; else leaked.push(text.slice(0, 80) + ' -> ' + after.reply.source);
    const mutant = await open.askWithTrace({ text, place: 'chat' });
    if (mutant.reply.source === 'runner:' + spec.toolId) openLeaks += 1;
  }
  for (const text of spec.others) {
    const before = await off.askWithTrace({ text, place: 'chat' });
    const after = await on.askWithTrace({ text, place: 'chat' });
    if (norm(before.reply.content) === norm(after.reply.content) && before.reply.source === after.reply.source) same += 1; else changed.push(text + ' -> ' + after.reply.source);
  }
  const hostile = spec.mustNot[spec.mustNot.length - 1] ?? '';
  for (let k = 0; k < 2; k += 1) { const t = performance.now(); await on.askWithTrace({ text: hostile, place: 'chat' }); fastest = Math.min(fastest, performance.now() - t); }
  console.log(`MEASURED ${spec.name}: answered exactly ${answered} of ${spec.answers.length}; must-not kept out ${kept} of ${spec.mustNot.length}; others identical ${same} of ${spec.others.length}; answers without task record ${noTask}; OFF used the foundation fallback for ${offFallback} of ${spec.answers.length}; slowest-case latency ${fastest.toFixed(1)} ms`);
  if (oldAnswers.length) console.log('DIFFERS FROM OLD (the old path answered these with the tool OFF): ' + JSON.stringify(oldAnswers));
  if (wrong.length) console.log('WRONG: ' + JSON.stringify(wrong));
  if (leaked.length) console.log('LEAKED: ' + JSON.stringify(leaked));
  if (changed.length) console.log('OTHERS CHANGED: ' + JSON.stringify(changed));
  check(wrong.length === 0 && answered === spec.answers.length, 'every answer is right');
  check(noTask === 0, 'every answer has a task record');
  check(leaked.length === 0 && kept === spec.mustNot.length, 'every must-not keeps the OFF reply');
  check(changed.length === 0 && same === spec.others.length, 'others are unchanged');
  check(fastest < 1500, 'hostile input under 1.5 seconds');
  check(openLeaks >= 1, 'MUTANT CAUGHT: with the guard wide open the must-not list leaks');
  console.log(`MUTANT CAUGHT: guard wide open leaks ${openLeaks} of ${spec.mustNot.length} must-not messages`);
  console.log(`${spec.name}: ${checks} checks passed`);
}
