/**
 * B04C0b-D (Director): the VALUE CASES. Resolution will use typed values (percent, quantity, duration, date, time) as EVIDENCE for a tool
 * (src/brain/mind/resolve/resolveTypes.ts, rules 8 to 11). This test pins what the real values stage (extractValues) gives for a written
 * corpus (tests/fixtures/valueCases.json), so that the evidence is never built on a value that is not there:
 *  - `expect` lists the strong kinds the message SHOULD give, in order; a bare number, a Roman numeral and text are not strong and never listed;
 *  - a case with `gap` records what the reader gives TODAY instead (MEASURED); the test fails if the reader changes, so a fix or a regression is seen
 *    (a fix means: remove the gap and keep `expect`);
 *  - a `trap` case documents a message that carries a number or a value that is NOT evidence of a tool.
 * Pure check of the values stage; no tool is run. Builders add cases, never edit the existing ones.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createStages } from '../src/brain/mind/stages';
import { extractValues } from '../src/brain/mind/meaning/values';
import { VALUE_KIND_LABELS } from '../src/brain/mind/schema/schemaTypes';
import type { MindContext } from '../src/brain/mind';

let checks = 0;
function assert(condition: unknown, message: string): asserts condition { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

interface Case { text: string; expect: string[]; gap?: { actual: string[]; why: string }; trap?: string }

async function main(): Promise<void> {
  const strong = VALUE_KIND_LABELS.split(' ');
  assert(strong.length === 5 && new Set(strong).size === 5, 'the label string holds five distinct kinds');
  const cases = JSON.parse(await readFile('./tests/fixtures/valueCases.json', 'utf8')) as Case[];
  assert(cases.length >= 30, `the corpus holds at least 30 cases (${cases.length})`);
  assert(new Set(cases.map((item) => item.text)).size === cases.length, 'no duplicate case');
  for (const kind of strong) assert(cases.filter((item) => item.expect.includes(kind)).length >= 3, `kind ${kind} has at least 3 cases`);
  assert(cases.filter((item) => item.expect.length === 0).length >= 8, 'at least 8 cases carry no strong value (what must NOT become evidence)');
  assert(cases.filter((item) => item.trap !== undefined).length >= 4, 'at least 4 documented traps');

  const dictionary = await Dictionary.open({ read: async (path: string) => readFile(join('./public/dictionary/en', path), 'utf8'), hash: sha });
  const executor = { run: async () => ({ content: 'unused', source: 'test' }) } as never;
  const stages = createStages(executor, () => Date.UTC(2026, 9, 28, 12, 0), () => 'values', createDictionarySlot(async () => dictionary));
  let sawBareNumberTrap = 0;
  const gaps: string[] = [];
  for (const item of cases) {
    for (const kind of item.expect) assert(strong.includes(kind), `expected kind ${kind} is one of the labels (${item.text})`);
    let context: MindContext = { utterance: { id: 'v', text: item.text, place: 'chat', at: 0 }, entries: [] };
    for (const stage of stages) { context = await stage.run(context); if (stage.id === 'analysis') break; }
    assert(context.analysis !== undefined, `analysis ran (${item.text})`);
    const outcome = extractValues(item.text, context.analysis.segments, { year: 2026, month: 10, day: 28, hour: 12, minute: 0 });
    assert(outcome.ok, `the values stage answers (${item.text})`);
    const kinds = outcome.values.map((value) => value.kind);
    const found = kinds.filter((kind) => strong.includes(kind));
    if (item.gap) { assert(JSON.stringify(found) === JSON.stringify(item.gap.actual), `GAP changed: ${item.text} now gives ${JSON.stringify(found)}, recorded ${JSON.stringify(item.gap.actual)}`); gaps.push(`${item.text}: ${item.gap.why}`); }
    else assert(JSON.stringify(found) === JSON.stringify(item.expect), `${item.text}: strong kinds ${JSON.stringify(found)}, expected ${JSON.stringify(item.expect)}`);
    if (item.expect.length === 0 && kinds.includes('number')) sawBareNumberTrap += 1;
  }
  assert(sawBareNumberTrap >= 5, `at least 5 cases carry a bare number that must not be evidence (${sawBareNumberTrap})`);
  console.log(`VALUE CASES OK: ${checks} checks, ${cases.length} cases, ${gaps.length} recorded reader gaps:`);
  for (const gap of gaps) console.log(`  GAP ${gap}`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
