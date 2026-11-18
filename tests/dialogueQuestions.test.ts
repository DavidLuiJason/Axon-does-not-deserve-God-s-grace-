import { binderAsked, traceReadsAsRequest, withQuotedText, withStageNote, entryNote, TEXT_QUESTION } from '../src/brain/mind/orchestrator/dialogueQuestions.ts';
import { deepStrictEqual } from 'node:assert';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
const trace = (execution: string, resolution = '1 pieces; 1 matches, 0 questions, 0 unavailable, 0 none; ROUTER shadow: 0 fast, 1 ask, 0 deep') => ({ utterance: {}, entries: [
  { stage: 'resolution', state: 'ran', note: resolution }, { stage: 'execution', state: 'ran', note: execution }, { stage: 'verification', state: 'not-built', note: 'not built: verification arrives in B6' }] });
const ASKED = 'legacy executor preserves current provider order and fallback; direct lane yielded: the binder says ask';

// binderAsked
check(binderAsked('foundation', trace(ASKED)) === true, 'B01_asked');
check(binderAsked('local-rules', trace(ASKED)) === false, 'B02_other_source_handles_it');
check(binderAsked('foundation', trace('direct lane yielded: no single sure tool was found')) === false, 'B03_no_tool_found');
check(binderAsked('foundation', null) === false, 'B04_null_trace');
check(binderAsked('foundation', { entries: 'x' }) === false, 'B05_bad_entries');
check(binderAsked('foundation', { entries: [{ stage: 'execution' }] }) === false, 'B06_malformed_entry');
check(binderAsked('runner:text-counter', trace(ASKED)) === false, 'B07_runner_source');
check(binderAsked('foundation', { entries: [] }) === false, 'B08_no_execution_entry');
// traceReadsAsRequest
check(traceReadsAsRequest(trace(ASKED)) === true, 'R01_match');
check(traceReadsAsRequest(trace(ASKED, '1 pieces; 0 matches, 0 questions, 0 unavailable, 1 none; ROUTER shadow: 0 fast, 0 ask, 1 deep')) === false, 'R02_none');
check(traceReadsAsRequest(trace(ASKED, '1 pieces; 0 matches, 1 questions, 0 unavailable, 0 none')) === true, 'R03_question');
check(traceReadsAsRequest(trace(ASKED, '1 pieces; 0 matches, 0 questions, 1 unavailable, 0 none')) === true, 'R04_unavailable');
check(traceReadsAsRequest(trace(ASKED, '2 pieces; 10 matches, 0 questions, 0 unavailable, 0 none')) === true, 'R05_ten');
check(traceReadsAsRequest(trace(ASKED, 'nothing useful here')) === false, 'R06_unknown_format');
check(traceReadsAsRequest({ entries: [] }) === false, 'R07_no_resolution_entry');
check(traceReadsAsRequest(undefined) === false, 'R08_undefined');
check(traceReadsAsRequest(trace(ASKED, '1 pieces; x matches, 0 questions, 0 unavailable, 0 none')) === false, 'R09_not_a_number');
check(traceReadsAsRequest(trace(ASKED, '1 pieces; -1 matches, 0 questions, 0 unavailable, 0 none')) === false, 'R10_negative');
check(traceReadsAsRequest(trace(ASKED, '1 pieces; -5 matches, 1 questions, 0 unavailable, 0 none')) === true, 'R11_negative_does_not_hide_a_real_count');
// withQuotedText
const q = (o: string, v: string) => withQuotedText(o, v);
check(q('convert to uppercase', 'hello') === 'convert to uppercase "hello"', 'Q01_plain');
check(q('Convert to uppercase.', 'hi there') === 'Convert to uppercase "hi there"', 'Q02_trailing_period_removed');
check(q('sort lines', 'say "hi"') === 'sort lines \u201csay "hi"\u201d', 'Q03_inner_quote_uses_curly');
check(q('sort lines', 'a \u201cb\u201d') === null, 'Q04_curly_inside_refused');
check(q('say "x" and convert', 'hello') === null, 'Q05_original_has_quote');
check(q('convert', '   ') === null, 'Q06_empty_value');
check(q('  ', 'hello') === null, 'Q07_empty_original');
check(q('convert', '  hello  ') === 'convert "hello"', 'Q08_value_trimmed');
check(q('sort lines', 'b\na') === 'sort lines "b\na"', 'Q09_multiline_kept');
check(q('what?!', 'x') === 'what "x"', 'Q10_several_trailing_marks');
check(q('?', 'x') === null, 'Q11_only_marks');
// withStageNote / entryNote
const t = trace(ASKED);
const replaced = withStageNote(t, 'verification', 'real note') as { entries: { stage: string; state: string; note: string }[] };
check(replaced.entries.find((e) => e.stage === 'verification')?.note === 'real note' && replaced.entries.find((e) => e.stage === 'verification')?.state === 'ran', 'S01_replaced');
check(t.entries.find((e) => e.stage === 'verification')?.note === 'not built: verification arrives in B6', 'S02_original_untouched');
const added = withStageNote(t, 'dialogue', 'x') as { entries: { stage: string }[] };
check(added.entries.length === 4 && added.entries[3].stage === 'dialogue', 'S03_added_at_end');
check(withStageNote('not a trace', 'dialogue', 'x') === 'not a trace', 'S04_non_trace_returned_as_is');
check(withStageNote(null, 'dialogue', 'x') === null, 'S05_null');
check(same(replaced.entries.map((e) => e.stage), ['resolution', 'execution', 'verification']), 'S06_order_kept');
check(entryNote(t, 'execution') === ASKED && entryNote(t, 'nope') === null && entryNote(5, 'x') === null, 'S07_entryNote');
check(TEXT_QUESTION.startsWith('Which text'), 'S08_question_wording');
console.log(`dialogueQuestions: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
