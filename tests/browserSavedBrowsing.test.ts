import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserController } from '../src/web/browserController.ts';
import { BROWSER_PARITY_MATRIX, getBrowserParity } from '../src/web/browserParityMatrix.ts';

const calls: Array<[string, unknown[]]> = [];
const state = { available: true, tabCount: 1, activeIndex: 0, url: 'https://example.test', title: 'Example', loading: false, canGoBack: false, canGoForward: false, engine: 'simulated', incognito: false as const };
const adapter = {
  engineId: 'simulated' as const, isAvailable: () => true,
  open: async (...args: unknown[]) => { calls.push(['open', args]); return { opened: true, url: 'https://example.test' }; },
  navigate: async (...args: unknown[]) => { calls.push(['navigate', args]); return state; },
  back: async (...args: unknown[]) => { calls.push(['back', args]); return state; }, forward: async (...args: unknown[]) => { calls.push(['forward', args]); return state; },
  reload: async (...args: unknown[]) => { calls.push(['reload', args]); return state; }, stop: async (...args: unknown[]) => { calls.push(['stop', args]); return state; },
  newTab: async (...args: unknown[]) => { calls.push(['newTab', args]); return state; }, switchTab: async (...args: unknown[]) => { calls.push(['switchTab', args]); return state; },
  closeTab: async (...args: unknown[]) => { calls.push(['closeTab', args]); return state; }, getState: async (...args: unknown[]) => { calls.push(['getState', args]); return state; },
  getPageText: async (...args: unknown[]) => { calls.push(['getPageText', args]); return { text: 'page' }; }, findInPage: async (...args: unknown[]) => { calls.push(['findInPage', args]); },
  zoomBy: async (...args: unknown[]) => { calls.push(['zoomBy', args]); }, setDesktopSite: async (...args: unknown[]) => { calls.push(['setDesktopSite', args]); return state; },
  addBookmark: async (...args: unknown[]) => { calls.push(['addBookmark', args]); }, editBookmark: async (...args: unknown[]) => { calls.push(['editBookmark', args]); },
  removeBookmark: async (...args: unknown[]) => { calls.push(['removeBookmark', args]); }, createBookmarkFolder: async (...args: unknown[]) => { calls.push(['createBookmarkFolder', args]); },
  moveBookmark: async (...args: unknown[]) => { calls.push(['moveBookmark', args]); }, listBookmarks: async (...args: unknown[]) => { calls.push(['listBookmarks', args]); return { items: [], folders: [] }; },
  searchHistory: async (...args: unknown[]) => { calls.push(['searchHistory', args]); return { items: [] }; }, clearHistory: async (...args: unknown[]) => { calls.push(['clearHistory', args]); },
  clearHistoryBySite: async (...args: unknown[]) => { calls.push(['clearHistoryBySite', args]); }, addToReadingList: async (...args: unknown[]) => { calls.push(['addToReadingList', args]); },
  removeReadingListItem: async (...args: unknown[]) => { calls.push(['removeReadingListItem', args]); }, openReadingListItem: async (...args: unknown[]) => { calls.push(['openReadingListItem', args]); return state; },
  markReadingListRead: async (...args: unknown[]) => { calls.push(['markReadingListRead', args]); }, listReadingList: async (...args: unknown[]) => { calls.push(['listReadingList', args]); return { items: [] }; },
  listDownloads: async (...args: unknown[]) => { calls.push(['listDownloads', args]); return { items: [] }; },
  openDownload: async (...args: unknown[]) => { calls.push(['openDownload', args]); }, shareDownload: async (...args: unknown[]) => { calls.push(['shareDownload', args]); },
  cancelDownload: async (...args: unknown[]) => { calls.push(['cancelDownload', args]); }, deleteDownload: async (...args: unknown[]) => { calls.push(['deleteDownload', args]); },
  copyCurrentUrl: async (...args: unknown[]) => { calls.push(['copyCurrentUrl', args]); }, shareCurrentUrl: async (...args: unknown[]) => { calls.push(['shareCurrentUrl', args]); },
  printPage: async (...args: unknown[]) => { calls.push(['printPage', args]); }, savePagePdf: async (...args: unknown[]) => { calls.push(['savePagePdf', args]); },
  getSecurityDetails: async (...args: unknown[]) => { calls.push(['getSecurityDetails', args]); return { url: '', scheme: '', host: '', certificatePresent: false, subject: '', issuer: '' }; },
  getSitePermissions: async (...args: unknown[]) => { calls.push(['getSitePermissions', args]); return { origin: '', summary: '', permissions: [] }; },
};
const controller = new BrowserController(adapter);

