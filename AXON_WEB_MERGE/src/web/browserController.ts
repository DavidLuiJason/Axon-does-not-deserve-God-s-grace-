import {
  decideBrowserCommand,
  getBrowserFunction,
  type BrowserActor,
  type BrowserFunctionId,
  type BrowserGatewayResult,
} from './browserCommandGateway.ts';
import type { BrowserEngineAdapter } from './browserEngineAdapter.ts';

export type BrowserControllerResult<T = unknown> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: 'NOT_READY' | 'DENIED' | 'UNAVAILABLE' | 'FAILED'; message: string; gateway?: BrowserGatewayResult }>;

const implemented = new Set<BrowserFunctionId>([
  'address.navigate', 'navigation.back', 'navigation.forward', 'navigation.reload', 'navigation.stop',
  'navigation.findInPage', 'navigation.zoom', 'navigation.requestDesktopSite', 'tabs.create', 'tabs.close',
  'tabs.switch', 'bookmarks.add', 'bookmarks.edit', 'bookmarks.remove', 'bookmarks.createFolder', 'bookmarks.move',
  'bookmarks.list', 'history.search', 'history.clear', 'history.clearBySite', 'readingList.add',
  'readingList.remove', 'readingList.open', 'readingList.markRead', 'readingList.list', 'page.read',
  'navigation.copyUrl', 'navigation.shareUrl', 'navigation.securityDetails', 'downloads.list',
  'downloads.open', 'downloads.share', 'downloads.cancel', 'downloads.delete', 'files.print', 'files.savePdf', 'site.viewPermissions',
]);

/**
 * Shared dispatch point for owner UI and the future AXON capability caller.
 * The current native WebView is the owner's normal session only. AXON is deliberately
 * NOT routed into it until a separate AXON browser context exists.
 */
export class BrowserController {
  private readonly adapter: BrowserEngineAdapter;
  constructor(adapter: BrowserEngineAdapter) { this.adapter = adapter; }

