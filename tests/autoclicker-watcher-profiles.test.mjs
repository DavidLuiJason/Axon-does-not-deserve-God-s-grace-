import test from 'node:test';
import assert from 'node:assert/strict';
import { readScreenStructure } from '../src/screen-intelligence/structure-reader.mjs';
import { waitFor, watchScreen } from '../src/axon-autoclicker/screen-watcher.mjs';
import { createAppProfiles } from '../src/axon-apps/app-profiles.mjs';
import { fakePhone } from './_fakePhone.mjs';

const shot = (pkg, labels) => readScreenStructure({ packageName: pkg, screen: { width: 100, height: 100 }, nodes: [{ className: 'LinearLayout', children: labels.map((t, i) => ({ className: 'android.widget.TextView', text: t, bounds: { l: 0, t: i * 10, r: 50, b: i * 10 + 8 } })) }] });
function seq(list) { let i = 0; return { readScreen: async () => list[Math.min(i++, list.length - 1)] }; }
const clock = () => { const c = { t: 0 }; return { now: () => c.t, wait: async (ms) => { c.t += ms; } }; };

test('waitFor: text appears, text goes, app comes forward, screen goes quiet, or it times out', async () => {
  const c = clock();
  assert.equal((await waitFor(seq([shot('a', ['x']), shot('a', ['x', 'Loaded'])]), { text: 'loaded' }, c)).reason, 'text');
  assert.equal((await waitFor(seq([shot('a', ['Loading']), shot('a', ['Done'])]), { textGone: 'loading' }, c)).reason, 'text-gone');
  assert.equal((await waitFor(seq([shot('a', ['x']), shot('b', ['x'])]), { package: 'b' }, c)).reason, 'package');
  assert.equal((await waitFor(seq([shot('a', ['x']), shot('a', ['y']), shot('a', ['y']), shot('a', ['y']), shot('a', ['y'])]), { idleMs: 600 }, { ...c, pollMs: 300 })).reason, 'idle');
  const t = await waitFor(seq([shot('a', ['x'])]), { text: 'never' }, { ...clock(), timeoutMs: 1000 });
  assert.deepEqual([t.ok, t.reason], [false, 'timeout']);
});
test('watchScreen reports changes and can be stopped', async () => {
  const c = clock(); const seen = [];
  const w = watchScreen(seq([shot('a', ['x']), shot('a', ['x']), shot('a', ['x', 'new']), shot('b', ['z'])]), (d, s) => seen.push([d.sameApp, s.packageName]), { ...c, pollMs: 100, maxMs: 1000 });
  const r = await w.done;
  assert.deepEqual(seen, [[true, 'a'], [false, 'b']]); assert.equal(r.stopped, false);
  const w2 = watchScreen(seq([shot('a', ['x'])]), () => assert.fail('no change expected'), { ...c, pollMs: 100, maxMs: 100000 });
  w2.stop(); assert.equal((await w2.done).stopped, true);
});
test('app profiles: own names for apps, notes, and saving them', () => {
  const p = createAppProfiles();
  assert.equal(p.setAlias('  My   Bank ', 'com.example.bankapp'), true); assert.equal(p.lookup('my bank'), 'com.example.bankapp'); assert.equal(p.lookup('other'), null);
  assert.equal(p.setAlias('', 'x'), false); p.setNote('com.example.notes', 'n'.repeat(900)); assert.equal(p.getNote('com.example.notes').length, 500);
  const copy = createAppProfiles(JSON.parse(JSON.stringify(p.toJSON())));
  assert.equal(copy.lookup('MY BANK'), 'com.example.bankapp'); assert.equal(copy.removeAlias('my bank'), true); assert.equal(copy.lookup('my bank'), null);
});
test('AXON Apps opens an app by the owner\'s own name, and a money app still asks', async () => {
  const profiles = createAppProfiles({ aliases: { 'my game': 'com.example.game', 'my bank': 'com.example.bankapp' } });
  const p = fakePhone({ ctl: { profiles } });
  assert.equal((await p.c.open('my game')).status, 'done'); assert.equal(p.st.fg, 'com.example.game');
  assert.equal((await p.c.open('my bank')).status, 'needs-approval');
});
