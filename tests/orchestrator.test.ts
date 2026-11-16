import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { deepStrictEqual } from 'node:assert';
import { createAxonBrain } from '../src/brain/index';
import { createOrchestrator } from '../src/brain/mind/orchestrator/orchestrator.ts';
import type { ReplyLike } from '../src/brain/mind/orchestrator/orchestrator.ts';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };

// ---- Part A: a fake brain, so every behaviour can be pinned exactly.
const ran = (body: string) => body + '\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.';
const counter = (w: number, c: number, ns: number, l: number, ln: number) => ran(`That text has ${w} words.\n\nWords: ${w}\nCharacters: ${c} (${ns} without spaces)\nLetters: ${l}\nLines: ${ln}`);
function fake(reply: ReplyLike | ((text: string) => ReplyLike)) {
  const seen: string[] = [];
  return { seen, brain: { async askWithTrace(request: { text: string; place: string }) { seen.push(request.text); return { reply: typeof reply === 'function' ? reply(request.text) : reply, trace: { fake: true } }; } } };
}
const GOOD = { content: counter(3, 14, 12, 12, 1), source: 'runner:text-counter', taskId: 'task-1' };
const BAD = { content: counter(9, 14, 12, 12, 1), source: 'runner:text-counter', taskId: 'task-1' };
const MSG = 'count words in "red blue green"';
const ask = async (mode: 'off' | 'shadow' | 'on' | undefined, reply: ReplyLike | ((t: string) => ReplyLike), text: string) => {
  const { brain, seen } = fake(reply);
  const o = createOrchestrator(brain, mode ? { mode } : {});
  const r = await o.ask({ text, place: 'chat' });
  return { r, seen, o };
};
{
  const a = await ask('off', BAD, MSG);
  check(same(a.r.reply, BAD) && a.r.orchestration.repair === null && a.r.orchestration.verification === null && a.r.orchestration.reflection === null && !a.r.orchestration.replyChanged, 'A01_off_passthrough');
  const b = await ask('shadow', BAD, MSG);
  check(same(b.r.reply, BAD) && b.r.orchestration.replyChanged === false && b.r.orchestration.verification?.report.overall === 'FAILED', 'A02_shadow_tampered_recorded_not_changed');
  check(b.r.orchestration.reflection?.candidates.some((c) => c.kind === 'MISTAKE' && c.needsRegressionTest) === true, 'A03_shadow_tampered_mistake_candidate');
  const c = await ask('on', BAD, MSG);
  check(c.r.reply.source === 'orchestrator:verify' && c.r.orchestration.replyChanged === true && c.seen.length === 1 && !c.r.reply.content.includes('Words: 9'), 'A04_on_tampered_held_back');
  check(c.r.reply.content === 'I ran text-counter, but my own re-check did not match its answer, so I am not giving you that result. Nothing was changed.', 'A05_on_tampered_message');
  const d = await ask('on', GOOD, MSG);
  check(same(d.r.reply, GOOD) && d.r.orchestration.verification?.report.overall === 'PASSED' && d.r.orchestration.replyChanged === false, 'A06_on_good_unchanged');
  check(d.r.orchestration.reflection?.completed === true && d.r.orchestration.reflection.progressMade === true && d.r.orchestration.reflection.candidates.length === 0, 'A07_good_reflection_clean');
  const e = await ask('on', GOOD, 'Delete the file. Delete the file.');
  check(e.seen.length === 0 && e.r.reply.source === 'orchestrator:repair' && e.r.reply.content === 'Did you mean: "Delete the file."?' && e.r.orchestration.replyChanged === true, 'A08_on_ask_does_not_call_brain');
  const g = await ask('shadow', GOOD, 'Delete the file. Delete the file.');
  check(g.seen.length === 1 && g.seen[0] === 'Delete the file. Delete the file.' && g.r.orchestration.repair?.verdict === 'ASK', 'A09_shadow_ask_still_asks_brain_exact_words');
  const h = await ask('on', GOOD, 'how much words are in "red blue green"');
  check(h.seen[0] === 'how many words are in "red blue green"' && h.r.reply.content.startsWith('I read your message as: how many words are in "red blue green"\n\n') && h.r.orchestration.replyChanged, 'A10_on_repaired_text_sent_and_said');
  const i = await ask('shadow', GOOD, 'how much words are in "red blue green"');
  check(i.seen[0] === 'how much words are in "red blue green"' && same(i.r.reply, GOOD) && i.r.orchestration.repair?.verdict === 'REPAIRED', 'A11_shadow_exact_words_sent');
  const j = await ask(undefined, GOOD, MSG);
  check(j.o.mode === 'shadow' && j.r.orchestration.mode === 'shadow', 'A12_default_is_shadow');
  const k = await ask('on', { content: 'I do not have a way to do that.', source: 'foundation' }, 'hello there');
  check(k.r.orchestration.verification === null && k.r.orchestration.reflection?.candidates.some((c) => c.kind === 'LESSON') === true && !k.r.orchestration.replyChanged, 'A13_foundation_is_a_lesson_not_a_change');
  const l = await ask('on', { content: ran('HELLO'), source: 'runner:case-converter' }, 'convert "Hello" to uppercase');
  check(l.r.orchestration.verification?.report.overall === 'UNCLEAR' && l.r.orchestration.verification.report.mayClaimSuccess === false && l.r.reply.content === ran('HELLO'), 'A14_unchecked_tool_is_unclear_not_blocked');
  const m = await ask('on', GOOD, 'count words in "a b" and "c"');
  check(m.r.orchestration.verification?.report.overall === 'UNCLEAR' && same(m.r.reply, GOOD), 'A15_two_quotes_unclear_not_blocked');
  const o = await ask('on', { content: 'That did not work.', source: 'runner:text-counter' }, MSG);
  check(o.r.orchestration.verification?.report.overall === 'FAILED' && o.r.reply.content === 'That did not work.' && o.r.orchestration.reflection?.candidates.some((c) => c.kind === 'TOOL_NOTE') === true, 'A16_tool_own_failure_shown_as_is');
  const p = await ask('on', GOOD, '');
  check(p.seen.length === 1 && p.seen[0] === '' && p.r.orchestration.problems.length === 1 && p.r.orchestration.problems[0] === 'repair refused the input: bad-input', 'A17_empty_text_passes_through_with_problem_noted');
  const q = await ask('on', { content: 'plain answer', source: 'local-rules' }, 'what is two plus two');
  check(q.r.orchestration.verification === null && q.r.orchestration.reflection?.completed === false && q.r.orchestration.reflection.candidates.length === 0, 'A18_non_tool_answer_untouched');
  const r2 = await ask('shadow', GOOD, 'Wait. count words in "red blue green"');
  check(r2.seen[0] === 'Wait. count words in "red blue green"' && r2.r.orchestration.repair?.verdict === 'REPAIRED' && r2.r.orchestration.effectiveText === 'Wait. count words in "red blue green"', 'A19_shadow_effective_text_is_original');
  let threw = false;
  try { await createOrchestrator({ async askWithTrace() { throw new Error('boom'); } }, { mode: 'on' }).ask({ text: 'x', place: 'chat' }); } catch { threw = true; }
  check(threw, 'A20_brain_errors_are_not_hidden');
  const s = await ask('on', { ...GOOD, taskId: undefined } as unknown as ReplyLike, MSG);
  check(s.r.orchestration.verification?.report.overall === 'PASSED', 'A21_missing_task_id_ok');
}

