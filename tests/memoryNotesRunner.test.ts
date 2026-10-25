/**
 * B03B3d MEMORY NOTES: THE PROOF (Director, 2026-10-25). The builder reads this file and never changes it.
 * Run: node run.mjs tests/memoryNotesRunner.test.ts   -> must end with "MEMORY NOTES RUNNER OK".
 * Every store handed to the engine is DEEP-FROZEN, so a function that changes its input fails here.
 */
import * as E from '../src/brain/mind/memory/notes/notes';
import type { Consent, NotesStore, Note, NoteResult, ProposeInput } from '../src/brain/mind/memory/notes/notesTypes';

let checks = 0; const failures: string[] = [];
process.on('uncaughtException', (e) => { console.error(`MEMORY NOTES RUNNER STOPPED after ${checks} checks: ${String((e as Error)?.message ?? e)}`); for (const f of failures.slice(0, 40)) console.error(' - ' + f); process.exit(1); });
function ok(cond: unknown, label: string): void { checks += 1; if (!cond) failures.push(label); }
const J = (v: unknown): string => JSON.stringify(v);
function eq(a: unknown, b: unknown, label: string): void { checks += 1; if (J(a) !== J(b)) failures.push(`${label}\n   got      ${J(a)}\n   expected ${J(b)}`); }
function freeze<T>(v: T): T { if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) { Object.freeze(v); for (const k of Object.keys(v as object)) freeze((v as any)[k]); } return v; }
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }
const YES: Consent = { kind: 'yes', at: 200 };
const SAID: Consent = { kind: 'said-remember', at: 300 };
const src = (text = 'owner words', chat: string | null = 'c1') => ({ text, chat });
function inp(topic: string, kind: ProposeInput['kind'], text: string, extra: Partial<ProposeInput> = {}): ProposeInput { return { topic, kind, text, standalone: true, source: src(), ...extra }; }
function must(r: NoteResult, label: string): { store: NotesStore; note: Note; changed: boolean } { checks += 1; if (!r.ok) { failures.push(`${label}: refused (${r.reason})`); throw new Error('stop'); } return r; }
function refused(r: NoteResult, reason: string, label: string): void { checks += 1; if (r.ok || r.reason !== reason) failures.push(`${label}: expected refusal ${reason}, got ${J(r.ok ? 'ok' : r.reason)}`); }
let S: NotesStore = freeze(E.emptyStore());
function step(r: NoteResult, label: string): Note { const m = must(r, label); S = freeze(m.store); return m.note; }

/** The independent invariant checker: the store rules S1 to S9 of the job file. */
function invariants(s: NotesStore): string[] {
  const bad: string[] = []; const ids = new Set<string>(); let max = 0;
  if (s.version !== 1) bad.push('version');
  const keys = new Set<string>(); const used = new Set<string>();
  for (const t of s.topics) { if (!/^t[1-9][0-9]*$/.test(t.id) || ids.has(t.id)) bad.push(`topic id ${t.id}`); ids.add(t.id); max = Math.max(max, Number(t.id.slice(1))); if (t.key !== E.topicKey(t.name) || t.key === '') bad.push(`topic key ${t.id}`); if (keys.has(t.key)) bad.push(`topic key twice ${t.key}`); keys.add(t.key); }
  const seen = new Set<string>();
  for (const n of s.notes) {
    if (!/^n[1-9][0-9]*$/.test(n.id) || ids.has(n.id)) bad.push(`note id ${n.id}`); ids.add(n.id); max = Math.max(max, Number(n.id.slice(1)));
    const t = s.topics.find((x) => x.id === n.topic); if (!t) { bad.push(`note ${n.id} topic`); continue; } used.add(t.id);
    if (n.text === '' || n.text !== n.text.trim()) bad.push(`note ${n.id} text`);
    if (n.kind === 'meaning' ? (n.term === null || n.term === '' || n.term !== n.term.trim()) : n.term !== null) bad.push(`note ${n.id} term`);
    if ((n.state === 'proposed') !== (n.consent === null)) bad.push(`note ${n.id} consent`);
    const sig = [t.key, n.kind, E.topicKey(n.text), n.term === null ? '-' : E.topicKey(n.term)].join('|'); if (seen.has(sig)) bad.push(`note ${n.id} duplicate`); seen.add(sig);
  }
  if (s.nextId <= max) bad.push('nextId'); for (const t of s.topics) if (!used.has(t.id)) bad.push(`empty topic ${t.id}`);
  return bad;
}

