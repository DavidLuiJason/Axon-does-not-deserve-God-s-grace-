/**
 * The long tail of owner browser commands (WEB9). Some are done by one native call (`native`), some are
 * composed here from the basic browser methods (`composed`). Everything else in the catalogue is either
 * explicitly not applicable on Android WebView (with the reason) or still open.
 */
import type { BrowserFunctionId } from './browserCommandGateway.ts';
import type { BrowserEngineAdapter } from './browserEngineAdapter.ts';

export type TailFailure = Readonly<{ ok: false; error: string; message: string }>;
export type TailResult = Readonly<{ ok: true; [key: string]: unknown }> | TailFailure;
export interface BrowserTailPlugin { runTail(options: { functionId: string; args?: Record<string, unknown> }): Promise<TailResult>; }

/** Done by one native call. */
export const TAIL_NATIVE_FUNCTION_IDS: ReadonlySet<BrowserFunctionId> = new Set<BrowserFunctionId>([
  'navigation.home', 'navigation.openExternal', 'navigation.fullscreen',
  'tabs.restoreClosed', 'tabs.listRecent', 'tabs.pin', 'tabs.suspend', 'tabs.restoreSession',
  'downloads.retry', 'downloads.openFolder',
  'page.extract', 'page.capture', 'page.readerMode', 'page.selectText', 'page.mediaPlayPause', 'page.mediaSeek', 'page.mediaVolume', 'page.accessibility',
  'site.clearData', 'site.manageCookies', 'site.changePermission', 'site.manageNotifications', 'security.safeBrowsingSettings',
  'credentials.openManager',
  'settings.homePage', 'settings.newTabPage', 'settings.searchEngine', 'settings.accessibility', 'settings.clearBrowsingData', 'settings.clearCache',
  'settings.exportData', 'settings.importData', 'settings.resetBrowser', 'settings.defaultBrowser', 'diagnostics.view',
]);
/** Built here from the basic browser methods (plus native text/selection helpers). */
export const TAIL_COMPOSED_FUNCTION_IDS: ReadonlySet<BrowserFunctionId> = new Set<BrowserFunctionId>([
  'address.search', 'address.suggestions', 'history.openEntry', 'tabs.duplicate', 'tabs.closeOthers',
  'site.viewInfo', 'security.certificateDetails', 'security.reportUnsafeSite',
  'page.translate', 'page.followLink', 'page.listen', 'page.copyText', 'page.shareContent',
  'credentials.generatePassword', 'settings.change',
]);
export const TAIL_FUNCTION_IDS: ReadonlySet<BrowserFunctionId> = new Set<BrowserFunctionId>([...TAIL_NATIVE_FUNCTION_IDS, ...TAIL_COMPOSED_FUNCTION_IDS]);
/** The command exists but does less than its name says. */
export const TAIL_PARTIAL_FUNCTION_IDS: ReadonlySet<BrowserFunctionId> = new Set<BrowserFunctionId>([
  'site.changePermission', 'site.manageNotifications', 'settings.newTabPage',
]);
export const TAIL_PARTIAL_REASONS: Readonly<Partial<Record<BrowserFunctionId, string>>> = Object.freeze({
  'site.changePermission': 'The decision is saved per site, but Android WebView still denies camera, microphone and location because the app declares no such permissions (an owner decision).',
  'site.manageNotifications': 'The decision is saved per site; Android WebView has no web notifications.',
  'settings.newTabPage': 'The choice is saved and used by the Home command; new tabs still open the default page.',
});
/** Decided: not built, with the honest reason. */
export const NOT_APPLICABLE_FUNCTIONS: Readonly<Partial<Record<BrowserFunctionId, string>>> = Object.freeze({
  'downloads.pause': 'Android DownloadManager has no pause or resume. Use retry or cancel.',
  'downloads.resume': 'Android DownloadManager has no pause or resume. Use retry or cancel.',
  'files.upload': 'The page opens the Android file picker itself; there is no separate command.',
  'files.open': 'Refused by design: the browser does not load local files.',
  'page.spellcheck': 'Android WebView text fields use the keyboard spell checker; the browser has no switch for it.',
  'site.requestCamera': 'Blocked by design until the app declares the Android camera permission (an owner decision). WebView denies the request.',
  'site.requestMicrophone': 'Blocked by design until the app declares the Android microphone permission (an owner decision). WebView denies the request.',
  'site.requestLocation': 'Blocked by design until the app declares the Android location permission (an owner decision). WebView denies the request.',
  'site.requestNotifications': 'Android WebView has no web notifications.',
  'site.requestBluetooth': 'Android WebView does not support Web Bluetooth.',
  'site.requestUsb': 'Android WebView does not support WebUSB.',
  'site.requestMidi': 'Android WebView does not offer MIDI access to pages.',
  'site.requestSerial': 'Android WebView does not support Web Serial.',
  'site.requestWebRtc': 'Camera and microphone for calls stay blocked by design (see the camera and microphone rows).',
  'security.trackingProtectionSettings': 'Android WebView has no tracking-protection switch. The third-party cookie setting is the available control.',
  'accounts.startSignIn': 'AXON Web has no browser account. Signing in to a site is always done by the owner on that site.',
  'accounts.signOut': 'AXON Web has no browser account. Use site data clearing to sign out of a site.',
  'credentials.fillPassword': 'Passwords are filled by the Android autofill service the owner chose; AXON Web never handles them.',
  'credentials.usePasskey': 'Passkeys are handled by the Android credential manager; AXON Web never handles them.',
  'autofill.address': 'Addresses are filled by the Android autofill service the owner chose.',
  'autofill.payment': 'Payment details are filled by the Android autofill service the owner chose; AXON Web never handles them.',
  'settings.language': 'Android WebView follows the phone language.',
  'settings.sync': 'AXON Web has no browser account to sync with. Use export and import.',
  'extensions.manage': 'Android WebView does not support browser extensions.',
});

