import AxonBrowser, { isNativeBrowserAvailable } from './axonBrowserPlugin.ts';
import type { AxonBrowserPlugin } from './browserPluginTypes.ts';
import type { BrowserDownloadItem, BrowserSecurityDetails, BrowserSitePermissionSummary } from './browserPluginTypes.ts';
import type { BrowserEngineAdapter } from './browserEngineAdapter.ts';

/** Native Android System WebView adapter. It does not implement GeckoView or a web-preview fake. */
export class AndroidWebViewAdapter implements BrowserEngineAdapter {
  readonly engineId = 'android-system-webview' as const;
  private readonly plugin: AxonBrowserPlugin;
  constructor(plugin: AxonBrowserPlugin = AxonBrowser) { this.plugin = plugin; }
  isAvailable(): boolean { return isNativeBrowserAvailable(); }
  open(options?: { url?: string }) { return this.plugin.open(options); }
  navigate(options: { url: string }) { return this.plugin.navigate(options); }
  back() { return this.plugin.back(); }
  forward() { return this.plugin.forward(); }
  reload() { return this.plugin.reload(); }
  stop() { return this.plugin.stop(); }
  newTab(options?: { url?: string; kind?: 'normal' | 'incognito' | 'stealth' }) { return this.plugin.newTab(options); }
  createGroup(options: { name: string; tabIndexes?: number[] }) { return this.plugin.createGroup(options); }
  renameGroup(options: { groupId: string; name: string }) { return this.plugin.renameGroup(options); }
  moveTabToGroup(options: { index: number; groupId: string }) { return this.plugin.moveTabToGroup(options); }
  removeTabFromGroup(options: { index: number }) { return this.plugin.removeTabFromGroup(options); }
  deleteGroup(options: { groupId: string }) { return this.plugin.deleteGroup(options); }
  closeGroup(options: { groupId: string }) { return this.plugin.closeGroup(options); }
  listGroups() { return this.plugin.listGroups(); }
  switchTab(options: { index: number }) { return this.plugin.switchTab(options); }
  closeTab(options: { index: number }) { return this.plugin.closeTab(options); }
  getState() { return this.plugin.getState(); }
  getPageText() { return this.plugin.getPageText(); }
  findInPage(options: { text: string }) { return this.plugin.findInPage(options); }
  zoomBy(options: { delta: number }) { return this.plugin.zoomBy(options); }
  setDesktopSite(options: { enabled: boolean }) { return this.plugin.setDesktopSite(options); }
  addBookmark(options: { title: string; url: string }) { return this.plugin.addBookmark(options); }
  editBookmark(options: { index: number; title: string; url: string }) { return this.plugin.editBookmark(options); }
  removeBookmark(options: { index: number }) { return this.plugin.removeBookmark(options); }
  createBookmarkFolder(options: { name: string }) { return this.plugin.createBookmarkFolder(options); }
  moveBookmark(options: { index: number; folder: string }) { return this.plugin.moveBookmark(options); }
  listBookmarks() { return this.plugin.listBookmarks(); }
  searchHistory(options?: { query?: string }) { return this.plugin.searchHistory(options); }
  clearHistory() { return this.plugin.clearHistory(); }
  clearHistoryBySite(options: { host: string }) { return this.plugin.clearHistoryBySite(options); }
  addToReadingList(options: { title: string; url: string }) { return this.plugin.addToReadingList(options); }
  removeReadingListItem(options: { index: number }) { return this.plugin.removeReadingListItem(options); }
  openReadingListItem(options: { index: number }) { return this.plugin.openReadingListItem(options); }
  markReadingListRead(options: { index: number; read: boolean }) { return this.plugin.markReadingListRead(options); }
  listReadingList() { return this.plugin.listReadingList(); }
  listDownloads(): Promise<{ items: BrowserDownloadItem[] }> { return this.plugin.listDownloads(); }
  openDownload(options: { id: string }) { return this.plugin.openDownload(options); }
  shareDownload(options: { id: string }) { return this.plugin.shareDownload(options); }
  cancelDownload(options: { id: string }) { return this.plugin.cancelDownload(options); }
  deleteDownload(options: { id: string }) { return this.plugin.deleteDownload(options); }
  copyCurrentUrl() { return this.plugin.copyCurrentUrl(); }
  shareCurrentUrl() { return this.plugin.shareCurrentUrl(); }
  printPage() { return this.plugin.printPage(); }
  savePagePdf() { return this.plugin.savePagePdf(); }
  getSecurityDetails(): Promise<BrowserSecurityDetails> { return this.plugin.getSecurityDetails(); }
  getSitePermissions(): Promise<BrowserSitePermissionSummary> { return this.plugin.getSitePermissions(); }
}