// ---------- A. start, topic key ----------
eq(E.emptyStore(), { version: 1, nextId: 1, topics: [], notes: [] }, 'A1 empty store');
ok(E.emptyStore() !== E.emptyStore(), 'A2 a new store each time');
eq(E.topicKey('Felix'), 'felix', 'A3 key lower case');
eq(E.topicKey('  The   Felix\tApp\n'), 'the felix app', 'A4 key collapses white space and trims');
eq(E.topicKey('ÉCOLE'), 'école', 'A5 key lowers accented letters');
eq(E.topicKey('C++'), 'c++', 'A6 key keeps punctuation');
eq(E.topicKey('   '), '', 'A7 blank key');
eq(E.topicKey(5 as any), '', 'A8 key of a non-string');

// ---------- B. propose ----------
const n1 = step(E.proposeNote(S, inp('Felix', 'fact', '  uses React and Vite  '), 100), 'B1');
eq(n1, { id: 'n2', topic: 't1', kind: 'fact', text: 'uses React and Vite', term: null, state: 'proposed', source: { text: 'owner words', chat: 'c1' }, created: 100, changed: 100, consent: null, history: [] }, 'B1 the first note');
eq(S.topics, [{ id: 't1', name: 'Felix', key: 'felix', created: 100 }], 'B2 the topic is made');
eq(S.nextId, 3, 'B3 one counter for topics and notes');
const dupR = must(E.proposeNote(S, inp('  FELIX ', 'fact', 'USES   react AND vite'), 150), 'B4');
ok(!dupR.changed && dupR.note.id === 'n2' && J(dupR.store) === J(S), 'B4 the same note again changes nothing');
const n2 = step(E.proposeNote(S, inp('felix', 'fact', 'is a phone app'), 160), 'B5');
eq([n2.id, n2.topic, S.topics.length, S.topics[0]!.name], ['n3', 't1', 1, 'Felix'], 'B5 an existing topic is reused by its key and keeps its first spelling');
const n3 = step(E.proposeNote(S, inp('Felix', 'preference', 'uses React and Vite'), 170), 'B6');
ok(n3.id === 'n4' && n3.kind === 'preference', 'B6 the same words with another kind are another note');
const m1 = step(E.proposeNote(S, inp('Lunch run', 'meaning', 'go and buy food', { term: '  lunch run ' }), 180), 'B7');
eq([m1.term, m1.kind, m1.topic], ['lunch run', 'meaning', 't5'], 'B7 a meaning note keeps its trimmed term');
const m2 = step(E.proposeNote(S, inp('Lunch run', 'meaning', 'a jog at noon', { term: 'lunch run' }), 190), 'B8');
ok(m2.id === 'n7' && S.notes.length === 5, 'B8 one term can keep several meanings');
const dm = must(E.proposeNote(S, inp('lunch run', 'meaning', 'GO and BUY food', { term: 'LUNCH RUN' }), 195), 'B9');
ok(!dm.changed && dm.note.id === m1.id, 'B9 the same meaning again is a duplicate');
const nt = step(E.proposeNote(S, inp('Felix', 'fact', 'has a dark theme', { term: 'ignored' }), 200), 'B10');
ok(nt.term === null, 'B10 a term on a fact is ignored');
refused(E.proposeNote(S, inp('Felix', 'fact', 'x', { standalone: false }), 1), 'not-standalone', 'B11 an if-clause note is never proposed');
refused(E.proposeNote(S, inp('Felix', 'fact', 'x', { standalone: false, topic: '  ' }), 1), 'not-standalone', 'B12 not-standalone comes before the other refusals');
refused(E.proposeNote(S, inp('   ', 'fact', 'x'), 1), 'empty-topic', 'B13 empty topic');
refused(E.proposeNote(S, inp('Felix', 'fact', '   '), 1), 'empty-text', 'B14 empty text');
refused(E.proposeNote(S, inp('Felix', 'meaning', 'x'), 1), 'missing-term', 'B15 meaning without a term');
refused(E.proposeNote(S, inp('Felix', 'meaning', 'x', { term: '  ' }), 1), 'missing-term', 'B16 meaning with a blank term');
refused(E.proposeNote(S, inp('Felix', 'meaning', 'x', { term: null }), 1), 'missing-term', 'B17 meaning with a null term');
refused(E.proposeNote(S, inp('Felix', 'zzz' as any, 'x'), 1), 'bad-input', 'B18 unknown kind');
refused(E.proposeNote(S, inp(5 as any, 'fact', 'x'), 1), 'bad-input', 'B19 topic not a string');
refused(E.proposeNote(S, inp('Felix', 'fact', 'x'), Number.NaN), 'bad-input', 'B20 now not a number');
refused(E.proposeNote(S, null as any, 1), 'bad-input', 'B21 no input');
refused(E.proposeNote({} as any, inp('Felix', 'fact', 'x'), 1), 'bad-input', 'B22 bad store');
refused(E.proposeNote(S, { ...inp('Felix', 'fact', 'x'), source: null as any }, 1), 'bad-input', 'B23 no source');
refused(E.proposeNote(S, { ...inp('Felix', 'fact', 'x'), standalone: 'yes' as any }, 1), 'bad-input', 'B24 standalone not a boolean');
ok(invariants(S).length === 0, `B25 invariants after proposals: ${invariants(S).join(', ')}`);

