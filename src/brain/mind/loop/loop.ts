import {
  APPROVAL_EFFECTS,
  PERMISSION_EFFECTS,
  type ActionSchema,
} from '../schema/schemaTypes.ts';

export type LoopState = Readonly<Record<string, string | number | boolean>>;
export type Task = {
  id: string;
  goal: string;
  successTest: (s: LoopState) => { done: boolean; reason: string };
  maxSteps: number;
};
export type LoopTool = {
  schema: ActionSchema;
  run: (input: Record<string, unknown>) =>
    | { ok: true; changes: Record<string, string | number | boolean> }
    | { ok: false; error: string };
};
export type PlanDecision =
  | { kind: 'step'; toolId: string; input: Record<string, unknown> }
  | { kind: 'done' }
  | { kind: 'ask'; question: string };
export type JournalEntry = Readonly<{
  n: number;
  observation: LoopState;
  decision: string;
  toolId: string;
  input: Readonly<Record<string, unknown>>;
  outcome: string;
  check: string;
}>;
export type LoopStatus =
  | 'SUCCESS' | 'BUDGET_EXHAUSTED' | 'NEEDS_OWNER' | 'REFUSED' | 'TOOL_FAILED'
  | 'NO_PROGRESS' | 'PLANNER_FAILED' | 'SUCCESS_TEST_FAILED' | 'INVALID_TASK';
export type VerifyResult = { done: boolean; reason: string };
export type Planner = (s: LoopState, journal: readonly JournalEntry[]) => PlanDecision;
export type LoopOptions = { granted: readonly string[]; now: () => number; maxMillis?: number };
export type LoopResult = {
  status: LoopStatus;
  reason: string;
  question?: string;
  steps: number;
  journal: JournalEntry[];
  finalState: LoopState;
};
export const LOOP_LIMITS = Object.freeze({ maxSteps: 50, maxJournalEntries: 200, maxStringLength: 2000, maxStateKeys: 500, maxInputKeys: 100, maxGoalLength: 10000 });

const hasLabel = (labels: string, value: string): boolean => (` ${labels} `).includes(` ${value} `);
const cut = (value: unknown): string => {
  let s: string;
  try { s = typeof value === 'string' ? value : String(value); } catch { s = '[unprintable]'; }
  return s.slice(0, LOOP_LIMITS.maxStringLength);
};
const plainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function copyState(value: unknown): Record<string, string | number | boolean> | null {
  if (!plainRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length > LOOP_LIMITS.maxStateKeys) return null;
  const out: Record<string, string | number | boolean> = Object.create(null) as Record<string, string | number | boolean>;
  for (const key of keys) {
    const v = value[key];
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null;
    if (typeof v === 'number' && !Number.isFinite(v)) return null;
    out[key.slice(0, LOOP_LIMITS.maxStringLength)] = typeof v === 'string' ? v.slice(0, LOOP_LIMITS.maxStringLength) : v;
  }
  return out;
}
function cloneInput(value: unknown): Record<string, unknown> | null {
  if (!plainRecord(value) || Object.keys(value).length > LOOP_LIMITS.maxInputKeys) return null;
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [k, v] of Object.entries(value)) {
    if (k.length > LOOP_LIMITS.maxStringLength) return null;
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) out[k] = typeof v === 'string' ? v.slice(0, LOOP_LIMITS.maxStringLength) : v;
    else return null;
  }
  return out;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}
