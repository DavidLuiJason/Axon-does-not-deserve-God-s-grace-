/**
 * B03B3a LANGUAGE CHECK (Director test, 2026-10-25). Real pipeline, real dictionary. The sentences are WRITTEN BY THE DIRECTOR, not
 * collected from real users: the thresholds (0.5 and 0.2) are placed between the clusters this small corpus shows and are NOT proven on
 * real messages. Owner decision: never claim "English only" for Pidgin, names, typos or mixed messages.
 * Run: tsx tests/languageCheck.test.ts   (LANGUAGE_ONLY=1 skips the deliberate breakages)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import { buildMeaning } from '../src/brain/mind/meaning';
import { readLanguage, type LanguageVerdict } from '../src/brain/mind/meaning/languageCheck';

const ENGLISH = ['Set a timer for five minutes', 'what is the weather like today', 'call Tom and tell him the meeting is at noon', 'convert 5 km to miles pls', 'tell Chidinma to call me', 'hello', 'ok', 'remind me to call Adaeze at 7pm', 'can u set alarm for 6am tmrw', 'is it raining in Port Harcourt', 'Translate this to Yoruba', 'Open the file and convert it to pdf if it is large', 'count the words in "bonjour tout le monde"'];
const PIDGIN = ['wetin dey happen, how far na', 'abeg help me set alarm for morning', 'I dey go market, make you remind me say I wan buy rice'];
const NEVER_CLAIM = ['whats ur name', 'bonjour, comment allez-vous aujourd\'hui', 'hola, necesito ayuda con mi tarea de matematicas', 'ndewo, kedu ka i mere taa'];
const FOREIGN = ['Ich möchte einen Wecker stellen für morgen früh', 'Preciso de ajuda para configurar um alarme', 'Buongiorno, vorrei impostare una sveglia per domani', 'Ẹ kú àárọ̀, báwo ni ṣe wà', 'sannu, yaya kake yau, ina son agogo', 'xqzv blorp wibble quux'];
const SCRIPTS = ['你好，请帮我设置一个闹钟', 'привет, как дела сегодня', 'مرحبا كيف حالك اليوم', 'नमस्ते मुझे अलार्म लगाना है'];
const MIXED_SCRIPT = ['alarm 设置一个闹钟明天早上七点'];
const SHORT_UNKNOWN = ['Chidinma', 'thx'];
const NO_WORDS = ['😀😀', '12345', '`code only`', ''];

let checks = 0; const fails: string[] = [];
const eq = (g: unknown, w: unknown, l: string) => { checks += 1; if (JSON.stringify(g) !== JSON.stringify(w)) fails.push(`${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

async function main(): Promise<void> {
  const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join('./public/dictionary/en', p), 'utf8'), hash: sha });
  const stages = createStages({ run: async () => ({ content: '', source: 'test' }) } as never, () => 0, () => 'u', createDictionarySlot(async () => dictionary));
  const verdict = async (text: string): Promise<LanguageVerdict> => {
    let c: any = { utterance: { id: '', text, place: 'chat', at: 0 }, entries: [] };
    for (const s of stages.slice(0, 4)) c = await s.run(c);
    const fromMeaning = c.meaning?.language?.verdict; const direct = c.analysis ? readLanguage(c.analysis).verdict : undefined;
    eq(fromMeaning ?? direct, direct, `Meaning carries the same reading: ${text}`);
    return (direct ?? 'no-words') as LanguageVerdict;
  };
  for (const t of ENGLISH) eq(await verdict(t), 'english', `english: ${t}`);
  for (const t of PIDGIN) eq(await verdict(t), 'english', `pidgin is read as English with unknown words: ${t}`);
  for (const t of NEVER_CLAIM) { const v = await verdict(t); eq(v !== 'not-english' && v !== 'other-script' && v !== 'english', true, `never "English only" for: ${t} (got ${v})`); }
  for (const t of FOREIGN) eq(await verdict(t), 'not-english', `not english: ${t}`);
  for (const t of SCRIPTS) eq(await verdict(t), 'other-script', `other script: ${t}`);
  for (const t of MIXED_SCRIPT) eq(await verdict(t), 'other-script', `mostly another script: ${t}`);
  eq(await verdict('Ẹ kú àárọ̀, báwo ni ṣe wà'.normalize('NFD')), 'not-english', 'accent marks written as separate marks do not make another script');
  eq(await verdict('ọ̀ ọ̀ ọ̀ ọ̀'.normalize('NFD')), 'not-english', 'letters with many separate accent marks stay Latin');
  for (const t of SHORT_UNKNOWN) eq(await verdict(t), 'unclear', `too short to claim anything: ${t}`);
  for (const t of NO_WORDS) eq(await verdict(t), 'no-words', `no words: ${JSON.stringify(t)}`);
  // Unknown words are named, not guessed; "if" is a grammar word, not an unknown.
  { let c: any = { utterance: { id: '', text: 'Open the file and convert it to pdf if it is large', place: 'chat', at: 0 }, entries: [] }; for (const s of stages.slice(0, 3)) c = await s.run(c);
    eq(readLanguage(c.analysis).unknownWords, ['pdf'], 'unknown words are listed (and "if" is not one)'); }
  // Hostile input never throws; nothing is changed.
  eq(buildMeaning({ segments: [], tokens: [] } as never, '').ok, true, 'empty analysis is fine');
  eq(readLanguage({ segments: [{ kind: 'language', text: 'a b c', start: 0, end: 5 }], tokens: [{ surface: 'a', lemma: 'a', start: 0, end: 1 }, { surface: 'b', lemma: 'b', start: 2, end: 3 }, { surface: 'c', lemma: 'c', start: 4, end: 5 }] } as never).verdict, 'unclear', 'words never checked give unclear');
  if (fails.length > 0) { console.error(fails.join('\n')); throw new Error(`languageCheck: ${fails.length} of ${checks} failed`); }
  console.log(`B03B3a LANGUAGE TEST OK: ${checks} checks`);
}

if (process.env.LANGUAGE_ONLY === '1') {
  main().catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
} else {
  main().then(() => {
    const F = 'src/brain/mind/meaning/languageCheck.ts';
    const MUTANTS: Array<[string, string, string]> = [
      ['notEnglishAtMost: 0.2', 'notEnglishAtMost: 0.3', 'claim threshold too high (mixed refused)'],
      ['englishAtLeast: 0.5', 'englishAtLeast: 0.8', 'english threshold too high'],
      ['if (otherLetters > latinLetters)', 'if (otherLetters > latinLetters * 5)', 'other script needs five times as many letters'],
      [" || isGrammarWord(normalizeWord(token.surface))", '', 'grammar words not counted'],
      [' || LINK_SET.has(normalizeWord(token.surface))', '', 'link words not counted'],
      ['minWordsForClaim: 3', 'minWordsForClaim: 1', 'claims on one word'],
      ["if (token.knowledge === 'not-checked' || token.knowledge === undefined) { unchecked += 1; continue; }", '', 'unchecked words counted as unknown'],
      ['if (cp >= 0x370 && cp <= 0x1dff)', 'if (cp >= 0x300 && cp <= 0x1dff)', 'accent marks counted as other script'],
    ];
    let caught = 0;
    for (const [from, to, name] of MUTANTS) {
      const dir = mkdtempSync(join(tmpdir(), 'lang-'));
      try {
        cpSync(resolve('src'), join(dir, 'src'), { recursive: true }); cpSync(resolve('tests'), join(dir, 'tests'), { recursive: true });
        mkdirSync(join(dir, 'public')); symlinkSync(resolve('public/dictionary'), join(dir, 'public/dictionary'));
        const path = join(dir, F); const source = readFileSync(path, 'utf8');
        if (!source.includes(from)) throw new Error(`mutant "${name}": text not found`);
        writeFileSync(path, source.replace(from, to));
        const run = spawnSync('npx', ['tsx', 'tests/languageCheck.test.ts'], { cwd: dir, env: { ...process.env, LANGUAGE_ONLY: '1' }, encoding: 'utf8' });
        if (run.status !== 0) { caught += 1; console.log(`  mutation killed: ${name}`); } else console.log(`  MUTATION SURVIVED: ${name}`);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
    if (caught !== MUTANTS.length) throw new Error(`languageCheck: ${MUTANTS.length - caught} mutation(s) survived`);
    console.log(`B03B3a LANGUAGE MUTATIONS: ${caught} of ${MUTANTS.length} killed`);
  }).catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
}