// ---------- C. keep ----------
for (const [c, label] of [[undefined, 'none'], [{ kind: 'maybe', at: 1 }, 'unknown kind'], [{ kind: 'yes' }, 'no time'], [{ kind: 'yes', at: Number.NaN }, 'bad time'], ['yes', 'a string']] as const) refused(E.keepNote(S, 'n2', c as any, 210), 'no-consent', `C1 no consent (${label})`);
refused(E.keepNote(S, 'zzz', YES, 210), 'not-found', 'C2 unknown id');
refused(E.keepNote(S, 5 as any, YES, 210), 'bad-input', 'C3 id not a string');
const k1 = step(E.keepNote(S, 'n2', { kind: 'yes', at: 205, extra: 1 } as any, 210), 'C4');
eq([k1.state, k1.consent, k1.changed, k1.created], ['kept', { kind: 'yes', at: 205 }, 210, 100], 'C4 kept with a copy of the consent');
const again = must(E.keepNote(S, 'n2', SAID, 220), 'C5'); ok(!again.changed && J(again.store) === J(S) && again.note.consent!.kind === 'yes', 'C5 keeping a kept note changes nothing');
step(E.keepNote(S, 'n6', SAID, 230), 'C6'); step(E.keepNote(S, 'n3', SAID, 231), 'C6b');
ok(S.notes.find((n) => n.id === 'n6')!.consent!.kind === 'said-remember', 'C6 said-remember is accepted');
const sp = must(E.keepNote(S, 'n4', { kind: 'standing-permission', at: 5 }, 232), 'C7'); ok(sp.note.state === 'kept', 'C7 standing-permission is accepted');
ok(S.notes.find((n) => n.id === 'n4')!.state === 'proposed', 'C8 the input store still shows the note as proposed');

// ---------- D. discard ----------
let D = freeze(E.emptyStore()); D = freeze(must(E.proposeNote(D, inp('Solo', 'fact', 'one'), 1), 'D0').store);
const d1 = must(E.discardProposal(D, 'n2'), 'D1'); eq([d1.store.notes.length, d1.store.topics.length, d1.note.id, d1.changed], [0, 0, 'n2', true], 'D1 a discarded proposal and its empty topic vanish');
refused(E.discardProposal(S, 'n2'), 'wrong-state', 'D2 a kept note cannot be discarded');
refused(E.discardProposal(S, 'zzz'), 'not-found', 'D3 unknown id');
const d4 = must(E.discardProposal(S, 'n4'), 'D4'); ok(d4.store.topics.length === 2 && d4.store.notes.length === 5, 'D4 a topic that still has notes stays');
refused(E.discardProposal({} as any, 'n2'), 'bad-input', 'D5 bad store');

