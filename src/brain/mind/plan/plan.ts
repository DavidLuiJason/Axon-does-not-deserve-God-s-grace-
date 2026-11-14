// P04 GOAL AND PLANNER (pure). Forms a goal with a success test, validates a plan, and decides ONE next step.
// The planner never executes anything and never trusts a tool's "done": a step counts as finished only when the real state shows it.
export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type Scalar = string | number | boolean;
export type Goal = {
  readonly id: string;
  readonly statement: string;
  readonly successKey: string;
  readonly successValue: Scalar;
  readonly maxSteps: number;
  readonly constraints: readonly string[];
};
export type PlanStep = {
  readonly id: string;
  readonly toolId: string;
  readonly input: Readonly<Record<string, string | number | boolean | null>>;
  readonly needs: readonly string[];
  readonly expectKey: string;
  readonly expectValue: Scalar;
};
export type Plan = { readonly goalId: string; readonly steps: readonly PlanStep[] };
export type JournalLike = { readonly toolId: string; readonly input: Readonly<Record<string, unknown>> };
export type Decision =
  | { readonly kind: 'step'; readonly stepId: string; readonly toolId: string; readonly input: Readonly<Record<string, string | number | boolean | null>> }
  | { readonly kind: 'done' }
  | { readonly kind: 'ask'; readonly question: string };

const fail = (error: string, message: string): EngineFailure => ({ ok: false, error, message });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const isScalar = (v: unknown): v is Scalar => typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
const isStrList = (v: unknown, maxLen: number): v is readonly string[] => Array.isArray(v) && v.length <= maxLen && v.every((x) => typeof x === 'string');

export function formGoal(spec: unknown): EngineResult<Goal> {
  if (!isObj(spec)) return fail('bad-input', 'The goal must be an object.');
  const { id, statement, successKey, successValue, maxSteps, constraints } = spec;
  if (!isStr(id, 100)) return fail('bad-input', 'The goal needs a non-empty id.');
  if (!isStr(statement)) return fail('bad-input', 'The goal needs a statement.');
  if (!isStr(successKey, 200)) return fail('bad-input', 'The goal needs a success key.');
  if (!isScalar(successValue)) return fail('bad-input', 'The success value must be a string, number or boolean.');
  if (typeof maxSteps !== 'number' || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 50) return fail('bad-input', 'maxSteps must be a whole number from 1 to 50.');
  if (!isStrList(constraints, 20)) return fail('bad-input', 'constraints must be a list of at most 20 strings.');
  return { ok: true, value: { id, statement, successKey, successValue, maxSteps, constraints: [...constraints] } };
}

function stepProblem(step: unknown): string | null {
  if (!isObj(step)) return 'a step is not an object';
  if (!isStr(step.id, 100) || !isStr(step.toolId, 200) || !isStr(step.expectKey, 200)) return 'a step needs id, toolId and expectKey';
  if (!isScalar(step.expectValue)) return 'a step needs a scalar expectValue';
  if (!isStrList(step.needs, 50)) return 'a step needs a list of need ids';
  if (!isObj(step.input)) return 'a step needs an input object';
  for (const v of Object.values(step.input)) if (!(v === null || isScalar(v))) return 'step inputs may only hold text, numbers, booleans or null';
  return null;
}

export function validatePlan(goal: Goal, plan: unknown): EngineResult<Plan> {
  if (!isObj(plan) || !Array.isArray(plan.steps) || typeof plan.goalId !== 'string') return fail('bad-input', 'The plan needs a goalId and a list of steps.');
  if (plan.goalId !== goal.id) return fail('bad-input', 'The plan is for a different goal.');
  if (plan.steps.length === 0) return fail('bad-input', 'The plan has no steps.');
  if (plan.steps.length > goal.maxSteps) return fail('too-many-steps', 'The plan has more steps than the goal allows.');
  const ids = new Set<string>();
  for (const s of plan.steps) {
    const problem = stepProblem(s);
    if (problem) return fail('bad-input', 'Invalid plan: ' + problem + '.');
    const id = (s as PlanStep).id;
    if (ids.has(id)) return fail('duplicate-step', 'Two steps share the id ' + id + '.');
    ids.add(id);
  }
  const steps = plan.steps as readonly PlanStep[];
  for (const s of steps) for (const n of s.needs) {
    if (n === s.id || !ids.has(n)) return fail('unknown-need', 'Step ' + s.id + ' needs a step that does not exist (or itself).');
  }
  const byId = new Map(steps.map((s) => [s.id, s] as const));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    const seen = state.get(id);
    if (seen === 2) return false;
    if (seen === 1) return true;
    state.set(id, 1);
    for (const n of (byId.get(id) as PlanStep).needs) if (visit(n)) return true;
    state.set(id, 2);
    return false;
  };
  for (const s of steps) if (visit(s.id)) return fail('cycle', 'The steps need each other in a circle.');
  if (!steps.some((s) => s.expectKey === goal.successKey && s.expectValue === goal.successValue)) return fail('misses-goal', 'No step produces the goal\'s success condition.');
  return { ok: true, value: { goalId: plan.goalId, steps } };
}

const stable = (o: Readonly<Record<string, unknown>>): string => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

export function decideNext(goal: Goal, plan: Plan, state: Readonly<Record<string, unknown>>, journal: readonly JournalLike[]): Decision {
  if (state[goal.successKey] === goal.successValue) return { kind: 'done' };
  if (journal.length >= goal.maxSteps) return { kind: 'ask', question: 'The step budget of ' + goal.maxSteps + ' is used up and the goal is not reached. How should I continue?' };
  const finished = new Set(plan.steps.filter((s) => state[s.expectKey] === s.expectValue).map((s) => s.id));
  const open = plan.steps.filter((s) => !finished.has(s.id));
  if (open.length === 0) return { kind: 'ask', question: 'All planned steps are finished but the goal is not reached. What should happen next?' };
  const ready = open.find((s) => s.needs.every((n) => finished.has(n)));
  if (!ready) return { kind: 'ask', question: 'No step can run yet: ' + open.map((s) => s.id).join(', ') + ' are waiting. What should happen next?' };
  const attempts = journal.filter((e) => e.toolId === ready.toolId && stable(e.input) === stable(ready.input)).length;
  if (attempts >= 2) return { kind: 'ask', question: 'Step ' + ready.id + ' (' + ready.toolId + ') was tried ' + attempts + ' times and its result is still not confirmed. I will not repeat it a third time. How should I continue?' };
  return { kind: 'step', stepId: ready.id, toolId: ready.toolId, input: { ...ready.input } };
}

export function makePlanner(goal: Goal, plan: Plan): (state: Readonly<Record<string, unknown>>, journal: readonly JournalLike[]) => Decision {
  return (state, journal) => decideNext(goal, plan, state, journal);
}