// Set AXON_ORCH_FAST=1 to run only the fake-brain part (a quick check while editing). The normal run does everything.
if (process.env.AXON_ORCH_FAST === '1') { console.log(`orchestrator (fast, fake brain only): ${n} checks; ${f} failed`); process.exit(f === 0 ? 0 : 1); }

// ---- Part B: the real brain. Shadow mode must change NOTHING; the independent re-check must never disagree with a correct tool.
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: sha });
const slot = createDictionarySlot(async () => dictionary);
const golden = JSON.parse(readFileSync('tests/fixtures/brainGolden.json', 'utf8')) as Array<{ message: string }>;
let toolRuns = 0;
for (let i = 0; i < golden.length; i++) {
  const text = golden[i].message;
  const plain: any = await createAxonBrain({ lane: true, slot }).askWithTrace({ text, place: 'chat' });
  const shadow = await createOrchestrator(createAxonBrain({ lane: true, slot }) as never, { mode: 'shadow' }).ask({ text, place: 'chat' });
  // The brain keeps a task counter, run times and taught words for the whole process, so two runs of one message can differ in those. Everything else must be identical.
  const steady = (r: { content: string; source: string; taskId?: string }) => ({ source: r.source, content: r.source.startsWith('runner:') || r.source === 'foundation' ? r.content.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms') : '(taught-word state)' });
  check(same(steady(shadow.reply), steady(plain.reply)) && shadow.orchestration.replyChanged === false, 'B-shadow-changes-nothing-' + i);
  const v = shadow.orchestration.verification;
  if (v) { toolRuns++; check(v.report.overall !== 'FAILED', 'B-no-false-alarm-golden-' + i); }
}
let seed = 2024;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const words = ['red', 'blue', 'héllo', 'wörld', 'a', 'B', '42', 'x-ray', "it's", '日本語', 'zeta', 'Alpha', '😀'];
const seps = [' ', ' ', '  ', '\t', '\n'];
const mk = (k: number) => { let s = ''; for (let i = 0; i < k; i++) { s += pick(words); if (i < k - 1) s += pick(seps); } return s; };
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const generated: string[] = [];
for (let i = 0; i < 30; i++) generated.push(`count words in "${mk(1 + Math.floor(rnd() * 6))}"`);
for (let i = 0; i < 20; i++) generated.push(`sort these lines: "${Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick(words)).join('\n')}"`);
for (let i = 0; i < 20; i++) generated.push(`decode base64 "${b64(mk(1 + Math.floor(rnd() * 3)).replace(/\n/g, ' '))}"`);
for (let i = 0; i < generated.length; i++) {
  const r = await createOrchestrator(createAxonBrain({ lane: true, slot }) as never, { mode: 'on' }).ask({ text: generated[i], place: 'chat' });
  const v = r.orchestration.verification;
  check(r.reply.source.startsWith('runner:') && v !== null && v.report.overall === 'PASSED' && !r.orchestration.replyChanged, 'B-generated-passes-' + i);
}
// A doubled message is repaired and answered correctly in "on" mode; "how much words" now runs.
{
  const on = (t: string) => createOrchestrator(createAxonBrain({ lane: true, slot }) as never, { mode: 'on' }).ask({ text: t, place: 'chat' });
  const a = await on('count words in "one two three". count words in "one two three".');
  check(a.reply.source === 'runner:text-counter' && a.reply.content.includes('Words: 3') && a.orchestration.verification?.report.overall === 'PASSED', 'B-doubled-message-fixed');
  const b = await on('how much words are in "red blue"');
  check(b.reply.source === 'runner:text-counter' && b.reply.content.includes('Words: 2'), 'B-how-much-words-runs');
  const c = await on('Delete the file. Delete the file.');
  check(c.reply.source === 'orchestrator:repair', 'B-risky-repair-asks');
}
console.log(`orchestrator: ${n} checks; ${f} failed; golden messages ${golden.length}; tool runs verified in golden ${toolRuns}; generated ${generated.length}`);
if (f !== 0) process.exitCode = 1;
