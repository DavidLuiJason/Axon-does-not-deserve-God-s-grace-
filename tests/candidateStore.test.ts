import { createCandidateStore, STORE_LIMIT } from '../src/brain/mind/orchestrator/candidateStore.ts';
import type { Candidate } from '../src/brain/mind/reflect/reflect.ts';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const cand = (kind: Candidate['kind'], text: string, over: Partial<Candidate> = {}): Candidate => ({ kind, text, stage: 'CANDIDATE', needsRegressionTest: kind === 'MISTAKE', expiresAfterDays: null, source: 'task:t1', ...over });

{
  const s = createCandidateStore();
  check(s.add([cand('LESSON', 'a'), cand('TOOL_NOTE', 'b'), cand('LESSON', 'a')]) === 2 && s.size() === 2, 'C01_dedupe');
  check(s.add([cand('LESSON', 'a')]) === 0, 'C02_dedupe_across_calls');
  check(s.add([cand('MISTAKE', 'a')]) === 1 && s.size() === 3, 'C03_same_text_other_kind_ok');
  check(s.add([{ ...cand('LESSON', 'x'), stage: 'TRUSTED' as unknown as 'CANDIDATE' }]) === 0, 'C04_not_a_candidate_refused');
  check(s.add([cand('MISTAKE', 'm2', { needsRegressionTest: false })]) === 0, 'C05_mistake_needs_regression_test');
  check(s.add([cand('LESSON', '   ')]) === 0 && s.add([cand('LESSON', 'x'.repeat(501))]) === 0, 'C06_text_limits');
  check(s.add([cand('LESSON', 'e1', { expiresAfterDays: 0 })]) === 0 && s.add([cand('LESSON', 'e2', { expiresAfterDays: 3651 })]) === 0 && s.add([cand('LESSON', 'e3', { expiresAfterDays: 1.5 })]) === 0, 'C07_expiry_limits');
  check(s.add([cand('LESSON', 'e4', { expiresAfterDays: 30 })]) === 1, 'C08_expiry_ok');
  const listed = s.list() as Candidate[];
  (listed[0] as { text: string }).text = 'changed';
  check(s.list()[0].text === 'a', 'C09_list_returns_copies');
  check(s.add([{ ...cand('LESSON', 'k'), kind: 'ADMITTED' as unknown as 'LESSON' }]) === 0, 'C10_unknown_kind_refused');
  check(s.add([{ ...cand('LESSON', 'k2'), source: 'x'.repeat(201) }]) === 0, 'C11_source_limit');
}
{
  const s = createCandidateStore();
  s.add(Array.from({ length: STORE_LIMIT + 20 }, (_, i) => cand('LESSON', 'item ' + i)));
  const l = s.list();
  check(l.length === STORE_LIMIT && l[0].text === 'item 20' && l[l.length - 1].text === 'item ' + (STORE_LIMIT + 19), 'L01_limit_keeps_newest');
}
{
  const a = createCandidateStore();
  a.add([cand('LESSON', 'one'), cand('MISTAKE', 'two'), cand('PREFERENCE', 'three'), cand('TOOL_NOTE', 'four', { expiresAfterDays: 30 })]);
  const text = a.exportText();
  const b = createCandidateStore();
  check(b.importText(text) === true && JSON.stringify(b.list()) === JSON.stringify(a.list()), 'E01_roundtrip');
  b.add([cand('LESSON', 'extra')]);
  check(b.importText(text) === true && b.size() === 4, 'E02_import_replaces');
  const before = b.exportText();
  check(b.importText('not json') === false && b.exportText() === before, 'E03_bad_json_refused_store_unchanged');
  check(b.importText(JSON.stringify({ version: 2, items: [] })) === false, 'E04_wrong_version');
  check(b.importText(JSON.stringify({ version: 1, items: [{ kind: 'LESSON', text: 'x', stage: 'ADMITTED', needsRegressionTest: false, expiresAfterDays: null, source: 's' }] })) === false && b.exportText() === before, 'E05_one_bad_item_refuses_all');
  check(b.importText(JSON.stringify({ version: 1, items: Array.from({ length: STORE_LIMIT + 1 }, (_, i) => cand('LESSON', 'x' + i)) })) === false, 'E06_too_many');
  check(b.importText(JSON.stringify({ version: 1, items: [] })) === true && b.size() === 0, 'E07_empty_ok');
  check(b.importText(JSON.stringify({ version: 1, items: [cand('LESSON', 'd'), cand('LESSON', 'd')] })) === true && b.size() === 1, 'E08_import_dedupes');
  check(b.importText('null') === false && b.importText('[]') === false && b.importText('5') === false, 'E09_not_objects');
}
console.log(`candidateStore: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
