import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_FUNCTIONS } from '../src/web/browserCommandGateway.ts';
import { TAIL_FUNCTION_IDS, TAIL_PARTIAL_FUNCTION_IDS } from '../src/web/browserLongTail.ts';
import { BROWSER_PARITY_MATRIX, BROWSER_PARITY_GROUPS, getBrowserParity, getBrowserParitySummary } from '../src/web/browserParityMatrix.ts';

test('parity matrix covers every catalogue ID exactly once', () => {
  assert.equal(BROWSER_PARITY_MATRIX.length, BROWSER_FUNCTIONS.length);
  assert.deepEqual(new Set(BROWSER_PARITY_MATRIX.map((row) => row.functionId)), new Set(BROWSER_FUNCTIONS.map((row) => row.id)));
  assert.equal(new Set(BROWSER_PARITY_MATRIX.map((row) => row.functionId)).size, BROWSER_PARITY_MATRIX.length);
});

test('all catalogue groups are represented and summaries reconcile', () => {
  assert.equal(BROWSER_PARITY_GROUPS.length, new Set(BROWSER_FUNCTIONS.map((row) => row.group)).size);
  assert.equal(BROWSER_PARITY_GROUPS.reduce((sum, row) => sum + row.total, 0), BROWSER_FUNCTIONS.length);
  const summary = getBrowserParitySummary();
  assert.equal(summary.catalogueTotal, BROWSER_FUNCTIONS.length);
  assert.equal(summary.groups, BROWSER_PARITY_GROUPS.length);
});

test('only the currently implemented command executors are marked as such', () => {
  const expected = new Set([
    'address.navigate', 'navigation.back', 'navigation.forward', 'navigation.reload', 'navigation.stop',
    'navigation.findInPage', 'navigation.zoom', 'navigation.requestDesktopSite', 'tabs.create', 'tabs.close',
    'tabs.switch', 'settings.view', 'settings.defaultMode', 'tabs.createGroup', 'tabs.renameGroup', 'tabs.moveToGroup', 'tabs.deleteGroup', 'tabs.removeFromGroup', 'tabs.listGroups', 'tabs.closeGroup', 'bookmarks.add', 'bookmarks.list', 'bookmarks.edit', 'bookmarks.remove',
    'bookmarks.createFolder', 'bookmarks.move', 'history.search', 'history.clear', 'history.clearBySite',
    'readingList.add', 'readingList.remove', 'readingList.open', 'readingList.markRead', 'readingList.list', 'page.read',
    'navigation.copyUrl', 'navigation.shareUrl', 'navigation.securityDetails', 'downloads.list', 'downloads.open',
    'downloads.share', 'downloads.cancel', 'downloads.delete', 'files.print', 'files.savePdf', 'site.viewPermissions',
  ]);
  for (const id of TAIL_FUNCTION_IDS) if (!TAIL_PARTIAL_FUNCTION_IDS.has(id)) expected.add(id);
  assert.deepEqual(new Set(BROWSER_PARITY_MATRIX.filter((row) => row.ownerCommand === 'IMPLEMENTED').map((row) => row.functionId)), expected);
});

test('AXON reaches only its own-session functions; every other command stays blocked', () => {
  const own = new Set(BROWSER_PARITY_MATRIX.filter((row) => row.axonAccess === 'OWN_SESSION_ONLY').map((row) => row.functionId));
  assert.deepEqual(own, new Set(['address.navigate', 'address.search', 'page.read', 'page.snapshot', 'page.click', 'page.type', 'page.select', 'page.scroll', 'page.submit', 'page.signIn', 'page.pay']));
  assert.ok(BROWSER_PARITY_MATRIX.filter((row) => !own.has(row.functionId)).every((row) => row.axonAccess === 'BLOCKED_NO_ISOLATED_SESSION'));
  assert.equal(getBrowserParitySummary().axonEnabled, own.size);
});

test('owner host partials are not silently counted as complete', () => {
  for (const id of ['tabs.restoreSession', 'tabs.suspend', 'history.openEntry'] as const) {
    assert.equal(getBrowserParity(id)?.ownerHost, 'PARTIAL');
  }
});

test('sensitive authentication and payment commands stay owner-handoff and are never built as AXON Web commands', () => {
  for (const id of ['accounts.startSignIn', 'credentials.fillPassword', 'credentials.usePasskey', 'autofill.payment'] as const) {
    const row = getBrowserParity(id);
    assert.equal(row?.ownerHost, 'NOT_APPLICABLE');
    assert.equal(row?.ownerCommand, 'NOT_APPLICABLE');
    assert.equal(row?.effect, 'OWNER_HANDOFF');
    assert.match(row?.evidence ?? '', /^Not applicable on Android WebView: /);
  }
});

test('every matrix row contains evidence and an explicit group', () => {
  assert.ok(BROWSER_PARITY_MATRIX.every((row) => row.group.length > 0 && row.evidence.length > 10));
});

test('every catalogue command is accounted for: built, partial, not applicable with a reason, AXON own-session, or listed as open', () => {
  const open = BROWSER_PARITY_MATRIX.filter((row) => row.ownerCommand === 'NOT_IMPLEMENTED' && row.axonAccess === 'BLOCKED_NO_ISOLATED_SESSION').map((row) => row.functionId).sort();
  assert.deepEqual(open, ['navigation.generateQr', 'page.installWebApp']);
  for (const row of BROWSER_PARITY_MATRIX) {
    if (row.ownerCommand === 'NOT_APPLICABLE') assert.match(row.evidence, /^Not applicable on Android WebView: .{20,}/);
    if (row.ownerCommand === 'PARTIAL') assert.match(row.evidence, /^Partial: .{20,}/);
  }
  const summary = getBrowserParitySummary();
  assert.equal(summary.ownerCommandImplemented + summary.ownerCommandPartial + summary.ownerCommandNotApplicable + summary.ownerCommandOpen
    + BROWSER_PARITY_MATRIX.filter((row) => row.ownerCommand === 'NOT_IMPLEMENTED' && row.axonAccess === 'OWN_SESSION_ONLY').length, summary.catalogueTotal);
});
