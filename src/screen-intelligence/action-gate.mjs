// Action gate (SI3d). Pure policy engine: decides whether AXON may act on a screen it has read.
// It does not tap or type anything. A later native executor receives only what confirmProposal() releases.
// Roadmap 7R: reading is allowed; forms, sign-in, sending, money and anything risky ASK first.

export const DEFAULT_POLICY = Object.freeze({
  autonomy: 'navigate',     // 'read-only' | 'navigate' | 'ask-everything'
  maxAgeMs: 5000,           // a screen read older than this must be read again before acting
  askTtlMs: 60000,          // an unanswered question expires, so a late "yes" cannot hit a changed screen
  maxPerMinute: 20,
  maxTextLength: 500,
  blockedPackages: [],
  askPackages: [],          // money, wallet and password apps: always ask before opening or acting (see axon-apps/app-catalog.mjs)
});

const KINDS = new Set(['tap', 'long-press', 'type', 'toggle', 'scroll', 'back', 'home', 'open-app']);
const NEEDS = { tap: 'tap', 'long-press': 'long-press', type: 'type', toggle: 'toggle', scroll: 'scroll' };
const GLOBAL = new Set(['back', 'home']);

function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
const looksLikeCard = (text) => { const d = String(text).replace(/[\s-]/g, ''); return /^\d{13,19}$/.test(d) && luhn(d); };
const center = (b) => (b ? { x: Math.round((b.l + b.r) / 2), y: Math.round((b.t + b.b) / 2) } : null);
const refuse = (code, reason) => ({ decision: 'refuse', code, reason });

export function proposeAction(structure, request, options = {}) {
  const policy = { ...DEFAULT_POLICY, ...options.policy };
  const now = options.now ?? Date.now();
  const history = options.history ?? [];
  const kind = request?.kind;
  if (!KINDS.has(kind)) return refuse('unknown-action', `AXON does not know the action "${kind}".`);
  if (policy.autonomy === 'read-only') return refuse('read-only', 'Acting is turned off. AXON may only read the screen.');
  if (history.filter((t) => now - t < 60000).length >= policy.maxPerMinute) return refuse('too-fast', 'Too many actions in the last minute. Waiting.');

  if (kind === 'open-app') {
    const pkg = String(request.packageName ?? '');
    if (!pkg) return refuse('no-package', 'No app was named.');
    if (policy.blockedPackages.includes(pkg)) return refuse('package-blocked', `${pkg} is on the blocked list.`);
    if (policy.askPackages.includes(pkg)) return { decision: 'ask', code: 'sensitive-app', reason: 'This looks like a money, wallet or password app.', summary: `Open ${pkg}`, action: { kind, packageName: pkg }, proposedAt: now };
    const decision = policy.autonomy === 'ask-everything' ? 'ask' : 'allow';
    return { decision, code: decision === 'ask' ? 'ask-everything' : 'ok', reason: decision === 'ask' ? 'You asked to approve every action.' : 'Opening an app is allowed.', summary: `Open ${pkg}`, action: { kind, packageName: pkg }, proposedAt: now };
  }

  if (!structure?.ok) return refuse('no-screen', 'There is no screen reading to act on. Read the screen first.');
  if (structure.blocked || policy.blockedPackages.includes(structure.packageName)) return refuse('package-blocked', `${structure.packageName} is on the blocked list.`);
  if (structure.capturedAt != null && now - structure.capturedAt > policy.maxAgeMs) return refuse('stale-screen', 'The screen reading is too old. Read it again first.');

  const signIn = (structure.elements ?? []).some((e) => e.label === '[password field]');
  const base = { kind, packageName: structure.packageName, capturedAt: structure.capturedAt ?? null };

  if (GLOBAL.has(kind)) {
    const decision = policy.autonomy === 'ask-everything' ? 'ask' : 'allow';
    return { decision, code: decision === 'ask' ? 'ask-everything' : 'ok', reason: 'Navigation key.', summary: kind === 'back' ? 'Press Back' : 'Go to the home screen', action: base, proposedAt: now };
  }

  const element = (structure.elements ?? []).find((e) => e.ref === request.ref);
  if (!element) return refuse('no-such-element', `Nothing on this screen has the reference ${request.ref}.`);
  if (!element.enabled) return refuse('element-disabled', `"${element.label}" is switched off.`);
  if (element.onScreen === false && kind !== 'scroll') return refuse('off-screen', `"${element.label}" is not on the visible screen. Scroll first.`);
  if (!element.actions.includes(NEEDS[kind])) return refuse('not-supported-by-element', `"${element.label}" cannot be used with ${kind}.`);
  if (kind === 'type') {
    if (element.label === '[password field]') return refuse('password-field', 'AXON never types into a password field. You type it yourself.');
    const text = String(request.text ?? '');
    if (!text) return refuse('no-text', 'There is no text to type.');
    if (text.length > policy.maxTextLength) return refuse('text-too-long', 'That text is too long to type.');
    if (looksLikeCard(text)) return refuse('card-number', 'AXON will not type something that looks like a card number.');
  }

  const label = element.label || element.role;
  const summary = {
    tap: `Tap "${label}"`, 'long-press': `Press and hold "${label}"`, toggle: `Switch "${label}"`,
    scroll: `Scroll ${request.direction ?? 'down'} on "${label}"`, type: `Type ${String(request.text ?? '').length} characters into "${label}"`,
  }[kind] + ` in ${structure.packageName}`;
  const action = { ...base, ref: element.ref, path: element.path, label, center: center(element.bounds),
    ...(kind === 'type' ? { text: String(request.text) } : {}), ...(kind === 'scroll' ? { direction: request.direction ?? 'down' } : {}) };

  let ask = null;
  if (policy.autonomy === 'ask-everything') ask = ['ask-everything', 'You asked to approve every action.'];
  else if (policy.askPackages.includes(structure.packageName) && kind !== 'scroll') ask = ['sensitive-app', 'This looks like a money, wallet or password app.'];
  else if (element.risk === 'ask') ask = ['risky-control', `"${label}" looks like it pays, sends, deletes or signs in.`];
  else if (signIn && kind !== 'scroll') ask = ['sign-in-screen', 'This looks like a sign-in screen.'];
  else if (kind === 'type') ask = ['typing', 'Typing into a field needs your approval.'];
  else if (kind === 'toggle') ask = ['setting-change', 'Changing a switch needs your approval.'];
  return { decision: ask ? 'ask' : 'allow', code: ask ? ask[0] : 'ok', reason: ask ? ask[1] : 'Reading-level navigation is allowed.', summary, action, proposedAt: now };
}

/** Releases an action for the native executor: allowed ones go straight through, asked ones only after a fresh "yes". */
export function confirmProposal(proposal, answer = {}, options = {}) {
  const policy = { ...DEFAULT_POLICY, ...options.policy };
  const now = options.now ?? Date.now();
  if (!proposal || proposal.decision === 'refuse') return { execute: false, reason: proposal?.reason ?? 'no-proposal' };
  if (proposal.decision === 'ask') {
    if (answer.approved !== true) return { execute: false, reason: 'not-approved' };
    if (now - (proposal.proposedAt ?? 0) > policy.askTtlMs) return { execute: false, reason: 'approval-expired' };
  }
  return { execute: true, payload: proposal.action };
}
