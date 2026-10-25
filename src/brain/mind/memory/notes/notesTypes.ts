// REBUILT by the Director (ninth account, 2026-10-25) from the B03B3d prompt rules and the two implementations, because the original contract (in B03B3d-MINIBASE.zip) was not in the sandbox. If the original differs, the ORIGINAL wins: diff them.
// REBUILT contract (Director sandbox) from prompt rules + both implementations. Labels are data-format labels.
export const NOTE_KIND_LABELS = 'meaning fact preference correction';
export const NOTE_STATE_LABELS = 'proposed kept removed';
export const CONSENT_KIND_LABELS = 'said-remember yes standing-permission';
export type NoteKind = 'meaning' | 'fact' | 'preference' | 'correction';
export type NoteState = 'proposed' | 'kept' | 'removed';
export type ConsentKind = 'said-remember' | 'yes' | 'standing-permission';
export interface Consent { kind: ConsentKind; at: number }
export interface NoteSource { text: string; chat: string | null }
export interface NoteVersion { text: string; term: string | null; topic: string; changed: number }
export interface Topic { id: string; name: string; key: string; created: number }
export interface Note { id: string; topic: string; kind: NoteKind; text: string; term: string | null; state: NoteState; source: NoteSource; created: number; changed: number; consent: Consent | null; history: readonly NoteVersion[] }
export interface NotesStore { version: 1; nextId: number; topics: readonly Topic[]; notes: readonly Note[] }
export interface ProposeInput { topic: string; text: string; kind: NoteKind; term?: string | null; standalone: boolean; source: NoteSource }
export interface EditInput { text?: string; topic?: string; term?: string | null }
export type Refusal = 'bad-input' | 'not-standalone' | 'empty-topic' | 'empty-text' | 'missing-term' | 'no-consent' | 'not-found' | 'wrong-state' | 'duplicate';
export type NoteResult = { ok: true; store: NotesStore; note: Note; changed: boolean } | { ok: false; reason: Refusal };
export interface ListOptions { states?: readonly NoteState[] }
export interface TopicView { topic: Topic; notes: readonly Note[] }
export interface Mention { start: number; end: number; text: string; topic: string; via: 'topic' | 'term'; notes: readonly string[] }
export type ParseResult = { ok: true; store: NotesStore } | { ok: false; reason: 'bad-text' | 'bad-store' };
export interface NotesApi {
  emptyStore(): NotesStore; topicKey(name: string): string;
  proposeNote(s: NotesStore, i: ProposeInput, now: number): NoteResult;
  keepNote(s: NotesStore, id: string, c: Consent, now: number): NoteResult;
  discardProposal(s: NotesStore, id: string): NoteResult;
  removeNote(s: NotesStore, id: string, now: number): NoteResult;
  restoreNote(s: NotesStore, id: string, now: number): NoteResult;
  correctNote(s: NotesStore, id: string, e: EditInput, c: Consent, now: number): NoteResult;
  listNotes(s: NotesStore, o?: ListOptions): TopicView[];
  findInMessage(s: NotesStore, t: string): Mention[];
  dictionaryCandidate(s: NotesStore, id: string): { term: string; meaning: string } | null;
  serializeStore(s: NotesStore): string; parseStore(t: string): ParseResult;
}
