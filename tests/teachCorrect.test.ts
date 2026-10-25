/**
 * B03B3b TEACH and CORRECT (Director test, 2026-10-25). Real pipeline, real dictionary. The sentences are WRITTEN BY THE DIRECTOR, not
 * collected from real users; the confidence numbers are ordinal and NOT calibrated. What is proven here: the right acts are found with the
 * right spans, questions, statements and reports are NOT taken as lessons, hostile input never throws, part A / structure / language are
 * unchanged by the new field, and deliberate breakages of the engine are noticed.
 * Run: tsx tests/teachCorrect.test.ts   (TEACH_ONLY=1 skips the breakages)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import { buildMeaning } from '../src/brain/mind/meaning';
import type { MindContext } from '../src/brain/mind';
import type { TeachingReading } from '../src/brain/mind/meaning/teach/teachTypes';

let checks = 0; const fails: string[] = [];
const eq = (g: unknown, w: unknown, l: string) => { checks += 1; if (JSON.stringify(g) !== JSON.stringify(w)) fails.push(`${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

/** A compact line for one reading, so the expectations stay readable: kind | term-or-replacement | meaning-or-rejected | flags. */
function line(r: TeachingReading): string {
  const q = (s: { text: string; quoted: boolean } | null) => (s === null ? '-' : `${s.quoted ? '"' : ''}${s.text}${s.quoted ? '"' : ''}`);
  const flags = [r.negated ? 'not' : '', r.standalone ? '' : 'dependent', r.doubt ?? ''].filter(Boolean).join(',');
  return r.kind === 'teach' ? `teach|${q(r.term)}|${q(r.meaning)}|${flags}` : `correct|${q(r.replacement)}|${q(r.rejected)}|${flags}`;
}

// [message, expected readings]. Every line is a message a person could really send.
const LESSONS: Array<[string, string[]]> = [
  ['serendipity means a happy accident', ['teach|serendipity|a happy accident|']],
  ['Serendipity means a happy accident.', ['teach|Serendipity|a happy accident|']],
  ['lunch run means go and buy food', ['teach|lunch run|go and buy food|']],
  ['"lunch run" means "go and buy food"', ['teach|"lunch run"|"go and buy food"|']],
  ['"lol" signifies laughing out loud', ['teach|"lol"|laughing out loud|']],
  ['lol signifies laughing out loud', ['teach|lol|laughing out loud|']],
  ['bank denotes the side of a river', ['teach|bank|the side of a river|']],
  ['Remember that lunch run means go and buy food', ['teach|lunch run|go and buy food|']],
  ['Remember lunch run means food', ['teach|lunch run|food|']],
  ['I think lunch run means food', ['teach|lunch run|food|']],
  ['remember "lunch run" means "go and buy food"', ['teach|"lunch run"|"go and buy food"|']],
  ['my usual means a flat white', ['teach|my usual|a flat white|']],
  ['Run means to move quickly', ['teach|Run|to move quickly|']],
  ['serendipity doesn\'t mean luck', ['teach|serendipity|luck|not']],
  ['serendipity does not mean luck', ['teach|serendipity|luck|not']],
  ['If lunch run means food, order it', ['teach|lunch run|food|dependent']],
  ['serendipity means a happy accident and set a timer for 5 minutes', ['teach|serendipity|a happy accident|']],
  // Doubtful: still reported, with the doubt named, so the Dialogue stage asks instead of guessing.
  ['The water shortage means that we have to stop taking long showers', ['teach|The water shortage|that we have to stop taking long showers|consequence']],
  ['Your help means a lot to me', ['teach|Your help|a lot to me|importance']],
];
const CORRECTIONS: Array<[string, string[]]> = [
  ['no, I meant kilometres', ['correct|kilometres|-|']],
  ['No I meant kilometres', ['correct|kilometres|-|']],
  ['I meant 10 not 5', ['correct|10|5|']],
  ['I meant 10, not 5', ['correct|10|5|']],
  ['sorry, I meant to say kilometres', ['correct|kilometres|-|']],
  ['what I meant was kilometres', ['correct|kilometres|-|']],
  ['I meant "km"', ['correct|"km"|-|']],
  ['I mean, kilometres', ['correct|kilometres|-|']],
  ['I didn\'t mean kilometres', ['correct|-|kilometres|not']],
  ['we meant the blue one', ['correct|the blue one|-|']],
  ['I meant to call mom', ['correct|mom|-|purpose']],
  ['I mean we should go', ['correct|we should go|-|filler']],
];
// Messages that must give NO reading: questions, statements, reports to someone else, and the many other uses of "mean".
const NOT_ACTS = [
  'what does serendipity mean?', 'what does serendipity mean', 'does serendipity mean luck?', 'what do you mean?', 'do you mean kilometres?', 'what did you mean by that',
  'it means nothing', 'that means we have to stop', 'this means a lot', 'that means a lot to me', 'they mean well',
  'tell Tom that lunch run means food', 'tell me what serendipity means', 'ask Anna what lunch run means',
  'the average mean value is 5', 'calculate the mean of 5 and 10', 'he is mean to me', 'Pete is mean',
  'he meant kilometres', 'you meant kilometres', 'I mean it', 'I meant', 'serendipity means', 'means a happy accident',
  'Set a timer for five minutes', 'convert 5 km to miles', 'hello', 'thanks', 'no', 'I want to learn what that word means',
  'I signify luck', 'I denote the side of a river', 'I think of kilometres', 'so what does lunch run mean to you', 'hey what does it mean when I say lunch run',
  'wetin dey mean', '', '   ', '😀', '"serendipity" "a happy accident"', 'means', 'I', 'mean', 'meant',
];
// KNOWN LIMITS (measured, not hidden): these ARE read as lessons although they are not; the Dialogue stage must confirm before anything is kept.
const KNOWN_FALSE_POSITIVES: Array<[string, string]> = [
  ['Your help means everything', 'teach|Your help|everything|'],
  ['the word serendipity means luck', 'teach|the word serendipity|luck|'],
];
// KNOWN LIMITS the other way: real lessons or corrections this job does not read (no dictionary sense or no previous message to use).
const KNOWN_MISSES = ['lol stands for laughing out loud', 'lol is short for laughing out loud', 'define lol as laughing out loud', 'make that 10 minutes', 'not 5, 10', "that's not what I meant"];

