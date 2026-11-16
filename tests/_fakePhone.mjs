// Shared fake phone for the AXON Apps and auto-clicker tests (not a test itself).
import { createStructureSource } from '../src/screen-intelligence/structure-source.mjs';
import { createAppsSource } from '../src/axon-apps/apps-source.mjs';
import { createAppsController } from '../src/axon-apps/apps-controller.mjs';

export function fakePhone(over = {}) {
  const st = { clock: 9_000_000, fg: 'com.axon.app', view: 'list', notes: 0, draft: '', score: 0, canvas: 0, swipes: 0, axonTaps: 0, kill: false, noOverlay: false, stopShown: false, stopHidden: 0, gestures: [], ...over.state };
  const box = (i) => ({ l: 0, t: i * 120, r: 900, b: i * 120 + 100 });
  const btn = (text, i) => ({ className: 'android.widget.Button', text, clickable: true, bounds: box(i) });
  const txt = (text, i) => ({ className: 'android.widget.TextView', text, bounds: box(i) });
  const nodes = () => {
    if (st.fg === 'com.example.game') return [txt(`Score: ${st.score}`, 0), btn('Tap me', 1)];
    if (st.fg === 'com.example.notes') return st.view === 'editor'
      ? [{ className: 'android.widget.EditText', hint: 'Note text', text: st.draft, editable: true, bounds: box(0) }, btn('Save', 1), btn('Cancel', 2)]
      : [btn('New note', 0), txt(`Notes: ${st.notes}`, 1)];
    if (st.fg === 'com.example.bankapp') return [btn('Check balance', 0), btn('Pay now', 1)];
    return [txt(`AXON taps: ${st.axonTaps}`, 0), btn('Test button', 1), btn('Noop', 2)];
  };
  const dead = () => (st.kill ? { result: { ok: false, code: 'stopped-by-owner' } } : null);
  const plugin = {
    getStatus: async () => ({ serviceEnabled: true }),
    readScreen: async () => ({ snapshot: { packageName: st.fg, capturedAt: st.clock, screen: { width: 1000, height: 2000 }, nodes: [{ className: 'android.widget.LinearLayout', children: nodes() }] } }),
    performAction: async ({ action }) => {
      if (dead()) return dead();
      if (action.kind === 'back') { if (st.view === 'editor') st.view = 'list'; else st.fg = 'com.axon.app'; return { result: { ok: true, code: 'back' } }; }
      if (action.kind === 'home') { st.fg = 'com.axon.app'; return { result: { ok: true, code: 'home' } }; }
      if (action.packageName !== st.fg) return { result: { ok: false, code: 'screen-changed' } };
      if (action.kind === 'tap') {
        if (action.label === 'Test button') st.axonTaps += 1;
        if (action.label === 'Tap me') st.score += 1;
        if (action.label === 'New note') st.view = 'editor';
        if (action.label === 'Save') { st.notes += 1; st.view = 'list'; st.draft = ''; }
        if (action.label === 'Cancel') st.view = 'list';
      }
      if (action.kind === 'type') st.draft = action.text;
      return { result: { ok: true, code: action.kind } };
    },
    performGesture: async ({ action }) => {
      if (dead()) return dead();
      if (action.packageName !== st.fg) return { result: { ok: false, code: 'screen-changed' } };
      st.gestures.push(action);
      if (action.kind === 'swipe') st.swipes += 1;
      else if (st.fg === 'com.example.game') { if (action.x <= 900 && action.y >= 120 && action.y <= 220) st.score += 1; else if (action.y > 1000) st.canvas += 1; }
      return { result: { ok: true, code: action.kind } };
    },
    getKillState: async () => ({ stopRequested: st.kill }),
    requestStop: async () => { st.kill = true; },
    clearStop: async () => { st.kill = false; },
    showStopControl: async () => { if (st.noOverlay) return { shown: false, code: 'overlay-denied' }; st.stopShown = true; return { shown: true }; },
    hideStopControl: async () => { st.stopShown = false; st.stopHidden += 1; },
  };
  const appsPlugin = {
    listApps: async () => ({ apps: [{ packageName: 'com.axon.app', label: 'AXON', self: true }, { packageName: 'com.example.notes', label: 'Notes' }, { packageName: 'com.example.game', label: 'Tap Game' }, { packageName: 'com.example.bankapp', label: 'Bank App' }] }),
    openApp: async ({ packageName }) => { st.fg = packageName; st.view = 'list'; return { opened: true }; },
  };
  const wait = async (ms) => { st.clock += ms; };
  const now = () => st.clock;
  const screen = createStructureSource(plugin);
  const apps = createAppsSource(appsPlugin);
  const c = createAppsController({ screen, apps, now, wait, ...over.ctl });
  return { st, screen, apps, c, wait, now, plugin, appsPlugin };
}
