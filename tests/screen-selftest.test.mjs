import test from 'node:test';
import assert from 'node:assert/strict';
import { createStructureSource } from '../src/screen-intelligence/structure-source.mjs';
import { createScreenActor } from '../src/screen-intelligence/screen-actor.mjs';
import { runScreenSelfTest } from '../src/screen-intelligence/screen-selftest.mjs';

// A tiny fake phone showing AXON's test screen.
function phone(over = {}) {
  const st = { taps: 0, field: '', service: true, ocr: 'AXON READ 47', shot: null, tapWorks: true, ...over };
  const snapshot = () => ({ packageName: 'com.axon.app', capturedAt: Date.now(), screen: { width: 1000, height: 2000 }, nodes: [{ className: 'android.widget.LinearLayout', children: [
    { className: 'android.widget.TextView', text: `Test taps: ${st.taps}`, bounds: { l: 0, t: 0, r: 500, b: 80 } },
    { className: 'android.widget.Button', text: 'AXON test button', clickable: true, bounds: { l: 0, t: 100, r: 500, b: 200 } },
    { className: 'android.widget.Button', text: 'Delete test item', clickable: true, bounds: { l: 0, t: 220, r: 500, b: 320 } },
    { className: 'android.widget.EditText', text: st.field, hint: 'AXON test field', editable: true, bounds: { l: 0, t: 340, r: 800, b: 440 } },
    { className: 'android.widget.EditText', text: 'secret', password: true, editable: true, bounds: { l: 0, t: 460, r: 800, b: 560 } },
    { className: 'android.widget.Image', contentDescription: 'AXON test picture', bounds: { l: 0, t: 600, r: 600, b: 900 } },
  ] }] });
  const plugin = {
    getStatus: async () => ({ serviceEnabled: st.service }),
    readScreen: async () => ({ snapshot: snapshot() }),
    recognizeRegions: async ({ regions }) => ({ result: st.shot ? { ok: false, code: st.shot } : { ok: true, regions: regions.map((r) => ({ ref: r.ref, text: st.ocr })) } }),
    performAction: async ({ action }) => {
      if (!st.tapWorks) return { result: { ok: false, code: 'screen-changed' } };
      if (action.kind === 'tap' && action.path === '0.1') st.taps += 1;
      if (action.kind === 'type' && action.path === '0.3') st.field = action.text;
      return { result: { ok: true, code: action.kind } };
    },
  };
  const source = createStructureSource(plugin);
  return { st, source, actor: createScreenActor({ source }), options: { wait: async () => {}, settleMs: 0 } };
}
const run = (p, extra = {}) => runScreenSelfTest({ source: p.source, actor: p.actor, options: { ...p.options, ...extra } });
const status = (r, step) => r.lines.find((l) => l.step === step)?.status;

test('a healthy phone passes every step including typing', async () => {
  const p = phone(); const r = await run(p, { approveTyping: true });
  assert.equal(r.passed, true); assert.equal(r.lines.length, 9); assert.ok(r.lines.every((l) => l.status === 'PASS'), JSON.stringify(r.lines.filter((l) => l.status !== 'PASS')));
  assert.equal(p.st.taps, 1); assert.equal(p.st.field, 'hello axon'); assert.match(r.summary, /9 passed, 0 failed/);
});
test('typing is skipped unless the owner ticks the box, and nothing is typed', async () => {
  const p = phone(); const r = await run(p);
  assert.equal(r.passed, true); assert.equal(status(r, 'AXON types for you'), 'SKIP'); assert.equal(p.st.field, '');
});
test('service off stops at once with plain help', async () => {
  const r = await run(phone({ service: false }));
  assert.equal(r.passed, false); assert.equal(r.lines.length, 1); assert.match(r.lines[0].text, /Accessibility/);
});
test('wrong picture text fails that step; a protected screen only skips it', async () => {
  assert.equal(status(await run(phone({ ocr: 'nothing useful' })), 'Read text inside a picture'), 'FAIL');
  const prot = await run(phone({ shot: 'screen-protected' }));
  assert.equal(status(prot, 'Read text inside a picture'), 'SKIP'); assert.equal(prot.passed, true);
  assert.match((await run(phone({ shot: 'screenshot-needs-android-11' }))).lines.find((l) => l.step === 'Read text inside a picture').text, /Android 11/);
});
test('a tap that does not run, or does not change anything, fails honestly', async () => {
  const r = await run(phone({ tapWorks: false }));
  assert.equal(status(r, 'AXON taps a button for you'), 'FAIL'); assert.equal(r.passed, false); assert.match(r.lines.find((l) => l.status === 'FAIL').text, /screen-changed/);
});
test('the risky button and the password field are never touched', async () => {
  const p = phone(); const r = await run(p, { approveTyping: true });
  assert.equal(status(r, 'Gate asks before risky taps'), 'PASS'); assert.equal(status(r, 'Gate refuses password typing'), 'PASS');
  assert.equal(p.st.taps, 1);
});