// ---------- E. remove and restore ----------
const r1 = step(E.removeNote(S, 'n2', 240), 'E1'); eq([r1.state, r1.changed, r1.consent], ['removed', 240, { kind: 'yes', at: 205 }], 'E1 removed keeps its consent');
eq(E.listNotes(S).flatMap((v) => v.notes.map((n) => n.id)), ['n3', 'n6'], 'E2 the default list shows kept notes only');
eq(E.listNotes(S, { states: ['removed'] }).flatMap((v) => v.notes.map((n) => n.id)), ['n2'], 'E3 removed notes can be listed');
const r2 = must(E.removeNote(S, 'n2', 250), 'E4'); ok(!r2.changed && J(r2.store) === J(S), 'E4 removing a removed note changes nothing');
refused(E.removeNote(S, 'n4', 250), 'wrong-state', 'E5 a proposed note cannot be removed');
refused(E.removeNote(S, 'zzz', 250), 'not-found', 'E6 unknown id');
refused(E.keepNote(S, 'n2', YES, 260), 'wrong-state', 'E7 a removed note is restored, not kept');
const r3 = step(E.restoreNote(S, 'n2', 270), 'E8'); eq([r3.state, r3.changed, r3.consent], ['kept', 270, { kind: 'yes', at: 205 }], 'E8 restored with the old consent');
const r4 = must(E.restoreNote(S, 'n2', 280), 'E9'); ok(!r4.changed && J(r4.store) === J(S), 'E9 restoring a kept note changes nothing');
refused(E.restoreNote(S, 'n4', 280), 'wrong-state', 'E10 a proposed note cannot be restored');
refused(E.restoreNote(S, 'zzz', 280), 'not-found', 'E11 unknown id');
refused(E.removeNote(S, 'n2', 'x' as any), 'bad-input', 'E12 now not a number');

// ---------- F. correct ----------
refused(E.correctNote(S, 'n2', { text: 'new' }, undefined as any, 300), 'no-consent', 'F1 a correction needs consent');
refused(E.correctNote(S, 'n4', { text: 'new' }, YES, 300), 'wrong-state', 'F2 a proposed note cannot be corrected');
refused(E.correctNote(S, 'zzz', { text: 'new' }, YES, 300), 'not-found', 'F3 unknown id');
refused(E.correctNote(S, 'n2', { text: 5 as any }, YES, 300), 'bad-input', 'F4 text not a string');
refused(E.correctNote(S, 'n2', null as any, YES, 300), 'bad-input', 'F5 no edit');
refused(E.correctNote(S, 'n2', { text: '  ' }, YES, 300), 'empty-text', 'F6 empty text');
refused(E.correctNote(S, 'n6', { term: '  ' }, YES, 300), 'missing-term', 'F7 a meaning note must keep a term');
refused(E.correctNote(S, 'n6', { term: null }, YES, 300), 'missing-term', 'F8 a null term is refused too');
refused(E.correctNote(S, 'n2', { topic: ' ' }, YES, 300), 'empty-topic', 'F9 empty topic');
const same1 = must(E.correctNote(S, 'n2', { text: ' uses React and Vite ', topic: 'FELIX' }, YES, 300), 'F10'); ok(!same1.changed && J(same1.store) === J(S), 'F10 a correction that changes nothing changes nothing');
const c1 = step(E.correctNote(S, 'n2', { text: 'uses React, Vite and Capacitor' }, SAID, 310), 'F11');
eq([c1.text, c1.changed, c1.created, c1.consent, c1.history], ['uses React, Vite and Capacitor', 310, 100, { kind: 'said-remember', at: 300 }, [{ text: 'uses React and Vite', term: null, topic: 't1', changed: 270 }]], 'F11 text corrected, old version in the history, new consent');
const c2 = step(E.correctNote(S, 'n6', { text: 'go out and buy lunch', term: 'lunch-run' }, YES, 320), 'F12');
eq([c2.term, c2.text, c2.history.length], ['lunch-run', 'go out and buy lunch', 1], 'F12 a meaning note can change term and text');
const c3 = step(E.correctNote(S, 'n2', { term: 'ignored' , text: 'uses React, Vite and Capacitor'}, YES, 330), 'F13'); ok(c3.term === null && c3.history.length === 1, 'F13 a term edit on a fact is ignored (nothing else changed)');
const c4 = step(E.correctNote(S, 'n2', { topic: 'Liquid' }, YES, 340), 'F14');
const liq = S.topics.find((t) => t.name === 'Liquid');
ok(!!liq && liq.key === 'liquid' && liq.created === 340 && c4.topic === liq.id && S.topics.some((t) => t.id === 't1') && c4.history.length === 2 && c4.history[1]!.topic === 't1', 'F14 moving to a new topic makes it; the old topic stays while it has notes');
const c5 = step(E.correctNote(S, 'n3', { topic: ' liquid ' }, YES, 350), 'F15');
ok(!!liq && c5.topic === liq.id, 'F15 moving to an existing topic by its key');
let F = freeze(E.emptyStore()); { const a1 = must(E.proposeNote(F, inp('Solo', 'fact', 'lonely note'), 1), 'F16a'); const k2 = must(E.keepNote(a1.store, a1.note.id, YES, 2), 'F16b'); F = freeze(k2.store); const mv = must(E.correctNote(F, a1.note.id, { topic: 'Other' }, YES, 3), 'F16c'); eq(mv.store.topics.map((t) => t.name), ['Other'], 'F16 a topic left empty by a move is deleted'); }
refused(E.correctNote(S, 'n3', { text: 'uses React, Vite and Capacitor' }, YES, 360), 'duplicate', 'F17 a correction that would copy another note is refused');
ok(invariants(S).length === 0, `F18 invariants: ${invariants(S).join(', ')}`);

