// PLANNER-TO-LOOP ADAPTER (pure). Lets the P04 planner drive the existing step loop (`runLoop`) with no change to the loop.
import type { Goal, Plan } from '../plan/plan.ts';
import { decideNext } from '../plan/plan.ts';
import type { JournalEntry, LoopState, PlanDecision, Planner, Task } from '../loop/loop.ts';

/** The loop's own task for a goal: it is done exactly when the state shows the goal's success key and value. */
export function taskForGoal(goal: Goal, taskId: string): Task {
  return {
    id: taskId,
    goal: goal.statement,
    maxSteps: goal.maxSteps,
    successTest: (s: LoopState) => (s[goal.successKey] === goal.successValue ? { done: true, reason: goal.successKey + ' is as the goal needs' } : { done: false, reason: goal.successKey + ' is not yet as the goal needs' }),
  };
}

/** The loop's Planner for a validated plan: one step at a time, asks the owner instead of repeating a step a third time. */
export function plannerForLoop(goal: Goal, plan: Plan): Planner {
  return (state: LoopState, journal: readonly JournalEntry[]): PlanDecision => {
    const d = decideNext(goal, plan, state, journal);
    if (d.kind === 'step') return { kind: 'step', toolId: d.toolId, input: { ...d.input } };
    if (d.kind === 'ask') return { kind: 'ask', question: d.question };
    return { kind: 'done' };
  };
}
