import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserController } from '../src/web/browserController.ts';
import { getBrowserFunction, decideBrowserCommand } from '../src/web/browserCommandGateway.ts';
import { AXON_BROWSER_SESSION_ENABLED } from '../src/web/browserSessionBoundary.ts';
import type { BrowserEngineAdapter } from '../src/web/browserEngineAdapter.ts';

const ownerIdentity = { owner: 'OWNER' as const, sessionId: 'owner-default', engineContextId: 'owner-default-webview', cookiePartitionId: 'owner-default-cookies', storagePartitionId: 'owner-default-storage', credentialStoreId: 'owner-credentials', isolationKind: 'SHARED_WEBVIEW_PROCESS' as const, isolationVerified: false };
const handedOffIdentity = { owner: 'AXON' as const, sessionId: 'handoff-tab-7', engineContextId: 'webview-profile-tab-7', cookiePartitionId: 'profile-cookies-tab-7', storagePartitionId: 'profile-storage-tab-7', credentialStoreId: null, isolationKind: 'ENGINE_PROFILE' as const, isolationVerified: true };

class FakeBrowser {
  readonly engineId = 'simulated' as const;
  isAvailable() { return true; }
  calls: unknown[] = [];
  defaultMode: 'normal' | 'stealth' = 'normal';
  async newTab(options: { url?: string; kind?: 'normal' | 'incognito'; stealth?: boolean } = {}) { this.calls.push(['newTab', options]); return { tabCount: 2 }; }
  async getSettings() { this.calls.push(['getSettings']); return { defaultMode: this.defaultMode, multiProfileSupported: true }; }
  async setDefaultMode(options: { defaultMode: 'normal' | 'stealth' }) { this.calls.push(['setDefaultMode', options]); this.defaultMode = options.defaultMode; return this.getSettings(); }
  async getPageText() { this.calls.push(['getPageText']); return { text: 'private page text' }; }
  async navigate(options: { url: string }) { this.calls.push(['navigate', options]); return {}; }
  async back() { return {}; } async forward() { return {}; } async reload() { return {}; } async stop() { return {}; }
  async findInPage() {} async zoomBy() {} async setDesktopSite() { return {}; }
  async createGroup() { return { groups: [] }; } async renameGroup() { return { groups: [] }; } async moveTabToGroup() { return {}; }
  async removeTabFromGroup() { return {}; } async deleteGroup() { return { groups: [] }; } async closeGroup() { return {}; } async listGroups() { return { groups: [] }; }
  async switchTab() { return {}; } async closeTab() { return {}; } async getState() { return {}; }
  async addBookmark() {} async editBookmark() {} async removeBookmark() {} async createBookmarkFolder() {} async moveBookmark() {} async listBookmarks() { return { items: [], folders: [] }; }
  async searchHistory() { return { items: [] }; } async clearHistory() {} async clearHistoryBySite() {} async addToReadingList() {} async removeReadingListItem() {} async openReadingListItem() { return {}; } async markReadingListRead() {} async listReadingList() { return { items: [] }; }
  async listDownloads() { return { items: [] }; } async openDownload() {} async shareDownload() {} async cancelDownload() {} async deleteDownload() {} async copyCurrentUrl() {} async shareCurrentUrl() {} async printPage() {} async savePagePdf() {}
  async getSecurityDetails() { return { url: '', scheme: '', host: '', certificatePresent: false, subject: '', issuer: '' }; } async getSitePermissions() { return { origin: '', summary: '', permissions: [] }; }
}

const makeController = () => { const adapter = new FakeBrowser(); return { adapter, controller: new BrowserController(adapter as unknown as BrowserEngineAdapter) }; };

