import test from 'node:test';
import assert from 'node:assert/strict';
import { readScreenStructure } from '../src/screen-intelligence/structure-reader.mjs';
import { validateRoutine, routineHash, approveRoutine, isApproved, resolveTarget, LIMITS } from '../src/axon-autoclicker/routine-model.mjs';

const good = () => ({ name: 'Collect reward', scope: 'external', packageName: 'com.example.game', steps: [
  { kind: 'tap', target: { label: 'Tap me', fallbackPoint: { fx: 0.4, fy: 0.08 } }, delayAfterMs: 300 },
  { kind: 'swipe', from: { fx: 0.5, fy: 0.8 }, to: { fx: 0.5, fy: 0.2 } },
  { kind: 'wait-for', until: { text: 'Score' }, timeoutMs: 3000 }], repeat: { count: 3, intervalMs: 1000 } });

test('a good routine validates and is cleaned with safe defaults', () => {
  const v = validateRoutine(good());
  assert.equal(v.ok, true, v.errors.join('; '));
  assert.equal(v.routine.limits.maxActions, 500); assert.equal(v.routine.limits.stuckAfter, 5); assert.equal(v.routine.steps[1].durationMs, 400);
});
test('bad routines say what is wrong in plain words', () => {
  const v = validateRoutine({ name: '', scope: 'sideways', steps: [{ kind: 'dance' }, { kind: 'tap' }, { kind: 'tap-point', at: { fx: 2, fy: 0 } }, { kind: 'type', target: { label: 'x' } }, { kind: 'wait', ms: 999999 }], repeat: { count: 0, intervalMs: 10 } });
  assert.equal(v.ok, false);
  const text = v.errors.join(' | ');
  for (const s of ['needs a name', 'scope must be', 'unknown step', 'needs a target', 'fractions', 'typing needs text', 'wait must be', 'repeat.count', 'safety floor']) assert.match(text, new RegExp(s));
  assert.equal(validateRoutine(null).ok, false);
});
test('limits are enforced: steps, text, interval floor, runtime and action ceilings', () => {
  assert.equal(validateRoutine({ ...good(), steps: Array.from({ length: LIMITS.maxSteps + 1 }, () => ({ kind: 'back' })) }).ok, false);
  assert.equal(validateRoutine({ ...good(), steps: [{ kind: 'type', target: { label: 'a' }, text: 'x'.repeat(501) }] }).ok, false);
  const v = validateRoutine({ ...good(), limits: { maxRuntimeMs: 1e12, maxActions: 1e9 } });
  assert.equal(v.routine.limits.maxRuntimeMs, LIMITS.maxRuntimeMs); assert.equal(v.routine.limits.maxActions, LIMITS.maxActions);
  assert.equal(validateRoutine({ ...good(), repeat: { forever: true, intervalMs: 1000 } }).ok, true);
  assert.equal(validateRoutine({ ...good(), repeat: { count: 2, intervalMs: 1000, jitterMs: 900 } }).ok, false);
});
test('internal routines stay inside AXON; external ones carry a package', () => {
  const internal = validateRoutine({ name: 'x', scope: 'internal', steps: [{ kind: 'open', app: 'Chrome' }] });
  assert.equal(internal.ok, false); assert.match(internal.errors.join(' '), /stays inside AXON/);
  const ok = validateRoutine({ name: 'x', scope: 'internal', steps: [{ kind: 'back' }] });
  assert.equal(ok.routine.packageName, 'com.axon.app');
});
test('only typing and switch steps can be pre-approved', () => {
  const base = { name: 'n', scope: 'external', steps: [{ kind: 'type', target: { label: 'Note' }, text: 'hi' }, { kind: 'tap', target: { label: 'Pay now' } }, { kind: 'toggle', target: { label: 'Gift' } }] };
  assert.equal(validateRoutine({ ...base, preapprove: [0, 2] }).ok, true);
  const bad = validateRoutine({ ...base, preapprove: [1] });
  assert.equal(bad.ok, false); assert.match(bad.errors[0], /always asks/);
  assert.equal(validateRoutine({ ...base, preapprove: [9] }).ok, false);
});
test('approval is bound to the routine content: any edit cancels it', () => {
  const approved = approveRoutine(good());
  assert.equal(isApproved(approved), true); assert.equal(isApproved(good()), false);
  assert.equal(isApproved({ ...approved, name: 'Collect reward' }), true);
  const edited = { ...approved, steps: [...approved.steps, { kind: 'back' }] };
  assert.equal(isApproved(edited), false);
  assert.equal(isApproved({ ...approved, repeat: { count: 99, intervalMs: 1000 } }), false);
  assert.equal(routineHash(good()), routineHash(JSON.parse(JSON.stringify(good()))));
  assert.equal(isApproved({ ...approved, id: 'renamed-id' }), true);
});
const screen = () => readScreenStructure({ packageName: 'p', screen: { width: 1000, height: 2000 }, nodes: [{ className: 'LinearLayout', children: [
  { className: 'android.widget.Button', text: 'Next', clickable: true, bounds: { l: 0, t: 0, r: 200, b: 100 } },
  { className: 'android.widget.Button', text: 'Next page', clickable: true, bounds: { l: 0, t: 120, r: 200, b: 220 } },
  { className: 'android.widget.Button', text: 'Continue', clickable: true, bounds: { l: 0, t: 240, r: 200, b: 340 } },
  { className: 'android.widget.Button', text: 'Skip ad', clickable: true, enabled: false, bounds: { l: 0, t: 360, r: 200, b: 460 } },
  { className: 'android.widget.Button', text: 'Far', clickable: true, bounds: { l: 0, t: 9000, r: 200, b: 9100 } },
  { className: 'android.widget.EditText', hint: 'Search', editable: true, bounds: { l: 0, t: 480, r: 800, b: 580 } }] }] });
test('targets are found by label, alias, part of a label, or the owner\'s description of what the button does', () => {
  const s = screen();
  assert.equal(resolveTarget(s, { label: 'next' }).element.label, 'Next');
  assert.equal(resolveTarget(s, { label: 'Proceed', aliases: ['continue'] }).element.label, 'Continue');
  assert.equal(resolveTarget(s, { label: 'cont' }).via, 'label-part');
  assert.equal(resolveTarget(s, { meaning: 'goes to the next page' }).element.label, 'Next page');
  assert.equal(resolveTarget(s, { meaning: 'the button that continues' }).none, true);
  assert.equal(resolveTarget(s, { label: 'nex' }).ambiguous.length, 2);
  assert.equal(resolveTarget(s, { label: 'Skip ad' }).none, true);
  assert.equal(resolveTarget(s, { label: 'Far' }).none, true);
  assert.equal(resolveTarget(s, { label: 'Search', role: 'input' }).element.role, 'input');
  assert.equal(resolveTarget(s, { label: 'Search', role: 'button' }).none, true);
});