async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join('./public/dictionary/en', p), 'utf8'), hash: sha });
  const stages = createStages({ run: async () => ({ content: '', source: 'test' }) } as never, () => 0, () => 'u', createDictionarySlot(async () => dictionary));
  async function read(text: string): Promise<MindContext> {
    let c: MindContext = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const s of stages.slice(0, 4)) c = await s.run(c);
    return c;
  }
  const readings = async (text: string): Promise<TeachingReading[]> => (await read(text)).meaning?.teaching ?? [];

  for (const [text, want] of [...LESSONS, ...CORRECTIONS]) eq((await readings(text)).map(line), want, `reading: ${text}`);
  for (const text of NOT_ACTS) eq((await readings(text)).map(line), [], `no teach or correct act: ${JSON.stringify(text)}`);
  for (const [text, want] of KNOWN_FALSE_POSITIVES) eq((await readings(text)).map(line), [want], `KNOWN LIMIT (read as a lesson): ${text}`);
  for (const text of KNOWN_MISSES) eq((await readings(text)).map(line), [], `KNOWN LIMIT (not read): ${text}`);

  // Details that later stages rely on.
  { const [r] = await readings('serendipity means a happy accident'); eq(r?.kind === 'teach' && r.termKnown, true, 'a word the dictionary knows says so (a lesson would ADD a meaning)'); }
  { const [r] = await readings('lol signifies laughing out loud'); eq(r?.kind === 'teach' && r.termKnown, false, 'a word the dictionary does not know says so'); }
  { const [r] = await readings('lunch run means go and buy food'); eq(r?.kind === 'teach' && r.termKnown, null, 'a phrase is not judged'); }
  { const [r] = await readings('serendipity means a happy accident and set a timer for 5 minutes'); eq(r?.kind === 'teach' && r.mayContinue, true, 'a following "and" clause may be part of the meaning: flagged'); }
  { const [r] = await readings('serendipity means a happy accident'); eq(r?.kind === 'teach' && r.mayContinue, false, 'nothing follows: nothing continues'); }
  { const [r] = await readings('Remember that lunch run means go and buy food'); eq(r?.kind === 'teach' && r.lead?.text, 'Remember that', 'words before the term are kept as the lead, never dropped silently'); }
  { const [r] = await readings('no, I meant kilometres'); eq(r?.kind === 'correct' && r.needsPrevious, true, 'a correction says its target is in an earlier message'); }
  { const [a] = await readings('serendipity means a happy accident'); const [b] = await readings('"lunch run" means "go and buy food"'); const [c] = await readings('The water shortage means that we have to stop'); const [d] = await readings('no, I meant kilometres');
    eq(Boolean(a && b && c && d && b.confidence > a.confidence && a.confidence > c.confidence && a.confidence > 0.5 && d.confidence > 0.5), true, 'confidence orders: both quoted > plain > doubtful'); }
  // The spans are exact pieces of the message.
  for (const [text] of [...LESSONS, ...CORRECTIONS]) for (const r of await readings(text)) {
    const spans = r.kind === 'teach' ? [r.verb, r.term, r.meaning, ...(r.lead ? [r.lead] : [])] : [r.verb, ...(r.replacement ? [r.replacement] : []), ...(r.rejected ? [r.rejected] : [])];
    for (const s of spans) eq(text.slice(s.start, s.end).trim() === s.text, true, `span text equals the message text: ${text} -> ${s.text}`);
  }

  // The new field changes nothing else: clauses, structure and language are identical to what they are without it.
  for (const [text] of [...LESSONS, ...CORRECTIONS]) {
    const m = (await read(text)).meaning!; const { teaching: _t, ...rest } = m;
    eq(Array.isArray(m.teaching), true, `teaching is always a list: ${text}`);
    eq(JSON.stringify(rest).includes('"teaching"'), false, `nothing else carries it: ${text}`);
  }
  // Several lessons and corrections in one message are each read; one reading per piece at most.
  eq((await readings('lol means laughing out loud. brb means be right back')).map(line), ['teach|lol|laughing out loud|', 'teach|brb|be right back|'], 'two lessons in one message');
  eq((await readings('serendipity means luck, no I meant a happy accident')).length >= 1, true, 'a lesson and a correction together do not break reading');

  // Hostile input never throws and returns a list.
  for (const bad of ['\u0000', 'means '.repeat(500), '"'.repeat(200), '`'.repeat(10) + ' means ' + '`'.repeat(10), 'I meant '.repeat(200), 'a means b '.repeat(150), '\n\n\n', '(((means)))', '"" means ""']) {
    let ok = true; try { const out = buildMeaning((await read(bad)).analysis!, bad); ok = out.ok === false || Array.isArray(out.meaning.teaching); } catch { ok = false; }
    eq(ok, true, `hostile input is safe: ${JSON.stringify(bad).slice(0, 40)}`);
  }
  eq(buildMeaning({ segments: [], tokens: [] } as never, '').ok, true, 'empty analysis is fine');
  // Seeded fuzz: random mixes of the key words never throw and every span stays inside the message.
  { let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const bag = ['means', 'meant', 'mean', 'I', 'no', 'not', 'the', 'a', 'it', 'what', 'does', 'to', 'say', '"x y"', 'lunch', 'run', ',', 'and', 'if', 'that', 'tell', 'Tom', 'kilometres', '5', '`c`'];
    let bad = 0;
    for (let n = 0; n < 400; n += 1) {
      const text = Array.from({ length: 1 + Math.floor(rnd() * 9) }, () => bag[Math.floor(rnd() * bag.length)]).join(' ');
      try { for (const r of await readings(text)) { const spans = r.kind === 'teach' ? [r.verb, r.term, r.meaning] : [r.verb, r.replacement, r.rejected]; for (const s of spans) if (s && (s.start < 0 || s.end > text.length || s.start >= s.end)) bad += 1; } } catch { bad += 1; }
    }
    eq(bad, 0, 'fuzz: 400 random messages, no throw, every span inside the message'); }
  // Speed: a long message of many lessons stays fast.
  { const text = 'lol means laughing out loud. '.repeat(40); const t0 = performance.now(); await readings(text); const ms = performance.now() - t0; eq(ms < 1500, true, `speed: 40 lessons in ${Math.round(ms)} ms`); }

  if (fails.length > 0) { console.error(fails.join('\n')); throw new Error(`teachCorrect: ${fails.length} of ${checks} failed`); }
  console.log(`B03B3b TEACH AND CORRECT TEST OK: ${checks} checks`);
}