test('new-tab command is owner-confirmed because it can create incognito or stealth identities', () => {
  assert.equal(getBrowserFunction('tabs.create')?.effect, 'OWNER_CONFIRM');
  const decision = decideBrowserCommand({ functionId: 'tabs.create', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner', owner: 'OWNER' }, sessionGrant: { sessionId: 'owner', functionIds: ['tabs.create'] } });
  assert.equal(decision.ok && decision.value.decision, 'ASK_OWNER');
});

test('controller forwards all normal/incognito plus stealth combinations to the engine', async () => {
  const { adapter, controller } = makeController();
  const cases = [
    { kind: 'normal', stealth: false },
    { kind: 'normal', stealth: true },
    { kind: 'incognito', stealth: false },
    { kind: 'incognito', stealth: true },
  ] as const;
  for (const options of cases) {
    const result = await controller.execute({ functionId: 'tabs.create', actor: 'OWNER', sessionId: 'owner', args: options });
    assert.equal(result.ok, true);
  }
  assert.deepEqual(adapter.calls.filter((call): call is unknown[] => Array.isArray(call) && call[0] === 'newTab').map((call) => { const options = call[1] as Record<string, unknown>; return { kind: options.kind, stealth: options.stealth }; }), cases);
});

test('default mode is readable and changing it is an owner-confirmed command', async () => {
  const { adapter, controller } = makeController();
  assert.equal(getBrowserFunction('settings.defaultMode')?.effect, 'OWNER_CONFIRM');
  const read = await controller.execute({ functionId: 'settings.view', actor: 'OWNER', sessionId: 'owner' });
  assert.equal(read.ok, true);
  const changed = await controller.execute({ functionId: 'settings.defaultMode', actor: 'OWNER', sessionId: 'owner', args: { defaultMode: 'stealth' } });
  assert.equal(changed.ok, true);
  assert.equal(adapter.defaultMode, 'stealth');
});

test('AXON is refused access to an owner incognito tab without explicit handoff', async () => {
  const { adapter, controller } = makeController();
  const result = await controller.execute({ functionId: 'page.read', actor: 'AXON', sessionId: 'owner', tabId: 'tab-7', tabKind: 'incognito' });
  assert.equal(result.ok, false); assert.equal(result.code, 'DENIED'); assert.equal(adapter.calls.length, 0);
});

test('AXON is refused access to an owner stealth tab without explicit handoff', async () => {
  const { adapter, controller } = makeController();
  const result = await controller.execute({ functionId: 'page.read', actor: 'AXON', sessionId: 'owner', tabId: 'tab-7', tabStealth: true });
  assert.equal(result.ok, false); assert.equal(result.code, 'DENIED'); assert.equal(adapter.calls.length, 0);
});

test('AXON may access a sensitive tab only with exact owner handoff and a verified separate profile boundary', async () => {
  const { adapter, controller } = makeController();
  const result = await controller.execute({
    functionId: 'page.read', actor: 'AXON', sessionId: 'owner', tabId: 'tab-7', tabKind: 'incognito', selectedByOwner: true,
    sessionGrant: { sessionId: 'owner', functionIds: ['page.read'] },
    ownerTabGrant: { tabId: 'tab-7', functionIds: ['page.read'] },
    sessionBoundary: { owner: ownerIdentity, requested: handedOffIdentity },
  });
  assert.equal(result.ok, true); assert.deepEqual(adapter.calls, [['getPageText']]);
});

test('AXON sensitive-tab handoff fails closed when the profile boundary is shared or unverified', async () => {
  const { adapter, controller } = makeController();
  const result = await controller.execute({
    functionId: 'page.read', actor: 'AXON', sessionId: 'owner', tabId: 'tab-7', tabStealth: true, selectedByOwner: true,
    sessionGrant: { sessionId: 'owner', functionIds: ['page.read'] }, ownerTabGrant: { tabId: 'tab-7', functionIds: ['page.read'] },
    sessionBoundary: { owner: ownerIdentity, requested: { ...handedOffIdentity, isolationKind: 'SHARED_WEBVIEW_PROCESS', isolationVerified: false } },
  });
  assert.equal(result.ok, false); assert.equal(result.code, 'DENIED'); assert.equal(adapter.calls.length, 0);
});

test('the AXON browser session feature flag remains disabled', () => assert.equal(AXON_BROWSER_SESSION_ENABLED, false));

test('native host uses AndroidX Multi-Profile and assigns the profile before WebView settings or navigation', async () => {
  const fs = await import('node:fs');
  const java = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserActivity.java', 'utf8');
  assert.match(java, /import androidx\.webkit\.ProfileStore;/);
  assert.match(java, /import androidx\.webkit\.WebViewCompat;/);
  assert.match(java, /WebViewFeature\.MULTI_PROFILE/);
  const create = java.slice(java.indexOf('private void createWebView'), java.indexOf('/** Keep only the selected tab'));
  assert.ok(create.indexOf('WebViewCompat.setProfile(web, tab.profileName)') < create.indexOf('web.getSettings()'));
});

test('native host saves normal stealth profile names but omits incognito tabs from saved tab state', async () => {
  const fs = await import('node:fs');
  const java = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserActivity.java', 'utf8');
  const save = java.slice(java.indexOf('private void saveTabs()'), java.indexOf('private void saveJson'));
  assert.match(save, /if \("incognito"\.equals\(t\.kind\)\) continue/);
  assert.match(save, /item\.put\("profileName",t\.profileName\)/);
  assert.match(save, /item\.put\("stealth",t\.stealth\)/);
});

test('native host destroys the incognito WebView before deleting its throwaway profile', async () => {
  const fs = await import('node:fs');
  const java = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserActivity.java', 'utf8');
  const close = java.slice(java.indexOf('public void closeTab'), java.indexOf('public void findInPage'));
  assert.ok(close.indexOf('removed.view.destroy()') < close.indexOf('deleteEphemeralProfile(removed)'));
  assert.match(java, /ProfileStore\.getInstance\(\)\.deleteProfile\(tab\.profileName\)/);
});

test('incognito history, bookmarks, reading-list saves and downloads do not enter persistent browser stores', async () => {
  const fs = await import('node:fs');
  const java = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserActivity.java', 'utf8');
  assert.match(java, /if \(!"incognito"\.equals\(tab\.kind\)\) addHistory/);
  assert.match(java, /Bookmarks from incognito tabs are not saved/);
  assert.match(java, /Reading-list entries from incognito tabs are not saved/);
  assert.match(java, /Downloads from incognito tabs are blocked/);
});
