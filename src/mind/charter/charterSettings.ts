// SETCHR2: the ONE adapter between the Charter Settings screen and the Charter writer (SETCHR1 V4 to V8). The screen imports only this file.
// Flow: preview (writes nothing) -> the owner taps Save -> this file mints the two approvals bound to the hashes the owner SAW -> writeCharter.
// No Date.now, no random: the caller passes `now` and a token generator. Used tokens live in memory for the session; approvals expire in two minutes (V5).
import { CHARTER_UNTRUSTED_NOTICE } from './charterView.ts';
import { CHARTER_LIMITS } from './charter.ts';
import type { Charter, Level, Sha256 } from './charter.ts';
import { proposeChange } from './change.ts';
import type { CharterPatch, OwnerApproval } from './change.ts';
import { previewCharterChange, readCharter, readCharterHistory, writeCharter } from './charterStore.ts';
import type { CharterStorage, WriteError } from './charterStore.ts';
import { previewRecovery, recoverCharter } from './charterRecovery.ts';
import type { RecoveryError, RecoveryProblem } from './charterRecovery.ts';

export type { CharterStorage } from './charterStore.ts';
export { CHARTER_UNTRUSTED_NOTICE } from './charterView.ts';
export const APPROVAL_MS = 120000;
// PROPOSED screen text (SETCHR1 V3); the owner's yes on the fixed notice line is still WAITING.
export const CHARTER_BUILT_IN_LINE = 'Built-in rules, not yet changed by you';
export const charterChangedLine = (date: string) => `Your rules, last changed ${date}`;
export const CHARTER_WIDENS_LINE = 'This lets AXON do more than before.';
export const CHARTER_RECOVERY_LINES: Readonly<Record<RecoveryProblem, string>> = Object.freeze({
  'charter-untrusted': 'Your saved Charter could not be read. It will be kept in History and the built-in rules will be put back.',
  'history-unreadable': 'Your Charter history could not be read. It will be kept as one History entry. Your Charter stays as it is.',
  'both': 'Your saved Charter and its history could not be read. Both will be kept in History and the built-in rules will be put back.',
});
export type ToolChoice = 'none' | 'ask' | 'never';
/** The words for one tool row on the Tools screen (SETCHR1 V3), so the sheet can show a line per tool instead of "New lane tools is proposed." */
export const TOOL_CHOICE_WORDS: Readonly<Record<ToolChoice, string>> = Object.freeze({ none: 'No extra rule', ask: 'Ask me first', never: 'Never' });
export const toolRuleLine = (toolId: string, choice: ToolChoice) => `${toolId}: ${TOOL_CHOICE_WORDS[choice]}`;
export type TokenMaker = () => string;
export type ScreenError = WriteError | RecoveryError | 'changed-since-preview' | 'bad-input' | 'cap-reached';
export type Failure = { readonly ok: false; readonly error: ScreenError; readonly message: string };
const no = (error: ScreenError, message: string): Failure => Object.freeze({ ok: false as const, error, message });

export type ScreenRead = {
  readonly status: 'built-in' | 'signed' | 'untrusted';
  readonly statusLine: string;
  readonly charter: Charter | null;
  readonly history: readonly { readonly replacedAt: string }[] | null;
  readonly recoveryNeeded: boolean;
};
/** Everything the screen shows, read through this adapter only. A bad history says null, never an empty list. */
export function readCharterScreen(storage: CharterStorage, sha256: Sha256): ScreenRead {
  const load = readCharter(storage, sha256); const hist = readCharterHistory(storage);
  const rec = previewRecovery(storage, sha256);
  const history = hist.ok ? [...hist.entries].reverse().slice(0, CHARTER_LIMITS.logEntries).map((e) => ({ replacedAt: e.replacedAt })) : null;
  const recoveryNeeded = rec.ok && rec.needed;
  if (load.status === 'untrusted') return Object.freeze({ status: 'untrusted' as const, statusLine: CHARTER_UNTRUSTED_NOTICE, charter: null, history, recoveryNeeded });
  if (load.status === 'built-in') return Object.freeze({ status: 'built-in' as const, statusLine: CHARTER_BUILT_IN_LINE, charter: load.charter, history, recoveryNeeded });
  return Object.freeze({ status: 'signed' as const, statusLine: charterChangedLine((load.charter.signedAt ?? '').slice(0, 10)), charter: load.charter, history, recoveryNeeded });
}

/** A tool rule is lane `tools`, action `tools.<id>`. "No extra rule" is written as `allowed` (CHR1 C2: it changes nothing) because removing a rule counts as narrowing in change.ts, so a removal could loosen without approval. */
export function toolRulePatch(charter: Charter, toolId: string, choice: ToolChoice): CharterPatch | Failure {
  if (charter === null || typeof charter !== 'object' || typeof toolId !== 'string' || toolId === '' || !['none', 'ask', 'never'].includes(choice)) return no('bad-input', 'The tool rule is invalid.');
  const lane = charter.lanes.tools; const actions = { ...(lane ? lane.actions : {}) };
  const id = `tools.${toolId}`; const level: Level = choice === 'none' ? 'allowed' : choice;
  if (!(id in actions) && Object.keys(actions).length >= CHARTER_LIMITS.actionsPerLane) return no('cap-reached', 'The Tools list is full.');
  actions[id] = { level, reason: 'Set by the owner in Settings.' };
  return { lanes: { tools: { id: 'tools', name: 'Tools', actions } } };
}

