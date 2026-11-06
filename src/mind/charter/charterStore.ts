// CHR3: the Charter's storage adapter and its ONE write path (CHR1 C6, C7). Only an owner-confirmed Settings action may import writeCharter;
// tests/charterStore.test.ts is the ratchet. No Date, no random: the caller passes `now`, the approvals and the hash function.
import { charterHash, defaultCharter } from './charter.ts';
import type { Charter, Sha256 } from './charter.ts';
import { applyChange, proposalHash, proposeChange, signCharter } from './change.ts';
import type { ChangeError, CharterPatch, OwnerApproval } from './change.ts';
import { loadCharterText, serializeCharter } from './charterView.ts';
import type { CharterLoad } from './charterView.ts';

export const CHARTER_KEY = 'axon.charter.v1';
export const CHARTER_HISTORY_KEY = 'axon.charter.history';
export const CHARTER_HISTORY_MAX = 20;
export interface CharterStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type HistoryEntry = { readonly replacedAt: string; readonly note: string; readonly text: string };
export type WriteError = ChangeError | 'bad-input' | 'store-untrusted' | 'history-unreadable' | 'storage-failed' | 'verify-failed' | 'invalid-charter';
export type WriteRequest = { readonly patch: CharterPatch; readonly changeApproval: OwnerApproval | null; readonly signApproval: OwnerApproval; readonly now: string; readonly usedTokens: ReadonlySet<string> };
export type WriteResult = { readonly ok: true; readonly revision: number; readonly usedTokens: Set<string> } | { readonly ok: false; readonly error: WriteError; readonly message: string };
export type PreviewResult = { readonly ok: true; readonly summary: readonly string[]; readonly widens: boolean; readonly changeHash: string; readonly resultHash: string } | { readonly ok: false; readonly error: WriteError; readonly message: string };

const no = (error: WriteError, message: string) => Object.freeze({ ok: false as const, error, message });

/** The app's storage convention (localStorage behind try/catch); null when it does not exist. Android storage pressure is UNMEASURED. */
export function browserCharterStorage(): CharterStorage | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

/** A read error is "unreadable" (untrusted), never "absent" (C6). */
export function readCharter(storage: CharterStorage, sha256: Sha256): CharterLoad {
  let text: string | null;
  try { text = storage.getItem(CHARTER_KEY); } catch { return loadCharterText({ kind: 'unreadable' }, sha256); }
  return loadCharterText(text === null ? { kind: 'absent' } : { kind: 'text', text }, sha256);
}

export function readCharterHistory(storage: CharterStorage): { ok: true; entries: HistoryEntry[] } | { ok: false } {
  try {
    const raw = storage.getItem(CHARTER_HISTORY_KEY);
    if (raw === null) return { ok: true, entries: [] };
    const v: unknown = JSON.parse(raw);
    const good = Array.isArray(v) && v.every((e) => e !== null && typeof e === 'object' && typeof e.replacedAt === 'string' && typeof e.note === 'string' && typeof e.text === 'string');
    return good ? { ok: true, entries: v as HistoryEntry[] } : { ok: false };
  } catch { return { ok: false }; }
}

/** What the owner is asked to approve: the change hash (for a widening) and the hash of the resulting Charter (for the signature). Writes nothing. */
export function previewCharterChange(storage: CharterStorage, patch: CharterPatch, sha256: Sha256): PreviewResult {
  const load = readCharter(storage, sha256);
  if (load.status === 'untrusted') return no('store-untrusted', 'The stored Charter could not be checked.');
  const proposal = proposeChange(load.charter, patch, 'owner');
  const changeHash = proposalHash(proposal, sha256);
  const probe: OwnerApproval = { by: 'owner', actionHash: changeHash, issuedAt: '', expiresAt: '9999-12-31T00:00:00Z', token: 'preview' };
  const next = applyChange(load.charter, proposal, probe, { now: '1970-01-01T00:00:00Z', usedTokens: new Set() }, sha256);
  if (!next.ok) return no(next.error, next.message);
  const resultHash = charterHash(next.value, sha256);
  return Object.freeze({ ok: true as const, summary: Object.freeze([...proposal.summary]), widens: proposal.widens, changeHash, resultHash });
}
/** THE ONLY WRITER. Order: history first (never lose a replaced Charter), then the Charter, then read back and check; on a failed check the old text is restored. */
export function writeCharter(storage: CharterStorage, req: WriteRequest, sha256: Sha256): WriteResult {
  if (req === null || typeof req !== 'object' || typeof req.now !== 'string' || req.signApproval === null || typeof req.signApproval !== 'object') return no('bad-input', 'The write request is invalid.');
  const load = readCharter(storage, sha256);
  if (load.status === 'untrusted') return no('store-untrusted', 'The stored Charter could not be checked, so it is not changed.');
  const history = readCharterHistory(storage);
  if (!history.ok) return no('history-unreadable', 'The Charter history could not be read, so nothing is changed.');
  const proposal = proposeChange(load.charter, req.patch, 'owner');
  const applied = applyChange(load.charter, proposal, req.changeApproval, { now: req.now, usedTokens: req.usedTokens }, sha256);
  if (!applied.ok) return no(applied.error, applied.message);
  const signed = signCharter(applied.value, req.signApproval, sha256, { now: req.now, usedTokens: applied.usedTokens });
  if (!signed.ok) return no(signed.error, signed.message);
  const text = serializeCharter(signed.value);
  if (!text.ok) return no('invalid-charter', text.message);
  let previous: string | null = null;
  try { previous = storage.getItem(CHARTER_KEY); } catch { return no('storage-failed', 'The Charter could not be read before writing.'); }
  const replaced = previous ?? (serializeCharter(defaultCharter()) as { text: string }).text;
  const entries = [...history.entries, { replacedAt: req.now, note: `[replaced ${req.now}]`, text: replaced }].slice(-CHARTER_HISTORY_MAX);
  try { storage.setItem(CHARTER_HISTORY_KEY, JSON.stringify(entries)); storage.setItem(CHARTER_KEY, text.text); } catch { return no('storage-failed', 'The Charter could not be saved.'); }
  const back = readCharter(storage, sha256);
  const ok = back.status === 'signed' && (serializeCharter(back.charter) as { text: string }).text === text.text;
  if (!ok) { try { if (previous === null) storage.removeItem(CHARTER_KEY); else storage.setItem(CHARTER_KEY, previous); } catch { /* reported below */ } return no('verify-failed', 'The saved Charter did not read back correctly; the old one was restored.'); }
  return Object.freeze({ ok: true as const, revision: signed.value.revision, usedTokens: signed.usedTokens });
}
