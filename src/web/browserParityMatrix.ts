import { BROWSER_FUNCTIONS, type BrowserFunctionDefinition, type BrowserFunctionId } from './browserCommandGateway.ts';

export type ParityStatus = 'IMPLEMENTED' | 'PARTIAL' | 'NOT_IMPLEMENTED';
export type AxonAccessStatus = 'BLOCKED_NO_ISOLATED_SESSION';
export type BrowserParityRow = Readonly<{
  functionId: BrowserFunctionId;
  group: string;
  effect: BrowserFunctionDefinition['effect'];
  ownerHost: ParityStatus;
  ownerCommand: ParityStatus;
  axonAccess: AxonAccessStatus;
  evidence: string;
}>;

// Owner command executors that currently reach the typed native plugin.
const ownerCommandImplemented = new Set<BrowserFunctionId>([
  'address.navigate', 'navigation.back', 'navigation.forward', 'navigation.reload', 'navigation.stop',
  'navigation.findInPage', 'navigation.zoom', 'navigation.requestDesktopSite', 'tabs.create', 'tabs.close', 'tabs.createGroup', 'tabs.renameGroup', 'tabs.moveToGroup', 'tabs.deleteGroup', 'tabs.removeFromGroup', 'tabs.listGroups', 'tabs.closeGroup',
  'tabs.switch', 'bookmarks.add', 'bookmarks.list', 'bookmarks.edit', 'bookmarks.remove',
  'bookmarks.createFolder', 'bookmarks.move', 'history.search', 'history.clear', 'history.clearBySite',
  'readingList.add', 'readingList.remove', 'readingList.open', 'readingList.markRead', 'readingList.list', 'page.read',
  'navigation.copyUrl', 'navigation.shareUrl', 'navigation.securityDetails', 'downloads.list', 'downloads.open',
  'downloads.share', 'downloads.cancel', 'downloads.delete', 'files.print', 'files.savePdf', 'site.viewPermissions',
]);

// Native Activity/UI functions present in the current source snapshot. This is deliberately
// narrower than generic WebView/website capabilities: only browser-owned functionality counts.
const ownerHostImplemented = new Set<BrowserFunctionId>([
  'address.navigate', 'address.search', 'navigation.back', 'navigation.forward', 'navigation.reload',
  'navigation.stop', 'navigation.requestDesktopSite', 'navigation.findInPage', 'navigation.zoom',
  'tabs.create', 'tabs.close', 'tabs.switch', 'tabs.createGroup', 'tabs.renameGroup', 'tabs.moveToGroup', 'tabs.deleteGroup', 'tabs.removeFromGroup', 'tabs.listGroups', 'tabs.closeGroup', 'tabs.restoreSession', 'tabs.suspend',
  'bookmarks.add', 'bookmarks.edit', 'bookmarks.remove', 'bookmarks.createFolder', 'bookmarks.move',
  'bookmarks.list', 'history.search', 'history.clear', 'history.clearBySite', 'readingList.add',
  'readingList.remove', 'readingList.open', 'readingList.markRead', 'readingList.list', 'history.openEntry',
  'downloads.list', 'downloads.open', 'downloads.share', 'downloads.cancel', 'downloads.delete',
  'navigation.copyUrl', 'navigation.shareUrl', 'navigation.securityDetails', 'files.print', 'files.savePdf', 'site.viewPermissions',
  'files.upload', 'page.read',
]);

// Source exposes a partial approximation, but not the complete contract (e.g. a system
// DownloadManager notification is not a browser download-management screen).
const ownerHostPartial = new Set<BrowserFunctionId>([
  'tabs.restoreSession', 'tabs.suspend', 'history.openEntry',
]);

const evidenceFor = (id: BrowserFunctionId, ownerHost: ParityStatus, ownerCommand: ParityStatus): string => {
  if (ownerCommand === 'IMPLEMENTED') return 'BrowserController executor -> typed Capacitor plugin -> native host method.';
  if (id === 'files.upload') return 'Native WebView file chooser -> Android ACTION_OPEN_DOCUMENT; no BrowserController executor.';
  if (id === 'downloads.pause' || id === 'downloads.resume' || id === 'downloads.retry' || id === 'downloads.openFolder') return 'The Android DownloadManager host does not expose this control in the current implementation.';
  if (id === 'tabs.restoreSession') return 'Native host restores persisted normal-tab URLs; no explicit controller command.';
  if (id === 'tabs.suspend') return 'Inactive WebView renderer is destroyed/saved for memory; no explicit suspend command.';
  if (id === 'history.openEntry') return 'Native history dialog can open an entry; no controller command.';
  if (ownerHost === 'IMPLEMENTED') return 'Native host source implements the owner-facing operation; no AXON command executor.';
  return 'No implementation evidence in the current cumulative source snapshot.';
};

export const BROWSER_PARITY_MATRIX: readonly BrowserParityRow[] = Object.freeze(BROWSER_FUNCTIONS.map((definition) => {
  const ownerCommand: ParityStatus = ownerCommandImplemented.has(definition.id) ? 'IMPLEMENTED' : 'NOT_IMPLEMENTED';
  const ownerHost: ParityStatus = ownerHostPartial.has(definition.id)
    ? 'PARTIAL'
    : ownerHostImplemented.has(definition.id) ? 'IMPLEMENTED' : 'NOT_IMPLEMENTED';
  return Object.freeze({
    functionId: definition.id,
    group: definition.group,
    effect: definition.effect,
    ownerHost,
    ownerCommand,
    // AXON is intentionally not connected to the owner's session. This is not parity yet.
    axonAccess: 'BLOCKED_NO_ISOLATED_SESSION' as const,
    evidence: evidenceFor(definition.id, ownerHost, ownerCommand),
  });
}));

export const BROWSER_PARITY_GROUPS = Object.freeze([...new Set(BROWSER_PARITY_MATRIX.map((row) => row.group))].map((group) => {
  const rows = BROWSER_PARITY_MATRIX.filter((row) => row.group === group);
  return Object.freeze({
    group,
    total: rows.length,
    ownerHostImplemented: rows.filter((row) => row.ownerHost === 'IMPLEMENTED').length,
    ownerHostPartial: rows.filter((row) => row.ownerHost === 'PARTIAL').length,
    ownerCommandImplemented: rows.filter((row) => row.ownerCommand === 'IMPLEMENTED').length,
    axonEnabled: 0,
    notReady: rows.filter((row) => row.ownerHost === 'NOT_IMPLEMENTED').length,
  });
}));

export function getBrowserParity(functionId: BrowserFunctionId): BrowserParityRow | undefined {
  return BROWSER_PARITY_MATRIX.find((row) => row.functionId === functionId);
}

export function getBrowserParitySummary() {
  return Object.freeze({
    catalogueTotal: BROWSER_PARITY_MATRIX.length,
    ownerHostImplemented: BROWSER_PARITY_MATRIX.filter((row) => row.ownerHost === 'IMPLEMENTED').length,
    ownerHostPartial: BROWSER_PARITY_MATRIX.filter((row) => row.ownerHost === 'PARTIAL').length,
    ownerCommandImplemented: BROWSER_PARITY_MATRIX.filter((row) => row.ownerCommand === 'IMPLEMENTED').length,
    axonEnabled: BROWSER_PARITY_MATRIX.filter((row) => row.axonAccess !== 'BLOCKED_NO_ISOLATED_SESSION').length,
    groups: BROWSER_PARITY_GROUPS.length,
  });
}
