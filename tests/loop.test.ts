import assert from 'node:assert/strict';
import { runLoop, LOOP_LIMITS, type LoopTool, type Task, type PlanDecision } from '../src/brain/mind/loop/loop.ts';
import type { ActionSchema, Effect } from '../src/brain/mind/schema/schemaTypes.ts';

let checks = 0;
function test(name: string, fn: () => void): void { fn(); checks++; console.log(`PASS ${checks}: ${name}`); }
function schema(tool: string, effects: Effect[] = [], status?: string, undo: ActionSchema['undo'] = 'not-needed'): ActionSchema {
  return { tool, acts: ['command'], actions: ['count:v'], objects: ['number:n'], names: [], slots: [], effects, preconditions: [], cost: { time: 'instant', memory: 'low', basis: 'estimate' }, undo, ...(status ? { status } : {}) } as ActionSchema;
}
function makeTask(maxSteps = 10, target = 5): Task {
  return { id: 'task-1', goal: 'reach target', maxSteps, successTest: s => ({ done: s.count === target, reason: `count is ${String(s.count ?? 0)}` }) };
}
function counter(spy: { calls: number }, step = 1): LoopTool {
  return { schema: schema('counter'), run: input => { spy.calls++; return { ok: true, changes: { count: Number(input.by ?? step) + Number(input.current ?? 0) } }; } };
}
function runCounter(target = 5, maxSteps = 10) {
  const spy = { calls: 0 };
  const tool = counter(spy);
  const result = runLoop(makeTask(maxSteps, target), s => ({ kind: 'step', toolId: 'counter', input: { current: Number(s.count ?? 0), by: 1 } }), { counter: tool }, { granted: [], now: () => 0 });
  return { result, spy };
}
const basic = { granted: [] as string[], now: () => 0 };

