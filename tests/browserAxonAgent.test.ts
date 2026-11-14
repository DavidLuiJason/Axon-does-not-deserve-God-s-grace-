import test from 'node:test';
import assert from 'node:assert/strict';
import { AXON_TAB_ID, AXON_WEB_TOOL_SPECS, buildSearchUrl, createAxonWebAgent } from '../src/web/axonWebAgent.ts';
import { getBrowserFunction } from '../src/web/browserCommandGateway.ts';
import type { AxonAction, AxonActResult, AxonPageElement, AxonSessionEngine, AxonSessionState, AxonSessionWireIdentity, AxonSnapshotResult } from '../src/web/axonSessionTypes.ts';

type Page = { title: string; text: string; elements: AxonPageElement[] };
const el = (id: string, role: string, text: string, extra: Partial<AxonPageElement> = {}): AxonPageElement => ({ id, role, tag: role === 'link' ? 'a' : 'button', text, sensitive: false, risk: 'none', ...extra });

class FakeEngine implements AxonSessionEngine {
  calls: string[] = [];
  actions: AxonAction[] = [];
  url = '';
  active = false;
  available = true;
  verified = true;
  credentialStoreId: string | null = null;
  pendingPolls = 0;
  pages: Record<string, Page> = {};
  nextActResult: AxonActResult | null = null;
  isAvailable() { return this.available; }
  private identity(): AxonSessionWireIdentity {
    return { owner: 'AXON', sessionId: 'axon_incognito_1', engineContextId: 'axon_incognito_1', cookiePartitionId: 'axon_incognito_1', storagePartitionId: 'axon_incognito_1', credentialStoreId: this.credentialStoreId, isolationKind: 'ENGINE_PROFILE', isolationVerified: this.verified };
  }
  private state(): AxonSessionState {
    return this.active ? { active: true, actionCount: this.actions.length, lastAction: this.calls.at(-1) ?? '', url: this.url, title: this.pages[this.url]?.title ?? '', identity: this.identity() } : { active: false, actionCount: 0, lastAction: '' };
  }
  async axonOpen(options: { url: string }): Promise<AxonSessionState> {
    this.calls.push('open:' + options.url);
    this.url = options.url;
    if (this.pendingPolls > 0) return { active: false, actionCount: 0, lastAction: '', pending: true };
    this.active = true;
    return this.state();
  }
  async axonState(): Promise<AxonSessionState> {
    this.calls.push('state');
    if (this.pendingPolls > 0) { this.pendingPolls -= 1; if (this.pendingPolls === 0) this.active = true; }
    return this.pendingPolls > 0 && !this.active ? { active: false, actionCount: 0, lastAction: '', pending: true } : this.state();
  }
  async axonSnapshot(): Promise<AxonSnapshotResult> {
    this.calls.push('snapshot');
    const page = this.pages[this.url] ?? { title: '', text: '', elements: [] };
    return { ok: true, url: this.url, title: page.title, text: page.text, elements: page.elements, truncated: false, scrollY: 0 };
  }
  async axonAct(options: { action: AxonAction }): Promise<AxonActResult> {
    this.calls.push('act:' + options.action.type);
    this.actions.push(options.action);
    if (this.nextActResult) { const r = this.nextActResult; this.nextActResult = null; return r; }
    if (options.action.type === 'click') {
      const target = this.pages[this.url]?.elements.find((item) => item.id === options.action.id);
      if (target?.role === 'link') this.url = target.href ?? this.url;
      return { ok: true, action: 'click', risk: target?.risk ?? 'none' };
    }
    return { ok: true, action: options.action.type, y: 300 };
  }
  async axonRelease(): Promise<AxonSessionState> { this.calls.push('release'); this.active = false; return this.state(); }
}

const home = 'https://example.test/';
function setup(opts: { maxSteps?: number } = {}) {
  const engine = new FakeEngine();
  engine.pages[home] = {
    title: 'Home', text: 'Welcome', elements: [
      el('e1', 'link', 'About us', { href: 'https://example.test/about' }),
      el('e2', 'textbox', 'Your name', { inputType: 'text' }),
      el('e3', 'textbox', 'Password', { inputType: 'password', sensitive: true }),
      el('e4', 'button', 'Send message', { risk: 'submit' }),
      el('e5', 'button', 'Buy now', { risk: 'payment' }),
      el('e6', 'button', 'Log in', { risk: 'sign-in' }),
      el('e7', 'select', 'Colour'),
    ],
  };
  engine.pages['https://example.test/about'] = { title: 'About', text: 'About text', elements: [] };
  const delays: number[] = [];
  const made = createAxonWebAgent({ engine, ...(opts.maxSteps === undefined ? {} : { maxSteps: opts.maxSteps }), delay: async (ms) => { delays.push(ms); } });
  return { engine, delays, ...made };
}
async function ready(opts: { maxSteps?: number } = {}) {
  const s = setup(opts);
  const opened = await s.agent.open(home);
  assert.equal(opened.ok, true);
  const snap = await s.agent.snapshot();
  assert.equal(snap.ok, true);
  return s;
}

