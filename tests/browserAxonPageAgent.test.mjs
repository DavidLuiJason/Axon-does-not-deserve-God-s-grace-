import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../android-overlay/app/src/main/assets/axon_page_agent.js', import.meta.url), 'utf8');

class FakeElement {
  constructor(tagName, attrs = {}, opts = {}) {
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
    this.innerText = opts.text ?? '';
    this.value = opts.value ?? '';
    this.disabled = opts.disabled === true;
    this.hidden = opts.hidden === true;
    this.form = opts.form ?? null;
    this.options = opts.options ?? [];
    this.events = [];
    this.clicks = 0;
    this.checked = false;
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getBoundingClientRect() { return this.hidden ? { width: 0, height: 0 } : { width: 80, height: 20 }; }
  closest(selector) { return selector === 'form' ? this.form : null; }
  click() { this.clicks += 1; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  dispatchEvent(event) { this.events.push(event.type); return true; }
}
class FakeForm { constructor(hasPassword) { this.hasPassword = hasPassword; } querySelector(sel) { return this.hasPassword && sel.includes('password') ? {} : null; } }

function makePage(elements, extra = {}) {
  const document = {
    title: 'Test page',
    body: { innerText: extra.text ?? 'Hello world' },
    querySelectorAll: () => elements,
    querySelector: (sel) => { const m = /data-axon-id="([^"]+)"/.exec(sel); return m ? elements.find((e) => e.attrs['data-axon-id'] === m[1]) ?? null : null; },
  };
  const scrolls = [];
  const window = { scrollY: 0, scrollBy: (x, y) => { scrolls.push(y); window.scrollY += y; }, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  const sandbox = { window, document, location: { href: extra.url ?? 'https://example.test/' }, Event: class { constructor(type) { this.type = type; } }, JSON, Object, String, Number, Math, isFinite };
  sandbox.window.document = document;
  vm.runInNewContext(source, sandbox);
  return { agent: window.__axonAgent, scrolls, window };
}
const parse = (text) => JSON.parse(text);

test('snapshot lists visible enabled controls with stable ids and hides sensitive values', () => {
  const link = new FakeElement('a', { href: '/next' }, { text: 'Next page' });
  const hiddenBtn = new FakeElement('button', {}, { text: 'Hidden', hidden: true });
  const off = new FakeElement('button', {}, { text: 'Off', disabled: true });
  const pass = new FakeElement('input', { type: 'password', name: 'pw' }, { value: 'secret123' });
  const box = new FakeElement('input', { type: 'text', name: 'q', placeholder: 'Search' }, { value: 'abc' });
  const { agent } = makePage([link, hiddenBtn, off, pass, box]);
  const first = parse(agent.snapshot());
  assert.equal(first.ok, true);
  assert.equal(first.title, 'Test page');
  assert.equal(first.text, 'Hello world');
  assert.deepEqual(first.elements.map((e) => e.id), ['e1', 'e2', 'e3']);
  assert.equal(first.elements[0].role, 'link');
  assert.equal(first.elements[0].href, '/next');
  const passItem = first.elements.find((e) => e.inputType === 'password');
  assert.equal(passItem.sensitive, true);
  assert.equal('value' in passItem, false, 'a password value must never be reported');
  assert.equal(first.elements.find((e) => e.name === 'q').value, 'abc');
  assert.deepEqual(parse(agent.snapshot()).elements.map((e) => e.id), ['e1', 'e2', 'e3'], 'ids stay stable on the same page');
});

test('click works on normal controls and is recorded', () => {
  const link = new FakeElement('a', { href: '/x' }, { text: 'Read more' });
  const { agent } = makePage([link]);
  agent.snapshot();
  const result = parse(agent.act(JSON.stringify({ type: 'click', id: 'e1' })));
  assert.equal(result.ok, true);
  assert.equal(link.clicks, 1);
});

test('payment and sign-in clicks are always refused as owner handoff, even if approved', () => {
  const pay = new FakeElement('button', { type: 'submit' }, { text: 'Place order', form: new FakeForm(false) });
  const signIn = new FakeElement('button', { type: 'submit' }, { text: 'Continue', form: new FakeForm(true) });
  const { agent } = makePage([pay, signIn]);
  const snap = parse(agent.snapshot());
  assert.equal(snap.elements[0].risk, 'payment');
  assert.equal(snap.elements[1].risk, 'sign-in');
  for (const id of ['e1', 'e2']) {
    const result = parse(agent.act(JSON.stringify({ type: 'click', id, approved: true })));
    assert.equal(result.ok, false);
    assert.equal(result.error, 'owner-handoff');
  }
  assert.equal(pay.clicks + signIn.clicks, 0);
});

test('a plain form submit needs approval and then works', () => {
  const send = new FakeElement('button', { type: 'submit' }, { text: 'Send feedback', form: new FakeForm(false) });
  const { agent } = makePage([send]);
  assert.equal(parse(agent.snapshot()).elements[0].risk, 'submit');
  const refused = parse(agent.act(JSON.stringify({ type: 'click', id: 'e1' })));
  assert.equal(refused.error, 'owner-approval-required');
  assert.equal(send.clicks, 0);
  assert.equal(parse(agent.act(JSON.stringify({ type: 'click', id: 'e1', approved: true }))).ok, true);
  assert.equal(send.clicks, 1);
});

test('typing fills a text field and fires input and change; sensitive fields are refused', () => {
  const box = new FakeElement('input', { type: 'text', name: 'q' });
  const pass = new FakeElement('input', { type: 'password' });
  const card = new FakeElement('input', { type: 'text', autocomplete: 'cc-number' });
  const { agent } = makePage([box, pass, card]);
  agent.snapshot();
  assert.equal(parse(agent.act(JSON.stringify({ type: 'type', id: 'e1', text: 'phones' }))).ok, true);
  assert.equal(box.value, 'phones');
  assert.deepEqual(box.events, ['input', 'change']);
  assert.equal(parse(agent.act(JSON.stringify({ type: 'type', id: 'e2', text: 'x' }))).error, 'sensitive-field');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'type', id: 'e3', text: '4111111111111111' }))).error, 'sensitive-field');
  assert.equal(pass.value, '');
});

