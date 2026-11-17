// Runs scheduled, owner-approved routines. tick() is called about once a minute by the background runtime (or by hand).
// Only approved routines run, never two at once, and a routine runs at most once per scheduled slot.
import { isApproved } from './routine-model.mjs';

/** The most recent moment a schedule should have fired, at or before `at` (device local time). */
export function lastSlot(schedule, at) {
  if (schedule.kind === 'every') return null;
  const [hh, mm] = schedule.time.split(':').map(Number);
  const d = new Date(at); d.setHours(hh, mm, 0, 0);
  if (d.getTime() > at) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 8; i += 1) {
    if (!schedule.days?.length || schedule.days.includes(d.getDay())) return d.getTime();
    d.setDate(d.getDate() - 1);
  }
  return null;
}

export function isDue(schedule, lastRun, at) {
  if (!schedule) return false;
  if (schedule.kind === 'every') return at - (lastRun ?? 0) >= schedule.minutes * 60000;
  const slot = lastSlot(schedule, at);
  return slot != null && (lastRun ?? 0) < slot;
}

export function createScheduler({ store, runner, now = () => Date.now(), ownPackage = 'com.axon.app', onEvent = () => {} }) {
  return {
    async tick() {
      if (runner.isRunning()) return { started: null, reason: 'busy' };
      const d = await store.dueData();
      const at = now();
      for (const [id, schedule] of Object.entries(d.schedules)) {
        const routine = d.routines[id];
        if (!routine || !isApproved(routine, { ownPackage }) || !isDue(schedule, d.lastRun[id], at)) continue;
        await store.markRun(id, at);   // marked first, so a crash or a refusal cannot cause a run loop
        onEvent({ type: 'scheduled-start', id });
        const result = await runner.run(routine);
        return { started: id, result };
      }
      return { started: null, reason: 'nothing-due' };
    },
  };
}

/**
 * Calls scheduler.tick() every minute while the app's JavaScript is alive. Honest limit: the Android background runtime
 * keeps the PROCESS alive but its work is native, so whether this JavaScript keeps ticking with the screen off is a PHONE TEST
 * (checklist item 21). Returns stop().
 */
export function startSchedulerLoop(scheduler, { intervalMs = 60000, setTimer = setInterval, clearTimer = clearInterval, onError = () => {} } = {}) {
  let busy = false;
  const handle = setTimer(async () => {
    if (busy) return;
    busy = true;
    try { await scheduler.tick(); } catch (error) { onError(error); } finally { busy = false; }
  }, Math.max(15000, intervalMs));
  return () => clearTimer(handle);
}
