// CHR4: the owner's way back from an untrusted Charter or an unreadable history (SETCHR1 F1). It never loses text: whatever is replaced goes into the history list first.
// Only an owner approval bound to what the owner saw (the recovery hash) lets it run. No Date, no random: the caller passes `now`, the approval and the hash function.
// This file reaches the Charter keys, so it is on ALLOWED_WRITER_IMPORTERS in tests/charterStore.test.ts (a deliberate decision, with charterSettings.ts).
import { CHARTER_HISTORY_KEY, CHARTER_HISTORY_MAX, CHARTER_KEY, readCharter, readCharterHistory } from './charterStore.ts';
import type { CharterStorage, HistoryEntry } from './charterStore.ts';
import type { OwnerApproval } from './change.ts';
import type { Sha256 } from './charter.ts';

export const RECOVERY_KEEP_MAX = 200000;
export type RecoveryError = 'bad-input' | 'not-needed' | 'approval-required' | 'hash-mismatch' | 'expired' | 'replayed' | 'storage-failed' | 'verify-failed';
export type RecoveryProblem = 'charter-untrusted' | 'history-unreadable' | 'both';
export type RecoveryPreview =
  | { readonly ok: true; readonly needed: false }
  | { readonly ok: true; readonly needed: true; readonly problem: RecoveryProblem; readonly recoveryHash: string }
  | { readonly ok: false; readonly error: 'bad-input' };
export type RecoveryRequest = { readonly approval: OwnerApproval | null; readonly now: string; readonly usedTokens: ReadonlySet<string> };
export type RecoveryResult = { readonly ok: true; readonly problem: RecoveryProblem; readonly usedTokens: Set<string> } | { readonly ok: false; readonly error: RecoveryError };

const bad = <E extends string>(error: E) => Object.freeze({ ok: false as const, error });
type Raw = { readonly readable: boolean; readonly text: string | null };
function rawOf(storage: CharterStorage, key: string): Raw { try { return { readable: true, text: storage.getItem(key) }; } catch { return { readable: false, text: null }; } }
const shown = (r: Raw) => (r.readable ? (r.text === null ? '<absent>' : r.text) : '<unreadable>');

function assess(storage: CharterStorage, sha256: Sha256) {
  const load = readCharter(storage, sha256);
  const hist = readCharterHistory(storage);
  const charterBad = load.status === 'untrusted';
  const historyBad = !hist.ok;
  const charterRaw = rawOf(storage, CHARTER_KEY); const historyRaw = rawOf(storage, CHARTER_HISTORY_KEY);
  const problem: RecoveryProblem | null = charterBad && historyBad ? 'both' : charterBad ? 'charter-untrusted' : historyBad ? 'history-unreadable' : null;
  let recoveryHash = '';
  if (problem !== null) { try { recoveryHash = sha256(JSON.stringify({ action: 'charter-recovery', problem, charter: shown(charterRaw), history: shown(historyRaw) })); } catch { recoveryHash = ''; } }
  return { problem, recoveryHash, charterRaw, historyRaw, charterBad, historyBad, entries: hist.ok ? hist.entries : ([] as HistoryEntry[]) };
}

/** What the owner is asked to approve. Writes nothing. A healthy Charter and history say "not needed". */
export function previewRecovery(storage: CharterStorage, sha256: Sha256): RecoveryPreview {
  if (storage === null || typeof storage !== 'object' || typeof sha256 !== 'function') return bad('bad-input');
  const a = assess(storage, sha256);
  if (a.problem === null) return Object.freeze({ ok: true as const, needed: false as const });
  if (a.recoveryHash === '') return bad('bad-input');
  return Object.freeze({ ok: true as const, needed: true as const, problem: a.problem, recoveryHash: a.recoveryHash });
}

/** Order: keep the broken text in the history first, then put the built-in Charter back (the key is removed), then read back; on a failed check the old values are restored. */
export function recoverCharter(storage: CharterStorage, req: RecoveryRequest, sha256: Sha256): RecoveryResult {
  if (req === null || typeof req !== 'object' || typeof req.now !== 'string' || typeof sha256 !== 'function' || storage === null || typeof storage !== 'object') return bad('bad-input');
  const a = assess(storage, sha256);
  if (a.problem === null) return bad('not-needed');
  const ap = req.approval;
  if (ap === null || typeof ap !== 'object' || ap.by !== 'owner' || typeof ap.token !== 'string' || ap.token === '') return bad('approval-required');
  if (ap.actionHash !== a.recoveryHash) return bad('hash-mismatch');
  if (!Number.isFinite(Date.parse(ap.expiresAt)) || !Number.isFinite(Date.parse(req.now)) || Date.parse(req.now) > Date.parse(ap.expiresAt)) return bad('expired');
  if (req.usedTokens !== undefined && req.usedTokens !== null && req.usedTokens.has(ap.token)) return bad('replayed');
  // Never remove what cannot be read and kept: an unreadable store (a read error) is refused before any write.
  if ((a.charterBad && !a.charterRaw.readable) || (a.historyBad && !a.historyRaw.readable)) return bad('storage-failed');
  const keep = (r: Raw): string => (r.text === null ? '' : r.text.length > RECOVERY_KEEP_MAX ? r.text.slice(0, RECOVERY_KEEP_MAX) : r.text);
  const added: HistoryEntry[] = [];
  if (a.problem === 'history-unreadable' || a.problem === 'both') added.push({ replacedAt: req.now, note: `[unreadable history kept ${req.now}]`, text: keep(a.historyRaw) });
  if (a.charterBad) added.push({ replacedAt: req.now, note: `[untrusted charter kept ${req.now}]`, text: keep(a.charterRaw) });
  const base = a.historyBad ? [] : a.entries;
  const entries = [...base, ...added].slice(-CHARTER_HISTORY_MAX);
  try { storage.setItem(CHARTER_HISTORY_KEY, JSON.stringify(entries)); if (a.charterBad) storage.removeItem(CHARTER_KEY); } catch { restore(storage, a); return bad('storage-failed'); }
  const back = readCharter(storage, sha256); const hist = readCharterHistory(storage);
  const ok = hist.ok && hist.entries.length === entries.length && (a.charterBad ? back.status === 'built-in' : back.status !== 'untrusted');
  if (!ok) { restore(storage, a); return bad('verify-failed'); }
  const used = new Set(req.usedTokens ?? []); used.add(ap.token);
  return Object.freeze({ ok: true as const, problem: a.problem, usedTokens: used });
}
function restore(storage: CharterStorage, a: { charterRaw: Raw; historyRaw: Raw }) {
  try { if (a.historyRaw.readable) { if (a.historyRaw.text === null) storage.removeItem(CHARTER_HISTORY_KEY); else storage.setItem(CHARTER_HISTORY_KEY, a.historyRaw.text); } } catch { /* nothing more can be done */ }
  try { if (a.charterRaw.readable) { if (a.charterRaw.text === null) storage.removeItem(CHARTER_KEY); else storage.setItem(CHARTER_KEY, a.charterRaw.text); } } catch { /* nothing more can be done */ }
}