// ---------- G. list ----------
let G = freeze(E.emptyStore());
const gadd = (t: string, k: ProposeInput['kind'], text: string, at: number, term?: string) => { const n = must(E.proposeNote(G, inp(t, k, text, term ? { term } : {}), at), 'G add'); G = freeze(must(E.keepNote(n.store, n.note.id, YES, at + 1), 'G keep').store); return n.note.id; };
const gz = gadd('Zeta', 'fact', 'z one', 50); const ga = gadd('alpha', 'fact', 'a one', 40); const gb = gadd('Beta', 'fact', 'b one', 30); const ga2 = gadd('ALPHA', 'fact', 'a two', 10); const gb2 = gadd('Beta', 'fact', 'b two', 30);
eq(E.listNotes(G).map((v) => [v.topic.key, v.notes.map((n) => n.id)]), [['alpha', [ga2, ga]], ['beta', [gb, gb2]], ['zeta', [gz]]], 'G1 topics by key, notes by created time then id');
const gp = must(E.proposeNote(G, inp('Omega', 'fact', 'pending'), 90), 'G2'); G = freeze(gp.store);
eq(E.listNotes(G).map((v) => v.topic.key), ['alpha', 'beta', 'zeta'], 'G2 a topic with only proposals is not listed by default');
eq(E.listNotes(G, { states: ['proposed', 'kept'] }).map((v) => v.topic.key), ['alpha', 'beta', 'omega', 'zeta'], 'G3 states choose what is listed');
eq(E.listNotes(G, { states: ['proposed'] }).map((v) => v.topic.key), ['omega'], 'G4 only proposals');
eq(E.listNotes(G, { states: ['nope'] as any }), [], 'G5 unknown state gives an empty list');
eq(E.listNotes(G, { states: [] }), [], 'G6 no states gives an empty list');
eq(E.listNotes(E.emptyStore()), [], 'G7 empty store');
eq(E.listNotes(null as any), [], 'G8 bad store');