const ENGINES: Readonly<Record<string, string>> = Object.freeze({
  google: 'https://www.google.com/search?q=', duckduckgo: 'https://duckduckgo.com/?q=', bing: 'https://www.bing.com/search?q=',
});
const LOWER = 'abcdefghijklmnopqrstuvwxyz', UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', DIGITS = '0123456789', SYMBOLS = '!@#$%^&*()-_=+[]{}:,.?';

type TabRow = { index: number; url: string; kind?: string; stealth?: boolean; axon?: boolean; pinned?: boolean };
const str = (value: unknown): string => String(value ?? '');
const isWebUrl = (url: string): boolean => url.startsWith('https://') || url.startsWith('http://');
function hostOf(url: string): string { try { return new URL(url).hostname; } catch { return ''; } }

export function generatePassword(random: (size: number) => Uint8Array, length = 20, symbols = true): string {
  if (!Number.isInteger(length) || length < 12 || length > 64) throw new Error('Password length must be a whole number from 12 to 64.');
  const groups = [LOWER, UPPER, DIGITS, ...(symbols ? [SYMBOLS] : [])];
  const all = groups.join('');
  const pick = (alphabet: string): string => {
    const limit = 256 - (256 % alphabet.length);
    for (;;) { const byte = random(1)[0] ?? 0; if (byte < limit) return alphabet[byte % alphabet.length] ?? ''; }
  };
  const chars = groups.map((group) => pick(group));
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const limit = 256 - (256 % (i + 1));
    let byte = random(1)[0] ?? 0;
    while (byte >= limit) byte = random(1)[0] ?? 0;
    const j = byte % (i + 1);
    const swap = chars[i] ?? ''; chars[i] = chars[j] ?? ''; chars[j] = swap;
  }
  return chars.join('');
}

export class BrowserLongTail {
  private readonly adapter: BrowserEngineAdapter;
  private readonly native: BrowserTailPlugin;
  private readonly random: (size: number) => Uint8Array;
  constructor(adapter: BrowserEngineAdapter, native: BrowserTailPlugin, random: (size: number) => Uint8Array = (size) => globalThis.crypto.getRandomValues(new Uint8Array(size))) {
    this.adapter = adapter; this.native = native; this.random = random;
  }

  private async callNative(functionId: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const result = await this.native.runTail({ functionId, args });
    if (!result.ok) throw new Error(result.message);
    return result as Record<string, unknown>;
  }
  private async tabs(): Promise<TabRow[]> { return (await this.adapter.getState()).tabs as unknown as TabRow[]; }
  private async currentUrl(): Promise<string> { return (await this.adapter.getState()).url; }