  async execute<T = unknown>(input: {
    functionId: BrowserFunctionId;
    actor: BrowserActor;
    sessionId: string;
    tabId?: string;
    args?: Record<string, unknown>;
    approval?: { functionId: BrowserFunctionId; tabId: string | null; approvalId: string };
  }): Promise<BrowserControllerResult<T>> {
    if (!implemented.has(input.functionId)) return { ok: false, code: 'NOT_READY', message: 'This browser function is catalogued but not implemented by the current native host.' };
    if (input.actor === 'AXON') return { ok: false, code: 'DENIED', message: 'AXON has no isolated browser session yet. It cannot use the owner browser session.' };
    if (!this.adapter.isAvailable()) return { ok: false, code: 'UNAVAILABLE', message: 'The native AXON Web host is not available in this current preview or host environment.' };

    const decision = decideBrowserCommand({
      functionId: input.functionId,
      actor: input.actor,
      support: 'SUPPORTED',
      session: { id: input.sessionId, owner: 'OWNER' },
      tab: getBrowserFunction(input.functionId)?.surface === 'TAB'
        ? { id: input.tabId ?? 'owner-active-tab', owner: 'OWNER' }
        : undefined,
      ownerApproval: input.approval,
    });
    if (!decision.ok) return { ok: false, code: 'DENIED', message: decision.message, gateway: decision };
    if (decision.value.decision !== 'ALLOW') return { ok: false, code: 'DENIED', message: decision.value.reason, gateway: decision };

    try {
      const a = input.args ?? {};
      let value: unknown;
      switch (input.functionId) {
        case 'address.navigate': value = await this.adapter.navigate({ url: String(a.url ?? '') }); break;
        case 'navigation.back': value = await this.adapter.back(); break;
        case 'navigation.forward': value = await this.adapter.forward(); break;
        case 'navigation.reload': value = await this.adapter.reload(); break;
        case 'navigation.stop': value = await this.adapter.stop(); break;
        case 'navigation.copyUrl': await this.adapter.copyCurrentUrl(); value = null; break;
        case 'navigation.shareUrl': await this.adapter.shareCurrentUrl(); value = null; break;
        case 'navigation.securityDetails': value = await this.adapter.getSecurityDetails(); break;
        case 'site.viewPermissions': value = await this.adapter.getSitePermissions(); break;
        case 'navigation.findInPage': await this.adapter.findInPage({ text: String(a.text ?? '') }); value = null; break;
        case 'navigation.zoom': await this.adapter.zoomBy({ delta: Number(a.delta ?? 0) }); value = null; break;
        case 'navigation.requestDesktopSite': value = await this.adapter.setDesktopSite({ enabled: Boolean(a.enabled) }); break;
        case 'tabs.create': value = await this.adapter.newTab({ url: String(a.url ?? 'https://www.google.com') }); break;
        case 'tabs.close': value = await this.adapter.closeTab({ index: Number(a.index ?? -1) }); break;
        case 'tabs.switch': value = await this.adapter.switchTab({ index: Number(a.index ?? -1) }); break;
        case 'bookmarks.add': await this.adapter.addBookmark({ title: String(a.title ?? a.url ?? ''), url: String(a.url ?? '') }); value = null; break;
        case 'bookmarks.edit': await this.adapter.editBookmark({ index: Number(a.index ?? -1), title: String(a.title ?? ''), url: String(a.url ?? '') }); value = null; break;
        case 'bookmarks.remove': await this.adapter.removeBookmark({ index: Number(a.index ?? -1) }); value = null; break;
        case 'bookmarks.createFolder': await this.adapter.createBookmarkFolder({ name: String(a.name ?? '') }); value = null; break;
        case 'bookmarks.move': await this.adapter.moveBookmark({ index: Number(a.index ?? -1), folder: String(a.folder ?? '') }); value = null; break;
        case 'bookmarks.list': value = await this.adapter.listBookmarks(); break;
        case 'history.search': value = await this.adapter.searchHistory({ query: String(a.query ?? '') }); break;
        case 'history.clear': await this.adapter.clearHistory(); value = null; break;
        case 'history.clearBySite': await this.adapter.clearHistoryBySite({ host: String(a.host ?? '') }); value = null; break;
        case 'readingList.add': await this.adapter.addToReadingList({ title: String(a.title ?? a.url ?? ''), url: String(a.url ?? '') }); value = null; break;
        case 'readingList.remove': await this.adapter.removeReadingListItem({ index: Number(a.index ?? -1) }); value = null; break;
        case 'readingList.open': value = await this.adapter.openReadingListItem({ index: Number(a.index ?? -1) }); break;
        case 'readingList.markRead': await this.adapter.markReadingListRead({ index: Number(a.index ?? -1), read: Boolean(a.read) }); value = null; break;
        case 'readingList.list': value = await this.adapter.listReadingList(); break;
        case 'downloads.list': value = await this.adapter.listDownloads(); break;
        case 'downloads.open': await this.adapter.openDownload({ id: String(a.id ?? '') }); value = null; break;
        case 'downloads.share': await this.adapter.shareDownload({ id: String(a.id ?? '') }); value = null; break;
        case 'downloads.cancel': await this.adapter.cancelDownload({ id: String(a.id ?? '') }); value = null; break;
        case 'downloads.delete': await this.adapter.deleteDownload({ id: String(a.id ?? '') }); value = null; break;
        case 'files.print': await this.adapter.printPage(); value = null; break;
        case 'files.savePdf': await this.adapter.savePagePdf(); value = null; break;
        case 'page.read': value = await this.adapter.getPageText(); break;
        default: return { ok: false, code: 'NOT_READY', message: 'No executor is registered for this browser function.' };
      }
      return { ok: true, value: value as T };
    } catch (error) {
      return { ok: false, code: 'FAILED', message: error instanceof Error ? error.message : String(error) };
    }
  }
}