function makeEntry(n: number, observation: Record<string, string | number | boolean>, decision: string, toolId: string, input: Record<string, unknown>, outcome: string, check: string): JournalEntry {
  return deepFreeze({ n, observation: { ...observation }, decision: cut(decision), toolId: cut(toolId), input: { ...input }, outcome: cut(outcome), check: cut(check) });
}
function result(status: LoopStatus, reason: string, steps: number, journal: JournalEntry[], state: Record<string, string | number | boolean>, question?: string): LoopResult {
  const safeJournal = journal.map((e) => makeEntry(e.n, { ...e.observation }, e.decision, e.toolId, { ...e.input }, e.outcome, e.check));
  return { status, reason: cut(reason) || 'The loop stopped without a reason.', ...(question ? { question: cut(question) } : {}), steps, journal: safeJournal, finalState: Object.freeze({ ...state }) };
}
function validSchema(schema: unknown): schema is ActionSchema {
  if (!plainRecord(schema) || typeof schema.tool !== 'string' || !schema.tool || !Array.isArray(schema.effects) || !Array.isArray(schema.preconditions) || typeof schema.undo !== 'string') return false;
  if (schema.effects.length > 64 || schema.preconditions.length > 64) return false;
  return true;
}
function hasEffect(effects: readonly unknown[], labels: string): string | undefined {
  return effects.find((e): e is string => typeof e === 'string' && hasLabel(labels, e));
}
function inputKey(toolId: string, input: Record<string, unknown>): string {
  return `${toolId}|${Object.keys(input).sort().map((k) => `${k}:${String(input[k])}`).join('|')}`;
}