  async run(functionId: BrowserFunctionId, a: Record<string, unknown>): Promise<unknown> {
    if (TAIL_NATIVE_FUNCTION_IDS.has(functionId)) return this.callNative(functionId, a);
    switch (functionId) {
      case 'address.search': {
        const query = str(a.query).trim();
        if (query.length < 1 || query.length > 300) throw new Error('A search needs 1 to 300 characters.');
        const settings = (await this.adapter.getSettings()) as { searchEngine?: string };
        return this.adapter.navigate({ url: (ENGINES[str(settings.searchEngine)] ?? ENGINES.google) + encodeURIComponent(query) });
      }
      case 'address.suggestions': {
        const query = str(a.query).trim().toLowerCase();
        if (query.length < 1) return { items: [] };
        const seen = new Set<string>(); const items: { title: string; url: string; source: string }[] = [];
        const add = (title: string, url: string, source: string) => { if (url && !seen.has(url) && items.length < 8) { seen.add(url); items.push({ title, url, source }); } };
        for (const b of (await this.adapter.listBookmarks()).items) if (`${b.title} ${b.url}`.toLowerCase().includes(query)) add(b.title, b.url, 'bookmark');
        for (const h of (await this.adapter.searchHistory({ query })).items) add(h.title, h.url, 'history');
        return { items };
      }
      case 'history.openEntry': {
        const items = (await this.adapter.searchHistory({ query: '' })).items;
        const entry = items[Number(a.index)];
        if (!entry || !isWebUrl(entry.url)) throw new Error('There is no history entry with that number.');
        return this.adapter.navigate({ url: entry.url });
      }
      case 'tabs.duplicate': {
        const tab = (await this.tabs()).find((row) => row.index === Number(a.index));
        if (!tab) throw new Error('There is no tab with that number.');
        if (tab.axon) throw new Error('AXON\'s own tab cannot be duplicated.');
        return this.adapter.newTab({ url: tab.url, kind: tab.kind === 'incognito' ? 'incognito' : 'normal', stealth: tab.stealth === true });
      }
      case 'tabs.closeOthers': {
        const keep = Number(a.index);
        const rows = await this.tabs();
        if (!rows.some((row) => row.index === keep)) throw new Error('There is no tab with that number.');
        const doomed = rows.filter((row) => row.index !== keep && !row.pinned && !row.axon).map((row) => row.index).sort((x, y) => y - x);
        for (const index of doomed) await this.adapter.closeTab({ index });
        return { closed: doomed.length };
      }
      case 'site.viewInfo': {
        const host = hostOf(await this.currentUrl());
        const [security, permissions, decisions] = await Promise.all([
          this.adapter.getSecurityDetails(), this.adapter.getSitePermissions(),
          host ? this.callNative('site.getDecisions', { host }) : Promise.resolve({ decisions: {} }),
        ]);
        return { host, security, permissions, decisions: decisions.decisions ?? {} };
      }
      case 'security.certificateDetails': return this.adapter.getSecurityDetails();
      case 'security.reportUnsafeSite': {
        const url = await this.currentUrl();
        if (!isWebUrl(url)) throw new Error('There is no web page to report.');
        return this.adapter.navigate({ url: 'https://safebrowsing.google.com/safebrowsing/report_badware/?url=' + encodeURIComponent(url) });
      }
      case 'page.translate': {
        const url = await this.currentUrl();
        const lang = a.lang === undefined ? 'en' : str(a.lang);
        if (!isWebUrl(url)) throw new Error('There is no web page to translate.');
        if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) throw new Error('Give a language code such as en, fr or pt-BR.');
        return this.adapter.navigate({ url: `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(url)}` });
      }
      case 'page.followLink': {
        const found = await this.callNative('page.extract');
        const links = (Array.isArray(found.links) ? found.links : []) as { index: number; href: string }[];
        const link = links.find((item) => item.index === Number(a.index));
        if (!link || !isWebUrl(link.href)) throw new Error('There is no web link with that number on the page.');
        return this.adapter.navigate({ url: link.href });
      }
      case 'page.listen': {
        if (a.stop === true) return this.callNative('page.listen', { stop: true });
        const text = a.text === undefined ? (await this.adapter.getPageText()).text : str(a.text);
        return this.callNative('page.listen', { text });
      }
      case 'page.copyText':
      case 'page.shareContent': {
        let text = a.text === undefined ? '' : str(a.text);
        if (!text) text = str((await this.callNative('page.selection')).text);
        if (!text) text = (await this.adapter.getPageText()).text.slice(0, 5000);
        return this.callNative(functionId, { text });
      }
      case 'credentials.generatePassword': {
        const length = a.length === undefined ? 20 : Number(a.length);
        return { password: generatePassword(this.random, length, a.symbols !== false) };
      }
      case 'settings.change': {
        const key = str(a.key);
        const route: Readonly<Record<string, readonly [string, string]>> = {
          homePage: ['settings.homePage', 'url'], newTabPage: ['settings.newTabPage', 'url'], searchEngine: ['settings.searchEngine', 'engine'],
          textZoom: ['settings.accessibility', 'textZoom'], safeBrowsing: ['security.safeBrowsingSettings', 'enabled'],
        };
        if (key === 'thirdPartyCookies') return this.callNative('site.manageCookies', { action: 'thirdParty', enabled: a.value === true });
        if (key === 'defaultMode') {
          if (a.value !== 'normal' && a.value !== 'stealth') throw new Error('defaultMode must be normal or stealth.');
          return this.adapter.setDefaultMode({ defaultMode: a.value });
        }
        const target = route[key];
        if (!target) throw new Error('Unknown setting. Known: homePage, newTabPage, searchEngine, textZoom, safeBrowsing, thirdPartyCookies, defaultMode.');
        return this.callNative(target[0], { [target[1]]: a.value });
      }
      default: throw new Error('No long-tail executor for this browser function.');
    }
  }
}
