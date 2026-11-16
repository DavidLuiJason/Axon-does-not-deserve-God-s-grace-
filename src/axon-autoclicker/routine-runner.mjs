// AXON Auto-Clicker runner: carries out an owner-approved routine. Every action still passes through the action gate.
// Safety it adds on top: owner approval bound to the routine's content, a visible STOP control (required for other apps),
// a native kill switch, time and action limits, stuck detection, and a pause at every question it may not answer itself.
import { validateRoutine, isApproved, resolveTarget } from './routine-model.mjs';
import { waitFor } from './screen-watcher.mjs';

const ACTION_KINDS = new Set(['tap', 'long-press', 'toggle', 'type', 'scroll', 'swipe', 'tap-point', 'long-press-point', 'back', 'home', 'open']);

export function createRoutineRunner({ controller, screen, ownPackage = 'com.axon.app', now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random, onEvent = () => {}, pauseTimeoutMs = 300000 }) {
  let run = null;
  let stopFlag = false;

  const emit = (e) => { try { onEvent(e); } catch { /* a listener must never break a run */ } };
  const px = (s, p) => ({ x: Math.round(p.fx * (s.screen?.width ?? 0)), y: Math.round(p.fy * (s.screen?.height ?? 0)) });

  async function finish(status, reason) {
    await screen.hideStopControl();
    const summary = { status, reason, loops: run.loop, actions: run.actions, ms: now() - run.startedAt, log: run.log.slice(-50) };
    emit({ type: 'finished', ...summary });
    run = null;
    return summary;
  }
  const record = (text, outcome) => { run.log.push({ at: now(), text, outcome }); if (run.log.length > 200) run.log.shift(); };

  async function guard() {
    if (stopFlag) return 'owner-stop';
    const kill = await screen.getKillState();
    if (kill.stopRequested) return 'stop-button';
    if (!kill.available && run.routine.scope === 'external') return 'kill-switch-unavailable';
    if (now() - run.startedAt > run.routine.limits.maxRuntimeMs) return 'time-limit';
    if (run.actions >= run.routine.limits.maxActions) return 'action-limit';
    return null;
  }

  async function exec(step) {
    if (step.kind === 'wait') { await wait(step.ms); return { ok: true, status: 'done', text: `Waited ${step.ms} ms.` }; }
    if (step.kind === 'wait-for') {
      const w = await waitFor(screen, step.until, { timeoutMs: step.timeoutMs, now, wait });
      return w.ok ? { ok: true, status: 'done', text: `Waited for ${w.reason}.` } : { ok: false, status: 'timeout', text: 'What the routine waited for did not appear in time.' };
    }
    if (step.kind === 'open') return controller.open(step.app);
    if (step.kind === 'back') return controller.back();
    if (step.kind === 'home') return controller.home();
    const s = await controller.see();
    if (!s.ok) return { ok: false, status: 'refused', code: 'no-screen', text: s.help ?? 'Cannot read the screen.' };
    if (s.blocked) return { ok: false, status: 'refused', code: 'package-blocked', text: 'That app is blocked.' };
    if (run.routine.scope === 'internal' && s.packageName !== ownPackage) return { ok: false, status: 'left-app', text: 'AXON is no longer in front.' };
    if (run.routine.scope === 'external' && run.routine.packageName && s.packageName !== run.routine.packageName) return { ok: false, status: 'left-app', text: `${run.routine.packageName} is no longer in front.` };
    if (step.kind === 'tap-point') { const p = px(s, step.at); return controller.tapPoint(p.x, p.y); }
    if (step.kind === 'long-press-point') { const p = px(s, step.at); return controller.longPressPoint(p.x, p.y); }
    if (step.kind === 'swipe') { const a = px(s, step.from); const b = px(s, step.to); return controller.swipe(a.x, a.y, b.x, b.y, step.durationMs); }
    if (step.kind === 'scroll') {
      if (!step.target) return controller.scroll(step.direction);
      const f = resolveTarget(s, step.target);
      return f.element ? controller.scroll(step.direction, { label: f.element.label }) : controller.scroll(step.direction);
    }
    const found = resolveTarget(s, step.target);
    if (found.element) {
      const label = found.element.label; const role = found.element.role;
      if (step.kind === 'type') return controller.type(label, step.text, { role });
      if (step.kind === 'long-press') return controller.longPress(label, { role });
      if (step.kind === 'toggle') return controller.toggle(label, { role });
      const r = await controller.tap(label, { role });
      if (r.status !== 'ambiguous' || !step.target.fallbackPoint) return r;
    }
    if (step.target?.fallbackPoint && step.kind !== 'type') {
      const p = px(s, step.target.fallbackPoint);
      return step.kind === 'long-press' ? controller.longPressPoint(p.x, p.y) : controller.tapPoint(p.x, p.y);
    }
    return found.ambiguous ? { ok: false, status: 'ambiguous', text: 'More than one item matches the routine step.' } : { ok: false, status: 'not-found', text: 'The routine could not find that item on the screen.' };
  }

  async function drive() {
    const { routine } = run;
    while (true) {
      while (run.index < routine.steps.length) {
        const why = await guard();
        if (why) return finish('stopped', why);
        const step = routine.steps[run.index];
        let r = await exec(step);
        if (r.status === 'needs-approval') {
          const pre = routine.preapprove.includes(run.index) && (r.code === 'typing' || r.code === 'setting-change');
          if (pre) r = await controller.approve(true);
          else { run.paused = { index: run.index, since: now() }; emit({ type: 'needs-approval', question: r.question }); return { status: 'needs-approval', question: r.question, loops: run.loop, actions: run.actions }; }
        }
        const counted = ACTION_KINDS.has(step.kind);
        if (r.ok) {
          if (counted) run.actions += 1;
          run.failures = 0;
          if (counted) { run.unchanged = /did not change/.test(r.changes ?? '') ? run.unchanged + 1 : 0; }
          record(r.text ?? step.kind, 'done');
          emit({ type: 'step', loop: run.loop, index: run.index, status: 'done', text: r.text });
        } else if (step.optional) {
          record(`Skipped: ${r.text ?? r.status}`, 'skipped');
        } else {
          run.failures += 1;
          record(`${r.status}: ${r.text ?? ''}`, 'failed');
          emit({ type: 'step', loop: run.loop, index: run.index, status: r.status, text: r.text });
          if (r.status === 'refused' || r.status === 'left-app') return finish('stopped', r.status === 'left-app' ? 'left-app' : `gate-refused:${r.code ?? ''}`);
          if (run.failures >= 3) return finish('failed', 'three-failures-in-a-row');
        }
        if (run.unchanged >= routine.limits.stuckAfter) return finish('stopped', 'stuck');
        if (step.delayAfterMs) await wait(step.delayAfterMs);
        run.index += 1;
      }
      run.loop += 1; run.index = 0;
      if (!routine.repeat.forever && run.loop >= routine.repeat.count) return finish('finished', 'completed');
      const jitter = routine.repeat.jitterMs ? Math.round((random() * 2 - 1) * routine.repeat.jitterMs) : 0;
      await wait(Math.max(routine.repeat.intervalMs + jitter, 0));
    }
  }

  return {
    /** Plain-words preview of what a routine will do. Nothing runs. */
    preview(input, options = {}) {
      const v = validateRoutine(input, { ownPackage, ...options });
      if (!v.ok) return { ok: false, errors: v.errors };
      const r = v.routine;
      const lines = r.steps.map((s, i) => `${i + 1}. ${s.kind}${s.target?.label ? ` "${s.target.label}"` : s.target?.meaning ? ` (${s.target.meaning})` : ''}${s.app ? ` ${s.app}` : ''}${s.text ? ` (${s.text.length} characters)` : ''}${s.ms ? ` ${s.ms} ms` : ''}`);
      return { ok: true, scope: r.scope, repeat: r.repeat.forever ? 'until a limit or STOP' : `${r.repeat.count} round(s)`, everyMs: r.repeat.intervalMs, limits: r.limits, lines };
    },
    async run(input, options = {}) {
      if (run) return { status: 'busy', reason: 'Another routine is running.' };
      const v = validateRoutine(input, { ownPackage, ...options });
      if (!v.ok) return { status: 'invalid', errors: v.errors };
      if (!isApproved(input, { ownPackage, ...options })) return { status: 'not-approved', reason: 'The owner has not approved this routine, or it was changed after approval.' };
      stopFlag = false;
      await screen.clearStop();
      const shown = await screen.showStopControl('STOP AXON');
      if (!shown.ok && v.routine.scope === 'external') return { status: 'refused', reason: 'stop-control-unavailable' };
      run = { routine: v.routine, startedAt: now(), loop: 0, index: 0, actions: 0, failures: 0, unchanged: 0, log: [], paused: null };
      emit({ type: 'started', name: v.routine.name, scope: v.routine.scope });
      return drive();
    },
    /** Answer the question a paused routine asked. */
    async answer(approved) {
      if (!run?.paused) return { status: 'nothing-pending' };
      if (now() - run.paused.since > pauseTimeoutMs) { await controller.approve(false); return finish('stopped', 'question-timed-out'); }
      run.paused = null;
      const r = await controller.approve(approved === true);
      if (!r.ok) return finish('stopped', approved === true ? `could-not:${r.code ?? r.status}` : 'declined');
      run.actions += 1; run.failures = 0; record(r.text ?? 'approved step', 'done'); run.index += 1;
      return drive();
    },
    async stop() { stopFlag = true; await screen.requestStop(); if (run?.paused) { await controller.approve(false); return finish('stopped', 'owner-stop'); } return { status: 'stop-requested' }; },
    isRunning: () => Boolean(run),
  };
}