test('select, scroll and every bad input are handled', () => {
  const sel = new FakeElement('select', {}, { options: [{ value: 'a' }, { value: 'b' }] });
  const link = new FakeElement('a', { href: '/' }, { text: 'Home' });
  const { agent, scrolls } = makePage([sel, link]);
  agent.snapshot();
  assert.equal(parse(agent.act(JSON.stringify({ type: 'select', id: 'e1', value: 'b' }))).ok, true);
  assert.equal(sel.value, 'b');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'select', id: 'e1', value: 'zzz' }))).error, 'no-such-option');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'select', id: 'e2', value: 'a' }))).error, 'not-a-select');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'scroll', dy: 400 }))).y, 400);
  assert.equal(parse(agent.act(JSON.stringify({ type: 'scroll', dy: 999999 }))).y, 400 + 5000);
  assert.deepEqual(scrolls, [400, 5000]);
  assert.equal(parse(agent.act(JSON.stringify({ type: 'scroll', dy: 'x' }))).error, 'bad-action');
  assert.equal(parse(agent.act('not json')).error, 'bad-action');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'click', id: 'e1"]x' }))).error, 'bad-id');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'click', id: 'e99' }))).error, 'no-such-element');
  assert.equal(parse(agent.act(JSON.stringify({ type: 'dance', id: 'e1' }))).error, 'bad-action');
});

test('an action aimed at a different page than the snapshot is refused', () => {
  const link = new FakeElement('a', { href: '/' }, { text: 'Home' });
  const { agent } = makePage([link], { url: 'https://example.test/b' });
  agent.snapshot();
  const result = parse(agent.act(JSON.stringify({ type: 'click', id: 'e1', url: 'https://example.test/a' })));
  assert.equal(result.error, 'page-changed');
  assert.equal(link.clicks, 0);
});

test('snapshot caps the element list and the page text', () => {
  const many = Array.from({ length: 150 }, (_, i) => new FakeElement('a', { href: '/' + i }, { text: 'L' + i }));
  const { agent } = makePage(many, { text: 'x'.repeat(30000) });
  const snap = parse(agent.snapshot());
  assert.equal(snap.elements.length, 120);
  assert.equal(snap.text.length, 20000);
  assert.equal(snap.truncated, true);
});
