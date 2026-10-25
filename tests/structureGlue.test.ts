/**
 * B03B2 GLUE (Director test, 2026-10-25): the structure jobs 2a, 2b and 2c joined to the Meaning stage, run through the REAL
 * pipeline stages with the REAL dictionary. Also: part A is unchanged (clauses identical with and without `structure`), bad input,
 * a seeded fuzz, speed, and deliberate breakages of the glue files that the checks must notice.
 * Run: tsx tests/structureGlue.test.ts   (STRUCTURE_GLUE_ONLY=1 skips the breakages)
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
import type { MindContext } from '../src/brain/mind';
import { buildMeaning } from '../src/brain/mind/meaning';
import type { MeaningStructure } from '../src/brain/mind/meaning/structure/glueTypes';

let checks = 0; const fails: string[] = [];
const eq = (got: unknown, want: unknown, label: string) => { checks += 1; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join('./public/dictionary/en', p), 'utf8'), hash: sha });
  const stages = createStages({ run: async () => ({ content: '', source: 'test' }) } as never, () => 0, () => 'u', createDictionarySlot(async () => dictionary));
  async function read(text: string): Promise<MindContext> {
    let c: MindContext = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const s of stages.slice(0, 4)) c = await s.run(c);
    return c;
  }
  const struct = async (text: string): Promise<MeaningStructure> => { const s = (await read(text)).meaning?.structure; if (!s) throw new Error(`no structure for ${text}`); return s; };
  const slice = (s: MeaningStructure, a: number, b: number) => s.words.slice(a, b).map((x) => x.norm).join(' ');
  const piece = async (text: string, i = 0) => {
    const s = await struct(text); const p = s.pieces[i]!;
    return {
      text: slice(s, p.from, p.to), alone: p.mayRunAlone, infinitive: p.parts.infinitive, verb: p.parts.verb === null ? null : s.words[p.parts.verb]!.norm,
      pointers: p.refs.pointers.map((q) => `${q.kind}:${s.words[q.at]!.norm}`), needsPrevious: p.refs.needsPrevious,
      relay: p.refs.relay && { addressee: slice(s, p.refs.relay.addressee.from, p.refs.relay.addressee.to), content: slice(s, p.refs.relay.content.from, p.refs.relay.content.to), speaker: p.refs.relay.addresseeIsSpeaker },
    };
  };

  // Relays: the dictionary (synset ids) decides which verbs tell or ask someone; "call" is both noun and verb and still reads as the infinitive.
  eq((await piece('Tell Tom to call me')).relay, { addressee: 'tom', content: 'to call me', speaker: false }, 'relay: tell Tom to call me');
  eq((await piece('Remind me to call mom')).relay, { addressee: 'me', content: 'to call mom', speaker: true }, 'relay: remind me');
  eq((await piece('Ask Anna to send the file')).relay, { addressee: 'anna', content: 'to send the file', speaker: false }, 'relay: ask');
  eq((await piece('Tell me a joke')).relay, null, 'no relay: tell me a joke');
  eq((await piece('Call me to confirm')).relay, null, 'no relay: call is a purpose, not a relay');
  eq((await piece('Convert it to pdf')).relay, null, 'no relay: ordinary command');
  // The noun-or-verb policy applies ONLY after a telling or asking verb: "to work" after send or go stays a detail, not an infinitive.
  eq((await piece('Send it to work')).infinitive, null, 'no infinitive: send it to work');
  eq((await piece('Go to work')).infinitive, null, 'no infinitive: go to work');
  eq((await piece('Tell Tom to work late')).relay?.content, 'to work late', 'relay: tell Tom to work late');
  // Pointers.
  eq((await piece('Convert that')).pointers, ['thing:that'], 'pointer: that');
  eq((await piece('Convert it to pdf')).pointers, ['thing:it'], 'pointer: it');
  eq((await piece('Delete the last one')).pointers, ['earlier:last'], 'pointer: the last one');
  eq((await piece('Convert that file')).pointers, [], 'no pointer: that + noun');
  eq((await piece('Again')).needsPrevious, true, 'again alone needs the clause before');
  eq((await piece('Do it again')).pointers, ['again:again'], 'again found (the phrase "do it" hides the "it": KNOWN LIMIT)');
  // Links: a condition never runs alone (owner-confirmed); a reason is a separate piece.
  { const s = await struct('If it rains, set a timer for 5 minutes');
    eq(s.pieces.map((p) => p.mayRunAlone), [false, false], 'if-clause and its main clause never run alone');
    eq(s.links.map((l) => `${l.kind}:${l.marker}:${l.dependent}->${l.main}`), ['condition:if:0->1'], 'condition link'); }
  { const s = await struct('Set a timer because I am late');
    eq(s.pieces.map((p) => p.mayRunAlone), [true, false], 'the reason piece never runs alone');
    eq(s.links.map((l) => l.kind), ['reason'], 'reason link'); }
  eq((await struct('Open the file and convert it')).pieces.length, 2, 'two clauses give two pieces');
  // Quoted material is never read; pieces still map to part-A clauses in order.
  { const c = await read('Tell Tom to say "hello there" then convert that'); const s = c.meaning!.structure!;
    eq(s.pieces.every((p, i) => p.clause >= 0 && p.clause < c.meaning!.clauses.length && (i === 0 || p.from >= s.pieces[i - 1]!.to)), true, 'pieces in order, each inside a clause');
    eq(s.words.some((w) => w.norm === 'hello'), false, 'quoted words are not structure words'); }
  // Part A is unchanged: the same clauses with the structure removed.
  for (const text of ['Tell Tom to call me', 'If it rains, set a timer', 'hello', 'what is a word?', 'count the words in "a b c"']) {
    const c = await read(text); const m = c.meaning!; const plain = JSON.stringify({ clauses: m.clauses, onlyMaterial: m.onlyMaterial });
    const again = buildMeaning(c.analysis!, text); eq(again.ok && JSON.stringify({ clauses: again.meaning.clauses, onlyMaterial: again.meaning.onlyMaterial }) === plain, true, `part A stable: ${text}`);
  }
  // No words, only material, bad input: no structure, never a throw.
  eq((await read('')).meaning?.structure, undefined, 'empty message has no structure');
  eq((await read('`code only`')).meaning?.structure, undefined, 'only material has no structure');
  eq(buildMeaning(null as never, 'x').ok, false, 'bad analysis still refused');
  // Seeded fuzz over real words: never throws, pieces are in order, no gaps or overlaps inside the unit range, and the result repeats.
  const vocab = 'tell remind ask me tom to call it that again the last one if because when and then convert delete file set timer for 5 minutes at noon , ? . please do not'.split(' ');
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 150; n += 1) {
    const text = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => vocab[Math.floor(rnd() * vocab.length)]!).join(' ');
    const c = await read(text); const s = c.meaning?.structure; if (!s) continue;
    let ok = s.pieces.length > 0 && s.pieces[0]!.from === 0 && s.pieces[s.pieces.length - 1]!.to === s.words.length;
    for (let i = 1; i < s.pieces.length; i += 1) if (s.pieces[i]!.from !== s.pieces[i - 1]!.to) ok = false;
    for (const p of s.pieces) for (const q of p.refs.pointers) if (q.at < p.from || q.at >= p.to) ok = false;
    eq(ok, true, `fuzz ${n} well-formed: ${text}`);
    eq(JSON.stringify(buildMeaning(c.analysis!, text)) === JSON.stringify(buildMeaning(c.analysis!, text)), true, `fuzz ${n} repeatable`);
  }
  // Speed: a 1,500-word message.
  { const text = Array.from({ length: 1500 }, (_, i) => (i % 5 === 4 ? 'again' : i % 5 === 2 ? 'it' : 'convert')).join(' ');
    const c = await read(text); const t = performance.now(); buildMeaning(c.analysis!, text); eq(performance.now() - t < 500, true, '1,500 words read for structure in under 500 ms'); }

  if (fails.length > 0) { console.error(fails.join('\n')); throw new Error(`structureGlue: ${fails.length} of ${checks} failed`); }
  console.log(`B03B2 GLUE TEST OK: ${checks} checks`);
}

if (process.env.STRUCTURE_GLUE_ONLY === '1' || process.env.GLUE_MUTANT === '1') {
  main().catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
} else {
  main().then(() => {
    const MUTANTS: Array<[string, string, string, string]> = [
      ['src/brain/mind/meaning/structure/glue.ts', "!units[verb]!.speech", "false", 'relay fix off'],
      ['src/brain/mind/meaning/structure/glue.ts', "first: unit.speaker", "first: false", 'speaker flag off'],
      ['src/brain/mind/meaning/structure/glue.ts', "mayRunAlone: linked.mayRunAlone[i] ?? true", "mayRunAlone: true", 'conditions may run alone'],
      ['src/brain/mind/meaning/structure/glue.ts', "speech: unit.speech", "speech: false", 'speech flag off'],
      ['src/brain/mind/meaning/structure/glue.ts', "noun: unit.pos.has('n'), determiner: unit.determiner }));\n  const parts", "noun: false, determiner: unit.determiner }));\n  const parts", 'noun flag off'],
      ['src/brain/mind/meaning/structure/speechSenses.ts', "oewn-00612092-v ", "", 'remind sense removed'],
      ['src/brain/mind/meaning/structure/speechSenses.ts', "oewn-00748704-v ", "oewn-00748704-v oewn-00794133-v ", 'call sense added'],
      ['src/brain/mind/meaning/build.ts', "structure = buildStructure(", "structure = undefined; void (", 'structure not built'],
    ];
    let caught = 0;
    for (const [file, from, to, name] of MUTANTS) {
      const dir = mkdtempSync(join(tmpdir(), 'glue-'));
      try {
        cpSync(resolve('src'), join(dir, 'src'), { recursive: true }); cpSync(resolve('tests'), join(dir, 'tests'), { recursive: true }); mkdirSync(join(dir, 'public')); symlinkSync(resolve('public/dictionary'), join(dir, 'public/dictionary'));
        const path = join(dir, file); const source = readFileSync(path, 'utf8');
        if (!source.includes(from)) throw new Error(`mutant "${name}": text not found in ${file}`);
        writeFileSync(path, source.replace(from, to));
        const run = spawnSync('npx', ['tsx', 'tests/structureGlue.test.ts'], { cwd: dir, env: { ...process.env, GLUE_MUTANT: '1' }, encoding: 'utf8' });
        if (run.status !== 0) { caught += 1; console.log(`  mutation killed: ${name}`); } else console.log(`  MUTATION SURVIVED: ${name}`);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
    if (caught !== MUTANTS.length) throw new Error(`structureGlue: ${MUTANTS.length - caught} mutation(s) survived`);
    console.log(`B03B2 GLUE MUTATIONS: ${caught} of ${MUTANTS.length} killed`);
  }).catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
}
