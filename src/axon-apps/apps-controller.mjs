// AXON Apps controller: see installed apps, open one, read its screen, tap, type, scroll, go back, and carry a short list of
// steps. Every action goes through the action gate; risky ones stop and wait for the owner's yes. It plans nothing: the brain
// (or the owner) decides what to do, this does it safely and says what happened in plain words.
import { createScreenActor } from '../screen-intelligence/screen-actor.mjs';
import { findElements, diffStructures } from '../screen-intelligence/structure-reader.mjs';
import { readPictures } from '../screen-intelligence/picture-reader.mjs';
import { normalizeApps, searchApps, resolveApp, sensitiveApps } from './app-catalog.mjs';

const SCREEN_KINDS = new Set(['tap', 'long-press', 'type', 'toggle', 'scroll']);
const area = (e) => (e.bounds ? Math.max(0, e.bounds.r - e.bounds.l) * Math.max(0, e.bounds.b - e.bounds.t) : 0);
const brief = (e) => ({ ref: e.ref, label: e.label, role: e.role });
// Returned to callers and shown to the owner: typed text is never repeated.
const publicProposal = (p) => ({ ...p, action: { ...p.action, ...(p.action?.text ? { text: '[hidden]' } : {}) } });

export function createAppsController({ screen, apps, policy = {}, now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms)), maxSteps = 30 }) {
  let catalog = []; let actor = null; let pending = null; let queue = []; let carried = []; let stopped = false;
  const log = [];
  const note = (text, outcome) => { log.push({ at: now(), text, outcome }); if (log.length > 200) log.shift(); };

  async function refresh() {
    const raw = await apps.listApps();
    if (!raw.ok) return { ok: false, code: raw.code };
    catalog = normalizeApps(raw.apps);
    const askPackages = [...(policy.askPackages ?? []), ...sensitiveApps(catalog).map((a) => a.packageName)];
    actor = createScreenActor({ source: screen, apps, policy: { ...policy, askPackages }, now });
    return { ok: true, count: catalog.length };
  }
  async function ready() { if (actor) return { ok: true }; return refresh(); }

  function summarizeChange(before, after) {
    if (!after?.ok) return 'The screen could not be read afterwards.';
    if (!before?.ok) return `Now on ${after.packageName}.`;
    const d = diffStructures(before, after);
    if (!d.sameApp) return `Moved to ${after.packageName}.`;
    if (d.unchanged) return 'The screen did not change.';
    const names = d.added.map((e) => e.label).filter(Boolean).slice(0, 3);
    return `${d.added.length} new, ${d.removed.length} gone, ${d.changed.length} changed${names.length ? `; new: ${names.map((n) => `"${n}"`).join(', ')}` : ''}.`;
  }

  async function settle({ quietMs = 600, timeoutMs = 4000, pollMs = 250 } = {}) {
    let prev = await screen.readScreen(); let quiet = 0; const start = now();
    while (now() - start < timeoutMs) {
      await wait(pollMs);
      const cur = await screen.readScreen();
      if (cur.ok && prev.ok && cur.packageName === prev.packageName && diffStructures(prev, cur).unchanged) { quiet += pollMs; if (quiet >= quietMs) return { settled: true, screen: cur }; } else quiet = 0;
      prev = cur;
    }
    return { settled: false, screen: prev };
  }

  async function waitForApp(packageName, { timeoutMs = 8000, pollMs = 400 } = {}) {
    const start = now();
    while (now() - start < timeoutMs) {
      const s = await screen.readScreen();
      if (s.ok && s.packageName === packageName) return true;
      await wait(pollMs);
    }
    return false;
  }

  function pick(structure, { ref, label, role }) {
    if (ref) { const e = structure.elements.find((x) => x.ref === ref); return e ? { element: e } : { none: true }; }
    let matches = findElements(structure, { text: label, role });
    const visible = matches.filter((e) => e.onScreen !== false);
    if (visible.length) matches = visible;
    if (!matches.length) return { none: true };
    const exact = matches.filter((e) => e.label.toLowerCase() === String(label).toLowerCase());
    if (exact.length === 1) return { element: exact[0] };
    if (matches.length === 1) return { element: matches[0] };
    return { ambiguous: matches.slice(0, 5).map(brief) };
  }

  async function finish(proposal, answer, before) {
    const done = await actor.execute(proposal, answer);
    if (!done.executed) { note(`Could not: ${proposal.summary} (${done.code})`, 'failed'); return { ok: false, status: 'failed', code: done.code, text: `That did not work (${done.code}).` }; }
    note(proposal.summary, 'done');
    if (proposal.action.kind === 'open-app') {
      const seen = await waitForApp(proposal.action.packageName);
      if (!seen) return { ok: true, status: 'opened-not-seen', text: `${proposal.summary}. The app was asked to open but its screen is not showing yet.` };
    }
    const { settled, screen: after } = await settle();
    return { ok: true, status: 'done', settled, text: proposal.summary, changes: summarizeChange(before, after), screen: after };
  }

  async function act(request, target = {}) {
    const r0 = await ready();
    if (!r0.ok) return { ok: false, status: 'failed', code: r0.code, text: `AXON cannot list apps (${r0.code}).` };
    let before = null; let req = { ...request };
    if (request.kind !== 'open-app') {
      before = await screen.readScreen({ blockedPackages: policy.blockedPackages ?? [] });
      if (!before.ok) return { ok: false, status: 'refused', code: 'no-screen', text: before.help ?? `Cannot read the screen (${before.reason}).` };
      if (SCREEN_KINDS.has(request.kind)) {
        let found;
        if (request.kind === 'scroll' && !target.ref && !target.label) {
          const best = before.elements.filter((e) => e.actions.includes('scroll') && e.onScreen !== false).sort((a, b) => area(b) - area(a))[0];
          found = best ? { element: best } : { none: true };
        } else found = pick(before, target);
        if (found.none) return { ok: false, status: 'not-found', text: `I can't see ${target.label ? `"${target.label}"` : 'that'} on this screen.` };
        if (found.ambiguous) return { ok: false, status: 'ambiguous', text: `More than one item matches "${target.label}".`, candidates: found.ambiguous };
        req.ref = found.element.ref;
      }
    }
    const { proposal } = await actor.propose(req, {}, before);
    if (proposal.decision === 'refuse') { note(`Refused: ${proposal.reason}`, 'refused'); return { ok: false, status: 'refused', code: proposal.code, text: proposal.reason }; }
    if (proposal.decision === 'ask') {
      pending = { proposal, before };
      note(`Asked you: ${proposal.summary}`, 'asked');
      return { ok: false, status: 'needs-approval', code: proposal.code, question: `${proposal.summary}? ${proposal.reason}`, proposal: publicProposal(proposal) };
    }
    return finish(proposal, {}, before);
  }

  async function approve(answer) {
    if (!pending) return { ok: false, status: 'nothing-pending' };
    const p = pending; pending = null;
    if (answer !== true) { note(`You said no: ${p.proposal.summary}`, 'declined'); return { ok: false, status: 'declined', text: 'Cancelled.' }; }
    return finish(p.proposal, { approved: true }, p.before);
  }

  async function open(query) {
    const r0 = await ready();
    if (!r0.ok) return { ok: false, status: 'failed', code: r0.code, text: `AXON cannot list apps (${r0.code}).` };
    const hit = resolveApp(catalog, query);
    if (hit.status === 'none') return { ok: false, status: 'not-found', text: `No installed app matches "${query}".` };
    if (hit.status === 'ambiguous') return { ok: false, status: 'ambiguous', text: `More than one app matches "${query}".`, candidates: hit.candidates.map((a) => ({ label: a.label, packageName: a.packageName })) };
    return act({ kind: 'open-app', packageName: hit.app.packageName });
  }

  async function runStep(step) {
    switch (step?.do) {
      case 'open': return open(step.app);
      case 'tap': return act({ kind: 'tap' }, { label: step.label, ref: step.ref, role: step.role });
      case 'long-press': return act({ kind: 'long-press' }, { label: step.label, ref: step.ref });
      case 'toggle': return act({ kind: 'toggle' }, { label: step.label, ref: step.ref });
      case 'type': return act({ kind: 'type', text: step.text }, { label: step.label, ref: step.ref, role: 'input' });
      case 'scroll': return act({ kind: 'scroll', direction: step.direction ?? 'down' }, { label: step.label, ref: step.ref });
      case 'back': return act({ kind: 'back' });
      case 'home': return act({ kind: 'home' });
      case 'see': return { ok: true, status: 'done', text: 'Looked at the screen.', screen: await screen.readScreen() };
      default: return { ok: false, status: 'failed', code: 'unknown-step', text: `Unknown step "${step?.do}".` };
    }
  }

  async function drain() {
    while (queue.length) {
      if (stopped) return { status: 'stopped', completed: carried, remaining: queue };
      const step = queue.shift();
      const r = await runStep(step);
      if (r.status === 'needs-approval') return { status: 'needs-approval', completed: carried, question: r.question, remaining: queue };
      carried.push({ step, status: r.status, text: r.text ?? r.changes ?? '' });
      if (!r.ok) return { status: 'stopped', reason: r.status, text: r.text, completed: carried, remaining: queue };
    }
    return { status: 'done', completed: carried, remaining: [] };
  }

  return {
    refresh,
    async listApps(query, { limit = 50 } = {}) { const r = await ready(); if (!r.ok) return { ok: false, code: r.code, apps: [] }; return { ok: true, apps: query ? searchApps(catalog, query, { limit }).map((x) => x.app) : catalog.slice(0, limit) }; },
    open,
    async see({ pictures = false } = {}) { const s = await screen.readScreen({ blockedPackages: policy.blockedPackages ?? [] }); return pictures && s.ok ? readPictures(screen, s) : s; },
    tap: (label, o = {}) => act({ kind: 'tap' }, { label, ...o }),
    longPress: (label, o = {}) => act({ kind: 'long-press' }, { label, ...o }),
    toggle: (label, o = {}) => act({ kind: 'toggle' }, { label, ...o }),
    type: (label, text, o = {}) => act({ kind: 'type', text }, { label, role: 'input', ...o }),
    scroll: (direction = 'down', o = {}) => act({ kind: 'scroll', direction }, o),
    back: () => act({ kind: 'back' }),
    home: () => act({ kind: 'home' }),
    approve,
    async run(steps) { queue = (Array.isArray(steps) ? steps : []).slice(0, maxSteps); carried = []; stopped = false; return drain(); },
    async resume(answer) {
      const r = await approve(answer);
      if (!r.ok) { queue = []; return { status: r.status === 'declined' ? 'declined' : 'stopped', reason: r.status, completed: carried, remaining: [] }; }
      carried.push({ step: 'approved', status: r.status, text: r.text });
      return drain();
    },
    stop() { stopped = true; pending = null; note('Stopped by the owner.', 'stopped'); },
    log: () => log.slice(),
  };
}
