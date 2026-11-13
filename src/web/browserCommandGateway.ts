/**
 * AXON Web — shared browser command contract and permission decision engine.
 * Pure engine only: no browser host, UI, storage, clock, network, or native bridge.
 * The owner UI and AXON must dispatch the same BrowserFunctionId through this gateway.
 */

export type BrowserActor = 'OWNER' | 'AXON';
export type BrowserSurface = 'TAB' | 'BROWSER' | 'ACCOUNT' | 'FILE';
export type BrowserEffect = 'READ' | 'REVERSIBLE' | 'OWNER_CONFIRM' | 'OWNER_HANDOFF';
export type BrowserSupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
export type BrowserDecision = 'ALLOW' | 'ASK_OWNER' | 'HANDOFF_TO_OWNER' | 'NOT_READY' | 'REFUSE';

export type BrowserFunctionId =
  // Address bar and navigation
  | 'address.navigate' | 'address.search' | 'navigation.back' | 'navigation.forward'
  | 'navigation.reload' | 'navigation.stop' | 'navigation.home' | 'navigation.copyUrl'
  | 'navigation.shareUrl' | 'navigation.openExternal' | 'navigation.requestDesktopSite'
  | 'navigation.findInPage' | 'navigation.zoom' | 'navigation.fullscreen'
  | 'navigation.securityDetails' | 'address.suggestions' | 'navigation.generateQr'
  // Tabs and tab groups
  | 'tabs.create' | 'tabs.close' | 'tabs.restoreClosed' | 'tabs.switch' | 'tabs.duplicate'
  | 'tabs.createGroup' | 'tabs.renameGroup' | 'tabs.moveToGroup' | 'tabs.deleteGroup' | 'tabs.removeFromGroup' | 'tabs.listGroups' | 'tabs.closeOthers'
  | 'tabs.suspend' | 'tabs.restoreSession' | 'tabs.listRecent' | 'tabs.pin' | 'tabs.closeGroup'
  // Bookmarks, history and reading list
  | 'bookmarks.add' | 'bookmarks.edit' | 'bookmarks.remove' | 'bookmarks.list' | 'bookmarks.createFolder' | 'bookmarks.move'
  | 'history.search' | 'history.clear' | 'history.openEntry' | 'history.clearBySite'
  | 'readingList.add' | 'readingList.remove' | 'readingList.open' | 'readingList.markRead' | 'readingList.list'
  // Downloads, uploads and file handling
  | 'downloads.list' | 'downloads.pause' | 'downloads.resume' | 'downloads.cancel'
  | 'downloads.open' | 'downloads.share' | 'downloads.delete' | 'downloads.retry' | 'downloads.openFolder' | 'files.upload'
  | 'files.open' | 'files.print' | 'files.savePdf'
  // Page reading and convenience tools
  | 'page.read' | 'page.extract' | 'page.followLink' | 'page.capture'
  | 'page.translate' | 'page.readerMode' | 'page.listen' | 'page.spellcheck'
  | 'page.selectText' | 'page.copyText' | 'page.shareContent' | 'page.accessibility'
  | 'page.installWebApp' | 'page.mediaPlayPause' | 'page.mediaSeek' | 'page.mediaVolume'
  // Site permissions, privacy and security
  | 'site.viewInfo' | 'site.viewPermissions' | 'site.changePermission'
  | 'site.clearData' | 'site.manageCookies' | 'site.manageNotifications'
  | 'site.requestCamera' | 'site.requestMicrophone' | 'site.requestLocation' | 'site.requestNotifications'
  | 'site.requestBluetooth' | 'site.requestUsb' | 'site.requestMidi' | 'site.requestSerial' | 'site.requestWebRtc'
  | 'security.safeBrowsingSettings' | 'security.trackingProtectionSettings'
  | 'security.certificateDetails' | 'security.reportUnsafeSite'
  // Accounts, passwords, passkeys and autofill
  | 'accounts.startSignIn' | 'accounts.signOut' | 'credentials.openManager'
  | 'credentials.generatePassword' | 'credentials.fillPassword' | 'credentials.usePasskey'
  | 'autofill.address' | 'autofill.payment'
  // Browser settings and maintenance
  | 'settings.view' | 'settings.change' | 'settings.searchEngine' | 'settings.language'
  | 'settings.accessibility' | 'settings.clearBrowsingData' | 'settings.exportData'
  | 'settings.importData' | 'settings.resetBrowser' | 'settings.defaultBrowser' | 'settings.homePage'
  | 'settings.newTabPage' | 'settings.clearCache' | 'settings.sync' | 'extensions.manage'
  | 'diagnostics.view';

