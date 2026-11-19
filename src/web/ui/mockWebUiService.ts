import { WEB_FEATURES } from './webFeatureFlags.ts';
import type {
  WebBookmark, WebClearable, WebClosedTab, WebDownload, WebGroup, WebHistoryItem, WebPermission, WebPermissionDecision, WebResult,
  WebShareAction, WebSiteInfo, WebState, WebTab, WebTabKind, WebUiService, WebViewportRect,
} from './webUiTypes.ts';

const ok = <T>(value: T): WebResult<T> => Object.freeze({ ok: true as const, value });
const no = (reason: 'coming-soon' | 'not-available' | 'invalid' | 'failed', message: string): WebResult<never> => Object.freeze({ ok: false as const, reason, message });
const KIND_LABEL: Record<WebTabKind, string> = { normal: 'Normal', incognito: 'Incognito', stealth: 'Stealth' };

function toUrl(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (value.startsWith('https://') || value.startsWith('http://')) return value;
  if (!value.includes(' ') && value.includes('.') && !value.startsWith('.') && !value.endsWith('.')) return 'https://' + value;
  return 'https://www.google.com/search?q=' + encodeURIComponent(value);
}
function titleOf(url: string): string {
  try { const u = new URL(url); return u.hostname.startsWith('www.') ? u.hostname.slice(4) : u.hostname; } catch { return url; }
}

type Perms = Record<WebPermission, WebPermissionDecision>;
const defaultPerms = (): Perms => ({ camera: 'block', microphone: 'block', location: 'block', notifications: 'block' });

/**
 * In-memory preview of AXON Web. It behaves like the real engine for the normal kind and says "coming soon"
 * for incognito and stealth searches while their flags are off. Used by the screens now (and by AI Studio previews).
 */
export class MockWebUiService implements WebUiService {
  private state: WebState = { tabs: [], groups: [], activeTabId: null };
  private readonly listeners = new Set<() => void>();
  private counter = 0;
  private readonly backStacks = new Map<string, string[]>();
  private readonly forwardStacks = new Map<string, string[]>();
  private history: WebHistoryItem[] = [];
  private bookmarks: WebBookmark[] = [];
  private downloads: WebDownload[] = [];
  private closed: WebClosedTab[] = [];
  private readonly perms = new Map<string, Perms>();
  private viewport: WebViewportRect | null = null;
  private findText = '';

