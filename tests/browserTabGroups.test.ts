import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserController } from '../src/web/browserController.ts';
import { getBrowserFunction } from '../src/web/browserCommandGateway.ts';
import type { BrowserEngineAdapter } from '../src/web/browserEngineAdapter.ts';

type SimTab = { url: string; groupId: string | null; kind: 'normal' | 'incognito'; stealth: boolean };
type SimGroup = { id: string; name: string };

class GroupBrowser {
  readonly engineId = 'simulated' as const;
  private tabs: SimTab[] = [
    { url: 'https://one.test', groupId: null, kind: 'normal', stealth: false },
    { url: 'https://two.test', groupId: null, kind: 'normal', stealth: false },
    { url: 'https://three.test', groupId: null, kind: 'normal', stealth: false },
  ];
  private groups: SimGroup[] = [];
  private defaultMode: 'normal' | 'stealth' = 'normal';
  isAvailable() { return true; }
  async newTab(options: { url?: string; kind?: 'normal' | 'incognito'; stealth?: boolean } = {}) {
    const kind = options.kind ?? 'normal';
    this.tabs.push({ url: options.url ?? 'about:blank', groupId: null, kind, stealth: options.stealth ?? this.defaultMode === 'stealth' });
    return this.state();
  }
  async createGroup({ name, tabIndexes }: { name: string; tabIndexes?: number[] }) {
    if (!name.trim()) throw new Error('Group name is required.');
    for (const index of tabIndexes ?? []) if (!Number.isInteger(index) || index < 0 || index >= this.tabs.length) throw new Error('Tab index out of range.');
    const group = { id: `group-${this.groups.length + 1}`, name: name.trim() };
    this.groups.push(group);
    for (const index of tabIndexes ?? []) this.tabs[index].groupId = group.id;
    return this.listGroups();
  }
  async renameGroup({ groupId, name }: { groupId: string; name: string }) {
    const group = this.group(groupId); if (!name.trim()) throw new Error('Group name is required.');
    group.name = name.trim(); return this.listGroups();
  }
  async moveTabToGroup({ index, groupId }: { index: number; groupId: string }) {
    this.tab(index).groupId = this.group(groupId).id; return this.state();
  }
  async removeTabFromGroup({ index }: { index: number }) { this.tab(index).groupId = null; return this.state(); }
  async deleteGroup({ groupId }: { groupId: string }) {
    const group = this.group(groupId); this.tabs.forEach(tab => { if (tab.groupId === group.id) tab.groupId = null; });
    this.groups = this.groups.filter(item => item.id !== group.id); return this.listGroups();
  }
  async closeGroup({ groupId }: { groupId: string }) {
    const group = this.group(groupId); this.tabs = this.tabs.filter(tab => tab.groupId !== group.id);
    if (!this.tabs.length) this.tabs.push({ url: 'about:blank', groupId: null, kind: 'normal', stealth: false });
    this.groups = this.groups.filter(item => item.id !== group.id); return this.state();
  }
  async listGroups() { return { groups: this.groups.map(group => ({ ...group, tabIndexes: this.tabs.flatMap((tab, index) => tab.groupId === group.id ? [index] : []) })) }; }
  async getSettings() { return { defaultMode: this.defaultMode, multiProfileSupported: true }; }
  async setDefaultMode({ defaultMode }: { defaultMode: 'normal' | 'stealth' }) { this.defaultMode = defaultMode; return this.getSettings(); }
  async switchTab() { return this.state(); }
  async closeTab() { return this.state(); }
  async navigate() { return this.state(); }
  async back() { return this.state(); }
  async forward() { return this.state(); }
  async reload() { return this.state(); }
  async stop() { return this.state(); }
  async getState() { return this.state(); }
  async getPageText() { return { text: '' }; }
  async findInPage() {}
  async zoomBy() {}
  async setDesktopSite() { return this.state(); }
  async addBookmark() {}
  async editBookmark() {}
  async removeBookmark() {}
  async createBookmarkFolder() {}
  async moveBookmark() {}
  async listBookmarks() { return { items: [], folders: [] }; }
  async searchHistory() { return { items: [] }; }
  async clearHistory() {}
  async clearHistoryBySite() {}
  async addToReadingList() {}
  async removeReadingListItem() {}
  async openReadingListItem() { return this.state(); }
  async markReadingListRead() {}
  async listReadingList() { return { items: [] }; }
  async listDownloads() { return { items: [] }; }
  async openDownload() {}
  async shareDownload() {}
  async cancelDownload() {}
  async deleteDownload() {}
  async copyCurrentUrl() {}
  async shareCurrentUrl() {}
  async printPage() {}
  async savePagePdf() {}
  async getSecurityDetails() { return { url: '', scheme: '', host: '', certificatePresent: false, subject: '', issuer: '' }; }
  async getSitePermissions() { return { origin: '', summary: '', permissions: [] }; }
  group(id: string) { const group = this.groups.find(item => item.id === id); if (!group) throw new Error('Tab group not found.'); return group; }
  tab(index: number) { const tab = this.tabs[index]; if (!tab) throw new Error('Tab index out of range.'); return tab; }
  state() {
    const groups = this.listGroupsSync();
    return { available: true, tabCount: this.tabs.length, activeIndex: 0, url: this.tabs[0]?.url ?? '', title: '', loading: false, canGoBack: false, canGoForward: false, engine: 'simulated', incognito: this.tabs[0]?.kind === 'incognito', defaultMode: this.defaultMode,
      tabs: this.tabs.map((tab, index) => ({ index, url: tab.url, title: '', groupId: tab.groupId, kind: tab.kind, stealth: tab.stealth })), groups };
  }
  listGroupsSync() { return this.groups.map(group => ({ ...group, tabIndexes: this.tabs.flatMap((tab, index) => tab.groupId === group.id ? [index] : []) })); }
}

