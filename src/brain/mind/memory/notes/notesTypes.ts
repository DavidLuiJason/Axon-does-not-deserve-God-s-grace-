/**
 * B03B3d MEMORY NOTES: the CONTRACT. Written by the Director (2026-10-25). The builder reads it and never changes it.
 *
 * WHAT A MEMORY NOTE IS (owner, 2026-10-25): AXON's own visible memory, ORGANISED BY TOPIC. A topic is whatever the notes are
 * about: an app ("Felix"), a word, a person, a project, anything. Under a topic AXON keeps notes: what a word means, a fact, a
 * preference, a correction. It is NOT a list of word pairs. Everything here is pure data in, new data out (no clock, no storage,
 * no dictionary, no screen): the caller gives `now`, saves the text, and shows the list.
 *
 * SAFETY (owner, confirmed): a note becomes KEPT only with a recorded consent of the owner; a note that depends on an "if" clause
 * is never even proposed; nothing here writes to the core dictionary or My Dictionary (`dictionaryCandidate` only LOOKS).
 */

/** The closed LABELS of the data format (not vocabulary: nothing is matched against what the owner says). One string each. */
export const NOTE_KIND_LABELS = 'meaning fact preference correction';
export const NOTE_STATE_LABELS = 'proposed kept removed';
export const CONSENT_KIND_LABELS = 'said-remember yes standing-permission';

export type NoteKind = 'meaning' | 'fact' | 'preference' | 'correction';
export type NoteState = 'proposed' | 'kept' | 'removed';
/** said-remember: the owner's own words asked AXON to remember it. yes: the owner approved a proposal. standing-permission: a rule the owner approved earlier. */
export type ConsentKind = 'said-remember' | 'yes' | 'standing-permission';

export interface Consent { readonly kind: ConsentKind; readonly at: number }
/** The owner's own words the note came from (kept so the owner can see WHY AXON remembers it), and the chat they were said in. */
export interface NoteSource { readonly text: string; readonly chat: string | null }
/** What a note said before a correction or a move. `topic` is a topic ID. */
export interface NoteVersion { readonly text: string; readonly term: string | null; readonly topic: string; readonly changed: number }

export interface Topic { readonly id: string; readonly name: string; readonly key: string; readonly created: number }
export interface Note {
  readonly id: string;
  /** A topic ID that exists in the store. */
  readonly topic: string;
  readonly kind: NoteKind;
  /** What AXON remembers, trimmed. For a 'meaning' note: what `term` stands for. */
  readonly text: string;
  /** Only a 'meaning' note has a term (the word or phrase being taught, trimmed); every other kind has null. */
  readonly term: string | null;
  readonly state: NoteState;
  readonly source: NoteSource;
  readonly created: number;
  readonly changed: number;
  /** null while 'proposed'; set when kept; stays set when removed. */
  readonly consent: Consent | null;
  /** Oldest first. Each correction or move appends the version it replaced. */
  readonly history: readonly NoteVersion[];
}
/** `nextId` is ONE counter for topics and notes: topics get `t<N>`, notes get `n<N>`, N = nextId at creation, then nextId + 1. */
export interface NotesStore { readonly version: 1; readonly nextId: number; readonly topics: readonly Topic[]; readonly notes: readonly Note[] }

export type Refusal =
  | 'bad-input' | 'not-standalone' | 'empty-topic' | 'empty-text' | 'missing-term'
  | 'no-consent' | 'not-found' | 'wrong-state' | 'duplicate';
/** `changed` is false when nothing needed changing (the same note already existed, or it was already in that state); the store is then equal to the input. */
export type NoteResult = { readonly ok: true; readonly store: NotesStore; readonly note: Note; readonly changed: boolean } | { readonly ok: false; readonly reason: Refusal };

export interface ProposeInput {
  /** The topic as the owner said it ("Felix"). */
  readonly topic: string;
  readonly kind: NoteKind;
  readonly text: string;
  /** Needed for kind 'meaning'; ignored (stored as null) for every other kind. */
  readonly term?: string | null;
  /** false when the words belong to an "if" clause or a reason clause (B03B3b `standalone`): such a note is never proposed. */
  readonly standalone: boolean;
  readonly source: NoteSource;
}
/** Fields to change on a KEPT note. A missing field stays as it is. `topic` moves the note to another topic (made if new). */
export interface EditInput { readonly text?: string; readonly term?: string | null; readonly topic?: string }

export interface TopicView { readonly topic: Topic; readonly notes: readonly Note[] }
export interface ListOptions { readonly states?: readonly NoteState[] }
/** A kept topic name or a kept meaning term found inside a message. `start`/`end` are character positions in the ORIGINAL message and `text` is that slice. */
export interface Mention { readonly start: number; readonly end: number; readonly text: string; readonly topic: string; readonly via: 'topic' | 'term'; readonly notes: readonly string[] }
export type ParseResult = { readonly ok: true; readonly store: NotesStore } | { readonly ok: false; readonly reason: 'bad-text' | 'bad-store' };

/** The functions `notes.ts` must export, with exactly these names and shapes. */
export interface NotesApi {
  emptyStore(): NotesStore;
  topicKey(name: string): string;
  proposeNote(store: NotesStore, input: ProposeInput, now: number): NoteResult;
  keepNote(store: NotesStore, id: string, consent: Consent, now: number): NoteResult;
  discardProposal(store: NotesStore, id: string): NoteResult;
  removeNote(store: NotesStore, id: string, now: number): NoteResult;
  restoreNote(store: NotesStore, id: string, now: number): NoteResult;
  correctNote(store: NotesStore, id: string, edit: EditInput, consent: Consent, now: number): NoteResult;
  listNotes(store: NotesStore, options?: ListOptions): TopicView[];
  findInMessage(store: NotesStore, text: string): Mention[];
  dictionaryCandidate(store: NotesStore, id: string): { readonly term: string; readonly meaning: string } | null;
  serializeStore(store: NotesStore): string;
  parseStore(text: string): ParseResult;
}
