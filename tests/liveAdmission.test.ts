/** CONNECT0: the admission gate. Every tool whose live switch is ON has every part; a mutant tool missing one part is caught by name. */
import { admissionProblems, type AdmissionFacts } from '../src/tools/runners/liveAdmission';
import { LIVE_SWITCHES, LIVE_TASKS, LIVE_CHOICES } from '../src/tools/runners/liveSwitches';
import { findRunner } from '../src/tools/runners/runnerRegistry';
import { getSchema } from '../src/brain/mind/schema/actionSchemas';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { createAxonEngine } from '../src/kernel/axonEngine';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { listChatActions } from '../src/capabilities';
import { CATALOG_TOOLS } from '../src/tools/toolCatalog';

let n = 0;
const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const quiet = console.log;
console.log = (): void => undefined;
registerAxonToolsCapability();
console.log = quiet;

const kernelIds = new Set(createAxonEngine().listActions().map((a) => a.id));
const chat = new Map(listChatActions().map((x) => [x.action.id, x.action.status]));
const onIds = Object.keys(LIVE_SWITCHES).filter((id) => LIVE_SWITCHES[id] === 'runner').sort();

function factsFor(id: string): AdmissionFacts {
  const schema = getSchema(id);
  const task = Object.prototype.hasOwnProperty.call(LIVE_TASKS, id) ? LIVE_TASKS[id]! : null;
  return {
    id,
    hasRunner: findRunner(id) !== null,
    hasSchema: schema !== null,
    hasTaskEntry: task !== null,
    kernelActionRegistered: task !== null && kernelIds.has(task.actionId),
    chatActionAvailable: chat.get('act.' + id) === 'available',
    hasLaneGuard: Object.prototype.hasOwnProperty.call(LANE_GUARDS, id),
    schemaHasChoiceSlot: schema !== null && schema.slots.some((s) => s.kind === 'choice'),
    hasLiveChoices: Object.prototype.hasOwnProperty.call(LIVE_CHOICES, id),
  };
}

check(onIds.length >= 3, 'at least the three tools that are ON are found');
for (const id of onIds) {
  const problems = admissionProblems(factsFor(id));
  check(problems.length === 0, 'tool ' + id + ' is ON and lacks: ' + problems.join(', '));
}
check(JSON.stringify(Object.keys(LIVE_TASKS).sort()) === JSON.stringify(onIds), 'the task records belong to exactly the tools that are ON');

// FL10: chat must not claim a tool that is not ON.
const catalogIds = new Set(CATALOG_TOOLS.map((t) => t.id));
for (const [actionId, status] of chat) {
  if (!actionId.startsWith('act.')) continue;
  const toolId = actionId.slice(4);
  if (catalogIds.has(toolId) && status === 'available') check(onIds.includes(toolId), 'chat claims ' + toolId + ' but its switch is not ON');
}

// Mutants: one missing part at a time is named; a tool with nothing is refused with every problem.
const full: AdmissionFacts = { id: 'x', hasRunner: true, hasSchema: true, hasTaskEntry: true, kernelActionRegistered: true, chatActionAvailable: true, hasLaneGuard: true, schemaHasChoiceSlot: true, hasLiveChoices: true };
check(admissionProblems(full).length === 0, 'a complete fake tool is admitted');
const cuts: Array<[keyof AdmissionFacts, string]> = [['hasRunner', 'no-runner'], ['hasSchema', 'no-schema-row'], ['hasTaskEntry', 'no-task-record'], ['kernelActionRegistered', 'kernel-action-not-registered'], ['chatActionAvailable', 'no-available-chat-action'], ['hasLaneGuard', 'no-lane-guard'], ['hasLiveChoices', 'no-live-choices']];
for (const [key, name] of cuts) {
  const p = admissionProblems({ ...full, [key]: false });
  check(p.length === 1 && p[0] === name, 'mutant without ' + key + ' is named ' + name);
}
check(admissionProblems({ ...full, schemaHasChoiceSlot: false, hasLiveChoices: false }).length === 0, 'live choices are not needed when the schema has no choice slot');
check(admissionProblems({ ...full, hasRunner: false, hasSchema: false, hasTaskEntry: false, kernelActionRegistered: false, chatActionAvailable: false, hasLaneGuard: false, hasLiveChoices: false }).length === 7, 'a tool with nothing lacks all seven parts');
check(admissionProblems(null as unknown as AdmissionFacts)[0] === 'bad-facts' && admissionProblems({ ...full, id: '' })[0] === 'bad-facts', 'bad input is refused, never thrown');
const before = JSON.stringify(full); admissionProblems(full);
check(JSON.stringify(full) === before, 'the facts are never changed');
console.log('liveAdmission: ' + n + ' checks passed');
