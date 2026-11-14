import test from 'node:test';
import assert from 'node:assert/strict';
import { createStructureSource } from '../src/screen-intelligence/structure-source.mjs';
import { createAppsSource } from '../src/axon-apps/apps-source.mjs';
import { createAppsController } from '../src/axon-apps/apps-controller.mjs';

// A fake phone with AXON, a Notes app, a Bank app and a Chrome app.
function phone(over = {}) {
  const st = { clock: 5_000_000, fg: 'com.axon.app', view: 'list', notes: 0, draft: '', fail: false, listFails: false, ...over };
  const b = (i) => ({ l: 0, t: i * 120, r: 900, b: i * 120 + 100 });
  const btn = (text, i) => ({ className: 'android.widget.Button', text, clickable: true, bounds: b(i) });
  const nodes = () => {
    if (st.fg === 'com.example.notes') return st.view === 'editor'
      ? [{ className: 'android.widget.EditText', hint: 'Note text', text: st.draft, editable: true, bounds: b(0) }, btn('Save', 1), btn('Save draft', 2), btn('Cancel', 3)]
      : [btn('New note', 0), { className: 'android.widget.TextView', text: `Notes: ${st.notes}`, bounds: b(1) }];
    if (st.fg === 'com.example.bankapp') return [btn('Check balance', 0)];
    if (st.fg === 'com.android.chrome') return [btn('Search', 0)];
    return [{ className: 'android.widget.TextView', text: 'AXON home', bounds: b(0) }];
  };
  const screenPlugin = {
    getStatus: async () => ({ serviceEnabled: true }),
    readScreen: async () => ({ snapshot: { packageName: st.fg, capturedAt: st.clock, screen: { width: 1000, height: 2000 }, nodes: [{ className: 'android.widget.LinearLayout', children: nodes() }] } }),
    performAction: async ({ action }) => {
      if (st.fail) return { result: { ok: false, code: 'screen-changed' } };
      if (action.kind === 'back') { if (st.view === 'editor') st.view = 'list'; else st.fg = 'com.axon.app'; return { result: { ok: true, code: 'back' } }; }
      if (action.kind === 'home') { st.fg = 'com.axon.app'; return { result: { ok: true, code: 'home' } }; }
      if (action.packageName !== st.fg) return { result: { ok: false, code: 'screen-changed' } };
      if (action.kind === 'tap' && action.label === 'New note') st.view = 'editor';
      if (action.kind === 'tap' && action.label === 'Save') { st.notes += 1; st.view = 'list'; st.draft = ''; }
      if (action.kind === 'tap' && action.label === 'Cancel') st.view = 'list';
      if (action.kind === 'type') st.draft = action.text;
      return { result: { ok: true, code: action.kind } };
    },
  };
  const appsPlugin = {
    listApps: async () => { if (st.listFails) throw new Error('no-apps'); return { apps: [
      { packageName: 'com.axon.app', label: 'AXON', self: true }, { packageName: 'com.example.notes', label: 'Notes' }, { packageName: 'com.example.bankapp', label: 'Bank App' },
      { packageName: 'com.android.chrome', label: 'Chrome' }, { packageName: 'com.calc.one', label: 'Calculator' }, { packageName: 'com.calc.two', label: 'Calculator' }] }; },
    openApp: async ({ packageName }) => { st.fg = packageName; st.view = 'list'; return { opened: true }; },
  };
  const wait = async (ms) => { st.clock += ms; };
  const c = createAppsController({ screen: createStructureSource(screenPlugin), apps: createAppsSource(appsPlugin), now: () => st.clock, wait, ...over.ctl });
  return { st, c };
}

