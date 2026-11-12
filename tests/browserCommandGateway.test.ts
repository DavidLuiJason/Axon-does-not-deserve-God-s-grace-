import assert from 'node:assert/strict';
import {
  BROWSER_FUNCTIONS,
  decideBrowserCommand,
  getBrowserFunction,
  listBrowserFunctions,
  type BrowserFunctionId,
} from '../src/web/browserCommandGateway.ts';

let checks = 0;
function check(name: string, run: () => void): void {
  run(); checks += 1; process.stdout.write(`PASS ${name}\n`);
}
function decision(input: unknown) {
  const result = decideBrowserCommand(input);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(String((result as { message?: unknown }).message));
  return result.value;
}

check('catalog is non-empty and has unique function identifiers', () => {
  assert.ok(BROWSER_FUNCTIONS.length >= 80);
  assert.equal(new Set(BROWSER_FUNCTIONS.map((item) => item.id)).size, BROWSER_FUNCTIONS.length);
});
check('all catalogue rows have descriptions and a valid effect', () => {
  for (const item of BROWSER_FUNCTIONS) {
    assert.ok(item.description.length > 10);
    assert.ok(['READ', 'REVERSIBLE', 'OWNER_CONFIRM', 'OWNER_HANDOFF'].includes(item.effect));
  }
});
check('lookup returns a known function and null for an unknown one', () => {
  assert.equal(getBrowserFunction('page.read')?.effect, 'READ');
  assert.equal(getBrowserFunction('made.up'), null);
  assert.equal(getBrowserFunction(null), null);
});
check('group listing returns only matching rows', () => {
  const rows = listBrowserFunctions('Tabs');
  assert.ok(rows.length >= 8);
  assert.ok(rows.every((item) => item.group === 'Tabs'));
  assert.equal(listBrowserFunctions(' ').length, 0);
});
check('owner can invoke a supported page function', () => {
  assert.equal(decision({ functionId: 'page.read', actor: 'OWNER', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, tab: { id: 't1', owner: 'OWNER' } }).decision, 'ALLOW');
});
check('AXON can read its own task tab', () => {
  assert.equal(decision({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'task-1', owner: 'AXON' } }).decision, 'ALLOW');
});
check('AXON cannot read an owner tab without a grant', () => {
  const result = decision({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, sessionGrant: { sessionId: 'owner-session', functionIds: ['page.read'] }, tab: { id: 'owner-1', owner: 'OWNER', selectedByOwner: true } });
  assert.equal(result.decision, 'ASK_OWNER');
  assert.equal(result.reason, 'owner-tab-access-not-granted');
});
check('owner-tab grant must target the exact owner-selected tab and function', () => {
  assert.equal(decision({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, sessionGrant: { sessionId: 'owner-session', functionIds: ['page.read'] }, tab: { id: 'owner-1', owner: 'OWNER', selectedByOwner: true }, ownerTabGrant: { tabId: 'owner-1', functionIds: ['page.read'] } }).decision, 'ALLOW');
  assert.equal(decision({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, sessionGrant: { sessionId: 'owner-session', functionIds: ['page.read'] }, tab: { id: 'owner-1', owner: 'OWNER', selectedByOwner: false }, ownerTabGrant: { tabId: 'owner-1', functionIds: ['page.read'] } }).decision, 'ASK_OWNER');
  assert.equal(decision({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, sessionGrant: { sessionId: 'owner-session', functionIds: ['page.read'] }, tab: { id: 'owner-1', owner: 'OWNER', selectedByOwner: true }, ownerTabGrant: { tabId: 'owner-2', functionIds: ['page.read'] } }).decision, 'ASK_OWNER');
});
check('AXON can use reversible bookmark actions on its own context', () => {
  assert.equal(decision({ functionId: 'bookmarks.add', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' } }).decision, 'ALLOW');
});
check('sensitive actions ask before a specific approval', () => {
  const result = decision({ functionId: 'files.upload', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'task-1', owner: 'AXON' } });
  assert.equal(result.decision, 'ASK_OWNER');
  assert.equal(result.approvalRequired, true);
});
check('matching approval releases only the named action and tab', () => {
  assert.equal(decision({ functionId: 'files.upload', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'task-1', owner: 'AXON' }, ownerApproval: { functionId: 'files.upload', tabId: 'task-1', approvalId: 'approval-1' } }).decision, 'ALLOW');
});
check('approval for a different function does not authorize the requested action', () => {
  assert.equal(decision({ functionId: 'files.upload', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'task-1', owner: 'AXON' }, ownerApproval: { functionId: 'files.print', tabId: 'task-1', approvalId: 'approval-1' } }).decision, 'ASK_OWNER');
});
check('approval for a different tab does not authorize the requested action', () => {
  assert.equal(decision({ functionId: 'files.upload', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'task-1', owner: 'AXON' }, ownerApproval: { functionId: 'files.upload', tabId: 'task-2', approvalId: 'approval-1' } }).decision, 'ASK_OWNER');
});
check('credential and passkey actions always hand off to owner/system UI', () => {
  const ids: BrowserFunctionId[] = ['accounts.startSignIn', 'credentials.openManager', 'credentials.generatePassword', 'credentials.fillPassword', 'credentials.usePasskey', 'autofill.address', 'autofill.payment'];
  for (const functionId of ids) {
    assert.equal(decision({ functionId, actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' } }).decision, 'HANDOFF_TO_OWNER');
  }
});
check('unsupported engine function is refused, not simulated', () => {
  const result = decision({ functionId: 'extensions.manage', actor: 'AXON', support: 'UNSUPPORTED', session: { id: 'axon-session', owner: 'AXON' } });
  assert.equal(result.decision, 'REFUSE');
  assert.equal(result.reason, 'engine-does-not-support-function');
});
check('unknown engine support remains not ready', () => {
  assert.equal(decision({ functionId: 'page.read', actor: 'AXON', support: 'UNKNOWN', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'task-1', owner: 'AXON' } }).decision, 'NOT_READY');
});
check('tab-scoped functions refuse a missing tab context', () => {
  const result = decision({ functionId: 'navigation.back', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' } });
  assert.equal(result.decision, 'REFUSE');
  assert.equal(result.reason, 'tab-context-required');
});
check('AXON cannot access the owner browser session without an explicit session grant', () => {
  const result = decision({ functionId: 'history.search', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' } });
  assert.equal(result.decision, 'ASK_OWNER');
  assert.equal(result.reason, 'owner-session-access-not-granted');
});
check('owner-session grant is limited to the exact session and function', () => {
  assert.equal(decision({ functionId: 'history.search', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, sessionGrant: { sessionId: 'owner-session', functionIds: ['history.search'] } }).decision, 'ALLOW');
  assert.equal(decision({ functionId: 'history.search', actor: 'AXON', support: 'SUPPORTED', session: { id: 'owner-session', owner: 'OWNER' }, sessionGrant: { sessionId: 'other-session', functionIds: ['history.search'] } }).decision, 'ASK_OWNER');
});
check('AXON tab and session ownership must agree', () => {
  assert.equal(decideBrowserCommand({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'owner-tab', owner: 'OWNER', selectedByOwner: true } }).ok, false);
});
check('browser-scoped read-only settings can be read without a tab', () => {
  assert.equal(decision({ functionId: 'settings.view', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' } }).decision, 'ALLOW');
});
check('browser-scoped changes require owner approval', () => {
  assert.equal(decision({ functionId: 'settings.change', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' } }).decision, 'ASK_OWNER');
});
check('invalid request objects are rejected', () => {
  assert.equal(decideBrowserCommand(null).ok, false);
  assert.equal(decideBrowserCommand([]).ok, false);
  assert.equal(decideBrowserCommand({ functionId: 'bad', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' } }).ok, false);
});
check('malformed tab, grant and approval data are rejected', () => {
  assert.equal(decideBrowserCommand({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: '', owner: 'AXON' } }).ok, false);
  assert.equal(decideBrowserCommand({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, ownerTabGrant: { tabId: 't1', functionIds: ['bad'] } }).ok, false);
  assert.equal(decideBrowserCommand({ functionId: 'page.read', actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, ownerApproval: { functionId: 'bad', tabId: null, approvalId: 'a1' } }).ok, false);
});
check('every owner-facing feature in the catalogue has an AXON-callable command identity', () => {
  for (const item of BROWSER_FUNCTIONS) {
    const result = decideBrowserCommand({ functionId: item.id, actor: 'AXON', support: 'SUPPORTED', session: { id: 'axon-session', owner: 'AXON' }, tab: { id: 'axon-task', owner: 'AXON' }, ownerApproval: { functionId: item.id, tabId: 'axon-task', approvalId: 'test-approval' } });
    assert.equal(result.ok, true, item.id);
    if (result.ok) assert.ok(['ALLOW', 'HANDOFF_TO_OWNER'].includes(result.value.decision), item.id);
  }
});

process.stdout.write(`\nTOTAL ${checks} CHECKS PASSED\n`);
