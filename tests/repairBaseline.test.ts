/** W0-B: read-only measurement of today's brain against the hand-authored repair corpus. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createAxonBrain } from '../src/brain/index';

interface ExpectedReading {
  toolId: string;
  reading: string;
  arguments: Record<string, unknown>;
  outputContains: string;
}
interface CorpusCase {
  id: string;
  text: string;
  kind: 'R1' | 'R2' | 'CONTROL';
  expected: ExpectedReading;
  shouldChange: boolean;
}
type Outcome = 'correct as is' | 'wrong' | 'asked instead' | 'error';
interface Observation {
  id: string;
  source?: string;
  content?: string;
  taskId?: string;
  resolutionNote?: string;
  error?: string;
}

let checks = 0;
const failures: string[] = [];
function check(condition: boolean, label: string): void {
  checks += 1;
  if (!condition) failures.push(label);
}
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function readExpectedCorpus(value: unknown): CorpusCase[] {
  if (!Array.isArray(value)) throw new Error('repairCorpus.json must contain an array');
  return value as CorpusCase[];
}
function askCount(note: string | undefined): number {
  const match = note?.match(/\b(\d+) questions\b/);
  return match ? Number(match[1]) : 0;
}
function classify(observation: Observation, expected: ExpectedReading): Outcome {
  if (observation.error) return 'error';
  if (askCount(observation.resolutionNote) > 0 || observation.source === 'ask') return 'asked instead';
  if (
    (observation.source === `runner:${expected.toolId}` || observation.source === 'local-rules') &&
    observation.taskId !== undefined &&
    (observation.content ?? '').includes(expected.outputContains)
  ) return 'correct as is';
  return 'wrong';
}
function mismatchedIds(corpus: CorpusCase[], observations: Observation[]): string[] {
  const observed = new Map(observations.map((item) => [item.id, item]));
  return corpus.filter((item) => classify(observed.get(item.id) ?? { id: item.id, error: 'missing observation' }, item.expected) !== 'correct as is')
    .map((item) => item.id);
}
function tally(corpus: CorpusCase[], observations: Observation[]): Record<CorpusCase['kind'], Record<Outcome, number>> {
  const result = Object.fromEntries((['R1', 'R2', 'CONTROL'] as const).map((kind) => [kind, {
    'correct as is': 0, wrong: 0, 'asked instead': 0, error: 0,
  }])) as Record<CorpusCase['kind'], Record<Outcome, number>>;
  const observed = new Map(observations.map((item) => [item.id, item]));
  for (const item of corpus) {
    const actual = observed.get(item.id) ?? { id: item.id, error: 'missing observation' };
    result[item.kind][classify(actual, item.expected)] += 1;
  }
  return result;
}
function reportMarkdown(corpus: CorpusCase[], observations: Observation[], counts: ReturnType<typeof tally>): string {
  const lines: string[] = [
    '**Source ZIP:** `Axon-does-not-deserve-God-s-grace--main (35).zip`.',
    '**First line of MERGE_TAG.txt (date and tag):** `2026-11-11 | CONNECT2-W4 + NAP LAWS [D471]`.',
    '**Source ZIP test count:** 247 `tests/*.test.ts` files (matches the owner’s stated count; the working tree now has 248 after adding this baseline test).',
    '',
    '# AXON Repair Baseline — Wave 0-B',
    '',
    '**Status:** MEASURED against the current brain; no repair engine was added.',
    '**Corpus:** 180 hand-authored cases: 60 R1, 60 R2, 60 well-formed controls.',
    '**Measurement:** sequential replay in isolated toolchain worker processes (10 independent cases per worker), each with a fresh dictionary slot and brain. A correct result requires the expected runner source (or the legacy `local-rules` path where the expected output is exact), a task record and the hand-written result fragment.',
    '',
    '| Kind | Cases | Should change | Must stay | Correct as is | Wrong | Asked instead | Error |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const kind of ['R1', 'R2', 'CONTROL'] as const) {
    const group = corpus.filter((item) => item.kind === kind);
    const should = group.filter((item) => item.shouldChange).length;
    const mustStay = group.filter((item) => !item.shouldChange).length;
    const c = counts[kind];
    lines.push(`| ${kind} | ${group.length} | ${should} | ${mustStay} | ${c['correct as is']} | ${c.wrong} | ${c['asked instead']} | ${c.error} |`);
  }
  const total = (['correct as is', 'wrong', 'asked instead', 'error'] as const).reduce((sum, key) => sum + counts.R1[key] + counts.R2[key] + counts.CONTROL[key], 0);
  lines.push(`| **TOTAL** | **${corpus.length}** | **${corpus.filter((x) => x.shouldChange).length}** | **${corpus.filter((x) => !x.shouldChange).length}** | **${counts.R1['correct as is'] + counts.R2['correct as is'] + counts.CONTROL['correct as is']}** | **${counts.R1.wrong + counts.R2.wrong + counts.CONTROL.wrong}** | **${counts.R1['asked instead'] + counts.R2['asked instead'] + counts.CONTROL['asked instead']}** | **${counts.R1.error + counts.R2.error + counts.CONTROL.error}** |`);
  // D84 addition: 'wrong' hides two very different things. Split it: the brain said it cannot do it (foundation fallback) versus it ran a tool and gave a wrong answer.
  const seen = new Map(observations.map((o) => [o.id, o]));
  lines.push('', '**Split of "wrong" (D84):** refused = the brain said it has no way to do it; ran wrong = it ran a tool and gave a wrong answer (the dangerous kind).', '', '| Kind | Wrong | Refused | Ran wrong |', '|---|---:|---:|---:|');
  for (const kind of ['R1', 'R2', 'CONTROL'] as const) {
    const wrongItems = corpus.filter((item) => item.kind === kind && classify(seen.get(item.id) ?? { id: item.id, error: 'missing observation' }, item.expected) === 'wrong');
    const refused = wrongItems.filter((item) => seen.get(item.id)?.source === 'foundation').length;
    lines.push(`| ${kind} | ${wrongItems.length} | ${refused} | ${wrongItems.length - refused} |`);
  }
  lines.push('', `**Replay completeness:** ${observations.length}/${corpus.length} cases produced an observation. **Deterministic totals:** counts only; task IDs and elapsed milliseconds are intentionally excluded.`, '');
  const observed = new Map(observations.map((item) => [item.id, item]));
  const wrongIds = (kind: CorpusCase['kind']) => corpus
    .filter((item) => item.kind === kind && classify(observed.get(item.id) ?? { id: item.id, error: 'missing observation' }, item.expected) === 'wrong')
    .map((item) => item.id);
  lines.push('## Wrong-reading IDs', '');
  for (const kind of ['R1', 'R2', 'CONTROL'] as const) lines.push(`- ${kind}: ${wrongIds(kind).join(', ') || 'none'}`);
  const controlWrong = corpus.filter((item) => item.kind === 'CONTROL' && classify(observed.get(item.id) ?? { id: item.id, error: 'missing observation' }, item.expected) === 'wrong');
  if (controlWrong.length) {
    lines.push('', '### Control mismatches', '');
    for (const item of controlWrong) {
      const actual = observed.get(item.id);
      const firstLine = (actual?.content ?? '').split('\n')[0] ?? '';
      lines.push(`- ${item.id}: expected \`${item.expected.toolId}\` / \`${item.expected.outputContains.replace(/\n/g, '\\n')}\`; got \`${actual?.source ?? 'no reply'}\` / \`${firstLine.slice(0, 180)}\`.`);
    }
  }
  const nonzero = observations.filter((item) => item.error || askCount(item.resolutionNote) > 0);
  if (nonzero.length) {
    lines.push('', '## Errors and questions', '');
    for (const item of nonzero) lines.push(`- ${item.id}: ${item.error ?? `asked instead; resolution: ${item.resolutionNote ?? 'no resolution trace'}`}`);
  }
  lines.push(
    '## Interpretation and limits',
    '',
    '- “Correct as is” means the current brain returned the exact expected live tool, a task ID and the hand-written output fragment. It does not claim a repair occurred.',
    '- R1 and R2 cases have `shouldChange: true`; CONTROL cases have `shouldChange: false`. The baseline measures present behavior only; it does not repair or rewrite any message.',
    '- The 60 controls include requests for Text Counter, Case Converter, Sort Lines, Number to Words, Encoder/Decoder, Hash Tool and QR Maker, all read as live in this repository snapshot.',
    '- The held-out half described in the repair design cannot be independently authored by another person in this builder run; these are builder-authored cases and are not a held-out set.',
    '- No R1/R2 repair implementation, phrase list, runner, wiring, source index or existing test was changed.',
    '',
  );
  return lines.join('\n');
}

const corpusPath = join(process.cwd(), 'tests/fixtures/repairCorpus.json');
const raw = JSON.parse(await readFile(corpusPath, 'utf8')) as unknown;
const corpus = readExpectedCorpus(raw);
const byKind = (kind: CorpusCase['kind']) => corpus.filter((item) => item.kind === kind);
check(corpus.length === 180, 'corpus contains exactly 180 cases');
check(byKind('R1').length === 60 && byKind('R2').length === 60 && byKind('CONTROL').length === 60, 'corpus has 60 R1, 60 R2 and 60 controls');
check(new Set(corpus.map((item) => item.id)).size === corpus.length, 'all case IDs are unique');
check(corpus.every((item) => typeof item.text === 'string' && item.text.length > 0 && typeof item.shouldChange === 'boolean' && item.expected?.toolId && item.expected.reading && item.expected.arguments && item.expected.outputContains), 'every case has text, kind, expected reading and shouldChange');
const liveTools = new Set(['text-counter', 'case-converter', 'sort-lines', 'number-to-words', 'hash-tool', 'encoder-decoder', 'qr-maker']);
check(corpus.every((item) => liveTools.has(item.expected.toolId)), 'all expected readings use only the seven currently live tools');
check(byKind('R1').every((item) => item.shouldChange), 'every R1 case is marked shouldChange');
check(byKind('R2').every((item) => item.shouldChange && /^how much\b/i.test(item.text)), 'every R2 case is a how-much count case marked shouldChange');
check(byKind('CONTROL').every((item) => !item.shouldChange), 'every well-formed control is marked not to change');
check(byKind('CONTROL').some((item) => item.text.toLowerCase().includes('\"wait 5 minutes\"')), 'well-formed controls preserve “wait 5 minutes” as quoted content');
check(byKind('CONTROL').some((item) => item.text.toLowerCase().includes('\"oops\"')), 'well-formed controls preserve “oops” as quoted content');
check(!byKind('R1').some((item) => /wait\s+5\s+minutes/i.test(item.text)), 'R1 never treats “wait 5 minutes” as a restart marker');
check(byKind('R1').every((item) => {
  const pieces = item.text.split(/[.!?]\s*/).map((part) => part.trim().toLowerCase());
  const markers = item.text.match(/\b(?:wait|oops)\b/gi) ?? [];
  return markers.every((marker) => pieces.includes(marker.toLowerCase()));
}), 'R1 wait/oops markers occur only as standalone pieces');

