import type { Consent, Note, NoteKind, NotesStore, ProposeInput, Refusal } from './notesTypes';
import { proposeNote, keepNote, removeNote, topicKey } from './notes';

export type JudgeVerdict = 'same' | 'contradicts' | 'unrelated' | 'unknown';
export type NoteFacts = { readonly kind: NoteKind; readonly text: string; readonly term: string | null };
export type NoteJudge = (existing: NoteFacts, candidate: NoteFacts) => JudgeVerdict;
export type ConflictReason = 'same-term-other-meaning' | 'judged-contradiction' | 'judge-unsure';
export type Conflict = { readonly noteId: string; readonly reason: ConflictReason };
export type Decision = 'replace' | 'keep-both' | 'cancel';
export type ReplacedRecord = {
  readonly oldNoteId: string;
  readonly newNoteId: string;
  readonly topicId: string;
  readonly oldText: string;
  readonly oldTerm: string | null;
  readonly replacedAt: number;
  readonly description: string;
  readonly marker: string;
};
export type ReplacedLog = { readonly version: 1; readonly records: readonly ReplacedRecord[] };
export type ConflictRefusal = Refusal | 'unknown-decision' | 'bad-log';

export const CONTRADICTION_LIMITS = {
  maxNotesChecked: 5000,
  maxDescriptionCodePoints: 80,
  maxRecords: 5000,
  maxLogChars: 2000000
} as const;

