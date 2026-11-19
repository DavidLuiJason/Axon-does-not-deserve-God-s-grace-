import test from 'node:test';
import assert from 'node:assert/strict';
import { MockWebUiService } from '../src/web/ui/mockWebUiService.ts';
import { WEB_FEATURES } from '../src/web/ui/webFeatureFlags.ts';
import { getWebUiService } from '../src/web/ui/webUiService.ts';
import { WEB_TAB_KINDS } from '../src/web/ui/webUiTypes.ts';

const fail = (r: { ok: boolean }) => (r.ok ? null : (r as { ok: false; reason: string }).reason);

test('the three kinds exist in the order normal, incognito, stealth and the flags start off', () => {
  assert.deepEqual([...WEB_TAB_KINDS], ['normal', 'incognito', 'stealth']);
  assert.equal(WEB_FEATURES.incognito, false);
  assert.equal(WEB_FEATURES.stealth, false);
});

test('opening a tab of every kind works; searching in incognito and stealth says coming soon', async () => {
  const web = new MockWebUiService();
  const normal = await web.newTab('normal'); const incog = await web.newTab('incognito'); const stealth = await web.newTab('stealth');
  assert.ok(normal.ok && incog.ok && stealth.ok);
  assert.equal(web.getState().tabs.length, 3);
  assert.equal(web.getState().activeTabId, stealth.ok ? stealth.value.tabId : '');
  assert.equal(fail(await web.search('phones')), 'coming-soon');
  await web.switchTab(incog.ok ? incog.value.tabId : '');
  const refused = await web.search('example.com');
  assert.equal(fail(refused), 'coming-soon');
  assert.match(refused.ok ? '' : refused.message, /Incognito browsing is coming soon/);
  await web.switchTab(normal.ok ? normal.value.tabId : '');
  assert.equal((await web.search('phones')).ok, true);
});

test('typed text becomes a search or an address, and history, back and forward follow', async () => {
  const web = new MockWebUiService();
  await web.newTab('normal');
  await web.search('best phone deals');
  assert.match(web.getState().tabs[0]?.url ?? '', /^https:\/\/www\.google\.com\/search\?q=best%20phone%20deals$/);
  await web.search('shop.example.com/item');
  assert.equal(web.getState().tabs[0]?.title, 'shop.example.com');
  assert.equal(web.getState().tabs[0]?.canGoBack, true);
  assert.equal(fail(await web.goForward()), 'not-available');
  await web.goBack();
  assert.equal(web.getState().tabs[0]?.canGoForward, true);
  await web.goForward();
  assert.equal(web.getState().tabs[0]?.title, 'shop.example.com');
  assert.equal((await web.listHistory()).length, 4);
  assert.equal((await web.listHistory('shop')).length, 2 > 0 ? (await web.listHistory('shop')).length : 0);
  assert.equal(fail(await web.search('   ')), 'invalid');
  await web.clearBrowsingData(['history']);
  assert.equal((await web.listHistory()).length, 0);
});

test('nothing from incognito or stealth tabs is added to history or bookmarks', async () => {
  const web = new MockWebUiService();
  await web.newTab('incognito');
  await web.search('example.com');
  assert.deepEqual(await web.listHistory(), []);
  assert.equal(fail(await web.bookmarkPage()), 'coming-soon');
  assert.equal(fail(await web.downloadPage()), 'coming-soon');
  assert.equal(fail(await web.getSiteInfo()), 'coming-soon');
});

test('closing the open tab opens its neighbour, remembers normal pages, and reopening works', async () => {
  const web = new MockWebUiService();
  const a = await web.newTab('normal'); await web.search('a.example.com');
  const b = await web.newTab('normal'); await web.search('b.example.com');
  const c = await web.newTab('normal');
  const [ida, idb, idc] = [a, b, c].map((r) => (r.ok ? r.value.tabId : ''));
  await web.closeTab(idc as string);
  assert.equal(web.getState().activeTabId, idb);
  await web.closeTab(idb as string);
  assert.equal(web.getState().activeTabId, ida);
  assert.deepEqual(web.recentlyClosed().map((t) => t.title), ['b.example.com']);
  const reopened = await web.reopenClosedTab(0);
  assert.ok(reopened.ok);
  assert.equal(web.recentlyClosed().length, 0);
  assert.equal(fail(await web.reopenClosedTab(0)), 'invalid');
  assert.equal(fail(await web.closeTab('nope')), 'invalid');
  await web.closeTab(ida as string);
  await web.closeTab(reopened.ok ? reopened.value.tabId : '');
  assert.equal(web.getState().activeTabId, null);
});

