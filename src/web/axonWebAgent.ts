/**
 * AXON Web agent: the safe way for AXON to browse and act on pages.
 * It never touches the owner's tabs. It works only in AXON's own isolated tab, and every step goes
 * through the permission gateway first. Two handles come back: `agent` (given to the brain/tools)
 * and `owner` (given only to the owner's screen: approvals, extra budget, take-over).
 */
import { decideBrowserCommand, type BrowserFunctionId } from './browserCommandGateway.ts';
import { evaluateBrowserSessionBoundary, type BrowserSessionIdentity } from './browserSessionBoundary.ts';
import { classifyStep } from './browserStepGuard.ts';
import type { AxonAction, AxonElementRisk, AxonPageElement, AxonSessionEngine, AxonSessionState, AxonSnapshotOk } from './axonSessionTypes.ts';

export type AxonAgentCode = 'UNAVAILABLE' | 'NO_SESSION' | 'BAD_INPUT' | 'REFUSED' | 'NEEDS_OWNER' | 'HANDOFF' | 'BUDGET' | 'STALE' | 'FAILED';
export type AxonAgentResult<T = unknown> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: AxonAgentCode; message: string; approvalId?: string; functionId?: BrowserFunctionId }>;

export const AXON_TAB_ID = 'axon-own-tab';
export const OWNER_BROWSING_IDENTITY: BrowserSessionIdentity = Object.freeze({
  owner: 'OWNER', sessionId: 'owner-session', engineContextId: 'owner-default-profile', cookiePartitionId: 'owner-default-cookies',
  storagePartitionId: 'owner-default-storage', credentialStoreId: 'owner-credential-store', isolationKind: 'SHARED_WEBVIEW_PROCESS', isolationVerified: true,
});

export function buildSearchUrl(query: string, base = 'https://www.google.com/search?q='): string { return base + encodeURIComponent(query); }

export type AxonWebAgentOptions = Readonly<{
  engine: AxonSessionEngine;
  /** Steps AXON may take before the owner must allow more. Default 40. */
  maxSteps?: number;
  searchBaseUrl?: string;
  ownerIdentity?: BrowserSessionIdentity;
  /** Injectable waiting (tests). Default: real timers. */
  delay?: (ms: number) => Promise<void>;
  newApprovalId?: () => string;
}>;

export interface AxonWebAgent {
  open(url: string): Promise<AxonAgentResult<{ url: string; title: string }>>;
  search(query: string): Promise<AxonAgentResult<{ url: string; title: string }>>;
  snapshot(): Promise<AxonAgentResult<AxonSnapshotOk>>;
  read(): Promise<AxonAgentResult<{ url: string; title: string; text: string }>>;
  click(id: string): Promise<AxonAgentResult<{ risk: AxonElementRisk }>>;
  type(id: string, text: string, options?: { containsCredentials?: boolean }): Promise<AxonAgentResult<null>>;
  select(id: string, value: string): Promise<AxonAgentResult<null>>;
  scroll(dy: number): Promise<AxonAgentResult<{ y: number }>>;
  state(): Promise<AxonAgentResult<AxonSessionState>>;
  release(): Promise<AxonAgentResult<null>>;
}

export type AxonPendingApproval = Readonly<{ approvalId: string; functionId: BrowserFunctionId; prompt: string }>;
export interface AxonOwnerPanel {
  pending(): readonly AxonPendingApproval[];
  /** Owner taps Allow: runs that exact step once. */
  approve(approvalId: string): Promise<AxonAgentResult<unknown>>;
  deny(approvalId: string): boolean;
  /** Owner lets AXON continue after the step budget ran out. */
  allowMore(steps: number): void;
  /** Owner takes the screen back at once: closes AXON's tab and its throwaway profile. */
  takeOver(): Promise<AxonAgentResult<null>>;
}

type Pending = { functionId: BrowserFunctionId; prompt: string; run: (approvalId: string) => Promise<AxonAgentResult<unknown>> };

const ok = <T>(value: T): AxonAgentResult<T> => Object.freeze({ ok: true as const, value });
const no = (code: AxonAgentCode, message: string, extra: { approvalId?: string; functionId?: BrowserFunctionId } = {}): AxonAgentResult<never> =>
  Object.freeze({ ok: false as const, code, message, ...extra });
const cardLike = (text: string): boolean => /^[0-9 -]+$/.test(text) && text.replace(/[^0-9]/g, '').length >= 13 && text.replace(/[^0-9]/g, '').length <= 19;