const CHOICES = 'replace keep-both cancel'.split(' ') as Decision[];
const DECISIONS = CHOICES;
const VERDICTS = 'same contradicts unrelated unknown'.split(' ') as JudgeVerdict[];
const CONSENTS = 'said-remember yes standing-permission'.split(' ');
const own = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const validConsent = (v: unknown): v is Consent => own(v) && CONSENTS.includes(v.kind) && finite(v.at);
const unchangedFailure = (reason: ConflictRefusal, store: NotesStore, log: ReplacedLog) => ({ ok: false as const, reason, store, log });
function validLog(value: unknown): value is ReplacedLog {
  if (!own(value) || value.version !== 1 || !Array.isArray(value.records) || value.records.length > CONTRADICTION_LIMITS.maxRecords) return false;
  const pairs = new Set<string>();
  for (const r of value.records) {
    if (!own(r) || typeof r.oldNoteId !== 'string' || !r.oldNoteId || typeof r.newNoteId !== 'string' || !r.newNoteId ||
      typeof r.topicId !== 'string' || !r.topicId || typeof r.oldText !== 'string' ||
      (r.oldTerm !== null && typeof r.oldTerm !== 'string') || !finite(r.replacedAt) ||
      typeof r.description !== 'string' || typeof r.marker !== 'string') return false;
    const pair = JSON.stringify([r.oldNoteId, r.newNoteId]);
    if (pairs.has(pair)) return false;
    pairs.add(pair);
  }
  return true;
}
function cleanDescription(text: string): string {
  let out = '';
  let pendingSpace = false;
  for (const point of text) {
    if (point.trim() === '') {
      if (out.length) pendingSpace = true;
    } else {
      if (pendingSpace) out += ' ';
      out += point;
      pendingSpace = false;
    }
  }
  const points = Array.from(out);
  if (points.length <= CONTRADICTION_LIMITS.maxDescriptionCodePoints) return out;
  return points.slice(0, CONTRADICTION_LIMITS.maxDescriptionCodePoints).join('') + '\u2026';
}
function candidateCheck(store: NotesStore, input: ProposeInput) {
  return proposeNote(store, input, 0);
}
function findConflictsInner(
  store: NotesStore, candidate: ProposeInput, judge?: NoteJudge
): { ok: true; conflicts: Conflict[] } | { ok: false; reason: Refusal } {
  const proposed = candidateCheck(store, candidate);
  if (proposed.ok === false) return { ok: false, reason: proposed.reason };
  if (!own(store) || !Array.isArray(store.notes) || !Array.isArray(store.topics)) return { ok: false, reason: 'bad-input' };
  const topic = store.topics.find(t => t.key === topicKey(candidate.topic));
  if (!topic) return { ok: true, conflicts: [] };
  const candidateTextKey = topicKey(candidate.text.trim());
  const candidateTermKey = candidate.kind === 'meaning' && typeof candidate.term === 'string' ? topicKey(candidate.term.trim()) : '';
  const conflicts: Conflict[] = [];
  let checked = 0;
  for (const note of store.notes) {
    if (!note || note.state !== 'kept' || note.topic !== topic.id) continue;
    checked++;
    if (checked > CONTRADICTION_LIMITS.maxNotesChecked) return { ok: false, reason: 'bad-input' };
    if (note.kind !== candidate.kind) continue;
    const existingTextKey = topicKey(note.text);
    const existingTermKey = topicKey(note.term ?? '');
    if (existingTextKey === candidateTextKey && existingTermKey === candidateTermKey) continue;
    if (candidate.kind === 'meaning' && existingTermKey === candidateTermKey) {
      conflicts.push({ noteId: note.id, reason: 'same-term-other-meaning' });
      continue;
    }
    if (judge) {
      let verdict: unknown = 'unknown';
      try { verdict = judge({ kind: note.kind, text: note.text, term: note.term }, { kind: candidate.kind, text: candidate.text.trim(), term: candidate.kind === 'meaning' ? candidate.term!.trim() : null }); }
      catch { verdict = 'unknown'; }
      if (typeof verdict !== 'string' || !VERDICTS.includes(verdict as JudgeVerdict)) verdict = 'unknown';
      if (verdict === 'contradicts') conflicts.push({ noteId: note.id, reason: 'judged-contradiction' });
      else if (verdict === 'unknown') conflicts.push({ noteId: note.id, reason: 'judge-unsure' });
    }
  }
  return { ok: true, conflicts };
}
export function findConflicts(store: NotesStore, candidate: ProposeInput, judge?: NoteJudge): { ok: true; conflicts: Conflict[] } | { ok: false; reason: Refusal } {
  try { return findConflictsInner(store, candidate, judge); } catch { return { ok: false, reason: 'bad-input' }; }
}
export function conflictQuestion(
  store: NotesStore, conflict: Conflict, formatDate: (ms: number) => string
): { text: string; choices: Decision[] } | null {
  if (!own(store) || !Array.isArray(store.notes) || !own(conflict) || typeof conflict.noteId !== 'string' || typeof formatDate !== 'function') return null;
  const note = store.notes.find(n => n.id === conflict.noteId && n.state === 'kept');
  if (!note) return null;
  let date: string;
  try { date = formatDate(note.changed); } catch { return null; }
  if (typeof date !== 'string') return null;
  const meaning = note.kind === 'meaning' && note.term !== null ? ` The term is ${note.term}.` : '';
  const relation = conflict.reason === 'judge-unsure' ? 'This MAY contradict what AXON already remembers: ' : 'This contradicts what AXON already remembers: ';
  return { text: `${relation}${note.text}.${meaning} Date: ${date}. Choose replace, keep both, or cancel.`, choices: [...CHOICES] };
}
function decideInner(
  store: NotesStore, log: ReplacedLog, input: ProposeInput, conflictNoteId: string | null,
  decision: Decision, consent: Consent, now: number, formatDate: (ms: number) => string
): { ok: true; store: NotesStore; log: ReplacedLog; note: Note | null; changed: boolean } | { ok: false; reason: ConflictRefusal } {
  if (!validLog(log)) return { ok: false, reason: 'bad-log' };
  if (typeof decision !== 'string' || !DECISIONS.includes(decision)) return { ok: false, reason: 'unknown-decision' };
  if (decision === 'cancel') return { ok: true, store, log, note: null, changed: false };
  if (!finite(now) || typeof formatDate !== 'function') return { ok: false, reason: 'bad-input' };
  if (!validConsent(consent)) return { ok: false, reason: 'no-consent' };
  const proposed = proposeNote(store, input, now);
  if (proposed.ok === false) return { ok: false, reason: proposed.reason };
  const old = conflictNoteId === null ? undefined : store.notes.find(n => n.id === conflictNoteId);
  if (decision === 'replace') {
    if (typeof conflictNoteId !== 'string' || !old) return { ok: false, reason: 'not-found' };
    if (old.state !== 'kept') return { ok: false, reason: 'wrong-state' };
    const duplicateKept = store.notes.some(n => n.state === 'kept' && n.topic === proposed.note.topic && n.kind === proposed.note.kind &&
      topicKey(n.text) === topicKey(proposed.note.text) && topicKey(n.term ?? '') === topicKey(proposed.note.term ?? ''));
    if (duplicateKept) return { ok: false, reason: 'duplicate' };
    if (log.records.length >= CONTRADICTION_LIMITS.maxRecords) return { ok: false, reason: 'bad-log' };
    let date: string;
    try { date = formatDate(now); } catch { return { ok: false, reason: 'bad-input' }; }
    if (typeof date !== 'string') return { ok: false, reason: 'bad-input' };
    const description = cleanDescription(proposed.note.text);
    const marker = `[replaced ${date} by what: ${description}]`;
    const kept = keepNote(proposed.store, proposed.note.id, consent, now);
    if (kept.ok === false) return { ok: false, reason: kept.reason };
    const removed = removeNote(kept.store, old.id, now);
    if (removed.ok === false) return { ok: false, reason: removed.reason };
    const record: ReplacedRecord = {
      oldNoteId: old.id, newNoteId: kept.note.id, topicId: old.topic, oldText: old.text, oldTerm: old.term,
      replacedAt: now, description, marker
    };
    const nextLog: ReplacedLog = { version: 1, records: [...log.records, record] };
    if (!validLog(nextLog)) return { ok: false, reason: 'bad-log' };
    return { ok: true, store: removed.store, log: nextLog, note: kept.note, changed: true };
  }
  const kept = keepNote(proposed.store, proposed.note.id, consent, now);
  if (kept.ok === false) return { ok: false, reason: kept.reason };
  return { ok: true, store: kept.store, log, note: kept.note, changed: proposed.changed || kept.changed };
}
export function decide(
  store: NotesStore, log: ReplacedLog, input: ProposeInput, conflictNoteId: string | null,
  decision: Decision, consent: Consent, now: number, formatDate: (ms: number) => string
): { ok: true; store: NotesStore; log: ReplacedLog; note: Note | null; changed: boolean } | { ok: false; reason: ConflictRefusal } {
  try { return decideInner(store, log, input, conflictNoteId, decision, consent, now, formatDate); }
  catch { return { ok: false, reason: 'bad-input' }; }
}
export function replacedHistory(
  store: NotesStore, log: ReplacedLog, filter?: { topic?: string; noteId?: string }
): (ReplacedRecord & { readonly canRestore: boolean })[] {
  if (!validLog(log) || !own(store) || !Array.isArray(store.notes) || (filter !== undefined && !own(filter))) return [];
  if (filter && filter.topic !== undefined && typeof filter.topic !== 'string') return [];
  if (filter && filter.noteId !== undefined && typeof filter.noteId !== 'string') return [];
  const topicFilter = filter?.topic === undefined ? null : topicKey(filter.topic);
  return log.records.filter(r => {
    if (topicFilter !== null) {
      const topic = store.topics.find(t => t.id === r.topicId);
      if (!topic || topic.key !== topicFilter) return false;
    }
    if (filter?.noteId !== undefined && r.oldNoteId !== filter.noteId && r.newNoteId !== filter.noteId) return false;
    return true;
  }).map(r => ({ ...r, canRestore: store.notes.some(n => n.id === r.oldNoteId && n.state === 'removed') }));
}
export function reminderLine(record: ReplacedRecord, formatDate: (ms: number) => string): string {
  void formatDate;
  return `${record.marker} ${record.oldText}`;
}
export function emptyReplacedLog(): ReplacedLog { return { version: 1, records: [] }; }
export function serializeReplacedLog(log: ReplacedLog): string {
  if (!validLog(log)) return '';
  const text = JSON.stringify({ version: 1, records: log.records.map(r => ({
    oldNoteId: r.oldNoteId, newNoteId: r.newNoteId, topicId: r.topicId, oldText: r.oldText, oldTerm: r.oldTerm,
    replacedAt: r.replacedAt, description: r.description, marker: r.marker
  })) });
  return text.length <= CONTRADICTION_LIMITS.maxLogChars ? text : '';
}
export function parseReplacedLog(text: string): { ok: true; log: ReplacedLog } | { ok: false; reason: 'bad-text' | 'bad-log' } {
  if (typeof text !== 'string' || text.length > CONTRADICTION_LIMITS.maxLogChars) return { ok: false, reason: 'bad-text' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, reason: 'bad-text' }; }
  if (!validLog(raw)) return { ok: false, reason: 'bad-log' };
  return { ok: true, log: { version: 1, records: raw.records.map(r => ({
    oldNoteId: r.oldNoteId, newNoteId: r.newNoteId, topicId: r.topicId, oldText: r.oldText, oldTerm: r.oldTerm,
    replacedAt: r.replacedAt, description: r.description, marker: r.marker
  })) } };
}
