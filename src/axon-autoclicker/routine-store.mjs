// Saved routines, the owner's approval of each one, and schedules. Storage is injected (backend.load / backend.save with a JSON
// string), so the real storage lane can plug in later. Editing a routine's content cancels its approval; schedules are separate.
import { validateRoutine, routineHash, isApproved } from './routine-model.mjs';

const EMPTY = () => ({ version: 1, routines: {}, schedules: {}, lastRun: {} });

export function createRoutineStore({ backend, ownPackage = 'com.axon.app', now = () => Date.now() }) {
  async function read() {
    try { const raw = await backend.load(); const d = raw ? JSON.parse(raw) : EMPTY(); return { ...EMPTY(), ...d }; } catch { return EMPTY(); }
  }
  async function write(d) { try { await backend.save(JSON.stringify(d)); return true; } catch { return false; } }
  const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'routine';

  return {
    async list() {
      const d = await read();
      return Object.values(d.routines).map((r) => ({ id: r.id, name: r.name, scope: r.scope, approved: isApproved(r, { ownPackage }), steps: r.steps.length, schedule: d.schedules[r.id] ?? null, lastRun: d.lastRun[r.id] ?? null }));
    },
    async get(id) { const d = await read(); return d.routines[id] ?? null; },
    /** Save a routine. The approval survives only if nothing that changes behaviour was edited. */
    async save(input) {
      const v = validateRoutine(input, { ownPackage });
      if (!v.ok) return { ok: false, errors: v.errors };
      const d = await read();
      const id = input.id && d.routines[input.id] ? input.id : `${slug(v.routine.name)}-${Object.keys(d.routines).length + 1}`;
      const previous = d.routines[id];
      const routine = { ...v.routine, id, updatedAt: now() };
      if (previous?.approvedHash && previous.approvedHash === routineHash(routine)) routine.approvedHash = previous.approvedHash;
      d.routines[id] = routine;
      return (await write(d)) ? { ok: true, routine, approved: Boolean(routine.approvedHash) } : { ok: false, errors: ['Could not save.'] };
    },
    /** The owner's explicit yes to this exact routine. */
    async approve(id) {
      const d = await read(); const r = d.routines[id];
      if (!r) return { ok: false, errors: ['No such routine.'] };
      r.approvedHash = routineHash(r);
      return (await write(d)) ? { ok: true } : { ok: false, errors: ['Could not save.'] };
    },
    async remove(id) { const d = await read(); if (!d.routines[id]) return { ok: false }; delete d.routines[id]; delete d.schedules[id]; delete d.lastRun[id]; return { ok: await write(d) }; },
    async setSchedule(id, schedule) {
      const d = await read();
      if (!d.routines[id]) return { ok: false, errors: ['No such routine.'] };
      if (schedule === null) delete d.schedules[id];
      else {
        const ok = (schedule?.kind === 'every' && Number.isFinite(schedule.minutes) && schedule.minutes >= 1) || (schedule?.kind === 'daily' && /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time ?? ''));
        if (!ok) return { ok: false, errors: ['A schedule is {kind:"every", minutes>=1} or {kind:"daily", time:"HH:MM"}.'] };
        d.schedules[id] = { kind: schedule.kind, ...(schedule.kind === 'every' ? { minutes: Math.floor(schedule.minutes) } : { time: schedule.time, ...(Array.isArray(schedule.days) ? { days: schedule.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) } : {}) }) };
      }
      return { ok: await write(d) };
    },
    async markRun(id, at = now()) { const d = await read(); d.lastRun[id] = at; return write(d); },
    async dueData() { return read(); },
  };
}