test('counter reaches five in five steps; journal is deterministic', () => {
  const { result, spy } = runCounter();
  assert.equal(result.status, 'SUCCESS'); assert.equal(result.steps, 5); assert.equal(result.journal.length, 5); assert.equal(spy.calls, 5); assert.equal(result.finalState.count, 5);
  assert.deepEqual(result, runCounter().result);
});
test('already satisfied succeeds before planner or tool is touched', () => {
  let planned = 0, called = 0;
  const r = runLoop(makeTask(5, 0), () => { planned++; return { kind: 'step', toolId: 'x', input: {} }; }, { x: { schema: schema('x'), run: () => { called++; return { ok: true, changes: {} }; } } }, basic, { count: 0 });
  assert.equal(r.status, 'SUCCESS'); assert.equal(r.steps, 0); assert.equal(r.journal.length, 0); assert.equal(planned, 0); assert.equal(called, 0);
});
test('hard budget stops at exactly three executed steps', () => { const { result, spy } = runCounter(5, 3); assert.equal(result.status, 'BUDGET_EXHAUSTED'); assert.equal(result.steps, 3); assert.equal(spy.calls, 3); assert.equal(result.journal.length, 3); });
test('sender effect asks owner and never runs', () => {
  let calls = 0; const tool: LoopTool = { schema: schema('sender', ['sends']), run: () => { calls++; return { ok: true, changes: {} }; } };
  const r = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'sender', input: {} }), { sender: tool }, basic);
  assert.equal(r.status, 'NEEDS_OWNER'); assert.equal(calls, 0); assert.match(r.question ?? '', /sender.*sends/);
});
test('network requires permission grant', () => {
  let calls = 0; const tool: LoopTool = { schema: schema('network', ['uses-network']), run: () => { calls++; return { ok: true, changes: { count: 5 } } } };
  const no = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'network', input: {} }), { network: tool }, basic);
  assert.equal(no.status, 'NEEDS_OWNER'); assert.equal(calls, 0);
  const yes = runLoop(makeTask(2), () => ({ kind: 'step', toolId: 'network', input: {} }), { network: tool }, { granted: ['permission'], now: () => 0 });
  assert.equal(yes.status, 'SUCCESS'); assert.equal(calls, 1);
});
test('unbuilt and unknown tools are refused without calls', () => {
  let calls = 0; const tool: LoopTool = { schema: schema('unbuilt', [], 'unbuilt'), run: () => { calls++; return { ok: true, changes: {} }; } };
  for (const id of ['unbuilt', 'missing']) { const r = runLoop(makeTask(), () => ({ kind: 'step', toolId: id, input: {} }), { unbuilt: tool }, basic); assert.equal(r.status, 'REFUSED'); }
  assert.equal(calls, 0);
});
test('tool, planner and success test exceptions are contained', () => {
  const throwing: LoopTool = { schema: schema('throwing'), run: () => { throw new Error('secret'); } };
  assert.equal(runLoop(makeTask(), () => ({ kind: 'step', toolId: 'throwing', input: {} }), { throwing }, basic).status, 'TOOL_FAILED');
  assert.equal(runLoop(makeTask(), () => { throw new Error('x'); }, {}, basic).status, 'PLANNER_FAILED');
  const badTask = { ...makeTask(), successTest: () => { throw new Error('x'); } } as unknown as Task;
  assert.equal(runLoop(badTask, () => ({ kind: 'done' }), {}, basic).status, 'SUCCESS_TEST_FAILED');
});
test('planner cannot declare done while success test is false', () => { const r = runLoop(makeTask(), () => ({ kind: 'done' }), {}, basic); assert.equal(r.status, 'PLANNER_FAILED'); assert.match(r.reason, /success test was false/); });
test('identical repeated tool and input without state change stops', () => {
  const t: LoopTool = { schema: schema('noop'), run: () => ({ ok: true, changes: {} }) };
  let plans = 0, calls = 0; const counted: LoopTool = { schema: t.schema, run: input => { calls++; return t.run(input); } }; const r = runLoop(makeTask(8), () => { plans++; return { kind: 'step', toolId: 'noop', input: { x: 1 } }; }, { noop: counted }, basic);
  assert.equal(r.status, 'NO_PROGRESS'); assert.equal(calls, 1); assert.equal(plans, 2); assert.equal(r.steps, 2);
});
test('invalid maxSteps values and missing success test are rejected', () => {
  for (const n of [0, 51, Number.NaN, -1, 2.5]) assert.equal(runLoop({ ...makeTask(), maxSteps: n }, () => ({ kind: 'done' }), {}, basic).status, 'INVALID_TASK');
  assert.equal(runLoop({ ...makeTask(), successTest: undefined } as unknown as Task, () => ({ kind: 'done' }), {}, basic).status, 'INVALID_TASK');
});
test('planner ask and time budget are reported', () => {
  const ask = runLoop(makeTask(), () => ({ kind: 'ask', question: 'Which one?' }), {}, basic); assert.equal(ask.status, 'NEEDS_OWNER'); assert.equal(ask.question, 'Which one?');
  let time = 0; const timed = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'x', input: {} }), {}, { granted: [], now: () => time++, maxMillis: 0 }); assert.equal(timed.status, 'BUDGET_EXHAUSTED');
});
test('hostile task, tools, planner output and oversized goal never throw', () => {
  assert.equal(runLoop(null as unknown as Task, () => ({ kind: 'done' }), {}, basic).status, 'INVALID_TASK');
  assert.equal(runLoop(makeTask(), () => ({ kind: 'done' }), null as unknown as Record<string, LoopTool>, basic).status, 'INVALID_TASK');
  assert.equal(runLoop(makeTask(), () => 'garbage' as unknown as PlanDecision, {}, basic).status, 'PLANNER_FAILED');
  assert.equal(runLoop({ ...makeTask(), goal: 'x'.repeat(10001) }, () => ({ kind: 'done' }), {}, basic).status, 'INVALID_TASK');
  const extra: LoopTool = { schema: schema('extra'), run: () => ({ ok: true, changes: { a: true, extra: { x: 1 } } } as unknown as ReturnType<LoopTool['run']>) };
  assert.equal(runLoop(makeTask(), () => ({ kind: 'step', toolId: 'extra', input: {} }), { extra }, basic).status, 'TOOL_FAILED');
});
test('returned state and journal are defensive copies', () => {
  const { result } = runCounter(); const before = runCounter().result;
  assert.throws(() => { (result.finalState as Record<string, unknown>).count = 999; });
  assert.throws(() => { (result.journal[0] as unknown as { outcome: string }).outcome = 'edited'; });
  assert.equal(before.finalState.count, 5); assert.equal(runCounter().result.finalState.count, 5);
});
test('schema approval effects and irreversible undo each require owner', () => {
  for (const [id, sch] of [['spender', schema('spender', ['spends'])], ['irreversible', schema('irreversible', [], undefined, 'irreversible')]] as const) {
    let calls = 0; const r = runLoop(makeTask(), () => ({ kind: 'step', toolId: id, input: {} }), { [id]: { schema: sch, run: () => { calls++; return { ok: true, changes: {} }; } } }, basic);
    assert.equal(r.status, 'NEEDS_OWNER'); assert.equal(calls, 0);
  }
});
test('director fix: owner-approval and permission preconditions are honoured', () => {
  let calls = 0;
  const mk = (pre: ActionSchema['preconditions']): LoopTool => ({ schema: { ...schema('pre'), preconditions: pre }, run: () => { calls++; return { ok: true, changes: { count: 5 } }; } });
  const a = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'pre', input: {} }), { pre: mk(['owner-approval']) }, { granted: ['permission'], now: () => 0 });
  assert.equal(a.status, 'NEEDS_OWNER'); assert.equal(calls, 0);
  const b = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'pre', input: {} }), { pre: mk(['permission']) }, basic);
  assert.equal(b.status, 'NEEDS_OWNER'); assert.equal(calls, 0);
  const c = runLoop(makeTask(2), () => ({ kind: 'step', toolId: 'pre', input: {} }), { pre: mk(['permission']) }, { granted: ['permission'], now: () => 0 });
  assert.equal(c.status, 'SUCCESS'); assert.equal(calls, 1);
});
test('director fix: tool name must match its schema; NaN and oversized state are refused', () => {
  let calls = 0;
  const wrong: LoopTool = { schema: schema('other'), run: () => { calls++; return { ok: true, changes: { count: 5 } }; } };
  const r1 = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'asked', input: {} }), { asked: wrong }, basic);
  assert.equal(r1.status, 'REFUSED'); assert.equal(calls, 0);
  const nan: LoopTool = { schema: schema('nan'), run: () => ({ ok: true, changes: { count: Number.NaN } }) };
  const r2 = runLoop(makeTask(), () => ({ kind: 'step', toolId: 'nan', input: {} }), { nan }, basic);
  assert.equal(r2.status, 'TOOL_FAILED');
  const big: Record<string, number> = {}; for (let i = 0; i < LOOP_LIMITS.maxStateKeys + 1; i++) big['k' + i] = i;
  const r3 = runLoop(makeTask(), () => ({ kind: 'done' }), {}, basic, big);
  assert.equal(r3.status, 'INVALID_TASK');
  const r4 = runLoop(makeTask(), () => ({ kind: 'done' }), {}, basic, { count: Number.NaN });
  assert.equal(r4.status, 'INVALID_TASK');
});
test('bounds and exports are explicit', () => { assert.equal(LOOP_LIMITS.maxSteps, 50); assert.equal(LOOP_LIMITS.maxJournalEntries, 200); });

// 1,000 reproducible task runs: each uses an independent arithmetic target and a seeded LCG.
test('1,000 seeded fake tasks preserve budgets, success truth and repeatability', () => {
  let seed = 0x51f15e;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let i = 0; i < 1000; i++) {
    const target = 1 + (rand() % 12), budget = 1 + (rand() % 15);
    const run = () => {
      const tool: LoopTool = { schema: schema('inc'), run: input => ({ ok: true, changes: { count: Number(input.current) + 1 } }) };
      return runLoop(makeTask(budget, target), s => ({ kind: 'step', toolId: 'inc', input: { current: Number(s.count ?? 0) } }), { inc: tool }, basic);
    };
    const a = run(), b = run();
    assert.ok(a.steps <= budget); assert.equal(a.journal.length, a.steps); assert.deepEqual(a, b);
    const independentSuccess = Number(a.finalState.count ?? 0) === target;
    assert.equal(a.status === 'SUCCESS', independentSuccess);
  }
});
console.log(`C31 LOOP TESTS PASSED: ${checks} groups; 1,000 seeded runs; limits ${LOOP_LIMITS.maxSteps}/${LOOP_LIMITS.maxJournalEntries}.`);