test('lists and searches installed apps', async () => {
  const { c } = phone();
  assert.equal((await c.listApps()).apps.length, 6);
  assert.deepEqual((await c.listApps('chrme')).apps.map((a) => a.label), ['Chrome']);
});
test('opens an ordinary app and reports its screen', async () => {
  const { st, c } = phone();
  const r = await c.open('notes');
  assert.deepEqual([r.ok, r.status, r.screen.packageName], [true, 'done', 'com.example.notes']);
  assert.equal(st.fg, 'com.example.notes'); assert.match(c.log()[0].text, /Open com.example.notes/);
});
test('ambiguous and unknown app names are not guessed', async () => {
  const { st, c } = phone();
  const a = await c.open('calculator');
  assert.equal(a.status, 'ambiguous'); assert.equal(a.candidates.length, 2); assert.equal(st.fg, 'com.axon.app');
  assert.equal((await c.open('zzzzzz')).status, 'not-found');
});
test('a money app asks first; no opens nothing, yes opens it', async () => {
  const { st, c } = phone();
  const r = await c.open('bank');
  assert.deepEqual([r.status, r.code], ['needs-approval', 'sensitive-app']); assert.equal(st.fg, 'com.axon.app');
  assert.equal((await c.approve(false)).status, 'declined'); assert.equal(st.fg, 'com.axon.app');
  await c.open('bank'); const yes = await c.approve(true);
  assert.deepEqual([yes.ok, st.fg], [true, 'com.example.bankapp']);
  assert.equal((await c.approve(true)).status, 'nothing-pending');
});
test('inside a money app even a plain tap asks, but scrolling and Back do not', async () => {
  const { c } = phone({ fg: 'com.example.bankapp' });
  assert.equal((await c.tap('Check balance')).code, 'sensitive-app');
  assert.equal((await c.back()).ok, true);
});
test('taps change the screen and say what changed; typing asks and never leaks the text', async () => {
  const { st, c } = phone();
  await c.open('notes');
  const t = await c.tap('New note');
  assert.equal(t.ok, true); assert.match(t.changes, /new/); assert.equal(st.view, 'editor');
  const ty = await c.type('Note text', 'my private words');
  assert.deepEqual([ty.status, ty.code], ['needs-approval', 'typing']); assert.ok(!JSON.stringify(ty).includes('private words'));
  const ok = await c.approve(true);
  assert.equal(ok.ok, true); assert.equal(st.draft, 'my private words');
  assert.ok(!JSON.stringify(c.log()).includes('private words')); assert.ok(!JSON.stringify(ok).includes('private words'));
});
test('ambiguous and missing buttons are reported with candidates', async () => {
  const { c } = phone({ fg: 'com.example.notes', view: 'editor' });
  const amb = await c.tap('Sav'); assert.equal(amb.status, 'ambiguous'); assert.deepEqual(amb.candidates.map((x) => x.label), ['Save', 'Save draft']);
  assert.equal((await c.tap('Save')).ok, true);
  assert.equal((await c.tap('Nope')).status, 'not-found');
});
test('a list of steps runs until something needs approval, then resumes', async () => {
  const { st, c } = phone();
  const steps = [{ do: 'open', app: 'notes' }, { do: 'tap', label: 'New note' }, { do: 'type', label: 'Note text', text: 'buy rice' }, { do: 'tap', label: 'Save' }];
  const first = await c.run(steps);
  assert.equal(first.status, 'needs-approval'); assert.equal(first.completed.length, 2); assert.equal(first.remaining.length, 1);
  const end = await c.resume(true);
  assert.deepEqual([end.status, end.completed.length, st.notes], ['done', 4, 1]);
  assert.ok(!JSON.stringify(end).includes('buy rice'));
});
test('declining or stopping cancels the rest; a failing step stops the list honestly', async () => {
  const a = phone(); await a.c.run([{ do: 'open', app: 'notes' }, { do: 'tap', label: 'New note' }, { do: 'type', label: 'Note text', text: 'x' }, { do: 'tap', label: 'Save' }]);
  assert.equal((await a.c.resume(false)).status, 'declined'); assert.equal(a.st.notes, 0);
  const b = phone(); await b.c.open('notes'); await b.c.tap('New note'); await b.c.type('Note text', 'x'); b.c.stop();
  assert.equal((await b.c.approve(true)).status, 'nothing-pending');
  const f = phone({ fail: true }); const r = await f.c.run([{ do: 'open', app: 'notes' }, { do: 'back' }]);
  assert.deepEqual([r.status, r.reason, r.completed.length], ['stopped', 'failed', 2]);
  assert.equal((await phone().c.run([{ do: 'dance' }])).status, 'stopped');
});
test('step lists are capped', async () => {
  const { c } = phone({ ctl: { maxSteps: 5 } });
  const r = await c.run(Array.from({ length: 40 }, () => ({ do: 'see' })));
  assert.deepEqual([r.status, r.completed.length], ['done', 5]);
});
test('no installed-app list means a plain failure, not a crash', async () => {
  const { c } = phone({ listFails: true });
  const r = await c.open('notes'); assert.deepEqual([r.ok, r.status, r.code], [false, 'failed', 'no-apps']);
  assert.equal((await c.listApps()).ok, false);
});
test('back and home work through the gate and the log reads in plain words', async () => {
  const { st, c } = phone({ fg: 'com.example.notes' });
  assert.equal((await c.home()).ok, true); assert.equal(st.fg, 'com.axon.app');
  assert.ok(c.log().every((l) => l.text && l.outcome));
});
