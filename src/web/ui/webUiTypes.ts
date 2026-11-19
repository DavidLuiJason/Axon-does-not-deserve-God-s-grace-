/**
 * The ONLY door between the AXON Web screens and the browser engine.
 * Screens import these types and call getWebUiService() (webUiService.ts). Nothing else.
 * Today getWebUiService() returns an in-memory preview service; Director 204 swaps in the real one later.
 */
export type WebTabKind = 'normal' | 'incognito' | 'stealth';
export const WEB_TAB_KINDS: readonly WebTabKind[] = Object.freeze(['normal', 'incognito', 'stealth']);

export type WebTab = Readonly<{
  id: string;
  kind: WebTabKind;
  title: string;
  url: string;
  loading: boolean;
  /** Tab group this tab belongs to, or null. */
  groupId: string | null;
  pinned: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  desktopSite: boolean;
  readerMode: boolean;
  bookmarked: boolean;
  secure: boolean;
}>;

export type WebGroup = Readonly<{ id: string; name: string; kind: WebTabKind }>;

export type WebState = Readonly<{
  tabs: readonly WebTab[];
  groups: readonly WebGroup[];
  /** The open tab, or null when no tab is open (then the screen shows the empty Web page). */
  activeTabId: string | null;
}>;

export type WebFailReason = 'coming-soon' | 'not-available' | 'invalid' | 'failed';
export type WebResult<T = null> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; reason: WebFailReason; message: string }>;

export type WebHistoryItem = Readonly<{ id: string; title: string; url: string; visitedAt: number }>;
export type WebBookmark = Readonly<{ id: string; title: string; url: string }>;
export type WebDownload = Readonly<{ id: string; title: string; url: string; status: 'running' | 'done' | 'failed'; progress: number }>;
export type WebClosedTab = Readonly<{ title: string; url: string; kind: WebTabKind }>;
export type WebPermission = 'camera' | 'microphone' | 'location' | 'notifications';
export type WebPermissionDecision = 'allow' | 'block' | 'ask';
export type WebSiteInfo = Readonly<{ host: string; secure: boolean; permissions: Readonly<Record<WebPermission, WebPermissionDecision>> }>;
export type WebClearable = 'history' | 'cookies' | 'cache' | 'siteData';
export type WebViewportRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type WebShareAction = 'link' | 'copyText' | 'shareText' | 'pdf' | 'page';

export interface WebUiService {
  getState(): WebState;
  /** Calls listener after every change. Returns the function that stops listening. */
  subscribe(listener: () => void): () => void;

  // tabs
  /** Opens an empty tab of the kind. Always works (the screen design is ready for all three kinds). */
  newTab(kind: WebTabKind): Promise<WebResult<{ tabId: string }>>;
  switchTab(tabId: string): Promise<WebResult>;
  closeTab(tabId: string): Promise<WebResult>;
  closeAllTabs(kind: WebTabKind): Promise<WebResult<{ closed: number }>>;
  duplicateTab(tabId: string): Promise<WebResult<{ tabId: string }>>;
  pinTab(tabId: string, pinned: boolean): Promise<WebResult>;
  /** Changes a tab's kind. Returns coming-soon until the engine exists. */
  moveTabToKind(tabId: string, kind: WebTabKind): Promise<WebResult>;
  recentlyClosed(): readonly WebClosedTab[];
  reopenClosedTab(index: number): Promise<WebResult<{ tabId: string }>>;

  // groups
  createGroup(name: string, tabIds: readonly string[]): Promise<WebResult<{ groupId: string }>>;
  renameGroup(groupId: string, name: string): Promise<WebResult>;
  addToGroup(tabId: string, groupId: string): Promise<WebResult>;
  removeFromGroup(tabId: string): Promise<WebResult>;
  /** Deletes the group; its tabs stay, ungrouped. */
  deleteGroup(groupId: string): Promise<WebResult>;

  // address / search (the chat box is the address bar while Web is open)
  /** Text or an address typed in the chat box, for the open tab. Returns coming-soon for incognito and stealth tabs until their flag is on. */
  search(text: string): Promise<WebResult>;
  goBack(): Promise<WebResult>;
  goForward(): Promise<WebResult>;
  reload(): Promise<WebResult>;
  stop(): Promise<WebResult>;

  // page tools (all act on the open tab)
  bookmarkPage(): Promise<WebResult<{ bookmarked: boolean }>>;
  downloadPage(): Promise<WebResult>;
  findInPage(query: string, forward: boolean): Promise<WebResult<{ matches: number }>>;
  clearFind(): void;
  toggleDesktopSite(): Promise<WebResult<{ enabled: boolean }>>;
  toggleReaderMode(): Promise<WebResult<{ enabled: boolean }>>;
  translatePage(languageCode: string): Promise<WebResult>;
  /** link: copy the address; copyText: copy all page text; shareText: share the page text through Android's share sheet; pdf: save the whole page as a PDF; page: share the page address through Android's share sheet. */
  share(action: WebShareAction): Promise<WebResult>;

  // lists
  listHistory(query?: string): Promise<readonly WebHistoryItem[]>;
  openHistoryItem(id: string): Promise<WebResult>;
  listBookmarks(): Promise<readonly WebBookmark[]>;
  openBookmark(id: string): Promise<WebResult>;
  removeBookmark(id: string): Promise<WebResult>;
  listDownloads(): Promise<readonly WebDownload[]>;
  cancelDownload(id: string): Promise<WebResult>;
  clearBrowsingData(what: readonly WebClearable[]): Promise<WebResult>;

  // site controls
  getSiteInfo(): Promise<WebResult<WebSiteInfo>>;
  setSitePermission(permission: WebPermission, decision: WebPermissionDecision): Promise<WebResult>;

  // viewport: the empty area where the page shows. The page is drawn natively behind the screen, so the screen
  // reports where the page area is (in CSS pixels, relative to the window) and keeps that area transparent.
  setViewportRect(rect: WebViewportRect | null): void;
}