export type BrowserFunctionDefinition = Readonly<{
  id: BrowserFunctionId;
  group: string;
  surface: BrowserSurface;
  effect: BrowserEffect;
  description: string;
}>;

const definitions: readonly BrowserFunctionDefinition[] = [
  // Address bar and navigation
  { id: 'address.navigate', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Open a URL in the active tab.' },
  { id: 'address.search', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Search from the address bar using the selected search provider.' },
  { id: 'navigation.back', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Go back in the active tab.' },
  { id: 'navigation.forward', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Go forward in the active tab.' },
  { id: 'navigation.reload', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Reload the active page.' },
  { id: 'navigation.stop', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Stop the current navigation.' },
  { id: 'navigation.home', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Open the configured home page.' },
  { id: 'navigation.copyUrl', group: 'Navigation', surface: 'TAB', effect: 'REVERSIBLE', description: 'Copy the current page URL.' },
  { id: 'navigation.shareUrl', group: 'Navigation', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Open the Android share flow for the current URL.' },
  { id: 'navigation.openExternal', group: 'Navigation', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Hand a URL to another installed application.' },
  { id: 'navigation.requestDesktopSite', group: 'Navigation', surface: 'TAB', effect: 'REVERSIBLE', description: 'Request the desktop version of the current site.' },
  { id: 'navigation.findInPage', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Find text within the current page.' },
  { id: 'navigation.zoom', group: 'Navigation', surface: 'TAB', effect: 'REVERSIBLE', description: 'Change page zoom or text scaling.' },
  { id: 'navigation.fullscreen', group: 'Navigation', surface: 'TAB', effect: 'REVERSIBLE', description: 'Toggle full-screen page viewing.' },
  { id: 'navigation.securityDetails', group: 'Navigation', surface: 'TAB', effect: 'READ', description: 'Read connection and certificate information.' },
  { id: 'address.suggestions', group: 'Navigation', surface: 'BROWSER', effect: 'READ', description: 'Show address-bar suggestions from permitted history and bookmarks.' },
  { id: 'navigation.generateQr', group: 'Navigation', surface: 'TAB', effect: 'REVERSIBLE', description: 'Generate a QR code for the current page URL.' },
  // Tabs and tab groups
  { id: 'tabs.create', group: 'Tabs', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Create a new tab in the caller’s permitted browser context.' },
  { id: 'tabs.close', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Close a permitted tab.' },
  { id: 'tabs.restoreClosed', group: 'Tabs', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Restore a recently closed tab.' },
  { id: 'tabs.switch', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Switch to a permitted tab.' },
  { id: 'tabs.duplicate', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Duplicate a permitted tab.' },
  { id: 'tabs.createGroup', group: 'Tabs', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Create a tab group.' },
  { id: 'tabs.renameGroup', group: 'Tabs', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Rename a tab group.' },
  { id: 'tabs.moveToGroup', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Move a permitted tab to a group.' },
  { id: 'tabs.deleteGroup', group: 'Tabs', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Delete a tab group while keeping its tabs open and ungrouped.' },
  { id: 'tabs.removeFromGroup', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Remove a permitted tab from its group without closing it.' },
  { id: 'tabs.listGroups', group: 'Tabs', surface: 'BROWSER', effect: 'READ', description: 'List tab groups and their member tab indexes.' },
  { id: 'tabs.closeOthers', group: 'Tabs', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Close all other tabs in the active context.' },
  { id: 'tabs.suspend', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Suspend a background tab to save memory.' },
  { id: 'tabs.restoreSession', group: 'Tabs', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Restore a previously saved browser session.' },
  { id: 'tabs.listRecent', group: 'Tabs', surface: 'BROWSER', effect: 'READ', description: 'List recent tabs in the permitted context.' },
  { id: 'tabs.pin', group: 'Tabs', surface: 'TAB', effect: 'REVERSIBLE', description: 'Pin a tab if the selected engine and mobile UI support it.' },
  { id: 'tabs.closeGroup', group: 'Tabs', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Close a selected tab group.' },
  // Bookmarks, history and reading list
  { id: 'bookmarks.add', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Add a bookmark.' },
  { id: 'bookmarks.edit', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Edit a bookmark or folder.' },
  { id: 'bookmarks.remove', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Remove a bookmark.' },
  { id: 'bookmarks.list', group: 'Saved browsing', surface: 'BROWSER', effect: 'READ', description: 'List bookmarks in the permitted context.' },
  { id: 'bookmarks.createFolder', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Create a bookmark folder.' },
  { id: 'bookmarks.move', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Move a bookmark to a folder.' },
  { id: 'history.search', group: 'Saved browsing', surface: 'BROWSER', effect: 'READ', description: 'Search browsing history in the permitted context.' },
  { id: 'history.clear', group: 'Saved browsing', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Clear selected browsing history.' },
  { id: 'history.openEntry', group: 'Saved browsing', surface: 'BROWSER', effect: 'READ', description: 'Open a history entry.' },
  { id: 'history.clearBySite', group: 'Saved browsing', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Clear browsing history for one selected site.' },
  { id: 'readingList.add', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Add a page to the reading list.' },
  { id: 'readingList.remove', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Remove a reading-list item.' },
  { id: 'readingList.open', group: 'Saved browsing', surface: 'BROWSER', effect: 'READ', description: 'Open a saved reading-list page.' },
  { id: 'readingList.markRead', group: 'Saved browsing', surface: 'BROWSER', effect: 'REVERSIBLE', description: 'Mark a reading-list item as read or unread.' },
  { id: 'readingList.list', group: 'Saved browsing', surface: 'BROWSER', effect: 'READ', description: 'List saved reading-list entries.' },
  // Downloads, uploads and file handling
  { id: 'downloads.list', group: 'Files', surface: 'BROWSER', effect: 'READ', description: 'List browser downloads.' },
  { id: 'downloads.pause', group: 'Files', surface: 'FILE', effect: 'REVERSIBLE', description: 'Pause a download.' },
  { id: 'downloads.resume', group: 'Files', surface: 'FILE', effect: 'REVERSIBLE', description: 'Resume a download.' },
  { id: 'downloads.cancel', group: 'Files', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Cancel a download.' },
  { id: 'downloads.open', group: 'Files', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Open a downloaded file with an Android handler.' },
  { id: 'downloads.share', group: 'Files', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Share a downloaded file.' },
  { id: 'downloads.delete', group: 'Files', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Delete a downloaded file.' },
  { id: 'downloads.retry', group: 'Files', surface: 'FILE', effect: 'REVERSIBLE', description: 'Retry a failed download.' },
  { id: 'downloads.openFolder', group: 'Files', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Open the download location in a file manager.' },
  { id: 'files.upload', group: 'Files', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Choose a file and upload it to a website.' },
  { id: 'files.open', group: 'Files', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Open a local file in the browser.' },
  { id: 'files.print', group: 'Files', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Open Android print services for a page or document.' },
  { id: 'files.savePdf', group: 'Files', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Save a page or document as PDF.' },
  // Page reading and convenience tools
  { id: 'page.read', group: 'Page tools', surface: 'TAB', effect: 'READ', description: 'Read visible page content in the permitted tab.' },
  { id: 'page.extract', group: 'Page tools', surface: 'TAB', effect: 'READ', description: 'Extract structured content from the permitted page.' },
  { id: 'page.followLink', group: 'Page tools', surface: 'TAB', effect: 'READ', description: 'Follow a link in the permitted tab.' },
  { id: 'page.capture', group: 'Page tools', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Capture or save page content.' },
  { id: 'page.translate', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Translate the page using an available translation service.' },
  { id: 'page.readerMode', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Show a simplified reading view.' },
  { id: 'page.listen', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Read page content aloud.' },
  { id: 'page.spellcheck', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Use supported spell-check assistance.' },
  { id: 'page.selectText', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Select text on the page.' },
  { id: 'page.copyText', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Copy selected or extracted page text.' },
  { id: 'page.shareContent', group: 'Page tools', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Share page content outside the browser.' },
  { id: 'page.accessibility', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Use supported page accessibility controls.' },
  { id: 'page.installWebApp', group: 'Page tools', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Install a supported progressive web app.' },
  { id: 'page.mediaPlayPause', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Control play or pause for page media.' },
  { id: 'page.mediaSeek', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Seek within page media.' },
  { id: 'page.mediaVolume', group: 'Page tools', surface: 'TAB', effect: 'REVERSIBLE', description: 'Adjust page media volume where supported.' },
  // Site permissions, privacy and security
  { id: 'site.viewInfo', group: 'Site security', surface: 'TAB', effect: 'READ', description: 'View site information.' },
  { id: 'site.viewPermissions', group: 'Site security', surface: 'TAB', effect: 'READ', description: 'View site permissions.' },
  { id: 'site.changePermission', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Change a site permission.' },
  { id: 'site.clearData', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Clear storage and site data for a selected origin.' },
  { id: 'site.manageCookies', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Inspect or change cookie settings for a site.' },
  { id: 'site.manageNotifications', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Manage notification permission for a site.' },
  { id: 'site.requestCamera', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for camera access.' },
  { id: 'site.requestMicrophone', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for microphone access.' },
  { id: 'site.requestLocation', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for location access.' },
  { id: 'site.requestNotifications', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for notification access.' },
  { id: 'site.requestBluetooth', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for Bluetooth access if supported.' },
  { id: 'site.requestUsb', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for USB access if supported.' },
  { id: 'site.requestMidi', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for MIDI access if supported.' },
  { id: 'site.requestSerial', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request for serial-device access if supported.' },
  { id: 'site.requestWebRtc', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Review a website request involving WebRTC devices or capture.' },
  { id: 'security.safeBrowsingSettings', group: 'Site security', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'View or change safe-browsing protection settings.' },
  { id: 'security.trackingProtectionSettings', group: 'Site security', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'View or change tracking-protection settings.' },
  { id: 'security.certificateDetails', group: 'Site security', surface: 'TAB', effect: 'READ', description: 'Inspect certificate details without bypassing validation.' },
  { id: 'security.reportUnsafeSite', group: 'Site security', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Submit a report to a supported safety service.' },
  // Accounts, passwords, passkeys and autofill
  { id: 'accounts.startSignIn', group: 'Accounts', surface: 'TAB', effect: 'OWNER_HANDOFF', description: 'Start a sign-in flow and hand authentication to the owner or trusted system UI.' },
  { id: 'accounts.signOut', group: 'Accounts', surface: 'TAB', effect: 'OWNER_CONFIRM', description: 'Sign out of a website account.' },
  { id: 'credentials.openManager', group: 'Accounts', surface: 'ACCOUNT', effect: 'OWNER_HANDOFF', description: 'Open the owner-controlled credential manager.' },
  { id: 'credentials.generatePassword', group: 'Accounts', surface: 'ACCOUNT', effect: 'OWNER_HANDOFF', description: 'Ask the owner-controlled credential manager to generate a password.' },
  { id: 'credentials.fillPassword', group: 'Accounts', surface: 'ACCOUNT', effect: 'OWNER_HANDOFF', description: 'Hand password filling to origin-bound owner/system autofill; AXON never reads the secret.' },
  { id: 'credentials.usePasskey', group: 'Accounts', surface: 'ACCOUNT', effect: 'OWNER_HANDOFF', description: 'Hand passkey authentication to Android Credential Manager and owner verification.' },
  { id: 'autofill.address', group: 'Accounts', surface: 'ACCOUNT', effect: 'OWNER_HANDOFF', description: 'Hand address autofill to owner review and approval.' },
  { id: 'autofill.payment', group: 'Accounts', surface: 'ACCOUNT', effect: 'OWNER_HANDOFF', description: 'Hand payment autofill to owner review; never submit payment automatically.' },
  // Browser settings and maintenance
  { id: 'settings.view', group: 'Settings', surface: 'BROWSER', effect: 'READ', description: 'Read browser settings.' },
  { id: 'settings.change', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Change browser settings.' },
  { id: 'settings.searchEngine', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Change the default search engine.' },
  { id: 'settings.language', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Change browser language settings.' },
  { id: 'settings.accessibility', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Change browser accessibility settings.' },
  { id: 'settings.clearBrowsingData', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Clear selected browser data.' },
  { id: 'settings.exportData', group: 'Settings', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Export selected non-secret browser data.' },
  { id: 'settings.importData', group: 'Settings', surface: 'FILE', effect: 'OWNER_CONFIRM', description: 'Import selected browser data.' },
  { id: 'settings.resetBrowser', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Reset browser settings and selected data.' },
  { id: 'settings.defaultBrowser', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_HANDOFF', description: 'Open Android settings to choose AXON Web as the default browser.' },
  { id: 'settings.homePage', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Change the browser home page.' },
  { id: 'settings.newTabPage', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Change the new-tab page.' },
  { id: 'settings.clearCache', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Clear browser cache.' },
  { id: 'settings.sync', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Configure sync only when an approved secure sync service exists.' },
  { id: 'extensions.manage', group: 'Settings', surface: 'BROWSER', effect: 'OWNER_CONFIRM', description: 'Manage extensions only if the chosen engine supports them.' },
  { id: 'diagnostics.view', group: 'Settings', surface: 'BROWSER', effect: 'READ', description: 'View browser diagnostics without exposing secrets.' },
];

const byId = new Map<BrowserFunctionId, BrowserFunctionDefinition>(definitions.map((item) => [item.id, Object.freeze(item)]));

export const BROWSER_FUNCTIONS: readonly BrowserFunctionDefinition[] = Object.freeze(definitions.map((item) => Object.freeze(item)));

export type BrowserSessionContext = Readonly<{
  id: string;
  owner: 'OWNER' | 'AXON';
}>;

export type BrowserSessionGrant = Readonly<{
  sessionId: string;
  functionIds: readonly BrowserFunctionId[];
}>;

export type BrowserTabContext = Readonly<{
  id: string;
  owner: 'OWNER' | 'AXON';
  selectedByOwner?: boolean;
}>;

export type BrowserTabGrant = Readonly<{
  tabId: string;
  functionIds: readonly BrowserFunctionId[];
}>;

/** Approval is deliberately command- and tab-bound; callers must issue short-lived, single-use grants. */
export type BrowserOwnerApproval = Readonly<{
  functionId: BrowserFunctionId;
  tabId: string | null;
  approvalId: string;
}>;

export type BrowserCommandRequest = Readonly<{
  functionId: BrowserFunctionId;
  actor: BrowserActor;
  support: BrowserSupport;
  session: BrowserSessionContext;
  sessionGrant?: BrowserSessionGrant;
  tab?: BrowserTabContext;
  ownerTabGrant?: BrowserTabGrant;
  ownerApproval?: BrowserOwnerApproval;
}>;

export type BrowserCommandDecision = Readonly<{
  functionId: BrowserFunctionId;
  actor: BrowserActor;
  decision: BrowserDecision;
  reason: string;
  approvalRequired: boolean;
  definition: BrowserFunctionDefinition;
}>;

export type BrowserGatewayError = 'invalid-request' | 'unknown-function';
export type BrowserGatewayResult =
  | Readonly<{ ok: true; value: BrowserCommandDecision }>
  | Readonly<{ ok: false; error: BrowserGatewayError; message: string }>;

const fail = (error: BrowserGatewayError, message: string): BrowserGatewayResult => Object.freeze({ ok: false, error, message });

export function getBrowserFunction(functionId: unknown): BrowserFunctionDefinition | null {
  if (typeof functionId !== 'string') return null;
  return byId.get(functionId as BrowserFunctionId) ?? null;
}

export function listBrowserFunctions(group?: string): readonly BrowserFunctionDefinition[] {
  if (group === undefined) return BROWSER_FUNCTIONS;
  if (typeof group !== 'string' || group.trim().length === 0) return Object.freeze([]);
  return Object.freeze(BROWSER_FUNCTIONS.filter((item) => item.group === group));
}

function hasOwnerSessionGrant(request: BrowserCommandRequest): boolean {
  const grant = request.sessionGrant;
  return request.session.owner === 'OWNER' && !!grant && grant.sessionId === request.session.id
    && grant.functionIds.includes(request.functionId);
}

function hasOwnerTabGrant(request: BrowserCommandRequest): boolean {
  const tab = request.tab;
  const grant = request.ownerTabGrant;
  return !!tab && tab.owner === 'OWNER' && tab.selectedByOwner === true
    && !!grant && grant.tabId === tab.id && grant.functionIds.includes(request.functionId);
}

function hasMatchingApproval(request: BrowserCommandRequest): boolean {
  const approval = request.ownerApproval;
  const expectedTabId = request.tab?.id ?? null;
  return !!approval && approval.approvalId.trim().length > 0
    && approval.functionId === request.functionId
    && approval.tabId === expectedTabId;
}

/**
 * Decides whether a browser command may proceed. This does not execute it.
 * Native/browser callers must re-check support, target identity and one-time approval at execution.
 */
export function decideBrowserCommand(input: unknown): BrowserGatewayResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid-request', 'A browser command request object is required.');
  }
  const request = input as BrowserCommandRequest;
  const definition = getBrowserFunction(request.functionId);
  if (!definition) return fail('unknown-function', 'The requested browser function is not in the declared catalogue.');
  if ((request.actor !== 'OWNER' && request.actor !== 'AXON')
      || !['SUPPORTED', 'UNSUPPORTED', 'UNKNOWN'].includes(request.support)
      || !request.session || typeof request.session.id !== 'string' || !request.session.id
      || (request.session.owner !== 'OWNER' && request.session.owner !== 'AXON')
      || (request.actor === 'AXON' && request.tab !== undefined && request.tab.owner !== request.session.owner)
      || ('sessionGrant' in request && request.sessionGrant !== undefined && (!request.sessionGrant
        || typeof request.sessionGrant.sessionId !== 'string' || !Array.isArray(request.sessionGrant.functionIds)
        || request.sessionGrant.functionIds.some((id) => !getBrowserFunction(id))))
      || ('tab' in request && request.tab !== undefined && (!request.tab || typeof request.tab.id !== 'string' || !request.tab.id
        || (request.tab.owner !== 'OWNER' && request.tab.owner !== 'AXON')
        || ('selectedByOwner' in request.tab && typeof request.tab.selectedByOwner !== 'boolean')))
      || ('ownerTabGrant' in request && request.ownerTabGrant !== undefined && (!request.ownerTabGrant
        || typeof request.ownerTabGrant.tabId !== 'string' || !Array.isArray(request.ownerTabGrant.functionIds)
        || request.ownerTabGrant.functionIds.some((id) => !getBrowserFunction(id))))
      || ('ownerApproval' in request && request.ownerApproval !== undefined && (!request.ownerApproval
        || !getBrowserFunction(request.ownerApproval.functionId) || typeof request.ownerApproval.approvalId !== 'string'
        || !(request.ownerApproval.tabId === null || typeof request.ownerApproval.tabId === 'string')))) {
    return fail('invalid-request', 'The browser command request contains invalid fields.');
  }

  let decision: BrowserDecision = 'ALLOW';
  let reason = 'owner-command';
  let approvalRequired = false;

  if (request.support === 'UNSUPPORTED') {
    decision = 'REFUSE'; reason = 'engine-does-not-support-function';
  } else if (request.support === 'UNKNOWN') {
    decision = 'NOT_READY'; reason = 'engine-support-not-measured';
  } else if (request.actor === 'OWNER') {
    decision = 'ALLOW'; reason = 'owner-initiated';
  } else if (request.session.owner === 'OWNER' && !hasOwnerSessionGrant(request)) {
    decision = 'ASK_OWNER'; reason = 'owner-session-access-not-granted'; approvalRequired = true;
  } else if (definition.effect === 'OWNER_HANDOFF') {
    decision = 'HANDOFF_TO_OWNER'; reason = 'owner-or-system-authentication-required';
  } else {
    if (definition.surface === 'TAB' && !request.tab) {
      decision = 'REFUSE'; reason = 'tab-context-required';
    } else if (request.tab?.owner === 'OWNER' && !hasOwnerTabGrant(request)) {
      decision = 'ASK_OWNER'; reason = 'owner-tab-access-not-granted'; approvalRequired = true;
    } else if (definition.effect === 'OWNER_CONFIRM' && !hasMatchingApproval(request)) {
      decision = 'ASK_OWNER'; reason = 'specific-owner-approval-required'; approvalRequired = true;
    } else {
      decision = 'ALLOW'; reason = definition.effect === 'OWNER_CONFIRM' ? 'approved-for-this-command' : 'permitted-axon-command';
    }
  }

  return Object.freeze({ ok: true, value: Object.freeze({
    functionId: request.functionId,
    actor: request.actor,
    decision,
    reason,
    approvalRequired,
    definition,
  }) });
}