export type Seen = { readonly changeHash: string; readonly resultHash: string };
export type ChangePreview = { readonly ok: true; readonly lines: readonly string[]; readonly widens: boolean; readonly seen: Seen } | Failure;
/** The confirm sheet's content: the summary lines, plus the bold line when the change widens. Writes nothing. */
export function previewChange(storage: CharterStorage, patch: CharterPatch, sha256: Sha256): ChangePreview {
  const p = previewCharterChange(storage, patch, sha256);
  if (!p.ok) return no(p.error, p.message);
  const lines = p.widens ? [...p.summary, CHARTER_WIDENS_LINE] : [...p.summary];
  return Object.freeze({ ok: true as const, lines: Object.freeze(lines), widens: p.widens, seen: Object.freeze({ changeHash: p.changeHash, resultHash: p.resultHash }) });
}
/** V6: a change AXON proposes is shown in the same sheet and waits for the owner's tap. A widening is refused here, as in change.ts. */
export function previewAxonProposal(storage: CharterStorage, patch: CharterPatch, sha256: Sha256): ChangePreview {
  const load = readCharter(storage, sha256);
  if (load.status === 'untrusted') return no('store-untrusted', 'The stored Charter could not be checked.');
  if (proposeChange(load.charter, patch, 'axon').widens) return no('axon-cannot-widen', 'Only the owner may widen the Charter.');
  return previewChange(storage, patch, sha256);
}

/** An approval is a tap bound to what the owner saw: the hash, two minutes, a fresh token (V5). */
export function approvalFor(actionHash: string, now: string, token: string): OwnerApproval {
  const at = Date.parse(now);
  return { by: 'owner', actionHash, issuedAt: now, expiresAt: Number.isFinite(at) ? new Date(at + APPROVAL_MS).toISOString() : '', token };
}

export type SaveRequest = { readonly patch: CharterPatch; readonly seen: Seen; readonly now: string; readonly newToken: TokenMaker; readonly usedTokens: ReadonlySet<string> };
export type SaveResult = { readonly ok: true; readonly revision: number; readonly usedTokens: Set<string> } | Failure;
/** Called only from the Save button. A Charter that changed since the preview is refused, never written. */
export function saveChange(storage: CharterStorage, req: SaveRequest, sha256: Sha256): SaveResult {
  if (req === null || typeof req !== 'object' || typeof req.now !== 'string' || typeof req.newToken !== 'function' || req.seen === null || typeof req.seen !== 'object') return no('bad-input', 'The save request is invalid.');
  const p = previewCharterChange(storage, req.patch, sha256);
  if (!p.ok) return no(p.error, p.message);
  if (p.changeHash !== req.seen.changeHash || p.resultHash !== req.seen.resultHash) return no('changed-since-preview', 'The Charter changed since you looked at it. Nothing was saved.');
  const t1 = req.newToken(); const t2 = req.newToken();
  if (typeof t1 !== 'string' || typeof t2 !== 'string' || t1 === '' || t2 === '' || t1 === t2) return no('bad-input', 'Approvals need two different tokens.');
  const w = writeCharter(storage, { patch: req.patch, changeApproval: p.widens ? approvalFor(p.changeHash, req.now, t1) : null, signApproval: approvalFor(p.resultHash, req.now, t2), now: req.now, usedTokens: req.usedTokens }, sha256);
  return w.ok ? Object.freeze({ ok: true as const, revision: w.revision, usedTokens: w.usedTokens }) : no(w.error, w.message);
}

export type RecoveryView = { readonly ok: true; readonly needed: false } | { readonly ok: true; readonly needed: true; readonly line: string; readonly seen: string } | Failure;
export function previewRecoveryChange(storage: CharterStorage, sha256: Sha256): RecoveryView {
  const r = previewRecovery(storage, sha256);
  if (!r.ok) return no('bad-input', 'The recovery could not be checked.');
  return r.needed ? Object.freeze({ ok: true as const, needed: true as const, line: CHARTER_RECOVERY_LINES[r.problem], seen: r.recoveryHash }) : Object.freeze({ ok: true as const, needed: false as const });
}
export type RecoverySave = { readonly seen: string; readonly now: string; readonly newToken: TokenMaker; readonly usedTokens: ReadonlySet<string> };
/** The button "Go back to the built-in rules" (V3a). */
export function saveRecovery(storage: CharterStorage, req: RecoverySave, sha256: Sha256): { readonly ok: true; readonly usedTokens: Set<string> } | Failure {
  if (req === null || typeof req !== 'object' || typeof req.now !== 'string' || typeof req.newToken !== 'function' || typeof req.seen !== 'string') return no('bad-input', 'The recovery request is invalid.');
  const token = req.newToken();
  if (typeof token !== 'string' || token === '') return no('bad-input', 'The approval needs a token.');
  const r = recoverCharter(storage, { approval: approvalFor(req.seen, req.now, token), now: req.now, usedTokens: req.usedTokens }, sha256);
  return r.ok ? Object.freeze({ ok: true as const, usedTokens: r.usedTokens }) : no(r.error, 'The Charter was not changed.');
}