test('search builds the search address and opens it in the AXON tab', async () => {
  const { agent, engine } = setup();
  const result = await agent.search('best phone deals');
  assert.equal(result.ok, true);
  assert.equal(engine.calls[0], 'open:' + buildSearchUrl('best phone deals'));
  assert.equal(buildSearchUrl('a b&c'), 'https://www.google.com/search?q=a%20b%26c');
});

test('bad searches and bad addresses never reach the engine', async () => {
  const { agent, engine } = setup();
  for (const url of ['javascript:alert(1)', 'https://user:pw@example.test/', 'ftp://x.test/', '']) {
    const result = await agent.open(url);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'BAD_INPUT');
  }
  const empty = await agent.search('   ');
  assert.equal(empty.ok === false && empty.code, 'BAD_INPUT');
  const long = await agent.search('x'.repeat(301));
  assert.equal(long.ok === false && long.code, 'BAD_INPUT');
  assert.deepEqual(engine.calls, []);
});

test('the session is refused and closed when isolation is not verified or a credential store is attached', async () => {
  for (const mutate of [(e: FakeEngine) => { e.verified = false; }, (e: FakeEngine) => { e.credentialStoreId = 'owner-credential-store'; }]) {
    const { agent, engine } = setup();
    mutate(engine);
    const result = await agent.open(home);
    assert.equal(result.ok === false && result.code, 'REFUSED');
    assert.ok(engine.calls.includes('release'));
    const snap = await agent.snapshot();
    assert.equal(snap.ok === false && snap.code, 'NO_SESSION');
  }
});

test('an unavailable engine is reported, and nothing works before a session exists', async () => {
  const { agent, engine } = setup();
  engine.available = false;
  const result = await agent.open(home);
  assert.equal(result.ok === false && result.code, 'UNAVAILABLE');
  for (const attempt of [() => agent.snapshot(), () => agent.read(), () => agent.click('e1'), () => agent.type('e2', 'x'), () => agent.select('e7', 'a'), () => agent.scroll(10)]) {
    const r = await attempt();
    assert.equal(r.ok === false && r.code, 'NO_SESSION');
  }
});

test('a browser screen that is still opening is waited for, then used', async () => {
  const slow = setup();
  slow.engine.pendingPolls = 2;
  const result = await slow.agent.open(home);
  assert.equal(result.ok, true);
  assert.deepEqual(slow.delays, [500, 500]);
  const never = setup();
  never.engine.pendingPolls = 99;
  const failed = await never.agent.open(home);
  assert.equal(failed.ok === false && failed.code, 'FAILED');
  assert.equal(never.delays.length, 10);
});

test('read and snapshot return the page; acting needs a fresh snapshot', async () => {
  const { agent } = setup();
  await agent.open(home);
  const stale = await agent.click('e1');
  assert.equal(stale.ok === false && stale.code, 'STALE');
  const read = await agent.read();
  assert.deepEqual(read.ok && read.value, { url: home, title: 'Home', text: 'Welcome' });
  const snap = await agent.snapshot();
  assert.equal(snap.ok && snap.value.elements.length, 7);
});

test('clicking a normal link navigates and clears the snapshot', async () => {
  const { agent, engine } = await ready();
  const clicked = await agent.click('e1');
  assert.equal(clicked.ok, true);
  assert.equal(engine.actions[0]?.url, home);
  assert.equal(engine.actions[0]?.approved, undefined);
  const again = await agent.click('e1');
  assert.equal(again.ok === false && again.code, 'STALE');
  const snap = await agent.snapshot();
  assert.equal(snap.ok && snap.value.title, 'About');
});

test('payment and sign-in are handed to the owner and never reach the page', async () => {
  const { agent, engine } = await ready();
  for (const id of ['e5', 'e6']) {
    const result = await agent.click(id);
    assert.equal(result.ok === false && result.code, 'HANDOFF');
  }
  assert.equal(engine.actions.length, 0);
});

test('a send button waits for the owner; approving runs that exact step once', async () => {
  const { agent, owner, engine } = await ready();
  const asked = await agent.click('e4');
  assert.ok(!asked.ok && asked.code === 'NEEDS_OWNER' && asked.approvalId !== undefined && asked.functionId === 'page.submit');
  assert.equal(engine.actions.length, 0);
  assert.equal(owner.pending().length, 1);
  assert.match(owner.pending()[0]?.prompt ?? '', /Send message/);
  const id = !asked.ok ? asked.approvalId ?? '' : '';
  const done = await owner.approve(id);
  assert.equal(done.ok, true);
  assert.equal(engine.actions.length, 1);
  assert.equal(engine.actions[0]?.approved, true);
  const twice = await owner.approve(id);
  assert.equal(twice.ok === false && twice.code, 'BAD_INPUT');
  assert.equal(engine.actions.length, 1);
});

test('the owner can deny a waiting step', async () => {
  const { agent, owner, engine } = await ready();
  const asked = await agent.click('e4');
  const id = !asked.ok ? asked.approvalId ?? '' : '';
  assert.equal(owner.deny(id), true);
  assert.equal(owner.pending().length, 0);
  assert.equal((await owner.approve(id)).ok, false);
  assert.equal(engine.actions.length, 0);
});