// ---------- H. find in a message ----------
let H = freeze(E.emptyStore());
const hadd = (t: string, k: ProposeInput['kind'], text: string, at: number, term?: string, keep = true) => { const n = must(E.proposeNote(H, inp(t, k, text, term ? { term } : {}), at), 'H add'); H = freeze(n.store); if (keep) H = freeze(must(E.keepNote(H, n.note.id, YES, at + 1), 'H keep').store); return n.note.id; };
const hf = hadd('Felix', 'fact', 'a phone app', 1); const hl = hadd('Liquid', 'fact', 'old name', 2); const hla = hadd('Liquid app', 'fact', 'the new app', 3);
const hw = hadd('Words', 'meaning', 'go and buy food', 4, 'lunch run'); const hw2 = hadd('Slang', 'meaning', 'a jog', 5, 'Lunch Run');
const hs = hadd('Secret', 'fact', 'proposed only', 6, undefined, false); const hr = hadd('Gone', 'fact', 'removed soon', 7); H = freeze(must(E.removeNote(H, hr, 8), 'H rm').store);
const hse = hadd('Serendipity', 'fact', 'a happy accident', 9); const hse2 = hadd('Words', 'meaning', 'luck by chance', 10, 'serendipity');
const hv = hadd('v2', 'fact', 'version two', 11); const hec = hadd('École', 'fact', 'school', 12);
const M = (t: string) => E.findInMessage(H, t);
eq(M('Open Felix please'), [{ start: 5, end: 10, text: 'Felix', topic: 't1', via: 'topic', notes: [hf] }], 'H1 a kept topic is found');
eq(M('  felix').map((m) => [m.start, m.end]), [[2, 7]], 'H2 leading white space and lower case');
eq(M('FELIX felix').map((m) => [m.start, m.end]), [[0, 5], [6, 11]], 'H3 every occurrence');
eq(M('felixes and prefelix'), [], 'H4 inside a longer word is not a mention');
eq(M("Felix's colours").map((m) => m.text), ['Felix'], 'H5 an apostrophe ends the word');
eq(M('the Liquid   app is ready').map((m) => [m.text, m.via, m.notes]), [['Liquid   app', 'topic', [hla]]], 'H6 the longest name wins and white space runs match one space');
eq(M('Liquid is old').map((m) => m.notes), [[hl]], 'H7 the shorter name is found when alone');
const lr = M('do the lunch run now'); eq(lr.map((m) => [m.text, m.via, m.topic, m.notes]), [['lunch run', 'term', H.notes.find((n) => n.id === hw)!.topic, [hw, hw2]]], 'H8 a taught term is found; every kept meaning is listed (first note decides the topic)');
eq(M('Secret and Gone'), [], 'H9 proposed and removed notes are never found');
eq(M('what is serendipity?').map((m) => [m.via, m.topic, m.notes]), [['topic', H.notes.find((n) => n.id === hse)!.topic, [hse, hse2]]], 'H10 a name that is also a term gives one mention with all its notes');
eq(M('v22 xv2 v2.').map((m) => [m.start, m.end]), [[8, 10]], 'H11 digits count as word characters');
eq(M("va à l'ÉCOLE!").map((m) => [m.start, m.end, m.text]), [[7, 12, 'ÉCOLE']], 'H12 accented capitals match');
eq(M('felix, lunch run, Liquid').map((m) => m.start), [0, 7, 18], 'H13 mentions come in message order');
eq(M(''), [], 'H14 empty message'); eq(E.findInMessage(H, 5 as any), [], 'H15 non-string message'); eq(E.findInMessage(null as any, 'felix'), [], 'H16 bad store');
const H2 = must(E.removeNote(H, hf, 40), 'H17').store; eq(E.findInMessage(H2, 'Felix').length, 0, 'H17 a removed note stops being found');
void hs; void hv; void hec;

// ---------- I. dictionary candidate (a look, never a write) ----------
const Ic = freeze(clone(H)) as NotesStore;
eq(E.dictionaryCandidate(Ic, hw), { term: 'lunch run', meaning: 'go and buy food' }, 'I1 a kept meaning note can be offered to My Dictionary');
eq(E.dictionaryCandidate(Ic, hf), null, 'I2 a fact is not a dictionary entry');
eq(E.dictionaryCandidate(Ic, hs), null, 'I3 a proposal is not');
eq(E.dictionaryCandidate(Ic, hr), null, 'I4 a removed note is not');
eq(E.dictionaryCandidate(Ic, 'zzz'), null, 'I5 unknown id'); eq(E.dictionaryCandidate({} as any, hw), null, 'I6 bad store');
ok(J(Ic) === J(H), 'I7 nothing changed');

