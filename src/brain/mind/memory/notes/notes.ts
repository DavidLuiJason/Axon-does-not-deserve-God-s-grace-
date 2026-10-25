import { NOTE_KIND_LABELS, NOTE_STATE_LABELS, CONSENT_KIND_LABELS } from './notesTypes';
import type { Consent, EditInput, ListOptions, Mention, Note, NoteKind, NoteResult, NotesStore, NoteState, NoteVersion, ProposeInput, Topic, TopicView, ParseResult, Refusal } from './notesTypes';

const kinds = NOTE_KIND_LABELS.split(' ');
const states = NOTE_STATE_LABELS.split(' ');
const consents = CONSENT_KIND_LABELS.split(' ');
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const object = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
function goodStore(s: any): s is NotesStore { return object(s) && s.version === 1 && Number.isInteger(s.nextId) && s.nextId >= 1 && Array.isArray(s.topics) && Array.isArray(s.notes); }
function validConsent(c: any): c is Consent { return object(c) && consents.includes(c.kind) && finite(c.at); }
function copyConsent(c: Consent): Consent { return { kind: c.kind, at: c.at }; }
function result(note: Note, store: NotesStore, changed: boolean): NoteResult { return { ok: true, store, note, changed }; }
function refuse(reason: Refusal): NoteResult { return { ok: false, reason }; }
function collapse(s: string): string { let out = ''; let inSpace = false; for (let i = 0; i < s.length; i++) { const c = s.charAt(i); if (c.trim() === '') { if (out.length) inSpace = true; } else { if (inSpace) out += ' '; out += c; inSpace = false; } } return out; }
export function topicKey(name: string): string { if (typeof name !== 'string') return ''; const s = collapse(name); let out = ''; for (let i = 0; i < s.length; i++) { const unit = s.charAt(i); const lower = unit.toLowerCase(); out += lower.length === 1 ? lower : unit; } return out; }
export function emptyStore(): NotesStore { return { version: 1, nextId: 1, topics: [], notes: [] }; }
function topicByKey(s: NotesStore, key: string): Topic | undefined { return s.topics.find(t => t.key === key); }
function numericId(id: string): number { let n = 0; for (let i = 1; i < id.length; i++) { const d = id.charCodeAt(i) - 48; if (d < 0 || d > 9) return Number.MAX_SAFE_INTEGER; n = n * 10 + d; } return n; }
function newTopic(s: NotesStore, name: string, now: number): { store: NotesStore; topic: Topic } { const clean = collapse(name); const topic: Topic = { id: `t${s.nextId}`, name: clean, key: topicKey(clean), created: now }; return { store: { version: 1, nextId: s.nextId + 1, topics: [...s.topics, topic], notes: [...s.notes] }, topic }; }
function sourceValid(v: any): boolean { return object(v) && typeof v.text === 'string' && (typeof v.chat === 'string' || v.chat === null); }
export function proposeNote(store: NotesStore, input: ProposeInput, now: number): NoteResult {
  if (!goodStore(store) || !finite(now) || !object(input) || typeof input.topic !== 'string' || typeof input.text !== 'string' || !kinds.includes(input.kind) || typeof input.standalone !== 'boolean' || !sourceValid(input.source)) return refuse('bad-input');
  if (!input.standalone) return refuse('not-standalone');
  const key = topicKey(input.topic); if (!key) return refuse('empty-topic');
  const text = input.text.trim(); if (!text) return refuse('empty-text');
  if (input.kind === 'meaning' && (typeof input.term !== 'string' || !input.term.trim())) return refuse('missing-term');
  const term = input.kind === 'meaning' ? (input.term as string).trim() : null;
  const existingTopic = topicByKey(store, key);
  if (existingTopic) { const duplicate = store.notes.find(n => n.topic === existingTopic.id && n.kind === input.kind && topicKey(n.text) === topicKey(text) && topicKey(n.term ?? '') === topicKey(term ?? '')); if (duplicate) return result(duplicate, store, false); }
  let next = store; let topic = existingTopic;
  if (!topic) { const made = newTopic(store, input.topic, now); next = made.store; topic = made.topic; }
  const note: Note = { id: `n${next.nextId}`, topic: topic.id, kind: input.kind, text, term, state: 'proposed', source: { text: input.source.text, chat: input.source.chat }, created: now, changed: now, consent: null, history: [] };
  return result(note, { version: 1, nextId: next.nextId + 1, topics: [...next.topics], notes: [...next.notes, note] }, true);
}
function findNote(store: NotesStore, id: string): Note | undefined { return store.notes.find(n => n.id === id); }
function replaceNote(store: NotesStore, old: Note, fresh: Note, topics = store.topics): NotesStore { return { version: 1, nextId: store.nextId, topics: [...topics], notes: store.notes.map(n => n.id === old.id ? fresh : n) }; }
export function keepNote(store: NotesStore, id: string, consent: Consent, now: number): NoteResult {
  if (!goodStore(store) || typeof id !== 'string' || !finite(now)) return refuse('bad-input'); if (!validConsent(consent)) return refuse('no-consent');
  const note = findNote(store, id); if (!note) return refuse('not-found'); if (note.state === 'removed') return refuse('wrong-state'); if (note.state === 'kept') return result(note, store, false);
  const fresh: Note = { ...note, state: 'kept', consent: copyConsent(consent), changed: now }; return result(fresh, replaceNote(store, note, fresh), true);
}
export function discardProposal(store: NotesStore, id: string): NoteResult {
  if (!goodStore(store) || typeof id !== 'string') return refuse('bad-input'); const note = findNote(store, id); if (!note) return refuse('not-found'); if (note.state !== 'proposed') return refuse('wrong-state');
  const notes = store.notes.filter(n => n.id !== id); const topics = store.topics.filter(t => notes.some(n => n.topic === t.id)); return result(note, { version: 1, nextId: store.nextId, topics, notes }, true);
}
export function removeNote(store: NotesStore, id: string, now: number): NoteResult {
  if (!goodStore(store) || typeof id !== 'string' || !finite(now)) return refuse('bad-input'); const note = findNote(store, id); if (!note) return refuse('not-found'); if (note.state === 'proposed') return refuse('wrong-state'); if (note.state === 'removed') return result(note, store, false);
  const fresh: Note = { ...note, state: 'removed', changed: now }; return result(fresh, replaceNote(store, note, fresh), true);
}
export function restoreNote(store: NotesStore, id: string, now: number): NoteResult {
  if (!goodStore(store) || typeof id !== 'string' || !finite(now)) return refuse('bad-input'); const note = findNote(store, id); if (!note) return refuse('not-found'); if (note.state === 'proposed') return refuse('wrong-state'); if (note.state === 'kept') return result(note, store, false);
  const fresh: Note = { ...note, state: 'kept', changed: now }; return result(fresh, replaceNote(store, note, fresh), true);
}
export function correctNote(store: NotesStore, id: string, edit: EditInput, consent: Consent, now: number): NoteResult {
  if (!goodStore(store) || typeof id !== 'string' || !object(edit) || !finite(now) || ('text' in edit && typeof edit.text !== 'string') || ('topic' in edit && typeof edit.topic !== 'string') || ('term' in edit && edit.term !== null && typeof edit.term !== 'string')) return refuse('bad-input');
  if (!validConsent(consent)) return refuse('no-consent'); const note = findNote(store, id); if (!note) return refuse('not-found'); if (note.state !== 'kept') return refuse('wrong-state');
  if ('text' in edit && !(edit.text as string).trim()) return refuse('empty-text');
  if (note.kind === 'meaning' && 'term' in edit && (edit.term === null || !(edit.term as string).trim())) return refuse('missing-term');
  if ('topic' in edit && !topicKey(edit.topic as string)) return refuse('empty-topic');
  const text = 'text' in edit ? (edit.text as string).trim() : note.text;
  const term = note.kind === 'meaning' ? ('term' in edit ? (edit.term as string).trim() : note.term) : null;
  const oldTopic = store.topics.find(t => t.id === note.topic)!; const destinationKey = 'topic' in edit ? topicKey(edit.topic as string) : oldTopic.key;
  const destinationExisting = topicByKey(store, destinationKey);
  if (text === note.text && term === note.term && destinationKey === oldTopic.key) return result(note, store, false);
  const duplicate = store.notes.find(n => n.id !== id && n.kind === note.kind && n.topic !== '' && store.topics.some(t => t.id === n.topic && t.key === destinationKey) && topicKey(n.text) === topicKey(text) && topicKey(n.term ?? '') === topicKey(term ?? ''));
  if (duplicate) return refuse('duplicate');
  let topics = [...store.topics]; let topic = destinationExisting; let nextId = store.nextId;
  if (!topic) { topic = { id: `t${nextId}`, name: collapse(edit.topic as string), key: destinationKey, created: now }; topics.push(topic); nextId += 1; }
  const history: NoteVersion[] = [...note.history, { text: note.text, term: note.term, topic: note.topic, changed: note.changed }];
  const fresh: Note = { ...note, text, term, topic: topic.id, changed: now, consent: copyConsent(consent), history };
  const notes = store.notes.map(n => n.id === id ? fresh : n);
  if (note.topic !== topic.id && !notes.some(n => n.topic === note.topic)) topics = topics.filter(t => t.id !== note.topic);
  return result(fresh, { version: 1, nextId, topics, notes }, true);
}
function validStateList(options: any): NoteState[] | null { if (options === undefined) return ['kept']; if (!object(options)) return null; if (!('states' in options)) return ['kept']; if (!Array.isArray(options.states) || !options.states.every((s: unknown) => typeof s === 'string' && states.includes(s))) return null; return [...options.states] as NoteState[]; }
export function listNotes(store: NotesStore, options?: ListOptions): TopicView[] {
  if (!goodStore(store)) return []; const wanted = validStateList(options); if (!wanted) return []; const rank = (id: string) => numericId(id);
  const topics = [...store.topics].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : rank(a.id) - rank(b.id)); const out: TopicView[] = [];
  for (const topic of topics) { const notes = store.notes.filter(n => n.topic === topic.id && wanted.includes(n.state)).sort((a, b) => a.created - b.created || rank(a.id) - rank(b.id)); if (notes.length) out.push({ topic, notes }); } return out;
}
function isWord(c: string | undefined): boolean { if (c === undefined) return false; const code = c.charCodeAt(0); return (code >= 48 && code <= 57) || c.toLowerCase() !== c.toUpperCase(); }
function normalizedMap(text: string): { value: string; map: number[] } { let value = ''; const map: number[] = []; let pending = -1; for (let i = 0; i < text.length; i++) { const c = text.charAt(i); if (c.trim() === '') { if (value.length && pending < 0) pending = i; continue; } if (pending >= 0) { value += ' '; map.push(pending); pending = -1; } const lower = c.toLowerCase(); value += lower.length === 1 ? lower : c; map.push(i); } return { value, map }; }
export function findInMessage(store: NotesStore, text: string): Mention[] {
  if (!goodStore(store) || typeof text !== 'string' || !text.length) return [];
  const kept = store.notes.filter(n => n.state === 'kept'); if (!kept.length) return [];
  const byTopic = new Map<string, Note[]>(); const topicById = new Map<string, Topic>(); for (const t of store.topics) topicById.set(t.id, t);
  for (const n of kept) { const list = byTopic.get(n.topic) ?? []; list.push(n); byTopic.set(n.topic, list); }
  const candidates = new Map<string, { topic: Topic | undefined; via: 'topic' | 'term'; notes: Note[] }>();
  for (const t of store.topics) { if (byTopic.has(t.id) && t.key) candidates.set(t.key, { topic: t, via: 'topic', notes: [] }); }
  for (const n of kept) if (n.kind === 'meaning' && n.term !== null) { const key = topicKey(n.term); if (key && !candidates.has(key)) candidates.set(key, { topic: topicById.get(n.topic), via: 'term', notes: [] }); }
  for (const [key, c] of candidates) {
    const chosen: Note[] = []; const seen = new Set<string>();
    for (const n of kept) { const t = topicById.get(n.topic); if (t?.key === key && !seen.has(n.id)) { chosen.push(n); seen.add(n.id); } }
    for (const n of kept) if (n.kind === 'meaning' && n.term !== null && topicKey(n.term) === key && !seen.has(n.id)) { chosen.push(n); seen.add(n.id); }
    chosen.sort((a, b) => a.created - b.created || numericId(a.id) - numericId(b.id)); c.notes = chosen;
  }
  const sorted = [...candidates.entries()].sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const norm = normalizedMap(text); const taken = new Uint8Array(norm.value.length); const mentions: Mention[] = [];
  for (const [key, c] of sorted) { if (!key || !c.notes.length) continue; let from = 0; while (from <= norm.value.length - key.length) { const at = norm.value.indexOf(key, from); if (at < 0) break; const endAt = at + key.length; let valid = !isWord(at > 0 ? norm.value.charAt(at - 1) : undefined) && !isWord(endAt < norm.value.length ? norm.value.charAt(endAt) : undefined); if (valid) for (let j = at; j < endAt; j++) if (taken[j]) { valid = false; break; } if (valid) { for (let j = at; j < endAt; j++) taken[j] = 1; const start = norm.map[at]!; const end = norm.map[endAt - 1]! + 1; mentions.push({ start, end, text: text.slice(start, end), topic: (c.topic ?? topicById.get(c.notes[0]!.topic))!.id, via: c.via, notes: c.notes.map(n => n.id) }); from = endAt; } else from = at + 1; } }
  return mentions.sort((a, b) => a.start - b.start || a.end - b.end);
}
export function dictionaryCandidate(store: NotesStore, id: string): { term: string; meaning: string } | null { if (!goodStore(store) || typeof id !== 'string') return null; const n = findNote(store, id); return n && n.state === 'kept' && n.kind === 'meaning' && typeof n.term === 'string' ? { term: n.term, meaning: n.text } : null; }
export function serializeStore(store: NotesStore): string {
  if (!goodStore(store)) return '';
  const topics = store.topics.map(t => ({ id: t.id, name: t.name, key: t.key, created: t.created }));
  const notes = store.notes.map(n => ({ id: n.id, topic: n.topic, kind: n.kind, text: n.text, term: n.term, state: n.state, source: { text: n.source.text, chat: n.source.chat }, created: n.created, changed: n.changed, consent: n.consent === null ? null : { kind: n.consent.kind, at: n.consent.at }, history: n.history.map(h => ({ text: h.text, term: h.term, topic: h.topic, changed: h.changed })) }));
  return JSON.stringify({ version: store.version, nextId: store.nextId, topics, notes });
}
function validId(id: unknown, prefix: string): id is string { if (typeof id !== 'string' || id.length < 2 || id.charAt(0) !== prefix || id.charAt(1) < '1' || id.charAt(1) > '9') return false; for (let i = 2; i < id.length; i++) if (id.charAt(i) < '0' || id.charAt(i) > '9') return false; return true; }
function validTopic(t: any): t is Topic { return object(t) && validId(t.id, 't') && typeof t.name === 'string' && !!t.name && collapse(t.name) === t.name && topicKey(t.name) === t.key && typeof t.key === 'string' && !!t.key && finite(t.created); }
function validHistory(h: any): h is NoteVersion { return object(h) && typeof h.text === 'string' && (typeof h.term === 'string' || h.term === null) && typeof h.topic === 'string' && finite(h.changed); }
function validNote(n: any, topicIds: Set<string>): n is Note { return object(n) && validId(n.id, 'n') && topicIds.has(n.topic) && kinds.includes(n.kind) && typeof n.text === 'string' && !!n.text && n.text.trim() === n.text && states.includes(n.state) && (n.kind === 'meaning' ? typeof n.term === 'string' && !!n.term.trim() && n.term.trim() === n.term : n.term === null) && object(n.source) && typeof n.source.text === 'string' && (typeof n.source.chat === 'string' || n.source.chat === null) && finite(n.created) && finite(n.changed) && (n.state === 'proposed' ? n.consent === null : validConsent(n.consent)) && Array.isArray(n.history) && n.history.every(validHistory); }
export function parseStore(text: string): ParseResult {
  if (typeof text !== 'string') return { ok: false, reason: 'bad-text' }; let raw: any; try { raw = JSON.parse(text); } catch { return { ok: false, reason: 'bad-text' }; }
  if (!object(raw) || raw.version !== 1 || !Number.isInteger(raw.nextId) || raw.nextId < 1 || !Array.isArray(raw.topics) || !Array.isArray(raw.notes)) return { ok: false, reason: 'bad-store' };
  const topics: Topic[] = []; const topicIds = new Set<string>(); const topicKeys = new Set<string>(); let max = 0;
  for (const t of raw.topics) { if (!validTopic(t) || topicIds.has(t.id) || topicKeys.has(t.key)) return { ok: false, reason: 'bad-store' }; topics.push({ id: t.id, name: t.name, key: t.key, created: t.created }); topicIds.add(t.id); topicKeys.add(t.key); max = Math.max(max, numericId(t.id)); }
  const notes: Note[] = []; const allIds = new Set<string>(topicIds); const signatures = new Set<string>(); const usedTopics = new Set<string>();
  for (const n of raw.notes) {
    if (!validNote(n, topicIds) || allIds.has(n.id)) return { ok: false, reason: 'bad-store' }; allIds.add(n.id); max = Math.max(max, numericId(n.id)); usedTopics.add(n.topic);
    const topic = topics.find(t => t.id === n.topic)!; const sig = JSON.stringify([topic.key, n.kind, topicKey(n.text), n.term === null ? null : topicKey(n.term)]); if (signatures.has(sig)) return { ok: false, reason: 'bad-store' }; signatures.add(sig);
    notes.push({ id: n.id, topic: n.topic, kind: n.kind, text: n.text, term: n.term, state: n.state, source: { text: n.source.text, chat: n.source.chat }, created: n.created, changed: n.changed, consent: n.consent === null ? null : copyConsent(n.consent), history: n.history.map((h: any) => ({ text: h.text, term: h.term, topic: h.topic, changed: h.changed })) });
  }
  if (raw.nextId <= max || topics.some(t => !usedTopics.has(t.id))) return { ok: false, reason: 'bad-store' };
  return { ok: true, store: { version: 1, nextId: raw.nextId, topics, notes } };
}
