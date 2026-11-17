import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_FUNCTIONS, type BrowserFunctionId } from '../src/web/browserCommandGateway.ts';
import { BrowserController } from '../src/web/browserController.ts';
import { BrowserLongTail, NOT_APPLICABLE_FUNCTIONS, TAIL_COMPOSED_FUNCTION_IDS, TAIL_FUNCTION_IDS, TAIL_NATIVE_FUNCTION_IDS, generatePassword, type BrowserTailPlugin, type TailResult } from '../src/web/browserLongTail.ts';
import type { BrowserEngineAdapter } from '../src/web/browserEngineAdapter.ts';

type Row = { index: number; url: string; title: string; groupId: null; kind: string; stealth: boolean; axon?: boolean; pinned?: boolean };
class FakeNative implements BrowserTailPlugin {
  calls: { functionId: string; args: Record<string, unknown> }[] = [];
  replies: Record<string, TailResult> = {};
  async runTail(options: { functionId: string; args?: Record<string, unknown> }): Promise<TailResult> {
    this.calls.push({ functionId: options.functionId, args: options.args ?? {} });
    return this.replies[options.functionId] ?? { ok: true };
  }
}
function fakeAdapter() {
  const log: string[] = [];
  const state = { url: 'https://shop.example.com/item', tabs: [] as Row[] };
  const adapter = {
    async getState() { return { url: state.url, tabs: state.tabs }; },
    async newTab(options: unknown) { log.push('newTab:' + JSON.stringify(options)); return { ok: true }; },
    async closeTab(options: { index: number }) { log.push('closeTab:' + options.index); return { ok: true }; },
    async navigate(options: { url: string }) { log.push('navigate:' + options.url); return { ok: true }; },
    async searchHistory(options?: { query?: string }) { log.push('history:' + (options?.query ?? '')); return { items: [{ title: 'Hist A', url: 'https://a.test/' }, { title: 'Shared', url: 'https://b.test/' }] }; },
    async listBookmarks() { return { items: [{ title: 'Shared', url: 'https://b.test/' }, { title: 'Book', url: 'https://c.test/book' }], folders: [] }; },
    async getSecurityDetails() { return { secure: true }; },
    async getSitePermissions() { return { camera: 'blocked' }; },
    async getPageText() { return { text: 'Page words '.repeat(600) }; },
    async getSettings() { return { defaultMode: 'normal', multiProfileSupported: true, searchEngine: 'duckduckgo' }; },
    async setDefaultMode(options: { defaultMode: string }) { log.push('mode:' + options.defaultMode); return { ok: true }; },
    isAvailable: () => true,
  } as unknown as BrowserEngineAdapter;
  return { adapter, log, state };
}
const seeded = (seed: number) => (size: number) => { const out = new Uint8Array(size); for (let i = 0; i < size; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; out[i] = (seed >> 8) & 255; } return out; };

test('generated passwords have the asked length, every class, and no symbols when told', () => {
  const pw = generatePassword(seeded(7), 24, true);
  assert.equal(pw.length, 24);
  assert.match(pw, /[a-z]/); assert.match(pw, /[A-Z]/); assert.match(pw, /[0-9]/); assert.match(pw, /[^A-Za-z0-9]/);
  assert.match(generatePassword(seeded(9), 30, false), /^[A-Za-z0-9]{30}$/);
  assert.notEqual(generatePassword(seeded(1), 20), generatePassword(seeded(2), 20));
  for (const bad of [11, 65, 20.5, Number.NaN]) assert.throws(() => generatePassword(seeded(1), bad));
});

test('search uses the saved search engine and refuses empty or huge queries', async () => {
  const { adapter, log } = fakeAdapter();
  const tail = new BrowserLongTail(adapter, new FakeNative());
  await tail.run('address.search', { query: 'a b&c' });
  assert.deepEqual(log, ['navigate:https://duckduckgo.com/?q=a%20b%26c']);
  await assert.rejects(() => tail.run('address.search', { query: '  ' }));
  await assert.rejects(() => tail.run('address.search', { query: 'x'.repeat(301) }));
});

test('suggestions list bookmarks first, without duplicates, at most 8', async () => {
  const { adapter } = fakeAdapter();
  const tail = new BrowserLongTail(adapter, new FakeNative());
  const result = await tail.run('address.suggestions', { query: 'b' }) as { items: { url: string; source: string }[] };
  assert.deepEqual(result.items.map((i) => i.url), ['https://b.test/', 'https://c.test/book', 'https://a.test/']);
  assert.equal(result.items[0]?.source, 'bookmark');
  assert.deepEqual(await tail.run('address.suggestions', { query: ' ' }), { items: [] });
});

test('history entries open by number and bad numbers are refused', async () => {
  const { adapter, log } = fakeAdapter();
  const tail = new BrowserLongTail(adapter, new FakeNative());
  await tail.run('history.openEntry', { index: 1 });
  assert.equal(log.at(-1), 'navigate:https://b.test/');
  await assert.rejects(() => tail.run('history.openEntry', { index: 9 }));
});

