import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_FUNCTIONS } from '../src/web/browserCommandGateway.ts';
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
    'tabs.switch', 'tabs.createGroup', 'tabs.renameGroup', 'tabs.moveToGroup', 'tabs.deleteGroup', 'tabs.removeFromGroup', 'tabs.listGroups', 'tabs.closeGroup', 'bookmarks.add', 'bookmarks.list', 'bookmarks.edit', 'bookmarks.remove',
    'bookmarks.createFolder', 'bookmarks.move', 'history.search', 'history.clear', 'history.clearBySite',
    'readingList.add', 'readingList.remove', 'readingList.open', 'readingList.markRead', 'readingList.list', 'page.read',
    'navigation.copyUrl', 'navigation.shareUrl', 'navigation.securityDetails', 'downloads.list', 'downloads.open',
    'downloads.share', 'downloads.cancel', 'downloads.delete', 'files.print', 'files.savePdf', 'site.viewPermissions',
  ]);
  assert.deepEqual(new Set(BROWSER_PARITY_MATRIX.filter((row) => row.ownerCommand === 'IMPLEMENTED').map((row) => row.functionId)), expected);
});

test('AXON is blocked from every owner-session command until isolated session exists', () => {
  assert.ok(BROWSER_PARITY_MATRIX.every((row) => row.axonAccess === 'BLOCKED_NO_ISOLATED_SESSION'));
  assert.equal(getBrowserParitySummary().axonEnabled, 0);
});

test('owner host partials are not silently counted as complete', () => {
  for (const id of ['tabs.restoreSession', 'tabs.suspend', 'history.openEntry'] as const) {
    assert.equal(getBrowserParity(id)?.ownerHost, 'PARTIAL');
  }
});

test('sensitive authentication and payment commands remain non-implemented and handoff-classified', () => {
  for (const id of ['accounts.startSignIn', 'credentials.fillPassword', 'credentials.usePasskey', 'autofill.payment'] as const) {
    const row = getBrowserParity(id);
    assert.equal(row?.ownerHost, 'NOT_IMPLEMENTED');
    assert.equal(row?.ownerCommand, 'NOT_IMPLEMENTED');
    assert.equal(row?.effect, 'OWNER_HANDOFF');
  }
});

test('every matrix row contains evidence and an explicit group', () => {
  assert.ok(BROWSER_PARITY_MATRIX.every((row) => row.group.length > 0 && row.evidence.length > 10));
});