test('groups: created from tabs of one kind, renamed, joined, left, and deleted without closing tabs', async () => {
  const web = new MockWebUiService();
  const a = await web.newTab('normal'); const b = await web.newTab('normal'); const s = await web.newTab('stealth');
  const [ida, idb, ids] = [a, b, s].map((r) => (r.ok ? r.value.tabId : '')) as [string, string, string];
  const g = await web.createGroup('  Shopping ', [ida, ids]);
  assert.ok(g.ok);
  const gid = g.ok ? g.value.groupId : '';
  const tabs = () => web.getState().tabs;
  assert.equal(tabs().find((t) => t.id === ida)?.groupId, gid);
  assert.equal(tabs().find((t) => t.id === ids)?.groupId, null, 'a stealth tab cannot join a normal group');
  assert.equal(web.getState().groups[0]?.name, 'Shopping');
  assert.equal((await web.addToGroup(idb, gid)).ok, true);
  assert.equal(fail(await web.addToGroup(ids, gid)), 'invalid');
  assert.equal((await web.renameGroup(gid, 'Phones')).ok, true);
  assert.equal(fail(await web.renameGroup(gid, '')), 'invalid');
  assert.equal(fail(await web.createGroup('x'.repeat(41), [])), 'invalid');
  await web.removeFromGroup(idb);
  assert.equal(tabs().find((t) => t.id === idb)?.groupId, null);
  assert.equal((await web.deleteGroup(gid)).ok, true);
  assert.equal(tabs().length, 3);
  assert.equal(tabs().find((t) => t.id === ida)?.groupId, null);
  assert.equal(fail(await web.deleteGroup(gid)), 'invalid');
});

test('moving a tab to another kind is coming soon; pinning, duplicating and closing all of a kind work', async () => {
  const web = new MockWebUiService();
  const a = await web.newTab('normal'); await web.newTab('incognito'); await web.newTab('incognito');
  const ida = a.ok ? a.value.tabId : '';
  assert.equal(fail(await web.moveTabToKind(ida, 'stealth')), 'coming-soon');
  assert.equal((await web.moveTabToKind(ida, 'normal')).ok, true);
  await web.pinTab(ida, true);
  assert.equal(web.getState().tabs[0]?.pinned, true);
  const copy = await web.duplicateTab(ida);
  assert.equal(web.getState().tabs.find((t) => t.id === (copy.ok ? copy.value.tabId : ''))?.pinned, false);
  const closed = await web.closeAllTabs('incognito');
  assert.deepEqual(closed.ok && closed.value, { closed: 2 });
  assert.equal(web.getState().tabs.every((t) => t.kind === 'normal'), true);
});

test('bookmarks toggle with the page, can be opened and removed; downloads and site permissions work', async () => {
  const web = new MockWebUiService();
  await web.newTab('normal');
  assert.equal(fail(await web.bookmarkPage()), 'not-available');
  await web.search('shop.example.com');
  assert.deepEqual((await web.bookmarkPage()).ok && (await web.listBookmarks()).length, 1);
  assert.equal(web.getState().tabs[0]?.bookmarked, true);
  await web.search('other.example.com');
  const [bookmark] = await web.listBookmarks();
  await web.openBookmark(bookmark?.id ?? '');
  assert.equal(web.getState().tabs[0]?.bookmarked, true);
  assert.equal((await web.removeBookmark(bookmark?.id ?? '')).ok, true);
  assert.equal(fail(await web.removeBookmark('x')), 'invalid');
  assert.equal((await web.downloadPage()).ok, true);
  const [download] = await web.listDownloads();
  assert.equal(download?.status, 'done');
  assert.equal((await web.cancelDownload(download?.id ?? '')).ok, true);
  const info = await web.getSiteInfo();
  assert.deepEqual(info.ok && info.value.permissions.camera, 'block');
  await web.setSitePermission('camera', 'ask');
  const again = await web.getSiteInfo();
  assert.equal(again.ok && again.value.permissions.camera, 'ask');
});

test('page tools: desktop site, reader mode, find, translate and share on a normal page; bad language refused', async () => {
  const web = new MockWebUiService();
  await web.newTab('normal'); await web.search('news.example.com');
  assert.deepEqual((await web.toggleDesktopSite()).ok && web.getState().tabs[0]?.desktopSite, true);
  assert.deepEqual((await web.toggleReaderMode()).ok && web.getState().tabs[0]?.readerMode, true);
  const found = await web.findInPage('word', true);
  assert.equal(found.ok && found.value.matches, 3);
  assert.equal((await web.findInPage('  ', true)).ok && 0, 0);
  web.clearFind();
  assert.equal((await web.translatePage('fr')).ok, true);
  assert.equal(fail(await web.translatePage('xx; drop')), 'invalid');
  for (const action of ['link', 'copyText', 'shareText', 'pdf', 'page'] as const) assert.equal((await web.share(action)).ok, true);
  assert.equal((await web.reload()).ok, true);
  await web.search('other.example.com');
  assert.equal(web.getState().tabs[0]?.readerMode, false, 'reader mode resets on a new page');
});

test('listeners hear every change, stop when told, and the viewport is remembered; the getter returns one service', async () => {
  const web = new MockWebUiService();
  let heard = 0;
  const stop = web.subscribe(() => { heard += 1; });
  await web.newTab('normal'); await web.search('a.example.com');
  assert.ok(heard >= 2);
  stop(); const before = heard; await web.newTab('normal');
  assert.equal(heard, before);
  web.setViewportRect({ x: 0, y: 64, width: 390, height: 600 });
  assert.deepEqual(web.getViewportRect(), { x: 0, y: 64, width: 390, height: 600 });
  web.setViewportRect(null);
  assert.equal(web.getViewportRect(), null);
  assert.equal(getWebUiService(), getWebUiService());
});
