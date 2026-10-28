const assert = {
  deepEqual(a: unknown, b: unknown, message?: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${message ?? 'deepEqual'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); },
  ok(v: unknown, message?: string) { if (!v) throw new Error(message ?? 'assertion failed'); },
  fail(message?: string): never { throw new Error(message ?? 'assertion failed'); }
};
import type { Consent, Note, NoteKind, NotesStore, ProposeInput } from '../src/brain/mind/memory/notes/notesTypes';
import { emptyStore, proposeNote, keepNote, removeNote, restoreNote, topicKey, serializeStore } from '../src/brain/mind/memory/notes/notes';
import {
  CONTRADICTION_LIMITS, findConflicts, conflictQuestion, decide, replacedHistory, reminderLine,
  emptyReplacedLog, serializeReplacedLog, parseReplacedLog
} from '../src/brain/mind/memory/notes/contradiction';

let assertions = 0;
function eq(a: unknown, b: unknown, message?: string) { assertions++; assert.deepEqual(a, b, message); }
function ok(v: unknown, message?: string): asserts v { assertions++; assert.ok(v, message); }
const consent: Consent = { kind: 'yes', at: 50 };
const source = { text: 'owner said this', chat: 'chat-1' };
function input(topic: string, kind: NoteKind, text: string, term?: string): ProposeInput {
  return { topic, kind, text, ...(kind === 'meaning' ? { term } : {}), standalone: true, source };
}
function addKept(store: NotesStore, i: ProposeInput, now: number): NotesStore {
  const p = proposeNote(store, i, now); ok(p.ok);
  const k = keepNote(p.store, p.note.id, consent, now + 1); ok(k.ok);
  return k.store;
}
function naive(store: NotesStore, c: ProposeInput, judge?: (a: any, b: any) => any) {
  const p = proposeNote(store, c, 0);
  if (p.ok === false) return { ok: false, reason: p.reason };
  const t = store.topics.find(x => x.key === topicKey(c.topic));
  if (!t) return { ok: true, conflicts: [] };
  const out: { noteId: string; reason: string }[] = [];
  for (const n of store.notes) {
    if (n.state !== 'kept' || n.topic !== t.id || n.kind !== c.kind) continue;
    const et = topicKey(n.text), ct = topicKey(c.text.trim());
    const em = topicKey(n.term ?? ''), cm = topicKey(c.kind === 'meaning' && typeof c.term === 'string' ? c.term.trim() : '');
    if (et === ct && em === cm) continue;
    if (c.kind === 'meaning' && em === cm) { out.push({ noteId: n.id, reason: 'same-term-other-meaning' }); continue; }
    if (judge) {
      let v: any = 'unknown';
      try { v = judge({ kind: n.kind, text: n.text, term: n.term }, { kind: c.kind, text: c.text.trim(), term: c.kind === 'meaning' ? c.term!.trim() : null }); } catch { v = 'unknown'; }
      if (!['same', 'contradicts', 'unrelated', 'unknown'].includes(v)) v = 'unknown';
      if (v === 'contradicts') out.push({ noteId: n.id, reason: 'judged-contradiction' });
      else if (v === 'unknown') out.push({ noteId: n.id, reason: 'judge-unsure' });
    }
  }
  return { ok: true, conflicts: out };
}
let seed = 0x3eB03;
function rand(n: number) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; }
const topics = ['Felix', 'Project AXON', 'café ☕', '東京', 'emoji 🐈', 'Rivers'];
const words = ['likes tea', 'hates tea', 'lives here', 'does not live here', 'happy accident', 'happy accident', 'résumé 📄', '東京'];
const kinds: NoteKind[] = ['meaning', 'fact', 'preference', 'correction'];
const verdicts = ['same', 'contradicts', 'unrelated', 'unknown', undefined, 'broken'];
for (let run = 0; run < 300; run++) {
  let store = emptyStore();
  const count = rand(41), topicCount = 1 + rand(6);
  for (let i = 0; i < count; i++) {
    const kind = kinds[rand(kinds.length)]!;
    const term = 'term ' + rand(5) + (rand(4) === 0 ? ' 🐈' : '');
    const p = input(topics[rand(topicCount)]!, kind, words[rand(words.length)]!, term);
    const added = proposeNote(store, p, i + 1);
    if (added.ok === false) continue;
    store = added.store;
    if (rand(3) !== 0) { const kept = keepNote(store, added.note.id, consent, i + 2); if (kept.ok === true) store = kept.store; }
    if (rand(7) === 0) { const n = store.notes[store.notes.length - 1]; if (n?.state === 'kept') { const removed = removeNote(store, n.id, i + 3); if (removed.ok === true) store = removed.store; } }
  }
  const kind = kinds[rand(kinds.length)]!;
  const candidate = input(topics[rand(topicCount)]!, kind, words[rand(words.length)]!, 'term ' + rand(5));
  const pick = verdicts[rand(verdicts.length)];
  const fake = () => pick;
  eq(findConflicts(store, candidate, fake as any), naive(store, candidate, fake as any), `seeded differential ${run}`);
}
{
  let store = addKept(emptyStore(), input('Felix', 'meaning', 'a happy accident', 'serendipity'), 1);
  const c = input(' felix ', 'meaning', 'a pleasant surprise', 'Serendipity');
  const found = findConflicts(store, c);
  eq(found, { ok: true, conflicts: [{ noteId: store.notes[0]!.id, reason: 'same-term-other-meaning' }] });
  const question = conflictQuestion(store, found.ok ? found.conflicts[0]! : { noteId: '', reason: 'judge-unsure' }, n => `D${n}`);
  ok(question?.text.includes('a happy accident')); ok(question?.text.includes('serendipity')); ok(question?.text.includes('D2'));
  eq(question?.choices, ['replace', 'keep-both', 'cancel']);
  const old = store.notes[0]!;
  const beforeCancel = serializeStore(store), emptyLog = emptyReplacedLog(), logBytes = serializeReplacedLog(emptyLog);
  const cancelled = decide(store, emptyLog, c, old.id, 'cancel', null as any, 99, n => String(n));
  ok(cancelled.ok); if (cancelled.ok) { eq(serializeStore(cancelled.store), beforeCancel); eq(serializeReplacedLog(cancelled.log), logBytes); eq(cancelled.changed, false); eq(cancelled.note, null); }
  const noConsent = decide(store, emptyLog, c, old.id, 'replace', null as any, 99, n => String(n));
  eq(noConsent, { ok: false, reason: 'no-consent' });
  eq(serializeStore(store), beforeCancel); eq(serializeReplacedLog(emptyLog), logBytes);
  const replaced = decide(store, emptyLog, c, old.id, 'replace', consent, 99, n => `date-${n}`);
  ok(replaced.ok, 'replace succeeds');
  if (replaced.ok) {
    const oldAfter = replaced.store.notes.find(n => n.id === old.id)!;
    eq(oldAfter.state, 'removed'); eq(oldAfter.text, old.text); eq(oldAfter.term, old.term);
    eq(replaced.log.records.length, 1);
    eq(replaced.log.records[0]!.marker, '[replaced date-99 by what: a pleasant surprise]');
    ok(replaced.log.records[0]!.oldText === old.text && replaced.log.records[0]!.oldTerm === old.term);
    const restored = restoreNote(replaced.store, old.id, 101); ok(restored.ok && restored.note.state === 'kept');
    eq(replacedHistory(replaced.store, replaced.log)[0]!.canRestore, true);
    eq(replacedHistory(restored.ok ? restored.store : replaced.store, replaced.log)[0]!.canRestore, false);
    ok(reminderLine(replaced.log.records[0]!, () => 'ignored').includes(old.text));
    const serialized = serializeReplacedLog(replaced.log), parsed = parseReplacedLog(serialized);
    ok(parsed.ok); if (parsed.ok) eq(parsed.log, replaced.log);
    eq(parseReplacedLog('{'), { ok: false, reason: 'bad-text' });
    eq(parseReplacedLog('x'.repeat(CONTRADICTION_LIMITS.maxLogChars + 1)), { ok: false, reason: 'bad-text' });
    const dupe = { version: 1, records: [replaced.log.records[0], replaced.log.records[0]] };
    eq(parseReplacedLog(JSON.stringify(dupe)), { ok: false, reason: 'bad-log' });
  }
  const duplicate = decide(store, emptyLog, input('Felix', 'meaning', 'a happy accident', 'serendipity'), old.id, 'replace', consent, 102, n => String(n));
  eq(duplicate, { ok: false, reason: 'duplicate' }); eq(serializeStore(store), beforeCancel);
  const both = decide(store, emptyLog, input('Felix', 'meaning', 'another meaning', 'serendipity'), old.id, 'keep-both', consent, 103, n => String(n));
  ok(both.ok); if (both.ok) { eq(both.store.notes.filter(n => n.state === 'kept').length, 2); eq(both.log, emptyLog); }
  eq(decide(store, emptyLog, c, old.id, 'maybe' as any, consent, 99, String), { ok: false, reason: 'unknown-decision' });
}
{
  const long = '😀'.repeat(81);
  let store = addKept(emptyStore(), input('T', 'fact', 'old'), 1);
  const old = store.notes[0]!;
  const r = decide(store, emptyReplacedLog(), input('T', 'fact', long), old.id, 'replace', consent, 10, () => 'today');
  ok(r.ok);
  if (r.ok) {
    eq(Array.from(r.log.records[0]!.description).length, 81);
    eq(r.log.records[0]!.description, '😀'.repeat(80) + '…');
  }
}
{
  // Public functions must not throw on malformed values.
  for (let i = 0; i < 300; i++) {
    const bad: any = [null, undefined, 3, {}, { version: 1, nextId: 1, topics: [{}], notes: [{}] }, { version: 1, nextId: 1, topics: [], notes: [] }][i % 6];
    try { findConflicts(bad, bad); } catch { assert.fail('findConflicts threw on malformed input'); }
    try { decide(bad, bad, bad, bad, bad, bad, bad, bad); } catch { assert.fail('decide threw on malformed input'); }
    assertions++;
  }
}

{
  const notes: Note[] = [];
  for (let i = 0; i < 2000; i++) notes.push({ id: `n${i + 2}`, topic: 't1', kind: 'fact', text: `fact number ${i}`, term: null, state: 'kept', source, created: i, changed: i, consent, history: [] });
  const large: NotesStore = { version: 1, nextId: 3000, topics: [{ id: 't1', name: 'Speed', key: 'speed', created: 1 }], notes };
  const started = performance.now();
  const result = findConflicts(large, input('Speed', 'fact', 'a new fact'));
  const elapsed = performance.now() - started;
  ok(result.ok); ok(elapsed < 50, `judge-less 2,000-note path took ${elapsed.toFixed(2)} ms`);
  console.log(`speed: MEASURED ${elapsed.toFixed(2)} ms for 2,000 kept notes (limit <50 ms)`);
}

console.log(`contradiction: PASS (${assertions} assertions; 300 seeded differential stores; 300 malformed-input probes; replace/cancel/keep-both/history/log/emoji checks)`);