  getState(): WebState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  getViewportRect(): WebViewportRect | null { return this.viewport; }
  private set(next: Partial<{ tabs: readonly WebTab[]; groups: readonly WebGroup[]; activeTabId: string | null }>): void {
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of [...this.listeners]) listener();
  }
  private id(prefix: string): string { this.counter += 1; return `${prefix}${this.counter}`; }
  private tab(tabId: string | null): WebTab | undefined { return this.state.tabs.find((t) => t.id === tabId); }
  private active(): WebTab | undefined { return this.tab(this.state.activeTabId); }
  private patch(tabId: string, change: Partial<WebTab>): void { this.set({ tabs: this.state.tabs.map((t) => (t.id === tabId ? Object.freeze({ ...t, ...change }) : t)) }); }
  private blank(kind: WebTabKind): WebTab {
    return Object.freeze({ id: this.id('tab-'), kind, title: 'New tab', url: '', loading: false, groupId: null, pinned: false, canGoBack: false, canGoForward: false, desktopSite: false, readerMode: false, bookmarked: false, secure: true });
  }
  private needNormalPage(): WebResult<never> | null {
    const tab = this.active();
    if (!tab) return no('not-available', 'No tab is open.');
    if (tab.kind !== 'normal' && !WEB_FEATURES[tab.kind]) return no('coming-soon', `${KIND_LABEL[tab.kind]} browsing is coming soon.`);
    if (!tab.url) return no('not-available', 'This tab has no page yet.');
    return null;
  }

  async newTab(kind: WebTabKind) { const tab = this.blank(kind); this.set({ tabs: [...this.state.tabs, tab], activeTabId: tab.id }); return ok({ tabId: tab.id }); }
  async switchTab(tabId: string) { if (!this.tab(tabId)) return no('invalid', 'No such tab.'); this.set({ activeTabId: tabId }); return ok(null); }
  async closeTab(tabId: string) {
    const tab = this.tab(tabId);
    if (!tab) return no('invalid', 'No such tab.');
    if (tab.kind === 'normal' && tab.url) this.closed = [{ title: tab.title, url: tab.url, kind: tab.kind }, ...this.closed].slice(0, 20);
    const tabs = this.state.tabs.filter((t) => t.id !== tabId);
    const index = this.state.tabs.findIndex((t) => t.id === tabId);
    const activeTabId = this.state.activeTabId !== tabId ? this.state.activeTabId : (tabs[Math.min(index, tabs.length - 1)]?.id ?? null);
    this.backStacks.delete(tabId); this.forwardStacks.delete(tabId);
    this.set({ tabs, activeTabId });
    return ok(null);
  }
  async closeAllTabs(kind: WebTabKind) {
    const doomed = this.state.tabs.filter((t) => t.kind === kind);
    for (const tab of doomed) await this.closeTab(tab.id);
    return ok({ closed: doomed.length });
  }
  async duplicateTab(tabId: string) {
    const tab = this.tab(tabId);
    if (!tab) return no('invalid', 'No such tab.');
    const copy = Object.freeze({ ...tab, id: this.id('tab-'), pinned: false });
    this.set({ tabs: [...this.state.tabs, copy], activeTabId: copy.id });
    return ok({ tabId: copy.id });
  }
  async pinTab(tabId: string, pinned: boolean) { if (!this.tab(tabId)) return no('invalid', 'No such tab.'); this.patch(tabId, { pinned }); return ok(null); }
  async moveTabToKind(tabId: string, kind: WebTabKind) {
    const tab = this.tab(tabId);
    if (!tab) return no('invalid', 'No such tab.');
    if (tab.kind === kind) return ok(null);
    return no('coming-soon', `Moving a tab to ${KIND_LABEL[kind]} is coming soon.`);
  }
  recentlyClosed(): readonly WebClosedTab[] { return this.closed; }
  async reopenClosedTab(index: number) {
    const item = this.closed[index];
    if (!item) return no('invalid', 'No such closed tab.');
    this.closed = this.closed.filter((_, i) => i !== index);
    const tab = Object.freeze({ ...this.blank(item.kind), url: item.url, title: item.title });
    this.set({ tabs: [...this.state.tabs, tab], activeTabId: tab.id });
    return ok({ tabId: tab.id });
  }

  async createGroup(name: string, tabIds: readonly string[]) {
    const label = name.trim();
    if (!label || label.length > 40) return no('invalid', 'A group name needs 1 to 40 characters.');
    const first = this.tab(tabIds[0] ?? null);
    const group: WebGroup = Object.freeze({ id: this.id('group-'), name: label, kind: first?.kind ?? 'normal' });
    this.set({ groups: [...this.state.groups, group] });
    for (const id of tabIds) { const t = this.tab(id); if (t && t.kind === group.kind) this.patch(id, { groupId: group.id }); }
    return ok({ groupId: group.id });
  }
  async renameGroup(groupId: string, name: string) {
    const label = name.trim();
    if (!label || label.length > 40) return no('invalid', 'A group name needs 1 to 40 characters.');
    if (!this.state.groups.some((g) => g.id === groupId)) return no('invalid', 'No such group.');
    this.set({ groups: this.state.groups.map((g) => (g.id === groupId ? Object.freeze({ ...g, name: label }) : g)) });
    return ok(null);
  }
  async addToGroup(tabId: string, groupId: string) {
    const tab = this.tab(tabId); const group = this.state.groups.find((g) => g.id === groupId);
    if (!tab || !group) return no('invalid', 'No such tab or group.');
    if (tab.kind !== group.kind) return no('invalid', 'A tab can only join a group of its own kind.');
    this.patch(tabId, { groupId }); return ok(null);
  }
  async removeFromGroup(tabId: string) { if (!this.tab(tabId)) return no('invalid', 'No such tab.'); this.patch(tabId, { groupId: null }); return ok(null); }
  async deleteGroup(groupId: string) {
    if (!this.state.groups.some((g) => g.id === groupId)) return no('invalid', 'No such group.');
    this.set({ groups: this.state.groups.filter((g) => g.id !== groupId), tabs: this.state.tabs.map((t) => (t.groupId === groupId ? Object.freeze({ ...t, groupId: null }) : t)) });
    return ok(null);
  }

  async search(text: string) {
    const tab = this.active();
    if (!tab) return no('not-available', 'No tab is open.');
    if (tab.kind !== 'normal' && !WEB_FEATURES[tab.kind]) return no('coming-soon', `${KIND_LABEL[tab.kind]} browsing is coming soon.`);
    const url = toUrl(text);
    if (!url) return no('invalid', 'Type something to search or a web address.');
    if (tab.url) { this.backStacks.set(tab.id, [...(this.backStacks.get(tab.id) ?? []), tab.url]); }
    this.forwardStacks.set(tab.id, []);
    this.visit(tab, url);
    return ok(null);
  }
  private visit(tab: WebTab, url: string): void {
    const bookmarked = this.bookmarks.some((b) => b.url === url);
    this.patch(tab.id, { url, title: titleOf(url), canGoBack: (this.backStacks.get(tab.id)?.length ?? 0) > 0, canGoForward: (this.forwardStacks.get(tab.id)?.length ?? 0) > 0, bookmarked, readerMode: false, secure: url.startsWith('https://') });
    if (tab.kind === 'normal') this.history = [{ id: this.id('hist-'), title: titleOf(url), url, visitedAt: this.counter }, ...this.history].slice(0, 500);
  }
  async goBack() {
    const tab = this.active(); const stack = tab ? this.backStacks.get(tab.id) ?? [] : [];
    if (!tab || stack.length === 0) return no('not-available', 'There is no earlier page.');
    this.forwardStacks.set(tab.id, [...(this.forwardStacks.get(tab.id) ?? []), tab.url]);
    this.backStacks.set(tab.id, stack.slice(0, -1));
    this.visit(tab, stack[stack.length - 1] as string); return ok(null);
  }
  async goForward() {
    const tab = this.active(); const stack = tab ? this.forwardStacks.get(tab.id) ?? [] : [];
    if (!tab || stack.length === 0) return no('not-available', 'There is no later page.');
    this.backStacks.set(tab.id, [...(this.backStacks.get(tab.id) ?? []), tab.url]);
    this.forwardStacks.set(tab.id, stack.slice(0, -1));
    this.visit(tab, stack[stack.length - 1] as string); return ok(null);
  }
  async reload() { const blocked = this.needNormalPage(); if (blocked) return blocked; return ok(null); }
  async stop() { const tab = this.active(); if (!tab) return no('not-available', 'No tab is open.'); this.patch(tab.id, { loading: false }); return ok(null); }

  async bookmarkPage() {
    const blocked = this.needNormalPage(); if (blocked) return blocked;
    const tab = this.active() as WebTab;
    if (tab.bookmarked) { this.bookmarks = this.bookmarks.filter((b) => b.url !== tab.url); this.patch(tab.id, { bookmarked: false }); return ok({ bookmarked: false }); }
    this.bookmarks = [{ id: this.id('bm-'), title: tab.title, url: tab.url }, ...this.bookmarks];
    this.patch(tab.id, { bookmarked: true }); return ok({ bookmarked: true });
  }
  async downloadPage() {
    const blocked = this.needNormalPage(); if (blocked) return blocked;
    const tab = this.active() as WebTab;
    this.downloads = [{ id: this.id('dl-'), title: tab.title + '.html', url: tab.url, status: 'done', progress: 1 }, ...this.downloads]; return ok(null);
  }
  async findInPage(query: string, _forward: boolean) {
    const blocked = this.needNormalPage(); if (blocked) return blocked;
    this.findText = query.trim(); return ok({ matches: this.findText ? 3 : 0 });
  }
  clearFind(): void { this.findText = ''; }
  async toggleDesktopSite() { const blocked = this.needNormalPage(); if (blocked) return blocked; const tab = this.active() as WebTab; this.patch(tab.id, { desktopSite: !tab.desktopSite }); return ok({ enabled: !tab.desktopSite }); }
  async toggleReaderMode() { const blocked = this.needNormalPage(); if (blocked) return blocked; const tab = this.active() as WebTab; this.patch(tab.id, { readerMode: !tab.readerMode }); return ok({ enabled: !tab.readerMode }); }
  async translatePage(languageCode: string) {
    const blocked = this.needNormalPage(); if (blocked) return blocked;
    if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(languageCode)) return no('invalid', 'Give a language code such as en, fr or pt-BR.');
    return ok(null);
  }
  async share(_action: WebShareAction) { const blocked = this.needNormalPage(); if (blocked) return blocked; return ok(null); }

  async listHistory(query = '') { const q = query.trim().toLowerCase(); return q ? this.history.filter((h) => `${h.title} ${h.url}`.toLowerCase().includes(q)) : this.history; }
  async openHistoryItem(id: string) { const item = this.history.find((h) => h.id === id); if (!item) return no('invalid', 'No such history entry.'); return this.search(item.url); }
  async listBookmarks() { return this.bookmarks; }
  async openBookmark(id: string) { const item = this.bookmarks.find((b) => b.id === id); if (!item) return no('invalid', 'No such bookmark.'); return this.search(item.url); }
  async removeBookmark(id: string) { if (!this.bookmarks.some((b) => b.id === id)) return no('invalid', 'No such bookmark.'); this.bookmarks = this.bookmarks.filter((b) => b.id !== id); return ok(null); }
  async listDownloads() { return this.downloads; }
  async cancelDownload(id: string) { if (!this.downloads.some((d) => d.id === id)) return no('invalid', 'No such download.'); this.downloads = this.downloads.filter((d) => d.id !== id); return ok(null); }
  async clearBrowsingData(what: readonly WebClearable[]) { if (what.includes('history')) this.history = []; return ok(null); }

  async getSiteInfo() {
    const tab = this.active();
    if (!tab) return no('not-available', 'No page is open.');
    if (tab.kind !== 'normal' && !WEB_FEATURES[tab.kind]) return no('coming-soon', `${KIND_LABEL[tab.kind]} browsing is coming soon.`);
    if (!tab.url) return no('not-available', 'No page is open.');
    const host = titleOf(tab.url);
    const info: WebSiteInfo = Object.freeze({ host, secure: tab.secure, permissions: Object.freeze({ ...(this.perms.get(host) ?? defaultPerms()) }) });
    return ok(info);
  }
  async setSitePermission(permission: WebPermission, decision: WebPermissionDecision) {
    const info = await this.getSiteInfo(); if (!info.ok) return info;
    this.perms.set(info.value.host, { ...(this.perms.get(info.value.host) ?? defaultPerms()), [permission]: decision }); return ok(null);
  }
  setViewportRect(rect: WebViewportRect | null): void { this.viewport = rect; }
}