export function runLoop(task: Task, planner: Planner, tools: Record<string, LoopTool>, options: LoopOptions, initialState: LoopState = {}): LoopResult {
  let state = copyState(initialState);
  if (!state) return result('INVALID_TASK', 'The starting state is invalid or too large.', 0, [], Object.create(null) as Record<string, string | number | boolean>);
  if (!plainRecord(task) || typeof task.id !== 'string' || !task.id.trim() || typeof task.goal !== 'string' || !task.goal.trim() || task.goal.length > LOOP_LIMITS.maxGoalLength || typeof task.successTest !== 'function' || !Number.isInteger(task.maxSteps) || task.maxSteps < 1 || task.maxSteps > LOOP_LIMITS.maxSteps) {
    return result('INVALID_TASK', 'The task is missing required details or has an invalid step budget.', 0, [], state);
  }
  if (typeof planner !== 'function' || !plainRecord(tools) || !plainRecord(options) || !Array.isArray(options.granted) || typeof options.now !== 'function' || (options.maxMillis !== undefined && (!Number.isFinite(options.maxMillis) || options.maxMillis < 0))) {
    return result('INVALID_TASK', 'The planner, tools, clock or loop options are invalid.', 0, [], state);
  }
  let started: number;
  try { started = options.now(); } catch { return result('INVALID_TASK', 'The injected clock failed before the loop started.', 0, [], state); }
  if (!Number.isFinite(started)) return result('INVALID_TASK', 'The injected clock returned an invalid time.', 0, [], state);
  const journal: JournalEntry[] = [];
  let steps = 0;
  let previousKey = '';
  let previousState = '';
  const stateKey = () => JSON.stringify(Object.keys(state as object).sort().map((k) => [k, (state as Record<string, unknown>)[k]]));
  const checkSuccess = (): VerifyResult | null => {
    try {
      const checked = task.successTest(Object.freeze({ ...(state as Record<string, string | number | boolean>) }));
      if (!plainRecord(checked) || typeof checked.done !== 'boolean' || typeof checked.reason !== 'string') return null;
      return { done: checked.done, reason: cut(checked.reason) };
    } catch { return null; }
  };
  while (steps < task.maxSteps && journal.length < LOOP_LIMITS.maxJournalEntries) {
    const observation = { ...(state as Record<string, string | number | boolean>) };
    const success = checkSuccess();
    if (!success) {
      journal.push(makeEntry(steps + 1, observation, 'success-test', '', {}, 'success test threw or returned invalid data', 'success test failed'));
      steps++;
      return result('SUCCESS_TEST_FAILED', 'The task success test failed.', steps, journal, state as Record<string, string | number | boolean>);
    }
    if (success.done) return result('SUCCESS', 'The task success test passed.', steps, journal, state as Record<string, string | number | boolean>);
    let current: number;
    try { current = options.now(); } catch {
      journal.push(makeEntry(steps + 1, observation, 'clock-check', '', {}, 'clock failed', 'time budget could not be checked'));
      steps++;
      return result('PLANNER_FAILED', 'The loop clock failed while checking its time budget.', steps, journal, state as Record<string, string | number | boolean>);
    }
    if (!Number.isFinite(current)) { journal.push(makeEntry(steps + 1, observation, 'clock-check', '', {}, 'clock returned invalid time', 'time budget could not be checked')); steps++; return result('PLANNER_FAILED', 'The loop clock returned an invalid time.', steps, journal, state as Record<string, string | number | boolean>); }
    if (options.maxMillis !== undefined && current - started >= options.maxMillis) {
      journal.push(makeEntry(steps + 1, observation, 'budget', '', {}, 'time budget reached', 'stopped before planning another step'));
      steps++;
      return result('BUDGET_EXHAUSTED', 'The loop reached its time budget before the success test passed.', steps, journal, state as Record<string, string | number | boolean>);
    }
    let decision: PlanDecision;
    try { decision = planner(Object.freeze({ ...observation }), Object.freeze(journal.slice())); }
    catch {
      journal.push(makeEntry(steps + 1, observation, 'planner', '', {}, 'planner threw', 'no action was run'));
      steps++;
      return result('PLANNER_FAILED', 'The planner failed while choosing the next step.', steps, journal, state as Record<string, string | number | boolean>);
    }
    if (!plainRecord(decision) || typeof decision.kind !== 'string') {
      journal.push(makeEntry(steps + 1, observation, 'invalid decision', '', {}, 'planner returned invalid data', 'no action was run'));
      steps++;
      return result('PLANNER_FAILED', 'The planner returned an invalid decision.', steps, journal, state as Record<string, string | number | boolean>);
    }
    if (decision.kind === 'ask') {
      const question = typeof decision.question === 'string' && decision.question.trim() ? cut(decision.question) : 'The planner needs the owner to clarify the next step.';
      journal.push(makeEntry(steps + 1, observation, 'ask', '', {}, 'owner input required', question));
      steps++;
      return result('NEEDS_OWNER', 'The planner asked for owner input.', steps, journal, state as Record<string, string | number | boolean>, question);
    }
    if (decision.kind === 'done') {
      journal.push(makeEntry(steps + 1, observation, 'done', '', {}, 'planner declared done', 'success test is still false'));
      steps++;
      return result('PLANNER_FAILED', 'The planner said the task was done, but the success test was false.', steps, journal, state as Record<string, string | number | boolean>);
    }
    if (decision.kind !== 'step' || typeof decision.toolId !== 'string' || !decision.toolId || !plainRecord(decision.input)) {
      journal.push(makeEntry(steps + 1, observation, 'invalid decision', '', {}, 'planner returned invalid step data', 'no action was run'));
      return result('PLANNER_FAILED', 'The planner returned an invalid step.', steps, journal, state as Record<string, string | number | boolean>);
    }
    const input = cloneInput(decision.input);
    if (!input) {
      journal.push(makeEntry(steps + 1, observation, 'invalid input', decision.toolId, {}, 'tool input is invalid or too large', 'tool was not run'));
      steps++;
      return result('REFUSED', `The loop refused invalid input for tool ${cut(decision.toolId)}.`, steps, journal, state as Record<string, string | number | boolean>);
    }
    const tool = Object.prototype.hasOwnProperty.call(tools, decision.toolId) ? tools[decision.toolId] : undefined;
    if (!tool || !plainRecord(tool) || typeof tool.run !== 'function' || !validSchema(tool.schema) || tool.schema.tool !== decision.toolId) {
      journal.push(makeEntry(steps + 1, observation, 'refused', decision.toolId, input, 'unknown or unavailable tool', 'tool was not run'));
      steps++;
      return result('REFUSED', `The loop refused unknown or unavailable tool ${cut(decision.toolId)}.`, steps, journal, state as Record<string, string | number | boolean>);
    }
    const schema = tool.schema as ActionSchema & { status?: string };
    if (schema.status === 'unbuilt' || schema.status === 'left-out') {
      journal.push(makeEntry(steps + 1, observation, 'refused', decision.toolId, input, `tool status is ${schema.status}`, 'tool was not run'));
      steps++;
      return result('REFUSED', `The loop refused ${cut(decision.toolId)} because its schema status is ${schema.status}.`, steps, journal, state as Record<string, string | number | boolean>);
    }
    const approval = hasEffect(schema.effects, APPROVAL_EFFECTS);
    const needsApprovalFirst = schema.preconditions.includes('owner-approval');
    if (approval || needsApprovalFirst || schema.undo === 'irreversible') {
      const effect = approval ?? (needsApprovalFirst ? 'owner-approval precondition' : 'irreversible action');
      const question = `May AXON run ${decision.toolId} with effect ${effect}?`;
      journal.push(makeEntry(steps + 1, observation, 'owner approval', decision.toolId, input, 'tool not run', question));
      steps++;
      return result('NEEDS_OWNER', `Tool ${cut(decision.toolId)} needs owner approval for ${cut(effect)}.`, steps, journal, state as Record<string, string | number | boolean>, question);
    }
    const permission = hasEffect(schema.effects, PERMISSION_EFFECTS);
    const permissionNeeded = permission ?? (schema.preconditions.includes('permission') ? 'a permission precondition' : undefined);
    if (permissionNeeded && !options.granted.includes('permission')) {
      const question = `Grant permission for ${decision.toolId} to use ${permissionNeeded}?`;
      journal.push(makeEntry(steps + 1, observation, 'permission required', decision.toolId, input, 'tool not run', question));
      steps++;
      return result('NEEDS_OWNER', `Tool ${cut(decision.toolId)} needs permission for ${cut(permissionNeeded)}.`, steps, journal, state as Record<string, string | number | boolean>, question);
    }
    const key = inputKey(decision.toolId, input);
    if (key === previousKey && stateKey() === previousState) {
      journal.push(makeEntry(steps + 1, observation, 'no progress', decision.toolId, input, 'same tool and input repeated without state change', 'stopped to prevent a loop'));
      steps++;
      return result('NO_PROGRESS', `Tool ${cut(decision.toolId)} repeated the same input without progress.`, steps, journal, state as Record<string, string | number | boolean>);
    }
    let outcome = '';
    let check = '';
    try {
      const ran = tool.run(Object.freeze({ ...input }));
      if (!plainRecord(ran) || typeof ran.ok !== 'boolean') throw new Error('invalid tool result');
      if (!ran.ok) {
        outcome = `tool reported failure: ${cut(ran.error)}`;
        check = 'state unchanged';
        journal.push(makeEntry(steps + 1, observation, 'step', decision.toolId, input, outcome, check));
        steps++;
        return result('TOOL_FAILED', `Tool ${cut(decision.toolId)} failed.`, steps, journal, state as Record<string, string | number | boolean>);
      }
      const changes = copyState(ran.changes);
      if (!changes) throw new Error('invalid or oversized changes');
      const next: Record<string, string | number | boolean> = { ...(state as Record<string, string | number | boolean>), ...changes };
      if (Object.keys(next).length > LOOP_LIMITS.maxStateKeys) throw new Error('state limit exceeded');
      state = next;
      outcome = 'tool succeeded';
      check = 'state changes accepted';
    } catch {
      journal.push(makeEntry(steps + 1, observation, 'step', decision.toolId, input, 'tool threw or returned invalid changes', 'state was not accepted'));
      steps++;
      return result('TOOL_FAILED', `Tool ${cut(decision.toolId)} failed while running or returning changes.`, steps, journal, state as Record<string, string | number | boolean>);
    }
    steps++;
    const post = checkSuccess();
    if (!post) {
      journal.push(makeEntry(steps, observation, 'step', decision.toolId, input, outcome, 'success test threw or returned invalid data'));
      return result('SUCCESS_TEST_FAILED', 'The task success test failed after a tool step.', steps, journal, state as Record<string, string | number | boolean>);
    }
    check = post.done ? `success test passed: ${cut(post.reason)}` : `success test not yet passed: ${cut(post.reason)}`;
    journal.push(makeEntry(steps, observation, 'step', decision.toolId, input, outcome, check));
    previousKey = key;
    previousState = stateKey();
    if (post.done) return result('SUCCESS', 'The task success test passed.', steps, journal, state as Record<string, string | number | boolean>);
  }
  return result('BUDGET_EXHAUSTED', 'The loop exhausted its step budget before the success test passed.', steps, journal, state as Record<string, string | number | boolean>);
}
