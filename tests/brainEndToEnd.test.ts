// P09 END-TO-END CONVERSATIONS. Real brain, real tools, wrapped by the orchestrator. Prints measured numbers per stage.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createAxonBrain } from '../src/brain/index';
import { createOrchestrator } from '../src/brain/mind/orchestrator/orchestrator.ts';
import type { Orchestration, OrchestratorMode } from '../src/brain/mind/orchestrator/orchestrator.ts';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const session = (mode: OrchestratorMode) => createOrchestrator(createAxonBrain({ lane: true, slot }) as never, { mode });
const plainAsk = async (text: string) => (await createAxonBrain({ lane: true, slot }).askWithTrace({ text, place: 'chat' })) as { reply: { content: string; source: string } };
// The brain keeps a process-wide task counter and times; compare everything else.
const steady = (r: { content: string; source: string }) => ({ source: r.source, content: r.content.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms') });
const body = (content: string): string => { const cut = content.indexOf('\n\nRan as task'); return cut < 0 ? content : content.slice(0, cut); };

const tally = {
  messages: 0, toolRuns: 0, rechecked: 0, recheckPassed: 0, recheckFailed: 0, recheckUnclear: 0,
  repairKeep: 0, repairRepaired: 0, repairAsk: 0, dialogueAsked: 0, dialogueFilled: 0, dialogueCancelled: 0, dialogueParked: 0,
  judgmentProceed: 0, judgmentAsk: 0, candidates: 0, shadowSame: 0, shadowTotal: 0,
};
const note = (o: Orchestration) => {
  tally.messages++;
  if (o.verification) { tally.rechecked++; if (o.verification.report.overall === 'PASSED') tally.recheckPassed++; else if (o.verification.report.overall === 'FAILED') tally.recheckFailed++; else tally.recheckUnclear++; }
  if (o.repair) { if (o.repair.verdict === 'KEEP') tally.repairKeep++; else if (o.repair.verdict === 'REPAIRED') tally.repairRepaired++; else tally.repairAsk++; }
  if (o.dialogue.action === 'asked') tally.dialogueAsked++;
  if (o.dialogue.action === 'filled') tally.dialogueFilled++;
  if (o.dialogue.action === 'cancelled') tally.dialogueCancelled++;
  if (o.dialogue.action === 'parked') tally.dialogueParked++;
  if (o.judgment) { if (o.judgment.verdict === 'PROCEED') tally.judgmentProceed++; else tally.judgmentAsk++; }
  if (o.reflection) tally.candidates += o.reflection.candidates.length;
};

let seed = 4711;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const vocab = ['red', 'blue', 'green', 'héllo', 'wörld', 'alpha', 'Beta', 'x-ray', 'zeta', 'omega', 'kiwi', 'lime', 'pear', 'fig', 'plum'];
const phrase = (k: number) => Array.from({ length: k }, () => pick(vocab)).join(' ');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

// ---- 1. Tool requests with their text: the right answer, rechecked, in every mode.
for (let i = 0; i < 24; i++) {
  const k = 1 + Math.floor(rnd() * 5); const p = phrase(k);
  const text = `count words in "${p}"`;
  const r = await session('on').ask({ text, place: 'chat' }); note(r.orchestration); tally.toolRuns++;
  check(r.reply.source === 'runner:text-counter' && r.reply.content.includes(`Words: ${k}`) && r.orchestration.verification?.report.overall === 'PASSED' && !r.orchestration.replyChanged, 'E1-count-' + i);
}
for (let i = 0; i < 10; i++) {
  const lines = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pick(vocab));
  const r = await session('on').ask({ text: `sort these lines: "${lines.join('\n')}"`, place: 'chat' }); note(r.orchestration); tally.toolRuns++;
  const expected = [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join('\n');
  check(r.reply.source === 'runner:sort-lines' && r.reply.content.includes('\n\n' + expected + '\nLine count: ' + lines.length + '.') && r.orchestration.verification?.report.overall === 'PASSED', 'E1-sort-' + i);
}
for (let i = 0; i < 10; i++) {
  const p = phrase(1 + Math.floor(rnd() * 3));
  const r = await session('on').ask({ text: `decode base64 "${b64(p)}"`, place: 'chat' }); note(r.orchestration); tally.toolRuns++;
  check(r.reply.source === 'runner:encoder-decoder' && body(r.reply.content) === p && r.orchestration.verification?.report.overall === 'PASSED', 'E1-decode-' + i);
}

// ---- 2. Messy messages: shadow changes nothing; on repairs, says so, and answers correctly.
for (let i = 0; i < 10; i++) {
  const k = 1 + Math.floor(rnd() * 4); const p = phrase(k); const one = `count words in "${p}".`;
  const doubled = one + ' ' + one;
  const on = await session('on').ask({ text: doubled, place: 'chat' }); note(on.orchestration);
  check(on.reply.source === 'runner:text-counter' && on.reply.content.startsWith('I read your message as: ' + one) && on.reply.content.includes(`Words: ${k}`) && on.orchestration.verification?.report.overall === 'PASSED', 'E2-doubled-on-' + i);
  const sh = await session('shadow').ask({ text: doubled, place: 'chat' }); note(sh.orchestration);
  const pl = await plainAsk(doubled); tally.shadowTotal++;
  const same = JSON.stringify(steady(sh.reply)) === JSON.stringify(steady(pl.reply)) && sh.orchestration.repair?.verdict === 'REPAIRED' && !sh.orchestration.replyChanged;
  if (same) tally.shadowSame++;
  check(same, 'E2-doubled-shadow-' + i);
}
for (let i = 0; i < 10; i++) {
  const k = 1 + Math.floor(rnd() * 4); const p = phrase(k);
  const on = await session('on').ask({ text: `how much words are in "${p}"`, place: 'chat' }); note(on.orchestration);
  check(on.reply.source === 'runner:text-counter' && on.reply.content.includes(`Words: ${k}`), 'E2-howmuch-on-' + i);
  const sh = await session('shadow').ask({ text: `how much words are in "${p}"`, place: 'chat' }); note(sh.orchestration);
  const pl = await plainAsk(`how much words are in "${p}"`); tally.shadowTotal++;
  const same = JSON.stringify(steady(sh.reply)) === JSON.stringify(steady(pl.reply)); if (same) tally.shadowSame++;
  check(same && sh.orchestration.repair?.verdict === 'REPAIRED', 'E2-howmuch-shadow-' + i);
}
for (let i = 0; i < 10; i++) {
  const p = phrase(2); const text = `Wait. count letters in "${p}".`;
  const on = await session('on').ask({ text, place: 'chat' }); note(on.orchestration);
  check(on.reply.source === 'runner:text-counter' && on.reply.content.startsWith('I read your message as: count letters in'), 'E2-marker-on-' + i);
}
for (const text of ['Delete the file. Delete the file.', 'Remove it. Remove it.', 'Send the message. Send the message.', 'Pay the bill. Pay the bill.', 'Erase everything. Erase everything.', 'Format the disk. Format the disk.']) {
  const on = await session('on').ask({ text, place: 'chat' }); note(on.orchestration);
  check(on.reply.source === 'orchestrator:repair' && on.reply.content.startsWith('Did you mean: "'), 'E2-risky-on-' + text);
  const sh = await session('shadow').ask({ text, place: 'chat' }); note(sh.orchestration);
  const pl = await plainAsk(text); tally.shadowTotal++;
  const same = JSON.stringify(steady(sh.reply)) === JSON.stringify(steady(pl.reply)); if (same) tally.shadowSame++;
  check(same && sh.orchestration.repair?.verdict === 'ASK', 'E2-risky-shadow-' + text);
}

// ---- 3. A tool that is missing its text: it asks, takes the answer, and the answer is rechecked.
const ask3 = [
  { first: 'convert to uppercase', source: 'runner:case-converter', answer: (p: string) => p.toUpperCase() },
  { first: 'encode base64', source: 'runner:encoder-decoder', answer: (p: string) => b64(p) },
  { first: 'sort lines', source: 'runner:sort-lines', answer: (p: string) => p },
];
for (const t of ask3) for (let i = 0; i < 4; i++) {
  const p = pick(vocab) + ' ' + pick(vocab);
  const s = session('on');
  const a = await s.ask({ text: t.first, place: 'chat' }); note(a.orchestration);
  check(a.reply.source === 'orchestrator:dialogue' && a.orchestration.dialogue.action === 'asked', 'E3-asks-' + t.first + i);
  const b = await s.ask({ text: p, place: 'chat' }); note(b.orchestration);
  const got = t.source === 'runner:sort-lines' ? b.reply.content.includes('\n\n' + p + '\nLine count: 1.') : body(b.reply.content) === t.answer(p);
  check(b.reply.source === t.source && got && b.orchestration.dialogue.action === 'filled', 'E3-answer-' + t.first + i);
  if (t.source !== 'runner:case-converter') check(b.orchestration.verification?.report.overall === 'PASSED', 'E3-rechecked-' + t.first + i);
}
{
  const s = session('on'); await s.ask({ text: 'sort lines', place: 'chat' });
  const c = await s.ask({ text: 'cancel', place: 'chat' }); note(c.orchestration);
  check(c.reply.content.startsWith('Okay, I dropped') && c.orchestration.dialogue.action === 'cancelled', 'E3-cancel');
  const s2 = session('on'); await s2.ask({ text: 'convert to uppercase', place: 'chat' });
  const p = await s2.ask({ text: 'sort lines "b\na"', place: 'chat' }); note(p.orchestration);
  const q = await s2.ask({ text: 'quiet', place: 'chat' }); note(q.orchestration);
  check(p.orchestration.dialogue.action === 'parked' && p.reply.source === 'runner:sort-lines' && body(q.reply.content) === 'QUIET', 'E3-parked-then-answered');
  const s3 = session('on'); const w = await s3.ask({ text: 'count words', place: 'chat' }); note(w.orchestration);
  const w2 = await s3.ask({ text: 'red blue', place: 'chat' }); note(w2.orchestration);
  check(w.reply.source === 'local-rules' && w.orchestration.dialogue.action === 'none' && w2.reply.content.includes('Words: 2'), 'E3-legacy-question-untouched');
}

// ---- 4. Requests the brain cannot do, and plain talk: honest, unchanged, and a lesson is noted.
for (const text of ['tell me a joke', 'what is the weather like', 'write me a poem', 'book a flight to Paris', 'what is two plus two']) {
  const on = await session('on').ask({ text, place: 'chat' }); note(on.orchestration);
  const pl = await plainAsk(text); tally.shadowTotal++;
  const same = JSON.stringify(steady(on.reply)) === JSON.stringify(steady(pl.reply)); if (same) tally.shadowSame++;
  check(same && on.orchestration.dialogue.action === 'none' && !on.orchestration.replyChanged, 'E4-unknown-' + text);
}
const o5 = session('on'); await o5.ask({ text: 'tell me a joke', place: 'chat' });
check(o5.candidates().some((c) => c.kind === 'LESSON'), 'E4-lesson-candidate-kept');

console.log(`E2E ${JSON.stringify(tally)}`);
check(tally.recheckFailed === 0, 'E-no-false-alarm');
check(tally.shadowSame === tally.shadowTotal, 'E-shadow-steady');
console.log(`brainEndToEnd: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