test('duplicate keeps kind and stealth; AXON tabs cannot be duplicated; closeOthers keeps pinned and AXON tabs', async () => {
  const { adapter, log, state } = fakeAdapter();
  state.tabs = [
    { index: 0, url: 'https://a.test/', title: '', groupId: null, kind: 'normal', stealth: false },
    { index: 1, url: 'https://b.test/', title: '', groupId: null, kind: 'incognito', stealth: true },
    { index: 2, url: 'https://c.test/', title: '', groupId: null, kind: 'normal', stealth: false, pinned: true },
    { index: 3, url: 'https://d.test/', title: '', groupId: null, kind: 'incognito', stealth: false, axon: true },
    { index: 4, url: 'https://e.test/', title: '', groupId: null, kind: 'normal', stealth: false },
  ];
  const tail = new BrowserLongTail(adapter, new FakeNative());
  await tail.run('tabs.duplicate', { index: 1 });
  assert.equal(log.at(-1), 'newTab:' + JSON.stringify({ url: 'https://b.test/', kind: 'incognito', stealth: true }));
  await assert.rejects(() => tail.run('tabs.duplicate', { index: 3 }), /AXON/);
  await assert.rejects(() => tail.run('tabs.duplicate', { index: 99 }));
  const result = await tail.run('tabs.closeOthers', { index: 0 });
  assert.deepEqual(result, { closed: 2 });
  assert.deepEqual(log.filter((l) => l.startsWith('closeTab')), ['closeTab:4', 'closeTab:1']);
  await assert.rejects(() => tail.run('tabs.closeOthers', { index: 42 }));
});

test('site info combines security, permissions and the saved decisions of the current site', async () => {
  const { adapter, state } = fakeAdapter();
  const native = new FakeNative();
  native.replies['site.getDecisions'] = { ok: true, decisions: { camera: 'block' } };
  const tail = new BrowserLongTail(adapter, native);
  assert.deepEqual(await tail.run('site.viewInfo', {}), { host: 'shop.example.com', security: { secure: true }, permissions: { camera: 'blocked' }, decisions: { camera: 'block' } });
  assert.deepEqual(native.calls[0], { functionId: 'site.getDecisions', args: { host: 'shop.example.com' } });
  state.url = 'about:blank';
  const blank = await tail.run('site.viewInfo', {}) as { host: string };
  assert.equal(blank.host, '');
});

test('report, translate and follow-link build safe addresses and refuse bad input', async () => {
  const { adapter, log, state } = fakeAdapter();
  const native = new FakeNative();
  native.replies['page.extract'] = { ok: true, links: [{ index: 0, href: 'https://x.test/a' }, { index: 1, href: 'javascript:alert(1)' }] };
  const tail = new BrowserLongTail(adapter, native);
  await tail.run('security.reportUnsafeSite', {});
  assert.equal(log.at(-1), 'navigate:https://safebrowsing.google.com/safebrowsing/report_badware/?url=' + encodeURIComponent(state.url));
  await tail.run('page.translate', { lang: 'pt-BR' });
  assert.equal(log.at(-1), 'navigate:https://translate.google.com/translate?sl=auto&tl=pt-BR&u=' + encodeURIComponent(state.url));
  await assert.rejects(() => tail.run('page.translate', { lang: 'xx; drop' }));
  await tail.run('page.followLink', { index: 0 });
  assert.equal(log.at(-1), 'navigate:https://x.test/a');
  await assert.rejects(() => tail.run('page.followLink', { index: 1 }));
  await assert.rejects(() => tail.run('page.followLink', { index: 7 }));
  state.url = 'about:blank';
  await assert.rejects(() => tail.run('security.reportUnsafeSite', {}));
  await assert.rejects(() => tail.run('page.translate', {}));
});

test('listen, copy and share fall back from given text to the selection to the page text', async () => {
  const { adapter } = fakeAdapter();
  const native = new FakeNative();
  native.replies['page.selection'] = { ok: true, text: 'picked words' };
  const tail = new BrowserLongTail(adapter, native);
  await tail.run('page.listen', {});
  assert.equal(String(native.calls.at(-1)?.args.text).startsWith('Page words'), true);
  await tail.run('page.listen', { stop: true });
  assert.deepEqual(native.calls.at(-1), { functionId: 'page.listen', args: { stop: true } });
  await tail.run('page.copyText', { text: 'given' });
  assert.deepEqual(native.calls.at(-1), { functionId: 'page.copyText', args: { text: 'given' } });
  await tail.run('page.shareContent', {});
  assert.deepEqual(native.calls.at(-1), { functionId: 'page.shareContent', args: { text: 'picked words' } });
  native.replies['page.selection'] = { ok: true, text: '' };
  await tail.run('page.copyText', {});
  assert.equal(String(native.calls.at(-1)?.args.text).length, 5000);
});

