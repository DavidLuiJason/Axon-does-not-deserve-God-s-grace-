// Waiting and watching: wait until something appears on screen, an app comes to the front, or the screen goes quiet.
import { diffStructures } from '../screen-intelligence/structure-reader.mjs';

const has = (s, text) => s.elements.some((e) => e.label.toLowerCase().includes(String(text).toLowerCase()) || String(e.pictureText ?? '').toLowerCase().includes(String(text).toLowerCase()));

export async function waitFor(source, until, { timeoutMs = 8000, pollMs = 300, now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const start = now(); let prev = null; let quiet = 0; let last = null;
  while (now() - start <= timeoutMs) {
    const s = await source.readScreen();
    last = s;
    if (s.ok && !s.blocked) {
      if (until.package && s.packageName === until.package) return { ok: true, reason: 'package', screen: s };
      if (until.text && has(s, until.text)) return { ok: true, reason: 'text', screen: s };
      if (until.textGone && !has(s, until.textGone)) return { ok: true, reason: 'text-gone', screen: s };
      if (until.idleMs) {
        if (prev?.ok && prev.packageName === s.packageName && diffStructures(prev, s).unchanged) quiet += pollMs; else quiet = 0;
        if (quiet >= until.idleMs) return { ok: true, reason: 'idle', screen: s };
      }
    }
    prev = s;
    await wait(pollMs);
  }
  return { ok: false, reason: 'timeout', screen: last };
}

/** Calls onChange(diff, screen) whenever the screen changes. Returns { stop, done }. */
export function watchScreen(source, onChange, { pollMs = 500, maxMs = 60000, now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let stopped = false;
  const done = (async () => {
    const start = now(); let prev = await source.readScreen();
    while (!stopped && now() - start < maxMs) {
      await wait(pollMs);
      if (stopped) break;
      const cur = await source.readScreen();
      if (cur.ok && prev.ok) { const d = diffStructures(prev, cur); if (!d.unchanged || !d.sameApp) onChange(d, cur); }
      prev = cur;
    }
    return { stopped };
  })();
  return { stop: () => { stopped = true; }, done };
}