export function createAxonWebAgent(options: AxonWebAgentOptions): { agent: AxonWebAgent; owner: AxonOwnerPanel } {
  const engine = options.engine;
  const ownerIdentity = options.ownerIdentity ?? OWNER_BROWSING_IDENTITY;
  const delay = options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let budget = Number.isInteger(options.maxSteps) && (options.maxSteps as number) > 0 ? (options.maxSteps as number) : 40;
  let identity: BrowserSessionIdentity | null = null;
  let last: AxonSnapshotOk | null = null;
  let counter = 0;
  const pending = new Map<string, Pending>();
  const newId = options.newApprovalId ?? ((): string => `axon-approval-${++counter}`);

  const gate = (functionId: BrowserFunctionId, approvalId?: string) => decideBrowserCommand({
    functionId, actor: 'AXON', support: 'SUPPORTED',
    session: { id: identity?.sessionId ?? 'axon-session-pending', owner: 'AXON' },
    tab: { id: AXON_TAB_ID, owner: 'AXON', kind: 'incognito' },
    ...(approvalId === undefined ? {} : { ownerApproval: { functionId, tabId: AXON_TAB_ID, approvalId } }),
  });

  /** Runs one gated step. `exec` runs only when the gateway says ALLOW. */
  async function gated<T>(functionId: BrowserFunctionId, prompt: string, exec: (approved: boolean) => Promise<AxonAgentResult<T>>, approvalId?: string): Promise<AxonAgentResult<T>> {
    const decision = gate(functionId, approvalId);
    if (!decision.ok) return no('REFUSED', decision.message, { functionId });
    const verdict = decision.value;
    if (verdict.decision === 'ASK_OWNER') {
      const id = newId();
      pending.set(id, { functionId, prompt, run: (granted) => gated(functionId, prompt, exec, granted) as Promise<AxonAgentResult<unknown>> });
      return no('NEEDS_OWNER', `The owner must approve this step: ${prompt}`, { approvalId: id, functionId });
    }
    if (verdict.decision === 'HANDOFF_TO_OWNER') return no('HANDOFF', `The owner must do this step: ${prompt}`, { functionId });
    if (verdict.decision !== 'ALLOW') return no('REFUSED', verdict.reason, { functionId });
    if (budget <= 0) return no('BUDGET', 'AXON used its step budget on this task. The owner must allow more steps.', { functionId });
    budget -= 1;
    return exec(verdict.definition.effect === 'OWNER_CONFIRM' && approvalId !== undefined);
  }

  async function startSession(url: string): Promise<AxonAgentResult<{ url: string; title: string }>> {
    if (!engine.isAvailable()) return no('UNAVAILABLE', 'The AXON Web browser is not available on this device.');
    let state: AxonSessionState;
    try { state = await engine.axonOpen({ url }); } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
    for (let tries = 0; state.pending === true && !state.active && tries < 10; tries++) {
      await delay(500);
      try { state = await engine.axonState(); } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
    }
    if (!state.active || !state.identity) return no('FAILED', 'The AXON browsing tab did not open.');
    const boundary = evaluateBrowserSessionBoundary(ownerIdentity, state.identity);
    if (!boundary.allowed) {
      try { await engine.axonRelease(); } catch { /* the tab is closed best-effort */ }
      identity = null; last = null;
      return no('REFUSED', boundary.reason);
    }
    identity = state.identity; last = null;
    return ok({ url: state.url ?? url, title: state.title ?? '' });
  }

  async function navigateTo(functionId: BrowserFunctionId, url: string): Promise<AxonAgentResult<{ url: string; title: string }>> {
    const step = classifyStep({ kind: 'open-url', url });
    if (!step.ok || step.value.decision === 'REFUSED') return no('BAD_INPUT', 'AXON only opens http or https addresses without a login inside them.');
    return gated(functionId, `open ${url}`, async () => startSession(url));
  }

  const needSession = (): AxonAgentResult<never> | null => (identity === null ? no('NO_SESSION', 'AXON has no open browsing tab. Open a page or search first.') : null);
  const fresh = (): AxonSnapshotOk | AxonAgentResult<never> => last ?? no('STALE', 'AXON has no current page snapshot. Take a snapshot first, then act with its element ids.');
  const isResult = (value: AxonSnapshotOk | AxonAgentResult<never>): value is AxonAgentResult<never> => 'ok' in value && (value as { ok: boolean }).ok === false && 'code' in value;
  const element = (snap: AxonSnapshotOk, id: string): AxonPageElement | undefined => snap.elements.find((item) => item.id === id);

  async function act(action: AxonAction): Promise<AxonAgentResult<{ risk: AxonElementRisk | undefined; y: number | undefined }>> {
    try {
      const result = await engine.axonAct({ action });
      if (result.ok) return ok({ risk: result.risk, y: result.y });
      if (result.error === 'owner-handoff') return no('HANDOFF', result.message);
      if (result.error === 'page-changed' || result.error === 'no-such-element') { last = null; return no('STALE', result.message); }
      return no('REFUSED', result.message);
    } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
  }

  const agent: AxonWebAgent = {
    open: (url) => navigateTo('address.navigate', String(url ?? '')),
    async search(query) {
      const text = String(query ?? '').trim();
      if (text.length < 1 || text.length > 300) return no('BAD_INPUT', 'A search needs 1 to 300 characters.');
      return navigateTo('address.search', buildSearchUrl(text, options.searchBaseUrl));
    },
    async snapshot() {
      const missing = needSession(); if (missing) return missing;
      return gated('page.snapshot', 'read the page controls', async () => {
        try {
          const snap = await engine.axonSnapshot();
          if (!snap.ok) return no('FAILED', snap.message);
          last = snap; return ok(snap);
        } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
      });
    },
    async read() {
      const missing = needSession(); if (missing) return missing;
      return gated('page.read', 'read the page', async () => {
        try {
          const snap = await engine.axonSnapshot();
          if (!snap.ok) return no('FAILED', snap.message);
          last = snap; return ok({ url: snap.url, title: snap.title, text: snap.text });
        } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
      });
    },
    async click(id) {
      const missing = needSession(); if (missing) return missing;
      const snap = fresh(); if (isResult(snap)) return snap;
      const item = element(snap, String(id));
      if (!item) return no('STALE', 'That element id is not on the current snapshot.');
      const functionId: BrowserFunctionId = item.risk === 'payment' ? 'page.pay' : item.risk === 'sign-in' ? 'page.signIn' : item.risk === 'submit' ? 'page.submit' : 'page.click';
      return gated(functionId, `${functionId === 'page.click' ? 'click' : functionId} "${item.text}" on ${snap.url}`, async (approved) => {
        const done = await act({ type: 'click', id: item.id, url: snap.url, ...(approved ? { approved: true } : {}) });
        if (!done.ok) return done;
        last = null;
        return ok({ risk: item.risk });
      });
    },
    async type(id, text, opts) {
      const missing = needSession(); if (missing) return missing;
      const snap = fresh(); if (isResult(snap)) return snap;
      const item = element(snap, String(id));
      if (!item) return no('STALE', 'That element id is not on the current snapshot.');
      const value = String(text ?? '');
      const step = classifyStep({ kind: 'type-text', containsCredentials: opts?.containsCredentials === true });
      if (!step.ok || step.value.decision === 'REFUSED') return no('REFUSED', 'AXON never types credentials.');
      if (item.sensitive) return no('REFUSED', 'AXON never types into password, card or code fields.');
      if (cardLike(value)) return no('REFUSED', 'AXON never types what looks like a card number.');
      return gated('page.type', `type into "${item.text}"`, async () => {
        const done = await act({ type: 'type', id: item.id, text: value, url: snap.url });
        return done.ok ? ok(null) : done;
      });
    },
    async select(id, value) {
      const missing = needSession(); if (missing) return missing;
      const snap = fresh(); if (isResult(snap)) return snap;
      const item = element(snap, String(id));
      if (!item) return no('STALE', 'That element id is not on the current snapshot.');
      return gated('page.select', `choose a value in "${item.text}"`, async () => {
        const done = await act({ type: 'select', id: item.id, value: String(value ?? ''), url: snap.url });
        return done.ok ? ok(null) : done;
      });
    },
    async scroll(dy) {
      const missing = needSession(); if (missing) return missing;
      if (typeof dy !== 'number' || !Number.isFinite(dy)) return no('BAD_INPUT', 'Scroll needs a number.');
      return gated('page.scroll', 'scroll the page', async () => {
        const done = await act({ type: 'scroll', dy });
        return done.ok ? ok({ y: done.value.y ?? 0 }) : done;
      });
    },
    async state() {
      try { return ok(await engine.axonState()); } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
    },
    async release() {
      pending.clear(); last = null; identity = null;
      try { await engine.axonRelease(); return ok(null); } catch (error) { return no('FAILED', error instanceof Error ? error.message : String(error)); }
    },
  };

  const owner: AxonOwnerPanel = {
    pending: () => Object.freeze([...pending.entries()].map(([approvalId, item]) => Object.freeze({ approvalId, functionId: item.functionId, prompt: item.prompt }))),
    async approve(approvalId) {
      const item = pending.get(approvalId);
      if (!item) return no('BAD_INPUT', 'There is no waiting approval with that id.');
      pending.delete(approvalId);
      return item.run(approvalId);
    },
    deny: (approvalId) => pending.delete(approvalId),
    allowMore(steps) { if (Number.isInteger(steps) && steps > 0 && steps <= 200) budget += steps; },
    takeOver: () => agent.release(),
  };
  return { agent, owner };
}

/** What the brain/tool layer registers. Names are stable; the descriptions are the tool help text. */
export const AXON_WEB_TOOL_SPECS = Object.freeze([
  { name: 'web.search', args: ['query'], description: 'Search the web in AXON\'s own private browser tab.' },
  { name: 'web.open', args: ['url'], description: 'Open an http(s) page in AXON\'s own private browser tab.' },
  { name: 'web.read', args: [], description: 'Read the text of the current page.' },
  { name: 'web.snapshot', args: [], description: 'List the page controls with element ids (needed before click, type, select).' },
  { name: 'web.click', args: ['id'], description: 'Click a control by id. Payment and sign-in are never done by AXON; sends need the owner.' },
  { name: 'web.type', args: ['id', 'text'], description: 'Type text into a plain text field by id. Never passwords, cards or codes.' },
  { name: 'web.select', args: ['id', 'value'], description: 'Choose a drop-down value by id.' },
  { name: 'web.scroll', args: ['dy'], description: 'Scroll the page by dy pixels.' },
  { name: 'web.release', args: [], description: 'Close AXON\'s browser tab and forget everything from it.' },
] as const);
