import { runLoop } from '../src/brain/mind/loop/loop.ts';
import type { LoopTool } from '../src/brain/mind/loop/loop.ts';
import type { ActionSchema } from '../src/brain/mind/schema/schemaTypes.ts';
import { formGoal, validatePlan } from '../src/brain/mind/plan/plan.ts';
import type { Goal, Plan } from '../src/brain/mind/plan/plan.ts';
import { plannerForLoop, taskForGoal } from '../src/brain/mind/orchestrator/loopAdapter.ts';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const schema = (tool: string): ActionSchema => ({ tool, acts: ['command'], actions: ['count:v'], objects: ['number:n'], names: [], slots: [], effects: [], preconditions: [], cost: { time: 'instant', memory: 'low', basis: 'estimate' }, undo: 'not-needed' } as ActionSchema);
const tool = (id: string, changes: Record<string, string | number | boolean>, spy: { calls: number }): LoopTool => ({ schema: schema(id), run: () => { spy.calls++; return { ok: true, changes }; } });
const goalOf = (maxSteps: number): Goal => { const g = formGoal({ id: 'g1', statement: 'Count then sort', successKey: 'sorted', successValue: true, maxSteps, constraints: [] }); if (!g.ok) throw new Error('goal'); return g.value; };
const planOf = (goal: Goal): Plan => { const p = validatePlan(goal, { goalId: 'g1', steps: [
  { id: 's1', toolId: 'tool-a', input: { text: 'b a' }, needs: [], expectKey: 'counted', expectValue: true },
  { id: 's2', toolId: 'tool-b', input: { text: 'b a' }, needs: ['s1'], expectKey: 'sorted', expectValue: true }] }); if (!p.ok) throw new Error('plan'); return p.value; };
const opts = { granted: [] as string[], now: () => 0 };

{
  const goal = goalOf(5); const plan = planOf(goal); const a = { calls: 0 }; const b = { calls: 0 };
  const r = runLoop(taskForGoal(goal, 'task-1'), plannerForLoop(goal, plan), { 'tool-a': tool('tool-a', { counted: true }, a), 'tool-b': tool('tool-b', { sorted: true }, b) }, opts);
  check(r.status === 'SUCCESS' && r.steps === 2 && a.calls === 1 && b.calls === 1, 'L01_two_steps_reach_goal');
  check(r.journal.map((j) => j.toolId).join(',') === 'tool-a,tool-b' && r.finalState.sorted === true && r.finalState.counted === true, 'L02_order_and_state');
  const again = runLoop(taskForGoal(goal, 'task-1'), plannerForLoop(goal, plan), { 'tool-a': tool('tool-a', { counted: true }, { calls: 0 }), 'tool-b': tool('tool-b', { sorted: true }, { calls: 0 }) }, opts);
  check(JSON.stringify(again) === JSON.stringify(r), 'L03_deterministic');
}
{
  const goal = goalOf(5); const plan = planOf(goal); const a = { calls: 0 }; const b = { calls: 0 };
  const r = runLoop(taskForGoal(goal, 'task-2'), plannerForLoop(goal, plan), { 'tool-a': tool('tool-a', { counted: true }, a), 'tool-b': tool('tool-b', { sorted: true }, b) }, opts, { counted: true, sorted: true });
  check(r.status === 'SUCCESS' && r.steps === 0 && a.calls === 0 && b.calls === 0, 'L04_already_done_runs_nothing');
}
{
  const goal = goalOf(6); const plan = planOf(goal); const a = { calls: 0 }; const b = { calls: 0 };
  const r = runLoop(taskForGoal(goal, 'task-3'), plannerForLoop(goal, plan), { 'tool-a': tool('tool-a', {}, a), 'tool-b': tool('tool-b', { sorted: true }, b) }, opts);
  check(a.calls <= 2 && b.calls === 0, 'L05_never_a_third_blind_retry');
  check(r.status === 'NO_PROGRESS' && r.steps === 2, 'L06_unconfirmed_step_stops_as_no_progress');
}
{
  const goal = goalOf(1); const plan: Plan = { goalId: 'g1', steps: planOf(goalOf(5)).steps };
  const a = { calls: 0 };
  const r = runLoop(taskForGoal(goal, 'task-4'), plannerForLoop(goal, plan), { 'tool-a': tool('tool-a', { counted: true }, a), 'tool-b': tool('tool-b', { sorted: true }, { calls: 0 }) }, opts);
  check(r.status === 'BUDGET_EXHAUSTED' && r.steps === 1, 'L07_budget_respected');
}
{
  const goal = goalOf(5); const plan = planOf(goal);
  const failing: LoopTool = { schema: schema('tool-a'), run: () => ({ ok: false, error: 'boom' }) };
  const r = runLoop(taskForGoal(goal, 'task-5'), plannerForLoop(goal, plan), { 'tool-a': failing, 'tool-b': tool('tool-b', { sorted: true }, { calls: 0 }) }, opts);
  check(r.status === 'TOOL_FAILED', 'L08_tool_failure_stops');
}
{
  const goal = goalOf(5);
  const t = taskForGoal(goal, 'task-6');
  check(t.successTest({ sorted: true }).done === true && t.successTest({ sorted: false }).done === false && t.successTest({}).done === false && t.maxSteps === 5 && t.goal === 'Count then sort', 'L09_task_for_goal');
  const planner = plannerForLoop(goal, planOf(goal));
  const d = planner({}, []);
  check(d.kind === 'step' && d.toolId === 'tool-a' && !('stepId' in d), 'L10_planner_decision_shape');
  const e = planner({ counted: true, sorted: true }, []);
  check(e.kind === 'done', 'L11_done_decision');
  const g = planner({}, [{ n: 1, observation: {}, decision: 'x', toolId: 'tool-a', input: { text: 'b a' }, outcome: 'ok', check: 'x' }, { n: 2, observation: {}, decision: 'x', toolId: 'tool-a', input: { text: 'b a' }, outcome: 'ok', check: 'x' }]);
  check(g.kind === 'ask' && g.question.includes('not repeat it a third time'), 'L12_ask_decision');
}
console.log(`loopAdapter: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