const setup = () => {
  const native = new GroupBrowser();
  const controller = new BrowserController(native as unknown as BrowserEngineAdapter);
  const run = (functionId: Parameters<BrowserController['execute']>[0]['functionId'], args: Record<string, unknown> = {}) =>
    controller.execute({ functionId, actor: 'OWNER', sessionId: 'owner-session', args });
  return { native, run };
};

test('tab group catalogue uses reversible, read and owner-confirm effects', () => {
  assert.equal(getBrowserFunction('tabs.createGroup')?.effect, 'REVERSIBLE');
  assert.equal(getBrowserFunction('tabs.renameGroup')?.effect, 'REVERSIBLE');
  assert.equal(getBrowserFunction('tabs.moveToGroup')?.effect, 'REVERSIBLE');
  assert.equal(getBrowserFunction('tabs.removeFromGroup')?.effect, 'REVERSIBLE');
  assert.equal(getBrowserFunction('tabs.deleteGroup')?.effect, 'REVERSIBLE');
  assert.equal(getBrowserFunction('tabs.listGroups')?.effect, 'READ');
  assert.equal(getBrowserFunction('tabs.closeGroup')?.effect, 'OWNER_CONFIRM');
});

test('create, list, rename, move and remove tab group membership', async () => {
  const { run } = setup();
  const created = await run('tabs.createGroup', { name: 'Research', tabIndexes: [0, 1] });
  assert.equal(created.ok, true);
  const groups = await run('tabs.listGroups');
  assert.equal(groups.ok, true);
  const group = (groups as { ok: true; value: { groups: Array<{ id: string; name: string; tabIndexes: number[] }> } }).value.groups[0];
  assert.deepEqual(group.tabIndexes, [0, 1]);
  const renamed = await run('tabs.renameGroup', { groupId: group.id, name: 'Work' });
  assert.equal((renamed as { ok: true; value: { groups: Array<{ name: string }> } }).value.groups[0].name, 'Work');
  await run('tabs.moveToGroup', { index: 2, groupId: group.id });
  let listed = await run('tabs.listGroups');
  assert.deepEqual((listed as { ok: true; value: { groups: Array<{ tabIndexes: number[] }> } }).value.groups[0].tabIndexes, [0, 1, 2]);
  await run('tabs.removeFromGroup', { index: 1 });
  listed = await run('tabs.listGroups');
  assert.deepEqual((listed as { ok: true; value: { groups: Array<{ tabIndexes: number[] }> } }).value.groups[0].tabIndexes, [0, 2]);
});

test('delete group leaves member tabs open and ungrouped', async () => {
  const { native, run } = setup();
  await run('tabs.createGroup', { name: 'Keep tabs', tabIndexes: [0, 2] });
  const listed = await run('tabs.listGroups');
  const id = (listed as { ok: true; value: { groups: Array<{ id: string }> } }).value.groups[0].id;
  const deleted = await run('tabs.deleteGroup', { groupId: id });
  assert.equal(deleted.ok, true);
  const state = await native.getState();
  assert.equal(state.tabCount, 3);
  assert.deepEqual(state.tabs.map(tab => tab.groupId), [null, null, null]);
  assert.deepEqual(state.groups, []);
});

test('close group closes only its member tabs', async () => {
  const { native, run } = setup();
  await run('tabs.createGroup', { name: 'Close me', tabIndexes: [0, 2] });
  const listed = await run('tabs.listGroups');
  const id = (listed as { ok: true; value: { groups: Array<{ id: string }> } }).value.groups[0].id;
  await run('tabs.closeGroup', { groupId: id });
  const state = await native.getState();
  assert.equal(state.tabCount, 1);
  assert.equal(state.tabs[0].url, 'https://two.test');
  assert.deepEqual(state.groups, []);
});

test('controller forwards incognito and stealth identity options instead of refusing them as not built', async () => {
  const { native, run } = setup();
  const result = await run('tabs.create', { kind: 'incognito', stealth: true });
  assert.equal(result.ok, true);
  const state = await native.getState();
  assert.equal(state.tabs[3].kind, 'incognito');
  assert.equal(state.tabs[3].stealth, true);
});
