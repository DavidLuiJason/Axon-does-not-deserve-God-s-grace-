// Records what the owner does (taps, long taps, scrolls, app changes) as a DRAFT routine by label, with a fallback point.
// Typing and passwords are never recorded. Money, wallet and password apps are dropped. The draft still has to be reviewed and approved.
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const roleOf = (cls) => (/edittext/i.test(cls ?? '') ? 'input' : /button/i.test(cls ?? '') ? 'button' : undefined);
const r3 = (n) => Math.round(n * 1000) / 1000;
const direction = (e) => (Math.abs(e.scrollDy ?? 0) >= Math.abs(e.scrollDx ?? 0) ? ((e.scrollDy ?? 1) >= 0 ? 'down' : 'up') : (e.scrollDx > 0 ? 'right' : 'left'));

export function eventsToRoutine(events, { name = 'Recorded routine', scope = 'external', ownPackage = 'com.axon.app', blockedPackages = [] } = {}) {
  const notes = ['Typing and passwords are never recorded: add typing steps by hand.', 'Money, wallet and password apps are left out.', 'Review every step, then approve the routine before it can run.'];
  const keep = (Array.isArray(events) ? events : []).filter((e) => e && e.packageName && !blockedPackages.includes(e.packageName) && (scope === 'internal' ? e.packageName === ownPackage : e.packageName !== ownPackage)).sort((a, b) => a.t - b.t);
  const steps = []; let lastT = null; let lastPkg = null; let firstPkg = null; let lastScroll = null;
  const delay = (gap) => { if (steps.length && gap > 0) steps[steps.length - 1].delayAfterMs = clamp(Math.round(gap / 50) * 50, 150, 10000); };
  for (const e of keep) {
    const gap = lastT == null ? 0 : e.t - lastT;
    if (e.type === 'window') {
      if (e.packageName !== lastPkg) { if (lastPkg !== null) { delay(gap); steps.push({ kind: 'wait-for', until: { package: e.packageName }, timeoutMs: 8000 }); } lastPkg = e.packageName; firstPkg ??= e.packageName; lastT = e.t; }
      continue;
    }
    firstPkg ??= e.packageName; lastPkg ??= e.packageName;
    if (e.type === 'scroll') {
      const dir = direction(e);
      if (lastScroll && lastScroll.dir === dir && e.t - lastScroll.t < 800) { lastScroll.t = e.t; lastT = e.t; continue; }
      delay(gap); steps.push({ kind: 'scroll', direction: dir }); lastScroll = { dir, t: e.t }; lastT = e.t; continue;
    }
    if (e.type === 'click' || e.type === 'long-click') {
      lastScroll = null;
      const target = {};
      if (e.label) { target.label = String(e.label).slice(0, 80); const role = roleOf(e.className); if (role) target.role = role; }
      if (e.bounds && e.screen?.width && e.screen?.height) target.fallbackPoint = { fx: r3(clamp(((e.bounds.l + e.bounds.r) / 2) / e.screen.width, 0, 1)), fy: r3(clamp(((e.bounds.t + e.bounds.b) / 2) / e.screen.height, 0, 1)) };
      if (!target.label && !target.fallbackPoint) continue;
      delay(gap); steps.push({ kind: e.type === 'click' ? 'tap' : 'long-press', target }); lastT = e.t;
    }
  }
  const truncated = steps.length > 100;
  if (truncated) notes.push('The recording was cut at 100 steps.');
  return { routine: { name, scope, packageName: scope === 'external' ? firstPkg ?? undefined : undefined, steps: steps.slice(0, 100), repeat: { count: 1, intervalMs: 1000 } }, notes, truncated };
}

export function createRecorder({ source }) {
  let blocked = []; let active = false;
  return {
    async start({ blockedPackages = [] } = {}) { blocked = blockedPackages; const r = await source.startRecording({ blockedPackages }); active = r.ok; return r; },
    async stop(options = {}) {
      if (!active) return { ok: false, code: 'not-recording' };
      active = false;
      const r = await source.stopRecording();
      if (!r.ok) return { ok: false, code: r.code };
      return { ok: true, eventCount: r.events.length, ...eventsToRoutine(r.events, { ...options, blockedPackages: [...blocked, ...(options.blockedPackages ?? [])] }) };
    },
    isRecording: () => active,
  };
}
