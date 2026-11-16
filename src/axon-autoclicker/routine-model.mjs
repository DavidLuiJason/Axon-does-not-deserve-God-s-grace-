// AXON Auto-Clicker: what a routine is, how it is checked, how its targets are found, and how the owner approves it.
// Pure data logic. Nothing here touches the phone.

export const LIMITS = Object.freeze({ minIntervalMs: 150, maxActions: 5000, maxRuntimeMs: 6 * 3600 * 1000, maxSteps: 100, maxLoops: 100000, maxWaitMs: 60000, maxWaitForMs: 120000, maxText: 500, maxName: 60 });
export const DEFAULTS = Object.freeze({ intervalMs: 1000, maxRuntimeMs: 10 * 60 * 1000, maxActions: 500, stuckAfter: 5 });
export const STEP_KINDS = Object.freeze(['tap', 'long-press', 'toggle', 'type', 'scroll', 'swipe', 'tap-point', 'long-press-point', 'back', 'home', 'open', 'wait', 'wait-for']);
const TARGET_KINDS = new Set(['tap', 'long-press', 'toggle', 'type']);
const PREAPPROVABLE = new Set(['type', 'toggle']);   // risky controls, money apps and sign-in screens can NEVER be pre-approved
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const frac = (p) => p && Number.isFinite(p.fx) && Number.isFinite(p.fy) && p.fx >= 0 && p.fx <= 1 && p.fy >= 0 && p.fy <= 1;
const str = (v, max) => String(v ?? '').trim().slice(0, max);

function cleanTarget(t, errors, where) {
  if (!t || typeof t !== 'object') { errors.push(`${where}: needs a target (a label, a meaning or a point).`); return null; }
  const out = {};
  if (t.label) out.label = str(t.label, 80);
  if (Array.isArray(t.aliases)) out.aliases = t.aliases.map((a) => str(a, 80)).filter(Boolean).slice(0, 10);
  if (t.meaning) out.meaning = str(t.meaning, 200);
  if (t.role) out.role = str(t.role, 20);
  if (t.fallbackPoint !== undefined) { if (frac(t.fallbackPoint)) out.fallbackPoint = { fx: t.fallbackPoint.fx, fy: t.fallbackPoint.fy }; else errors.push(`${where}: the fallback point must be fractions between 0 and 1.`); }
  if (!out.label && !out.aliases?.length && !out.meaning && !out.fallbackPoint) errors.push(`${where}: the target needs a label, a meaning or a fallback point.`);
  return out;
}

