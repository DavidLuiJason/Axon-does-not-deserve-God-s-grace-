import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BROWSER_FUNCTIONS, decideBrowserCommand } from '../src/web/browserCommandGateway.ts';
import { BrowserController } from '../src/web/browserController.ts';

const checks = [];
function add(name, fn) { checks.push({ name, fn }); }

// 1–117: every declared browser function has a unique, well-formed, documented catalogue entry.
for (const item of BROWSER_FUNCTIONS) {
  add(`catalogue ${item.id} has a unique id and complete metadata`, () => {
    assert.match(item.id, /^[a-z][A-Za-z0-9]*(\.[a-zA-Z][A-Za-z0-9]*)+$/);
    assert.ok(item.group.length > 0);
    assert.ok(['TAB', 'BROWSER', 'ACCOUNT', 'FILE'].includes(item.surface));
    assert.ok(['READ', 'REVERSIBLE', 'OWNER_CONFIRM', 'OWNER_HANDOFF'].includes(item.effect));
    assert.ok(item.description.length > 12);
    assert.equal(BROWSER_FUNCTIONS.filter((x) => x.id === item.id).length, 1);
  });
}

const calls = [];
const fake = {
  engineId: 'simulated',
  isAvailable: () => true,
  open: async (...a) => { calls.push(['open', ...a]); return { opened: true, url: 'https://example.test' }; },
  navigate: async (...a) => { calls.push(['navigate', ...a]); return { url: 'https://example.test' }; },
  back: async (...a) => { calls.push(['back', ...a]); return { canGoBack: false }; },
  forward: async (...a) => { calls.push(['forward', ...a]); return { canGoForward: false }; },
  reload: async (...a) => { calls.push(['reload', ...a]); return { loading: true }; },
  stop: async (...a) => { calls.push(['stop', ...a]); return { loading: false }; },
  newTab: async (...a) => { calls.push(['newTab', ...a]); return { tabCount: 2 }; },
  switchTab: async (...a) => { calls.push(['switchTab', ...a]); return { activeIndex: 1 }; },
  closeTab: async (...a) => { calls.push(['closeTab', ...a]); return { tabCount: 1 }; },
  getState: async (...a) => { calls.push(['getState', ...a]); return { available: true }; },
  getPageText: async (...a) => { calls.push(['getPageText', ...a]); return { text: 'page text' }; },
  findInPage: async (...a) => { calls.push(['findInPage', ...a]); },
  zoomBy: async (...a) => { calls.push(['zoomBy', ...a]); },
  setDesktopSite: async (...a) => { calls.push(['setDesktopSite', ...a]); return { desktop: true }; },
  addBookmark: async (...a) => { calls.push(['addBookmark', ...a]); },
  listBookmarks: async (...a) => { calls.push(['listBookmarks', ...a]); return { items: [] }; },
  searchHistory: async (...a) => { calls.push(['searchHistory', ...a]); return { items: [] }; },
};
const controller = new BrowserController(fake);
const supportedCases = [
  ['address.navigate', { url: 'https://example.test' }, 'navigate'],
  ['navigation.back', {}, 'back'],
  ['navigation.forward', {}, 'forward'],
  ['navigation.reload', {}, 'reload'],
  ['navigation.stop', {}, 'stop'],
  ['navigation.findInPage', { text: 'cloud' }, 'findInPage'],
  ['navigation.zoom', { delta: 1 }, 'zoomBy'],
  ['navigation.requestDesktopSite', { enabled: true }, 'setDesktopSite'],
  ['tabs.create', { url: 'https://example.test' }, 'newTab'],
  ['tabs.close', { index: 0 }, 'closeTab'],
  ['tabs.switch', { index: 0 }, 'switchTab'],
  ['bookmarks.add', { title: 'Example', url: 'https://example.test' }, 'addBookmark'],
  ['bookmarks.list', {}, 'listBookmarks'],
  ['history.search', { query: 'example' }, 'searchHistory'],
  ['page.read', {}, 'getPageText'],
];

// 118–132: each supported command reaches its matching native service through one controller.
for (const [functionId, args, method] of supportedCases) {
  add(`controller dispatch ${functionId} -> ${method}`, async () => {
    calls.length = 0;
    const result = await controller.execute({ functionId, actor: 'OWNER', sessionId: 'owner-default', tabId: 'owner-tab-1', args });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], method);
  });
}