test('settings.change routes each known key and refuses the rest', async () => {
  const { adapter, log } = fakeAdapter();
  const native = new FakeNative();
  const tail = new BrowserLongTail(adapter, native);
  await tail.run('settings.change', { key: 'homePage', value: 'https://home.test/' });
  await tail.run('settings.change', { key: 'textZoom', value: 130 });
  await tail.run('settings.change', { key: 'safeBrowsing', value: false });
  await tail.run('settings.change', { key: 'thirdPartyCookies', value: false });
  await tail.run('settings.change', { key: 'defaultMode', value: 'stealth' });
  assert.deepEqual(native.calls.map((c) => [c.functionId, c.args]), [
    ['settings.homePage', { url: 'https://home.test/' }], ['settings.accessibility', { textZoom: 130 }],
    ['security.safeBrowsingSettings', { enabled: false }], ['site.manageCookies', { action: 'thirdParty', enabled: false }],
  ]);
  assert.equal(log.at(-1), 'mode:stealth');
  await assert.rejects(() => tail.run('settings.change', { key: 'defaultMode', value: 'ghost' }));
  await assert.rejects(() => tail.run('settings.change', { key: 'password', value: 'x' }), /Unknown setting/);
});

test('every native command is forwarded unchanged, and a native failure becomes a clear error', async () => {
  const { adapter } = fakeAdapter();
  const native = new FakeNative();
  const tail = new BrowserLongTail(adapter, native);
  for (const id of TAIL_NATIVE_FUNCTION_IDS) await tail.run(id, { probe: id });
  assert.deepEqual(native.calls.map((c) => c.functionId), [...TAIL_NATIVE_FUNCTION_IDS]);
  assert.ok(native.calls.every((c) => c.args.probe === c.functionId));
  native.replies['tabs.restoreClosed'] = { ok: false, error: 'nothing-to-restore', message: 'There is no closed tab to restore.' };
  await assert.rejects(() => tail.run('tabs.restoreClosed', {}), /no closed tab/);
});

test('the controller runs tail commands for the owner through the gateway; AXON and a missing host are refused', async () => {
  const { adapter } = fakeAdapter();
  const native = new FakeNative();
  const withTail = new BrowserController(adapter, new BrowserLongTail(adapter, native));
  const ok = await withTail.execute({ functionId: 'tabs.restoreClosed', actor: 'OWNER', sessionId: 'owner' });
  assert.equal(ok.ok, true);
  const denied = await withTail.execute({ functionId: 'tabs.restoreClosed', actor: 'AXON', sessionId: 'axon' });
  assert.equal(denied.ok === false && denied.code, 'DENIED');
  assert.equal(native.calls.length, 1);
  const without = new BrowserController(adapter);
  const notReady = await without.execute({ functionId: 'tabs.restoreClosed', actor: 'OWNER', sessionId: 'owner' });
  assert.equal(notReady.ok === false && notReady.code, 'NOT_READY');
  native.replies['diagnostics.view'] = { ok: false, error: 'failed', message: 'boom' };
  const failed = await withTail.execute({ functionId: 'diagnostics.view', actor: 'OWNER', sessionId: 'owner' });
  assert.ok(!failed.ok && failed.code === 'FAILED' && /boom/.test(failed.message));
});

test('not-applicable commands never reach any host', async () => {
  const { adapter } = fakeAdapter();
  const native = new FakeNative();
  const controller = new BrowserController(adapter, new BrowserLongTail(adapter, native));
  for (const id of Object.keys(NOT_APPLICABLE_FUNCTIONS) as BrowserFunctionId[]) {
    const result = await controller.execute({ functionId: id, actor: 'OWNER', sessionId: 'owner' });
    assert.equal(result.ok === false && result.code, 'NOT_READY', id);
  }
  assert.equal(native.calls.length, 0);
});

test('the id lists are consistent with the catalogue', () => {
  const catalogue = new Set(BROWSER_FUNCTIONS.map((f) => f.id));
  for (const id of TAIL_FUNCTION_IDS) assert.ok(catalogue.has(id), id);
  for (const id of Object.keys(NOT_APPLICABLE_FUNCTIONS)) assert.ok(catalogue.has(id as BrowserFunctionId), id);
  for (const id of TAIL_NATIVE_FUNCTION_IDS) assert.equal(TAIL_COMPOSED_FUNCTION_IDS.has(id), false, id);
  for (const id of Object.keys(NOT_APPLICABLE_FUNCTIONS)) assert.equal(TAIL_FUNCTION_IDS.has(id as BrowserFunctionId), false, id);
});

test('the host factory wires the owner controller and the AXON agent from the same parts', async () => {
  const { createAxonWebHost } = await import('../src/web/axonWebHost.ts');
  const { adapter } = fakeAdapter();
  const native = new FakeNative();
  const engine = { isAvailable: () => false } as never;
  const host = createAxonWebHost({ adapter, tail: native, engine });
  const ok = await host.controller.execute({ functionId: 'navigation.home', actor: 'OWNER', sessionId: 'owner' });
  assert.equal(ok.ok, true);
  assert.equal(native.calls[0]?.functionId, 'navigation.home');
  const search = await host.agent.search('phones');
  assert.equal(search.ok === false && search.code, 'UNAVAILABLE');
  for (const name of ['approve', 'deny', 'allowMore', 'takeOver']) assert.equal(name in host.agent, false);
});