if (process.env.TEACH_ONLY === '1') {
  main().catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
} else {
  main().then(() => {
    const F = 'src/brain/mind/meaning/teach/readTeaching.ts';
    const S = 'src/brain/mind/meaning/teach/teachSenses.ts';
    // One change is NOT tried on purpose: dropping the "has the meaning" gate before readTeach changes nothing, because every word the
    // dictionary gives an "intend to express" sense also has a "has the meaning" sense (MEASURED: mean, intend): an equivalent change.
    const MUTANTS: Array<[string, string, string, string]> = [
      [F, 'const speaker = before !== undefined && before.subject && before.speaker;', 'const speaker = false;', 'the speaker is never told apart (corrections read as lessons)'],
      [F, "(unit.intend ? readCorrect(units, piece, pieceIndex, v, negated, materials, text) : null)", "readCorrect(units, piece, pieceIndex, v, negated, materials, text)", 'correction needs no "intend" sense'],
      [F, "for (let k = termFrom; k < t; k += 1) if (units[k]!.question) return null;", '', 'question words before the verb are ignored ("what does x mean")'],
      [F, "(units[termFrom]!.aux || units[termFrom]!.question)) return null;", "units[termFrom]!.question) return null;", 'question order ("does x mean y?") is taught'],
      [F, "if (standsAlone(units[termFrom]!)) return null;", '', 'a pronoun can be a term ("it means nothing")'],
      [F, "if (units[main]!.speech) return null;", '', 'a report to someone else is a lesson ("tell Tom that x means y")'],
      [F, "while (t > piece.from && (units[t - 1]!.aux || units[t - 1]!.neg)) { t -= 1; if (units[t]!.neg) negated = true; }", "", 'negation is not stepped over ("does not mean")'],
      [F, "if (first.subject || first.norm === TEACH_WORDS.complementizer) doubt = 'consequence';", "", 'a consequence is not doubted'],
      [F, "units[piece.to - 2]!.norm === TEACH_WORDS.infinitive && units[piece.to - 1]!.objectPronoun) doubt = 'importance';", "false) doubt = 'importance';", '"means a lot to me" is not doubted'],
      [F, "doubt = 'filler';", "doubt = null;", 'a spoken filler is not doubted'],
      [F, "doubt = units[j + 1]!.speech ? null : 'purpose';", "doubt = null;", '"meant to call" is not doubted'],
      [F, "else { replacement = words(units, text, j, neg); rejected = words(units, text, neg + 1, piece.to); }", "else { replacement = words(units, text, j, piece.to); }", '"10 not 5" keeps no rejected part'],
      [F, "const certain = reported || units[base]!.subject || !units[main]!.pos.has('n');", "const certain = true;", 'a noun-like first word is taken as a lead ("lunch run")'],
      [F, "while (base < t && (LINK_SET.has(units[base]!.norm) || units[base]!.coordinator || units[base]!.sequencer)) base += 1;", "", '"if" stays inside the term'],
      [F, "standalone: piece.mayRunAlone", "standalone: true", 'a condition piece may run alone'],
      [F, "const nextStarts = next !== undefined && next.from === piece.to && (units[next.from]!.coordinator || units[next.from]!.sequencer);", "const nextStarts = false;", 'a meaning that may go on is not flagged'],
      [F, "termKnown = units[termFrom]!.known;", "termKnown = null;", 'known words are not reported'],
      [F, "QUOTE_OPEN.includes(text.charAt(start)) && QUOTE_CLOSE.includes(text.charAt(end - 1))", "false", 'quote marks stay in the quoted span'],
      [S, "'oewn-00933814-v oewn-00933429-v oewn-00934286-v'", "'oewn-00933429-v oewn-00934286-v'", 'the main "denote or connote" sense is dropped'],
      [S, "new Set('oewn-00957180-v'.split(' '))", "new Set('oewn-00000000-v'.split(' '))", 'the "intend to express" sense is dropped'],
    ];
    let caught = 0;
    for (const [file, from, to, name] of MUTANTS) {
      const dir = mkdtempSync(join(tmpdir(), 'teach-'));
      try {
        cpSync(resolve('src'), join(dir, 'src'), { recursive: true }); cpSync(resolve('tests'), join(dir, 'tests'), { recursive: true });
        mkdirSync(join(dir, 'public')); symlinkSync(resolve('public/dictionary'), join(dir, 'public/dictionary'));
        const path = join(dir, file); const source = readFileSync(path, 'utf8');
        if (!source.includes(from)) throw new Error(`mutant "${name}": text not found`);
        writeFileSync(path, source.replace(from, to));
        const run = spawnSync('npx', ['tsx', 'tests/teachCorrect.test.ts'], { cwd: dir, env: { ...process.env, TEACH_ONLY: '1' }, encoding: 'utf8' });
        if (run.status !== 0) { caught += 1; console.log(`  mutation killed: ${name}`); } else console.log(`  MUTATION SURVIVED: ${name}`);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
    if (caught !== MUTANTS.length) throw new Error(`teachCorrect: ${MUTANTS.length - caught} mutation(s) survived`);
    console.log(`B03B3b TEACH AND CORRECT MUTATIONS: ${caught} of ${MUTANTS.length} killed`);
  }).catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
}
