export type BrowserHostKind = 'android-webview' | 'ios-webkit' | 'chromium' | 'gecko' | 'webkit' | 'unknown';
export type HostProbeState = 'AVAILABLE' | 'MISSING' | 'BLOCKED' | 'NOT_TESTED';

export interface BrowserHostFeature {
  id: string;
  state: HostProbeState;
  detail: string;
}

export interface BrowserHostConformanceReport {
  hostKind: BrowserHostKind;
  userAgent: string;
  secureContext: boolean;
  features: BrowserHostFeature[];
  workerExecutionEligible: boolean;
  notes: string[];
  testedAt: number;
}

function feature(id: string, available: boolean, detail: string): BrowserHostFeature {
  return { id, state: available ? 'AVAILABLE' : 'MISSING', detail };
}

/** Runtime probe only. A positive feature probe is not a platform/security certification. */
export async function probeBrowserHost(hostWindow: Window = window): Promise<BrowserHostConformanceReport> {
  const win = hostWindow as Window & typeof globalThis;
  const nav = win.navigator;
  const userAgent = nav?.userAgent ?? 'unknown';
  const ua = userAgent.toLowerCase();
  const hostKind: BrowserHostKind = /; wv\)|\bversion\/\d+.*chrome\//i.test(userAgent) && /android/i.test(userAgent) ? 'android-webview' :
    /iphone|ipad|ipod/i.test(userAgent) && /applewebkit/i.test(userAgent) ? 'ios-webkit' :
    /firefox\//i.test(userAgent) ? 'gecko' : /chrome\//i.test(userAgent) ? 'chromium' :
    /safari\//i.test(userAgent) && /applewebkit/i.test(userAgent) ? 'webkit' : 'unknown';
  const hasWorker = typeof win.Worker === 'function';
  const hasBlob = typeof win.Blob === 'function';
  const hasObjectUrl = typeof win.URL?.createObjectURL === 'function';
  const hasIndexedDb = typeof win.indexedDB !== 'undefined';
  const hasWasm = typeof win.WebAssembly !== 'undefined';
  const hasMessageChannel = typeof win.MessageChannel === 'function';
  const hasAbortController = typeof win.AbortController === 'function';
  const features = [
    feature('worker', hasWorker, hasWorker ? 'Dedicated Worker constructor is present.' : 'Dedicated Worker constructor is unavailable.'),
    feature('blob', hasBlob, hasBlob ? 'Blob construction is available.' : 'Blob construction is unavailable.'),
    feature('object-url', hasObjectUrl, hasObjectUrl ? 'Object URL creation is available.' : 'Object URL creation is unavailable.'),
    feature('indexeddb', hasIndexedDb, hasIndexedDb ? 'IndexedDB API is exposed; quota and durability still need testing.' : 'IndexedDB API is unavailable.'),
    feature('webassembly', hasWasm, hasWasm ? 'WebAssembly API is exposed.' : 'WebAssembly API is unavailable.'),
    feature('message-channel', hasMessageChannel, hasMessageChannel ? 'MessageChannel is available.' : 'MessageChannel is unavailable.'),
    feature('abort-controller', hasAbortController, hasAbortController ? 'AbortController is available.' : 'AbortController is unavailable.')
  ];
  const notes: string[] = [];
  if (!win.isSecureContext) notes.push('Host is not a secure context; some APIs may be unavailable or restricted.');
  if (hostKind === 'android-webview') notes.push('Android WebView identified heuristically; an actual WebView conformance run is still required.');
  if (hostKind === 'ios-webkit') notes.push('WebKit host identified heuristically; iOS app embedding and policy checks remain required.');
  if (hostKind === 'unknown') notes.push('Host engine could not be classified from its user-agent string.');
  notes.push('This report measures exposed APIs only; it does not attest CSP, opaque-origin isolation, hard RAM limits, or OS sandboxing.');
  return {
    hostKind, userAgent, secureContext: Boolean(win.isSecureContext), features,
    workerExecutionEligible: hasWorker && hasBlob && hasObjectUrl && hasAbortController,
    notes, testedAt: Date.now()
  };
}