test('the brain handle has no approval power', async () => {
  const { agent } = setup();
  for (const name of ['approve', 'deny', 'allowMore', 'takeOver', 'pending']) assert.equal(name in agent, false);
});

test('typing: plain field works; password, credentials and card numbers are refused before the page', async () => {
  const { agent, engine } = await ready();
  assert.equal((await agent.type('e2', 'Sam')).ok, true);
  assert.deepEqual(engine.actions.at(-1), { type: 'type', id: 'e2', text: 'Sam', url: home });
  const before = engine.actions.length;
  const sensitive = await agent.type('e3', 'hunter2');
  const creds = await agent.type('e2', 'my-password', { containsCredentials: true });
  const card = await agent.type('e2', '4111 1111 1111 1111');
  for (const r of [sensitive, creds, card]) assert.equal(r.ok === false && r.code, 'REFUSED');
  assert.equal(engine.actions.length, before);
});

test('select and scroll work and reject bad input', async () => {
  const { agent, engine } = await ready();
  assert.equal((await agent.select('e7', 'red')).ok, true);
  assert.deepEqual(engine.actions.at(-1), { type: 'select', id: 'e7', value: 'red', url: home });
  const scrolled = await agent.scroll(250);
  assert.deepEqual(scrolled.ok && scrolled.value, { y: 300 });
  assert.equal((await agent.scroll(Number.NaN)).ok === false, true);
  assert.equal((await agent.click('e99')).ok === false, true);
});

test('when the page says it changed, the snapshot is dropped', async () => {
  const { agent, engine } = await ready();
  engine.nextActResult = { ok: false, error: 'page-changed', message: 'The page changed.' };
  const result = await agent.type('e2', 'x');
  assert.equal(result.ok === false && result.code, 'STALE');
  assert.equal((await agent.type('e2', 'x')).ok === false, true);
});

test('page-side refusals are reported honestly', async () => {
  const { agent, engine } = await ready();
  engine.nextActResult = { ok: false, error: 'owner-handoff', message: 'Owner step.', risk: 'payment' };
  const result = await agent.click('e1');
  assert.equal(result.ok === false && result.code, 'HANDOFF');
});

test('the step budget stops AXON until the owner allows more', async () => {
  const { agent, owner } = await ready({ maxSteps: 4 });
  // open and snapshot already used 2 of 4
  assert.equal((await agent.scroll(10)).ok, true);
  assert.equal((await agent.scroll(10)).ok, true);
  const stopped = await agent.scroll(10);
  assert.equal(stopped.ok === false && stopped.code, 'BUDGET');
  owner.allowMore(2);
  assert.equal((await agent.scroll(10)).ok, true);
  owner.allowMore(0); owner.allowMore(-5); owner.allowMore(1000);
  assert.equal((await agent.scroll(10)).ok, true);
});

test('release and owner take-over close the AXON tab and clear waiting approvals', async () => {
  const { agent, owner, engine } = await ready();
  await agent.click('e4');
  assert.equal(owner.pending().length, 1);
  assert.equal((await owner.takeOver()).ok, true);
  assert.equal(engine.calls.at(-1), 'release');
  assert.equal(owner.pending().length, 0);
  assert.equal((await agent.snapshot()).ok === false, true);
  assert.equal((await agent.release()).ok, true);
});

test('state reports the control indicator data', async () => {
  const { agent } = await ready();
  const state = await agent.state();
  assert.ok(state.ok && state.value.active && state.value.identity?.isolationKind === 'ENGINE_PROFILE');
});

test('the new gateway commands have the intended effect classes', () => {
  const effect = (id: string) => getBrowserFunction(id)?.effect;
  assert.equal(effect('page.snapshot'), 'READ');
  assert.equal(effect('page.scroll'), 'READ');
  for (const id of ['page.click', 'page.type', 'page.select']) assert.equal(effect(id), 'REVERSIBLE');
  assert.equal(effect('page.submit'), 'OWNER_CONFIRM');
  assert.equal(effect('page.signIn'), 'OWNER_HANDOFF');
  assert.equal(effect('page.pay'), 'OWNER_HANDOFF');
  assert.equal(AXON_TAB_ID, 'axon-own-tab');
});

test('the tool specs name only methods the agent really has', () => {
  const { agent } = setup();
  const methodOf: Record<string, string> = { 'web.search': 'search', 'web.open': 'open', 'web.read': 'read', 'web.snapshot': 'snapshot', 'web.click': 'click', 'web.type': 'type', 'web.select': 'select', 'web.scroll': 'scroll', 'web.release': 'release' };
  assert.equal(AXON_WEB_TOOL_SPECS.length, Object.keys(methodOf).length);
  for (const spec of AXON_WEB_TOOL_SPECS) assert.equal(typeof (agent as unknown as Record<string, unknown>)[methodOf[spec.name] ?? ''], 'function');
});
