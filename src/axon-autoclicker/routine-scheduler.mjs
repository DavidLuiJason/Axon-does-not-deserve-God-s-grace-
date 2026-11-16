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