export function validateRoutine(input, { ownPackage = 'com.axon.app' } = {}) {
  const errors = [];
  const r = input && typeof input === 'object' ? input : {};
  const name = str(r.name, LIMITS.maxName);
  if (!name) errors.push('The routine needs a name.');
  const scope = r.scope === 'internal' || r.scope === 'external' ? r.scope : null;
  if (!scope) errors.push('The routine scope must be "internal" (inside AXON) or "external" (other apps).');
  const rawSteps = Array.isArray(r.steps) ? r.steps : [];
  if (!rawSteps.length) errors.push('The routine needs at least one step.');
  if (rawSteps.length > LIMITS.maxSteps) errors.push(`A routine can have at most ${LIMITS.maxSteps} steps.`);
  const steps = [];
  rawSteps.slice(0, LIMITS.maxSteps).forEach((s, i) => {
    const where = `Step ${i + 1}`;
    if (!s || !STEP_KINDS.includes(s.kind)) { errors.push(`${where}: unknown step "${s?.kind}".`); return; }
    const step = { kind: s.kind };
    if (TARGET_KINDS.has(s.kind)) step.target = cleanTarget(s.target, errors, where);
    if (s.kind === 'type') { const text = String(s.text ?? ''); if (!text) errors.push(`${where}: typing needs text.`); else if (text.length > LIMITS.maxText) errors.push(`${where}: the text is too long.`); else step.text = text; }
    if (s.kind === 'scroll') { step.direction = DIRECTIONS.has(s.direction) ? s.direction : 'down'; if (s.target) step.target = cleanTarget(s.target, errors, where); }
    if (s.kind === 'tap-point' || s.kind === 'long-press-point') { if (frac(s.at)) step.at = { fx: s.at.fx, fy: s.at.fy }; else errors.push(`${where}: "at" must be fractions between 0 and 1.`); }
    if (s.kind === 'swipe') { if (frac(s.from) && frac(s.to)) { step.from = { fx: s.from.fx, fy: s.from.fy }; step.to = { fx: s.to.fx, fy: s.to.fy }; step.durationMs = Math.min(3000, Math.max(100, Number(s.durationMs) || 400)); } else errors.push(`${where}: a swipe needs "from" and "to" as fractions between 0 and 1.`); }
    if (s.kind === 'open') { step.app = str(s.app, 80); if (!step.app) errors.push(`${where}: open needs an app name.`); if (scope === 'internal') errors.push(`${where}: an internal routine stays inside AXON and cannot open other apps.`); }
    if (s.kind === 'wait') { const ms = Number(s.ms); if (!Number.isFinite(ms) || ms < 0 || ms > LIMITS.maxWaitMs) errors.push(`${where}: wait must be 0 to ${LIMITS.maxWaitMs} ms.`); else step.ms = Math.round(ms); }
    if (s.kind === 'wait-for') {
      const u = s.until ?? {}; const until = {};
      if (u.text) until.text = str(u.text, 100); if (u.textGone) until.textGone = str(u.textGone, 100); if (u.package) until.package = str(u.package, 120); if (Number.isFinite(u.idleMs)) until.idleMs = Math.min(10000, Math.max(100, u.idleMs));
      if (!Object.keys(until).length) errors.push(`${where}: wait-for needs text, textGone, package or idleMs.`);
      step.until = until; step.timeoutMs = Math.min(LIMITS.maxWaitForMs, Math.max(500, Number(s.timeoutMs) || 8000));
    }
    if (s.delayAfterMs !== undefined) { const d = Number(s.delayAfterMs); if (!Number.isFinite(d) || d < 0 || d > LIMITS.maxWaitMs) errors.push(`${where}: delayAfterMs must be 0 to ${LIMITS.maxWaitMs}.`); else step.delayAfterMs = Math.round(d); }
    if (s.optional === true) step.optional = true;
    steps.push(step);
  });
  const rep = r.repeat ?? {};
  const repeat = {};
  if (rep.forever === true) repeat.forever = true;
  else { const c = rep.count === undefined ? 1 : Number(rep.count); if (!Number.isInteger(c) || c < 1 || c > LIMITS.maxLoops) errors.push(`repeat.count must be a whole number from 1 to ${LIMITS.maxLoops}.`); else repeat.count = c; }
  const interval = rep.intervalMs === undefined ? DEFAULTS.intervalMs : Number(rep.intervalMs);
  if (!Number.isFinite(interval) || interval < LIMITS.minIntervalMs) errors.push(`The time between rounds must be at least ${LIMITS.minIntervalMs} ms (a safety floor).`); else repeat.intervalMs = Math.round(interval);
  const jitter = rep.jitterMs === undefined ? 0 : Number(rep.jitterMs);
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > interval / 2) errors.push('jitterMs must be between 0 and half the interval.'); else repeat.jitterMs = Math.round(jitter);
  const l = r.limits ?? {};
  const limits = {
    maxRuntimeMs: Math.min(LIMITS.maxRuntimeMs, Math.max(1000, Number(l.maxRuntimeMs) || DEFAULTS.maxRuntimeMs)),
    maxActions: Math.min(LIMITS.maxActions, Math.max(1, Number(l.maxActions) || DEFAULTS.maxActions)),
    stuckAfter: Math.min(50, Math.max(1, Number(l.stuckAfter) || DEFAULTS.stuckAfter)),
  };
  const preapprove = [];
  for (const idx of Array.isArray(r.preapprove) ? r.preapprove : []) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= steps.length) errors.push(`preapprove: step ${idx} does not exist.`);
    else if (!PREAPPROVABLE.has(steps[idx].kind)) errors.push(`preapprove: step ${idx + 1} is a "${steps[idx].kind}" step. Only typing and switch steps can be pre-approved; anything that pays, sends, deletes or signs in always asks.`);
    else preapprove.push(idx);
  }
  const routine = { id: str(r.id, 60) || undefined, name, scope, packageName: scope === 'internal' ? ownPackage : (str(r.packageName, 120) || undefined), steps, repeat, limits, preapprove };
  return { ok: errors.length === 0, errors, routine };
}

function stable(v) { if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`; if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`; return JSON.stringify(v); }
/** Fingerprint of everything that can change what a routine does. The owner's approval is bound to it. */
export function routineHash(routine) {
  const { id, approvedHash, updatedAt, ...content } = routine ?? {};
  const text = stable(content);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16).padStart(8, '0')}-${text.length}`;
}
export const approveRoutine = (routine) => ({ ...routine, approvedHash: routineHash(validateRoutine(routine, { ownPackage: routine?.packageName ?? 'com.axon.app' }).routine) });
export const isApproved = (routine, options) => Boolean(routine?.approvedHash) && routine.approvedHash === routineHash(validateRoutine(routine, options).routine);

const STOP = new Set(['the', 'a', 'an', 'to', 'goes', 'go', 'button', 'this', 'that', 'is', 'it', 'and', 'of', 'on', 'in', 'for', 'you', 'your', 'opens', 'open', 'takes', 'moves', 'will', 'then', 'me', 'my']);
const tokens = (s) => String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Find the element a routine means: exact label or alias, then part of a label, then the owner's own description of what it does. */
export function resolveTarget(structure, target) {
  let els = (structure?.elements ?? []).filter((e) => e.enabled && e.actions.length && e.onScreen !== false && e.label);
  if (target?.role) els = els.filter((e) => e.role === target.role);
  const one = (list, via) => (list.length === 1 ? { element: list[0], via } : list.length > 1 ? { ambiguous: list.slice(0, 5).map((e) => ({ ref: e.ref, label: e.label })) } : null);
  const names = [target?.label, ...(target?.aliases ?? [])].map(norm).filter(Boolean);
  if (names.length) {
    const hit = one(els.filter((e) => names.includes(norm(e.label))), 'label') ?? one(els.filter((e) => names.some((n) => norm(e.label).includes(n))), 'label-part');
    if (hit) return hit;
  }
  const meaning = new Set(tokens(target?.meaning));
  if (meaning.size) {
    const fits = els.filter((e) => { const t = tokens(e.label); return t.length && t.every((w) => meaning.has(w)); });
    const most = Math.max(0, ...fits.map((e) => tokens(e.label).length));   // the description that covers the most words of a label wins
    const hit = one(fits.filter((e) => tokens(e.label).length === most), 'meaning');
    if (hit) return hit;
  }
  return { none: true };
}