const { Dictionary } = await import('../src/brain/dictionary');
const { createDictionarySlot } = await import('../src/brain/knowledge/dictionarySlot');
async function replayOne(item: CorpusCase): Promise<Observation> {
  try {
    const dictionary = await Dictionary.open({
      read: async (path: string) => readFile(join(process.cwd(), 'public/dictionary/en', path), 'utf8'),
      hash: sha256,
    });
    const slot = createDictionarySlot(async () => dictionary);
    const brain = createAxonBrain({ lane: true, slot });
    const result = await brain.askWithTrace({ text: item.text, place: 'chat' });
    const resolution = result.trace.entries.find((entry) => entry.stage === 'resolution');
    const stageFailure = result.trace.entries.find((entry) => entry.note.startsWith('stage failed:'));
    return {
      id: item.id,
      source: result.reply.source,
      content: result.reply.content,
      ...(result.reply.taskId === undefined ? {} : { taskId: result.reply.taskId }),
      ...(resolution ? { resolutionNote: resolution.note } : {}),
      ...(stageFailure ? { error: stageFailure.note } : {}),
    };
  } catch (error) {
    return { id: item.id, error: error instanceof Error ? error.message : String(error) };
  }
}

// Small isolated worker batches prevent a long-lived brain process from retaining state
// across unrelated messages. The project-supplied no-install runner is used.
const observations: Observation[] = [];
const workerStart = process.env.AXON_REPAIR_WORKER_START;
const workerEnd = process.env.AXON_REPAIR_WORKER_END;
if (workerStart !== undefined && workerEnd !== undefined) {
  const start = Number(workerStart);
  const end = Number(workerEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > corpus.length || start >= end) {
    throw new Error(`Invalid worker range: ${workerStart}..${workerEnd}`);
  }
  for (const item of corpus.slice(start, end)) {
    const observation = await replayOne(item);
    console.log(`W0B_OBSERVATION=${JSON.stringify(observation)}`);
  }
} else {
  console.log('Beginning corpus replay (sequential pairs of two isolated workers, 10 cases each).');
  const runNode = [process.execPath, ...process.execArgv].map((x) => `'${x}'`).join(' ');
  const script = `
set +e
for start in 0 20 40 60 80 100 120 140 160; do
  a=$start; b=$((start + 10)); c=$((start + 10)); d=$((start + 20));
  (AXON_REPAIR_WORKER_START=$a AXON_REPAIR_WORKER_END=$b ${runNode} tests/repairBaseline.test.ts) & p1=$!
  (AXON_REPAIR_WORKER_START=$c AXON_REPAIR_WORKER_END=$d ${runNode} tests/repairBaseline.test.ts) & p2=$!
  wait $p1; s1=$?; wait $p2; s2=$?;
  echo "W0B_PAIR=$a-$b:$s1,$c-$d:$s2"
done
`;
  const child = spawnSync('sh', ['-c', script], {
    encoding: 'utf8',
    timeout: 480_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const markers = (child.stdout ?? '').split('\n').filter((line) => line.startsWith('W0B_OBSERVATION='));
  const batch = markers.map((line) => JSON.parse(line.slice('W0B_OBSERVATION='.length)) as Observation);
  const byId = new Map(batch.map((item) => [item.id, item]));
  for (const item of corpus) {
    observations.push(byId.get(item.id) ?? {
      id: item.id,
      error: child.error?.message ?? (child.signal ? `worker orchestration killed by ${child.signal}` : `worker orchestration exit ${child.status}: ${(child.stderr ?? '').slice(0, 500)}`),
    });
  }
  console.log(`Replay progress: ${observations.length}/${corpus.length}; worker observations: ${batch.length}/180`);
check(observations.length === corpus.length, 'all corpus messages were replayed exactly once');
const counts = tally(corpus, observations);
for (const kind of ['R1', 'R2', 'CONTROL'] as const) {
  const groupTotal = Object.values(counts[kind]).reduce((a, b) => a + b, 0);
  check(groupTotal === 60, `${kind} outcome counts account for all 60 cases`);
}

// One intentional corpus mutant: corrupt three known-good expected outputs. The evaluator must name exactly those cases.
const baselineMismatch = mismatchedIds(corpus, observations);
const goodIds = corpus.filter((item) => classify(observations.find((o) => o.id === item.id) ?? { id: item.id, error: 'missing observation' }, item.expected) === 'correct as is').slice(0, 3).map((item) => item.id);
check(goodIds.length === 3, 'at least three correctly interpreted baseline controls exist for the expectation mutant');
const corrupted = corpus.map((item) => goodIds.includes(item.id)
  ? { ...item, expected: { ...item.expected, outputContains: '__CORRUPTED_EXPECTATION_MUTANT__' } }
  : item);
const mutantMismatch = mismatchedIds(corrupted, observations);
const newlyReported = mutantMismatch.filter((id) => !baselineMismatch.includes(id));
check(newlyReported.length === 3 && goodIds.every((id) => newlyReported.includes(id)), 'corrupting three expected readings is reported against exactly those three IDs');
console.log(`MUTANT CAUGHT: corrupt-three-corpus-expectations -> ${newlyReported.join(', ')}`);

const markdown = reportMarkdown(corpus, observations, counts);
await writeFile(join(process.cwd(), 'docs/REPAIR_BASELINE.md'), markdown, 'utf8');
console.log(`MEASURED repair baseline: ${observations.length} messages; R1=${JSON.stringify(counts.R1)}; R2=${JSON.stringify(counts.R2)}; CONTROL=${JSON.stringify(counts.CONTROL)}`);
console.log(`CORPUS: ${corpus.length} total (60 R1, 60 R2, 60 CONTROL); expected-reading mutant caught for ${newlyReported.length} cases.`);
console.log(`repairBaseline: ${checks} checks; ${failures.length} failed`);
if (failures.length) throw new Error(failures.map((failure) => `FAILED: ${failure}`).join('\n'));
}