// ---------- J. save and load ----------
const text = E.serializeStore(S);
ok(typeof text === 'string' && text.startsWith('{"version":1,"nextId":'), 'J1 starts with the version and the counter');
ok(!!liq && text.includes(`{"id":"${liq.id}","name":"Liquid","key":"liquid","created":340}`), 'J2 fixed key order inside a topic');
const back = E.parseStore(text); ok(back.ok, 'J3 parses what it wrote'); if (back.ok) { eq(back.store, S, 'J3 the same store comes back'); ok(E.serializeStore(back.store) === text, 'J4 text, store, text is stable'); }
const empty = E.parseStore(E.serializeStore(E.emptyStore())); ok(empty.ok && J(empty.store) === J(E.emptyStore()), 'J5 an empty store round-trips');
ok(E.serializeStore({} as any) === '', 'J6 serializing a bad store gives an empty string');
for (const t of ['', 'nope', '{"version":', undefined as any, 5 as any]) { const p = E.parseStore(t); ok(!p.ok && p.reason === 'bad-text', `J7 not JSON: ${String(t)}`); }
for (const t of ['[]', '5', 'null', '{}', '{"version":2,"nextId":1,"topics":[],"notes":[]}']) { const p = E.parseStore(t); ok(!p.ok && p.reason === 'bad-store', `J8 not a store: ${t}`); }
function mutate(label: string, f: (o: any) => void): void { const o = JSON.parse(text); f(o); const p = E.parseStore(JSON.stringify(o)); ok(!p.ok && p.reason === 'bad-store', `J9 rejects: ${label}`); }
mutate('nextId too small', (o) => { o.nextId = 3; }); mutate('nextId not an integer', (o) => { o.nextId = 2.5; });
mutate('twice the same note id', (o) => { o.notes[1].id = o.notes[0].id; }); mutate('a note id equal to a topic id', (o) => { o.notes[0].id = 't1'; });
mutate('note topic missing', (o) => { o.notes[0].topic = 't99'; }); mutate('unknown kind', (o) => { o.notes[0].kind = 'idea'; });
mutate('unknown state', (o) => { o.notes[0].state = 'lost'; }); mutate('kept note without consent', (o) => { const n = o.notes.find((x: any) => x.state === 'kept'); n.consent = null; });
mutate('consent kind unknown', (o) => { const n = o.notes.find((x: any) => x.state === 'kept'); n.consent.kind = 'maybe'; });
mutate('proposed note with consent', (o) => { const n = o.notes.find((x: any) => x.state === 'proposed'); n.consent = { kind: 'yes', at: 1 }; });
mutate('meaning without term', (o) => { const n = o.notes.find((x: any) => x.kind === 'meaning'); n.term = null; });
mutate('fact with a term', (o) => { const n = o.notes.find((x: any) => x.kind === 'fact'); n.term = 'x'; });
mutate('text with outer space', (o) => { o.notes[0].text = ` ${o.notes[0].text}`; }); mutate('empty text', (o) => { o.notes[0].text = ''; });
mutate('topic key does not match its name', (o) => { o.topics[0].key = 'other'; }); mutate('two topics with one key', (o) => { o.topics[1].key = o.topics[0].key; o.topics[1].name = o.topics[0].name; });
mutate('a topic without notes', (o) => { o.topics.push({ id: 't50', name: 'Lonely', key: 'lonely', created: 1 }); o.nextId = 99; });
mutate('a duplicate note', (o) => { const c = JSON.parse(JSON.stringify(o.notes[0])); c.id = 'n77'; o.notes.push(c); o.nextId = 99; });
mutate('history entry malformed', (o) => { o.notes[0].history = [{ text: 5 }]; }); mutate('created not a number', (o) => { o.notes[0].created = 'x'; });
mutate('source missing', (o) => { delete o.notes[0].source; }); mutate('notes not an array', (o) => { o.notes = {}; });

// ---------- K. never throws, never changes its input ----------
const junk: unknown[] = [undefined, null, 5, 'x', [], {}, { version: 1 }, () => 1];
let threw = '';
for (const a of junk) for (const b of junk) {
  const calls: Array<[string, () => unknown]> = [['proposeNote', () => E.proposeNote(a as any, b as any, 1)], ['keepNote', () => E.keepNote(a as any, b as any, b as any, 1)], ['discardProposal', () => E.discardProposal(a as any, b as any)], ['removeNote', () => E.removeNote(a as any, b as any, 1)], ['restoreNote', () => E.restoreNote(a as any, b as any, 1)], ['correctNote', () => E.correctNote(a as any, b as any, a as any, b as any, 1)], ['listNotes', () => E.listNotes(a as any, b as any)], ['findInMessage', () => E.findInMessage(a as any, b as any)], ['dictionaryCandidate', () => E.dictionaryCandidate(a as any, b as any)], ['serializeStore', () => E.serializeStore(a as any)], ['parseStore', () => E.parseStore(b as any)], ['topicKey', () => E.topicKey(a as any)]];
  for (const [name, f] of calls) { try { f(); } catch { threw = threw || name; } }
}
ok(threw === '', `K1 no function throws on junk (${threw})`);
refused(E.keepNote({} as any, 'n2', YES, 1), 'bad-input', 'K2 keep with a bad store'); refused(E.removeNote({} as any, 'n2', 1), 'bad-input', 'K3 remove with a bad store');