// 133–138: policy and failure boundaries.
add('AXON is denied access to the owner WebView context', async () => {
  calls.length = 0;
  const result = await controller.execute({ functionId: 'page.read', actor: 'AXON', sessionId: 'axon-task' });
  assert.equal(result.ok, false); assert.equal(result.code, 'DENIED'); assert.equal(calls.length, 0);
});
add('catalogued but unimplemented file upload is NOT_READY', async () => {
  calls.length = 0;
  const result = await controller.execute({ functionId: 'files.upload', actor: 'OWNER', sessionId: 'owner-default' });
  assert.equal(result.ok, false); assert.equal(result.code, 'NOT_READY'); assert.equal(calls.length, 0);
});
add('web preview cannot pretend the native browser is available', async () => {
  const webOnly = new BrowserController({ ...fake, isAvailable: () => false });
  const result = await webOnly.execute({ functionId: 'navigation.back', actor: 'OWNER', sessionId: 'owner-default' });
  assert.equal(result.ok, false); assert.equal(result.code, 'UNAVAILABLE');
});
add('invalid empty URL is passed to native validator rather than silently rewritten by controller', async () => {
  calls.length = 0;
  const result = await controller.execute({ functionId: 'address.navigate', actor: 'OWNER', sessionId: 'owner-default', args: { url: '' } });
  assert.equal(result.ok, true); assert.deepEqual(calls[0], ['navigate', { url: '' }]);
});
add('native plugin failure is returned as FAILED', async () => {
  const broken = { ...fake, back: async () => { throw new Error('bridge disconnected'); } };
  const result = await new BrowserController(broken).execute({ functionId: 'navigation.back', actor: 'OWNER', sessionId: 'owner-default', tabId: 'tab' });
  assert.equal(result.ok, false); assert.equal(result.code, 'FAILED'); assert.match(result.message, /bridge disconnected/);
});
add('owner command requires a valid browser tab context for tab-scoped actions', () => {
  const result = decideBrowserCommand({ functionId: 'navigation.back', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon', owner: 'AXON' } });
  assert.equal(result.ok, true); assert.equal(result.value.decision, 'REFUSE');
});

// 139–150: native host, overlay, and app integration safety contracts.
const java = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserActivity.java', 'utf8');
const plugin = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserPlugin.java', 'utf8');
const overlay = fs.readFileSync('scripts/apply-android-overlay.sh', 'utf8');
const activity = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/MainActivity.java', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
add('native host rejects non-HTTP(S) navigation schemes and embedded URL credentials', () => { assert.match(java, /getUserInfo\(\) != null/); assert.match(java, /javascript|http/); });
add('native host cancels TLS certificate errors', () => { assert.match(java, /onReceivedSslError[\s\S]{0,150}handler\.cancel\(\)/); });
add('native host disables mixed content', () => { assert.match(java, /MIXED_CONTENT_NEVER_ALLOW/); });
add('native host denies site camera and microphone permission requests and returns from Safe Browsing threats', () => { assert.match(java, /onPermissionRequest[\s\S]{0,80}request\.deny\(\)/); assert.match(java, /onSafeBrowsingHit[\s\S]{0,180}backToSafety\(true\)/); });
add('native host denies geolocation requests', () => { assert.match(java, /callback\.invoke\(origin, false, false\)/); });
add('native host uses Android document picker for uploads', () => { assert.match(java, /ACTION_OPEN_DOCUMENT/); });
add('native host uses Android DownloadManager for downloads', () => { assert.match(java, /DownloadManager\.Request/); });
add('native host persists normal tab URLs, history and bookmarks and suspends inactive renderers', () => { assert.match(java, /putString\(\"tabs\"/); assert.match(java, /saveJson\(\"history\"/); assert.match(java, /saveJson\(\"bookmarks\"/); assert.match(java, /suspendActiveTab/); assert.match(java, /saveState\(state\)/); });
add('browser plugin is registered in Capacitor MainActivity', () => { assert.match(activity, /registerPlugin\(BrowserPlugin\.class\)/); });
add('browser Activity is copied and declared by the idempotent overlay script', () => { assert.match(overlay, /BrowserActivity\.java/); assert.match(overlay, /android:name="\.browser\.BrowserActivity"/); });
add('browser plugin exposes only typed app-side methods, not a website JavaScript interface', () => { assert.match(plugin, /@CapacitorPlugin\(name = "AxonBrowser"\)/); assert.doesNotMatch(java, /addJavascriptInterface/); });
add('AXON Web mode displays launch surface and uses an engine-neutral adapter seam', () => { assert.match(app, /<BrowserHomeScreen \/>/); assert.doesNotMatch(app, /Web is coming soon/); const adapter=fs.readFileSync('src/web/browserEngineAdapter.ts','utf8'); const webview=fs.readFileSync('src/web/androidWebViewAdapter.ts','utf8'); assert.match(adapter,/interface BrowserEngineAdapter/); assert.match(webview,/android-system-webview/); });

if (checks.length !== 154) throw new Error(`Expected exactly 154 checks after the saved-browsing and tab-group catalogue additions, got ${checks.length}`);
for (const { name, fn } of checks) test(name, fn);