const cases: Array<[string, Record<string, unknown>, string]> = [
  ['bookmarks.edit', { index: 0, title: 'Updated', url: 'https://example.test/updated' }, 'editBookmark'],
  ['bookmarks.remove', { index: 0 }, 'removeBookmark'],
  ['bookmarks.createFolder', { name: 'Research' }, 'createBookmarkFolder'],
  ['bookmarks.move', { index: 1, folder: 'Research' }, 'moveBookmark'],
  ['history.clear', {}, 'clearHistory'],
  ['history.clearBySite', { host: 'example.test' }, 'clearHistoryBySite'],
  ['readingList.add', { title: 'Read later', url: 'https://example.test/article' }, 'addToReadingList'],
  ['readingList.remove', { index: 0 }, 'removeReadingListItem'],
  ['readingList.open', { index: 0 }, 'openReadingListItem'],
  ['readingList.markRead', { index: 0, read: true }, 'markReadingListRead'],
  ['readingList.list', {}, 'listReadingList'],
  ['downloads.list', {}, 'listDownloads'],
  ['downloads.open', { id: '12345' }, 'openDownload'],
  ['downloads.share', { id: '12345' }, 'shareDownload'],
  ['downloads.cancel', { id: '12345' }, 'cancelDownload'],
  ['downloads.delete', { id: '12345' }, 'deleteDownload'],
  ['navigation.copyUrl', {}, 'copyCurrentUrl'],
  ['navigation.shareUrl', {}, 'shareCurrentUrl'],
  ['navigation.securityDetails', {}, 'getSecurityDetails'],
  ['files.print', {}, 'printPage'],
  ['files.savePdf', {}, 'savePagePdf'],
  ['site.viewPermissions', {}, 'getSitePermissions'],
];

for (const [functionId, args, expectedMethod] of cases) {
  test(`${functionId} reaches native saved-browsing method ${expectedMethod}`, async () => {
    calls.length = 0;
    const result = await controller.execute({ functionId: functionId as never, actor: 'OWNER', sessionId: 'owner-default', args });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], expectedMethod);
  });
}

test('all saved-browsing executors are marked implemented in the parity matrix', () => {
  for (const [functionId] of cases) {
    assert.equal(getBrowserParity(functionId as never)?.ownerHost, 'IMPLEMENTED');
    assert.equal(getBrowserParity(functionId as never)?.ownerCommand, 'IMPLEMENTED');
  }
  assert.equal(BROWSER_PARITY_MATRIX.length, 118);
});

test('AXON is denied all saved-browsing operations on the owner session', async () => {
  calls.length = 0;
  for (const [functionId, args] of cases) {
    const result = await controller.execute({ functionId: functionId as never, actor: 'AXON', sessionId: 'axon-task', args });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DENIED');
  }
  assert.equal(calls.length, 0);
});

test('native persistence, validation and saved-browsing methods exist in Java host', async () => {
  const fs = await import('node:fs');
  const java = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserActivity.java', 'utf8');
  const plugin = fs.readFileSync('android-overlay/app/src/main/java/com/axon/app/browser/BrowserPlugin.java', 'utf8');
  for (const method of ['editBookmark', 'removeBookmark', 'createBookmarkFolder', 'moveBookmark', 'clearHistory', 'clearHistoryBySite', 'addToReadingList', 'removeReadingListItem', 'openReadingListItem', 'markReadingListRead', 'getReadingList', 'getDownloads', 'openDownload', 'shareDownload', 'cancelDownload', 'deleteDownload', 'copyCurrentUrl', 'shareCurrentUrl', 'printCurrentPage', 'getSecurityDetails', 'getSitePermissions']) assert.match(java, new RegExp(`\\b${method}\\b`));
  assert.match(java, /saveJson\("readingList",\s*readingList\)/);
  assert.match(java, /putString\("bookmarkFolders"/);
  assert.match(java, /parseDownloadId\(String rawId\)/, 'download actions use stable IDs rather than a filtered-list index');
  assert.match(plugin, /getString\("id"\)/, 'typed download bridge accepts the stable DownloadManager ID');
  for (const action of ['Save to reading list', 'Bookmarks', 'Reading list', 'Downloads', 'Copy URL', 'Share URL', 'Site information', 'Print page', 'Save as PDF', 'Create bookmark folder', 'Clear history', 'Clear by site']) assert.ok(java.includes(action), `native menu exposes ${action}`);
  for (const action of ['Edit', 'Move to folder', 'Mark as read', 'Remove', 'Open', 'Share', 'Cancel download', 'Remove record']) assert.ok(java.includes(action), `saved-item UI exposes ${action}`);
  for (const method of ['editBookmark', 'removeBookmark', 'createBookmarkFolder', 'moveBookmark', 'clearHistory', 'clearHistoryBySite', 'addToReadingList', 'removeReadingListItem', 'openReadingListItem', 'markReadingListRead', 'listReadingList']) assert.match(plugin, new RegExp(`@PluginMethod public void ${method}`));
});