// ---------- L. random life of a store: invariants after every step ----------
function rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let randomSteps = 0; let randomRefusals = 0;
for (const seed of [1, 2, 3, 4]) {
  const r = rng(seed); let st: NotesStore = freeze(E.emptyStore()); const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
  const tops = ['Felix', 'felix ', 'Liquid', ' LIQUID  app', 'serendipity', 'Words']; const texts = ['one', 'One ', 'two', 'three words here', 'ONE  '];
  for (let i = 0; i < 400; i++) {
    const ids = st.notes.map((n) => n.id); const id = ids.length && r() < 0.9 ? pick(ids) : 'n999'; const now = 1000 + i; const op = Math.floor(r() * 7); let res: NoteResult;
    const before = J(st);
    if (op <= 1) { const kind = pick(['meaning', 'fact', 'preference', 'correction'] as const); res = E.proposeNote(st, inp(pick(tops), kind, pick(texts), kind === 'meaning' ? { term: pick(['lunch run', 'Lunch  Run', 'serendipity']) } : {}), now); }
    else if (op === 2) res = E.keepNote(st, id, r() < 0.8 ? { kind: pick(['yes', 'said-remember', 'standing-permission'] as const), at: now } : ({ kind: 'x' } as any), now);
    else if (op === 3) res = E.discardProposal(st, id);
    else if (op === 4) res = r() < 0.6 ? E.removeNote(st, id, now) : E.restoreNote(st, id, now);
    else res = E.correctNote(st, id, r() < 0.5 ? { text: pick(texts) } : r() < 0.5 ? { topic: pick(tops) } : { text: pick(texts), term: pick(['lunch run', 'x y']), topic: pick(tops) }, YES, now);
    randomSteps += 1;
    if (res.ok) { if (!res.changed) ok(J(res.store) === before, `L1 seed ${seed} step ${i}: unchanged result equals the input`); st = freeze(res.store); } else randomRefusals += 1;
    ok(J(st) === before || res.ok, `L2 seed ${seed} step ${i}: a refusal leaves the store as it was`);
    const bad = invariants(st); if (bad.length) { failures.push(`L3 seed ${seed} step ${i}: ${bad.join(', ')}`); break; }
    if (i % 100 === 99) { const p = E.parseStore(E.serializeStore(st)); ok(p.ok && J(p.store) === J(st), `L4 seed ${seed} step ${i}: save and load`); }
  }
}
ok(randomSteps === 1600 && randomRefusals > 100 && randomRefusals < 1500, `L5 the random life was lively (${randomRefusals} refusals)`);

// ---------- M. speed ----------
let t0 = Date.now(); let big: NotesStore = E.emptyStore();
for (let i = 0; i < 1500; i++) { const r2 = E.proposeNote(big, inp(`Topic ${i % 300}`, i % 3 === 0 ? 'meaning' : 'fact', `note number ${i}`, i % 3 === 0 ? { term: `term ${i}` } : {}), i); if (!r2.ok) { failures.push('M0 proposal refused'); break; } big = r2.store; const k = E.keepNote(big, r2.note.id, YES, i); if (k.ok) big = k.store; }
ok(Date.now() - t0 < 4000, `M1 1,500 proposals and keeps under 4 s (${Date.now() - t0} ms)`);
t0 = Date.now(); const lv = E.listNotes(big); ok(lv.length === 300 && Date.now() - t0 < 500, `M2 list 1,500 notes under 0.5 s (${Date.now() - t0} ms)`);
t0 = Date.now(); const sx = E.serializeStore(big); const px = E.parseStore(sx); ok(px.ok && Date.now() - t0 < 1000, `M3 save and load 1,500 notes under 1 s (${Date.now() - t0} ms)`);
const longText = ('some words about topic 7 and term 300 here ').repeat(1700).slice(0, 70000);
t0 = Date.now(); const fm = E.findInMessage(big, longText); ok(fm.length > 1000 && Date.now() - t0 < 1500, `M4 search a 70,000-character message under 1.5 s (${fm.length} mentions, ${Date.now() - t0} ms)`);

if (failures.length) { console.error(`MEMORY NOTES RUNNER: ${failures.length} of ${checks} checks FAILED`); for (const f of failures.slice(0, 40)) console.error(' - ' + f); process.exit(1); }
console.log(`MEMORY NOTES RUNNER OK (${checks} checks)`);
