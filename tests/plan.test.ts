import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { formGoal, validatePlan, decideNext, makePlanner } from '../src/brain/mind/plan/plan.ts';
import type { Goal, Plan } from '../src/brain/mind/plan/plan.ts';

type Case = { id: string; fn: string; input: any; expected: any };
const cases = JSON.parse(readFileSync('tests/fixtures/planCases.json', 'utf8')) as Case[];
let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
const shape = (r: any) => (r.ok === false ? { ok: false, error: r.error } : r);

for (const c of cases) {
  let actual: unknown;
  try {
    if (c.fn === 'formGoal') actual = shape(formGoal(c.input));
    else if (c.fn === 'validatePlan') actual = shape(validatePlan(c.input.goal, c.input.plan));
    else actual = decideNext(c.input.goal, c.input.plan, c.input.state, c.input.journal);
  } catch { actual = '__THREW__'; }
  check(same(actual, c.expected), c.id);
}

// Invariants on random inputs (seeded, repeatable).
let seed = 99;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const goal = formGoal({ id: 'g', statement: 's', successKey: 'goal', successValue: true, maxSteps: 8, constraints: [] });
if (!goal.ok) throw new Error('setup');
for (let i = 0; i < 3000; i++) {
  const count = 1 + Math.floor(rnd() * 5);
  const steps = Array.from({ length: count }, (_, k) => ({
    id: 's' + k, toolId: 't' + Math.floor(rnd() * 3), input: { v: Math.floor(rnd() * 2) },
    needs: Array.from({ length: k }, (_, m) => 's' + m).filter(() => rnd() < 0.4),
    expectKey: k === count - 1 ? 'goal' : 'k' + k, expectValue: k === count - 1 ? true : 1,
  }));
  const plan = { goalId: 'g', steps };
  check(validatePlan(goal.value, plan).ok === true, 'inv-valid-plan-' + i);
  const state: Record<string, unknown> = {};
  for (const s of steps) if (rnd() < 0.4) state[s.expectKey] = s.expectValue;
  const journal = Array.from({ length: Math.floor(rnd() * 8) }, () => ({ toolId: 't' + Math.floor(rnd() * 3), input: { v: Math.floor(rnd() * 2) } }));
  const d = decideNext(goal.value as Goal, plan as Plan, state, journal);
  const again = decideNext(goal.value as Goal, plan as Plan, state, journal);
  check(same(d, again), 'inv-deterministic-' + i);
  check(same(d, makePlanner(goal.value as Goal, plan as Plan)(state, journal)), 'inv-planner-' + i);
  if (state.goal === true) check(d.kind === 'done', 'inv-success-' + i);
  if (d.kind === 'step') {
    const st = steps.find((s) => s.id === d.stepId);
    check(st !== undefined, 'inv-known-step-' + i);
    if (st) {
      check(state[st.expectKey] !== st.expectValue, 'inv-not-finished-' + i);
      check(st.needs.every((m) => { const o = steps.find((x) => x.id === m)!; return state[o.expectKey] === o.expectValue; }), 'inv-needs-met-' + i);
      const attempts = journal.filter((e) => e.toolId === st.toolId && e.input.v === st.input.v).length;
      check(attempts < 2 && journal.length < 8, 'inv-attempts-' + i);
    }
  }
}
// formGoal returns a copy, not the caller's list.
const spec = { id: 'g', statement: 's', successKey: 'k', successValue: 1, maxSteps: 2, constraints: ['a'] };
const made = formGoal(spec);
spec.constraints.push('b');
check(made.ok && made.value.constraints.length === 1, 'copy-constraints');

console.log(`plan: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
