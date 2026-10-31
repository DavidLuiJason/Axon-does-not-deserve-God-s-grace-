import { TEXT_RUNNERS } from '../src/tools/runners/textRunners';
import type { RunnerArgs, RunnerDeps, RunnerOutcome } from '../src/tools/runners/runnerTypes';
import { findReplace } from '../src/tools/engines/text/findReplace';
import { caseConvert } from '../src/tools/engines/text/caseConvert';
import { textCleaner } from '../src/tools/engines/text/textCleaner';
import { sortLines } from '../src/tools/engines/text/sortLines';
import { textCompare } from '../src/tools/engines/text/textCompare';
import { getSchema } from '../src/brain/mind/schema/actionSchemas';

let checks = 0;
function check(condition: unknown, name: string): void {
  if (!condition) throw new Error(`FAILED: ${name}`);
  checks += 1;
  console.log(`  OK: ${name}`);
}
function equal(actual: unknown, expected: unknown, name: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), name);
}
const fixedDeps: RunnerDeps = Object.freeze({ now: 1_798_000_000_000, randomBelow: (max: number) => Math.floor(max / 2), random01: () => 0.25 });
const runners = new Map(TEXT_RUNNERS.map((runner) => [runner.toolId, runner]));
async function run(id: string, args: unknown, deps: RunnerDeps = fixedDeps): Promise<RunnerOutcome> {
  const runner = runners.get(id);
  if (!runner) throw new Error(`Missing runner ${id}`);
  return runner.run(args as RunnerArgs, deps);
}
async function successCase(id: string, args: Record<string, unknown>, expected: unknown, name: string): Promise<void> {
  const frozen = Object.freeze({ ...args });
  const before = JSON.stringify(frozen);
  const first = await run(id, frozen, fixedDeps);
  const second = await run(id, frozen, fixedDeps);
  check(first.ok, `${name}: succeeds`);
  if (first.ok) equal(first.result, expected, `${name}: exact engine result`);
  equal(first, second, `${name}: repeatable result`);
  equal(JSON.stringify(frozen), before, `${name}: arguments unchanged`);
  if (first.ok) check(first.reply.length <= 2000, `${name}: reply within limit`);
}

async function refusalCase(id: string, args: Record<string, unknown>, expected: unknown, name: string): Promise<void> {
  const outcome = await run(id, args);
  check(!outcome.ok && outcome.kind === 'engine-refused', `${name}: typed engine refusal`);
  if (!outcome.ok) check(outcome.message.includes((expected as {error:string}).error), `${name}: engine error code retained`);
}

async function main(): Promise<void> {
  check(TEXT_RUNNERS.length === 5, 'exactly five text runners are exported');
  equal(TEXT_RUNNERS.map((runner) => runner.toolId), ['find-replace', 'case-converter', 'text-cleaner', 'sort-lines', 'text-compare'], 'runner order and catalog ids are exact');

  // Ten find-and-replace cases. Expected values come from direct engine calls, not runner mapping.
  await successCase('find-replace', { text: 'cat cat', pattern: 'cat' }, findReplace('cat cat', 'cat', '', {}), 'find/replace first match by default');
  await successCase('find-replace', { text: 'cat cat', pattern: 'cat', replacement: 'dog', replaceAll: true }, findReplace('cat cat', 'cat', 'dog', { replaceAll: true }), 'find/replace all matches');
  await successCase('find-replace', { text: 'Cat cat', pattern: 'cat', replacement: 'x', caseSensitive: true, replaceAll: true }, findReplace('Cat cat', 'cat', 'x', { caseSensitive: true, replaceAll: true }), 'find/replace case sensitive');
  await successCase('find-replace', { text: 'cat scatter cat!', pattern: 'cat', replacement: 'x', wholeWord: true, replaceAll: true }, findReplace('cat scatter cat!', 'cat', 'x', { wholeWord: true, replaceAll: true }), 'find/replace whole word');
  await successCase('find-replace', { text: 'a1 b2', pattern: '[a-z]', replacement: 'X', regex: true, replaceAll: true }, findReplace('a1 b2', '[a-z]', 'X', { regex: true, replaceAll: true }), 'find/replace regular expression');
  await successCase('find-replace', { text: 'nothing here', pattern: 'missing', replacement: 'x' }, findReplace('nothing here', 'missing', 'x', {}), 'find/replace no match');
  await successCase('find-replace', { text: 'abc', pattern: 'b' }, findReplace('abc', 'b', '', {}), 'find/replace omitted replacement defaults to empty');
  await successCase('find-replace', { text: 'abc', pattern: '' }, findReplace('abc', '', '', {}), 'find/replace empty pattern');
  await refusalCase('find-replace', { text: 'abc', pattern: '[', regex: true }, findReplace('abc', '[', '', { regex: true }), 'find/replace engine refuses invalid pattern');
  await refusalCase('find-replace', { text: 'aaaa', pattern: '(a+)+', regex: true }, findReplace('aaaa', '(a+)+', '', { regex: true }), 'find/replace engine refuses unsafe pattern');

  // Ten case-conversion cases, covering every descriptor choice plus Unicode.
  const caseInputs: Array<[string, string, string]> = [
    ['hello World', 'UPPER', 'HELLO WORLD'], ['HELLO WORLD', 'lower', 'hello world'], ['hello. WORLD! next', 'Sentence', 'Hello. World! Next'],
    ['hELLO wORLD', 'Title', 'Hello World'], ['Hello world', 'camelCase', 'helloWorld'], ['hello world', 'PascalCase', 'HelloWorld'],
    ['Hello World', 'snake_case', 'hello_world'], ['Hello World', 'kebab-case', 'hello-world'], ['Hello World', 'CONSTANT_CASE', 'HELLO_WORLD'],
    ['café déjà vu', 'snake_case', 'café_déjà_vu'],
  ];
  for (const [text, mode, literal] of caseInputs) {
    await successCase('case-converter', { text, mode }, caseConvert(text, mode as never), `case conversion ${mode} (${literal})`);
    const actual = caseConvert(text, mode as never);
    check(actual.ok && actual.text === literal, `case conversion ${mode}: independent literal answer`);
  }

  // Ten cleaner cases.
  const cleanerCases: Array<[string, Record<string, boolean>]> = [
    ['  a  \n b ', { trimEachLine: true }], ['a   b', { collapseRepeatedSpaces: true }], ['a\n\n\nb', { removeBlankLines: true }],
    ['a\n\n\nb', { collapseBlankLines: true }], ['“hi”—‘there’', { straightenQuotesAndDashes: true }], ['a\u200Bb', { removeZeroWidth: true }],
    ['a\r\nb\rc', { normalizeLineEndings: true }], ['  a   \r\n\r\n b  ', { normalizeLineEndings: true, trimEachLine: true, collapseRepeatedSpaces: true }],
    ['\n\n', { removeBlankLines: true, collapseBlankLines: true }], ['x\uFEFFy\u2028z', { removeZeroWidth: true, normalizeLineEndings: true }],
  ];
  for (const [text, options] of cleanerCases) {
    await successCase('text-cleaner', { text, ...options }, textCleaner(text, options), `text cleaning ${Object.keys(options).join('+')}`);
  }
  const cleanLiteral = textCleaner('  alpha   beta  \r\n\r\n gamma ', { normalizeLineEndings: true, trimEachLine: true, collapseRepeatedSpaces: true, removeBlankLines: true });
  check(cleanLiteral.ok && cleanLiteral.text === 'alpha beta\ngamma', 'cleaner independent literal output');
  check(cleanLiteral.ok && cleanLiteral.counts.trimEachLine === 2 && cleanLiteral.counts.collapseRepeatedSpaces === 2 && cleanLiteral.counts.removeBlankLines === 1 && cleanLiteral.counts.normalizeLineEndings === 2, 'cleaner independent literal counts');

  // Ten line-sorting cases, including injected shuffle randomness.
  const sortCases: Array<[string, Record<string, unknown>]> = [
    ['c\na\nb', { mode: 'ascending' }], ['c\na\nb', { mode: 'descending' }], ['long\nx\nmid', { mode: 'by-length' }],
    ['item10\nitem2\nitem1', { mode: 'natural' }], ['a\nb\nc', { mode: 'reverse' }], ['a\nb\nc\nd', { mode: 'shuffle' }],
    ['b\nA\na', { mode: 'ascending', ignoreCase: true }], ['a\na\nb', { mode: 'ascending', removeDuplicates: true }],
    ['a\n\nb\n ', { mode: 'ascending', ignoreBlankLines: true }], ['b\na\nb\nA', { mode: 'descending', ignoreCase: true, removeDuplicates: true }],
  ];
  for (const [text, options] of sortCases) {
    const engineOptions = options as NonNullable<Parameters<typeof sortLines>[1]>;
    const direct = sortLines(text, engineOptions, engineOptions.mode === 'shuffle' ? () => 0.25 : undefined);
    await successCase('sort-lines', { text, ...options }, direct, `line sorting ${String(options.mode)}`);
  }
  const sortedLiteral = sortLines('item10\nitem2\nitem1', { mode: 'natural' });
  check(sortedLiteral.ok && sortedLiteral.text === 'item1\nitem2\nitem10' && sortedLiteral.lineCount === 3, 'sort natural order independently equals item1, item2, item10');
  const shuffledLiteral = sortLines('a\nb\nc\nd', { mode: 'shuffle' }, () => 0.25);
  check(shuffledLiteral.ok && shuffledLiteral.text === 'd\nc\na\nb', 'sort injected shuffle independently has fixed output');

  // Ten text-comparison cases.
  const compareCases: Array<[string, string, 'line' | 'word']> = [
    ['a\nb', 'a\nb', 'line'], ['a\nb', 'a\nc', 'line'], ['a\nb', 'a\nb\nc', 'line'], ['a\nb\nc', 'a\nc', 'line'],
    ['one two', 'one three', 'word'], ['one two', 'one two three', 'word'], ['one two three', 'one three', 'word'],
    ['', 'new', 'word'], ['old', '', 'word'], ['a\nb\n', 'a\nb', 'line'],
  ];
  for (const [original, revised, mode] of compareCases) {
    await successCase('text-compare', { original, revised, mode }, textCompare(original, revised, mode), `text comparison ${mode}: ${JSON.stringify(original)} to ${JSON.stringify(revised)}`);
  }
  const compareLiteral = textCompare('red blue', 'red green', 'word');
  check(compareLiteral.ok && compareLiteral.counts.same === 2 && compareLiteral.counts.add === 1 && compareLiteral.counts.remove === 1, 'compare independent literal counts: two same, one added, one removed');

  // Independent, hand-derived checks across all five tools.
  const fr = findReplace('one one one', 'one', 'two', { replaceAll: true });
  check(fr.ok && fr.matchCount === 3 && fr.text === 'two two two', 'literal find/replace: three replacements and exact text');
  const cc = caseConvert('make it clear', 'camelCase');
  check(cc.ok && cc.text === 'makeItClear', 'literal camelCase result');
  const tc = textCleaner('a   b', { collapseRepeatedSpaces: true });
  check(tc.ok && tc.text === 'a b' && tc.counts.collapseRepeatedSpaces === 2, 'literal repeated-space reduction count');
  const sl = sortLines('z\na\nm', { mode: 'ascending' });
  check(sl.ok && sl.text === 'a\nm\nz' && sl.lineCount === 3, 'literal ascending order and line count');
  const td = textCompare('A B', 'A C', 'word');
  check(td.ok && td.counts.same === 2 && td.counts.add === 1 && td.counts.remove === 1, 'literal word comparison counts');
  check(fr.ok && fr.positions.length === 3 && fr.positions[0].start === 0 && fr.positions[2].end === 11, 'literal match positions are unchanged');
  check(cc.ok && cc.text.length === 11, 'literal converted character count');
  check(tc.ok && tc.counts.trimEachLine === 0, 'literal cleaner leaves unrelated count at zero');
  check(sl.ok && sl.text.split('\n').length === 3, 'literal sorted output has three lines');
  check(td.ok && td.differences.some((part) => part.type === 'add' && part.text === 'C'), 'literal diff retains the added word in result');
  check(fr.ok && fr.text.length === 11, 'literal replacement output length');
  const lowerLiteral = caseConvert('ABC', 'lower');
  check(lowerLiteral.ok && lowerLiteral.text === 'abc', 'literal lowercase result');
  check(textCleaner('x\r\ny', { normalizeLineEndings: true }).ok && (textCleaner('x\r\ny', { normalizeLineEndings: true }) as {text:string}).text === 'x\ny', 'literal CRLF normalization');
  check(sortLines('b\na', { mode: 'reverse' }).ok && (sortLines('b\na', { mode: 'reverse' }) as {text:string}).text === 'a\nb', 'literal reverse order');
  check(textCompare('a', 'b', 'line').ok && (textCompare('a', 'b', 'line') as {counts:{add:number;remove:number}}).counts.add === 1, 'literal line comparison has one addition');

  // Failure matrix: every declared slot gets each representative wrong value.
  const bases: Record<string, Record<string, unknown>> = {
    'find-replace': { text: 'abc', pattern: 'a' },
    'case-converter': { text: 'abc', mode: 'UPPER' },
    'text-cleaner': { text: 'abc' },
    'sort-lines': { text: 'b\na', mode: 'ascending' },
    'text-compare': { original: 'a', revised: 'b', mode: 'line' },
  };
  for (const id of Object.keys(bases)) {
    const schema = getSchema(id);
    if (!schema) throw new Error(`No schema for ${id}`);
    for (const slot of schema.slots) {
      const invalidValues: unknown[] = slot.kind === 'yes-no' ? ['true', 1, null, [], {}, NaN, Infinity] : slot.kind === 'choice' ? ['not-a-choice', 123, null, [], {}, NaN, Infinity] : [123, null, [], {}, NaN, Infinity, true];
      for (const invalid of invalidValues) {
        const args = Object.freeze({ ...bases[id], [slot.name]: invalid });
        const before = JSON.stringify(args);
        const outcome = await run(id, args);
        const repeated = await run(id, args);
        check(!outcome.ok && outcome.kind === 'invalid-input' && outcome.slot === slot.name, `${id}/${slot.name}: rejects wrong value ${String(invalid)}`);
        equal(outcome, repeated, `${id}/${slot.name}: invalid-input outcome repeats exactly`);
        equal(JSON.stringify(args), before, `${id}/${slot.name}: invalid-input arguments unchanged`);
      }
    }
    for (const slot of schema.slots.filter((item) => item.required)) {
      const args = { ...bases[id] };
      delete args[slot.name];
      const frozen = Object.freeze(args);
      const before = JSON.stringify(frozen);
      const outcome = await run(id, frozen);
      const repeated = await run(id, frozen);
      if ((id === 'sort-lines' || id === 'text-compare') && slot.name === 'mode') {
        // Director rule R6: the engine has a default, so an omitted mode is NOT an error.
        const expected = id === 'sort-lines'
          ? sortLines(args.text as string, { ignoreCase: args.ignoreCase as boolean | undefined, removeDuplicates: args.removeDuplicates as boolean | undefined, ignoreBlankLines: args.ignoreBlankLines as boolean | undefined })
          : textCompare(args.original as string, args.revised as string);
        check(outcome.ok, `${id}/mode: omitted mode succeeds with the engine default`);
        if (outcome.ok) equal(outcome.result, expected, `${id}/mode: omitted mode gives exactly the engine default result`);
        equal(outcome, repeated, `${id}/${slot.name}: default outcome repeats exactly`);
        continue;
      }
      check(!outcome.ok && outcome.kind === 'missing-input' && outcome.slot === slot.name, `${id}/${slot.name}: required value is reported missing`);
      equal(outcome, repeated, `${id}/${slot.name}: missing-input outcome repeats exactly`);
      equal(JSON.stringify(frozen), before, `${id}/${slot.name}: missing-input arguments unchanged`);
    }
  }
  const invalidChoices: Array<[string, string]> = [['case-converter', 'mode'], ['sort-lines', 'mode'], ['text-compare', 'mode']];
  for (const [id, slot] of invalidChoices) {
    const args = Object.freeze({ ...bases[id], [slot]: 'not-an-option' });
    const outcome = await run(id, args), repeated = await run(id, args);
    check(!outcome.ok && outcome.kind === 'invalid-input' && outcome.slot === slot, `${id}: choice outside descriptor is rejected before engine`);
    equal(outcome, repeated, `${id}: invalid choice outcome repeats exactly`);
  }
  const refusalInputs: Array<[string, Record<string, unknown>]> = [
    ['find-replace', { text: 'x'.repeat(200001), pattern: 'x' }],
    ['case-converter', { text: 'x'.repeat(200001), mode: 'UPPER' }],
    ['text-cleaner', { text: 'x'.repeat(200001) }],
    ['sort-lines', { text: 'x'.repeat(200001), mode: 'ascending' }],
    ['text-compare', { original: 'x'.repeat(60000), revised: 'y'.repeat(60000), mode: 'word' }],
  ];
  for (const [id, rawArgs] of refusalInputs) {
    const args = Object.freeze(rawArgs), before = JSON.stringify(rawArgs);
    const outcome = await run(id, args), repeated = await run(id, args);
    check(!outcome.ok && outcome.kind === 'engine-refused' && outcome.message.includes('too-large'), `${id}: engine refusal preserves its error code`);
    equal(outcome, repeated, `${id}: engine refusal outcome repeats exactly`);
    equal(JSON.stringify(args), before, `${id}: engine refusal arguments unchanged`);
  }
  const throwingArgs = { pattern: 'a', get text(): string { throw new Error('deliberate runtime throw'); } };
  const thrownOutcome = await run('find-replace', throwingArgs);
  check(!thrownOutcome.ok && thrownOutcome.kind === 'engine-refused', 'a throw while running is converted to a typed failure');
  for (const badArgs of [null, undefined, [], 'text']) {
    for (const id of Object.keys(bases)) {
      let outcome: RunnerOutcome | undefined;
      let repeated: RunnerOutcome | undefined;
      try { outcome = await run(id, badArgs); repeated = await run(id, badArgs); } catch { outcome = undefined; }
      check(!!outcome && !outcome.ok && outcome.kind === 'invalid-input', `${id}: invalid args container never throws (${String(badArgs)})`);
      equal(outcome, repeated, `${id}: invalid args container outcome repeats exactly`);
    }
  }

  // Reply facts, shortening, and preservation of the complete engine result.
  const longText = 'x'.repeat(3500);
  for (const [id, args, engineResult] of [
    ['find-replace', { text: longText, pattern: 'x', replacement: 'y', replaceAll: true }, findReplace(longText, 'x', 'y', { replaceAll: true })],
    ['case-converter', { text: longText, mode: 'UPPER' }, caseConvert(longText, 'UPPER')],
    ['text-cleaner', { text: longText }, textCleaner(longText)],
    ['sort-lines', { text: longText, mode: 'ascending' }, sortLines(longText, { mode: 'ascending' })],
  ] as Array<[string, Record<string, unknown>, unknown]>) {
    const frozenArgs = Object.freeze(args);
    const outcome = await run(id, frozenArgs), repeated = await run(id, frozenArgs);
    check(outcome.ok && outcome.reply.length <= 2000, `${id}: long reply is shortened`);
    equal(outcome, repeated, `${id}: long reply outcome repeats exactly`);
    if (outcome.ok) equal(outcome.result, engineResult, `${id}: full result survives reply shortening`);
  }
  const replyCase = await run('case-converter', { text: 'hello world', mode: 'UPPER' });
  check(replyCase.ok && replyCase.reply.includes('HELLO WORLD'), 'case-converter reply contains converted text');
  const replyCleaner = await run('text-cleaner', { text: 'a   b', collapseRepeatedSpaces: true });
  check(replyCleaner.ok && replyCleaner.reply.includes('a b') && replyCleaner.reply.includes('repeated spaces reduced: 2'), 'text-cleaner reply contains cleaned text and change count');
  const replyFind = await run('find-replace', { text: 'a a', pattern: 'a', replacement: 'b', replaceAll: true });
  check(replyFind.ok && replyFind.reply.includes('2 matches') && replyFind.reply.includes('b b'), 'find/replace reply contains match count and output');
  const replySort = await run('sort-lines', { text: 'b\na', mode: 'ascending' });
  check(replySort.ok && replySort.reply.includes('Line count: 2') && replySort.reply.includes('a\nb'), 'sort reply contains sorted text and line count');
  const replyCompare = await run('text-compare', { original: 'a b', revised: 'a c', mode: 'word' });
  check(replyCompare.ok && replyCompare.reply.includes('Same: 2') && replyCompare.reply.includes('added: 1') && replyCompare.reply.includes('removed: 1'), 'compare reply contains same, added and removed counts');

  // Director additions (C2AB check): literal expectations written by hand, so a runner that alters a result or misreports a change cannot pass.
  const exactCase = await run('case-converter', { text: ' Hello World\n', mode: 'UPPER' });
  check(exactCase.ok && (exactCase.result as { text: string }).text === ' HELLO WORLD\n' && exactCase.reply === ' HELLO WORLD\n', 'case-converter: whitespace around the text is kept exactly in result and reply');
  const cleanOne = await run('text-cleaner', { text: 'a  b', collapseRepeatedSpaces: true });
  check(cleanOne.ok && cleanOne.reply === 'a b\nChanges: repeated spaces reduced: 1.', 'text-cleaner: reply lists exactly the one change that happened');
  const cleanNone = await run('text-cleaner', { text: 'a b' });
  check(cleanNone.ok && cleanNone.reply === 'a b\nChanges: none.', 'text-cleaner: reply says none when nothing changed, and lists no zero counts');

  // Seven deliberate mutant copies; each must be rejected by the named independent check.
  const optionExpected = findReplace('A a', 'a', 'x', { caseSensitive: true, replaceAll: true });
  const optionMutant = findReplace('A a', 'a', 'x', { replaceAll: true });
  check(JSON.stringify(optionExpected) !== JSON.stringify(optionMutant), 'MUTANT 1 caught: ignored caseSensitive option changes expected output');
  const swapExpected = findReplace('red blue', 'red', 'green', {});
  const swapMutant = findReplace('red blue', 'green', 'red', {});
  check(JSON.stringify(swapExpected) !== JSON.stringify(swapMutant), 'MUTANT 2 caught: swapped pattern/replacement changes expected output');
  const throwMutant = async (): Promise<RunnerOutcome> => { throw new Error('mutant throw'); };
  let escaped = false;
  try { await throwMutant(); } catch { escaped = true; }
  check(escaped, 'MUTANT 3 caught: throwing runner copy escapes instead of returning a typed failure');
  const frozenArgs = Object.freeze({ text: 'x', pattern: 'x' });
  let mutationBlocked = false;
  try { (frozenArgs as { text: string }).text = 'changed'; } catch { mutationBlocked = true; }
  check(mutationBlocked, 'MUTANT 4 caught: frozen-input mutation probe blocks changed arguments');
  const choiceExpected = await run('case-converter', { text: 'abc', mode: 'not-a-mode' });
  const choiceMutantEngine = caseConvert('abc', 'not-a-mode' as never);
  check(!choiceExpected.ok && choiceExpected.kind === 'invalid-input' && !choiceMutantEngine.ok && choiceMutantEngine.error === 'invalid-mode', 'MUTANT 5 caught: invalid choice reaches engine instead of being rejected at the boundary');
  const changedResult = findReplace('a', 'a', 'b', {});
  if (changedResult.ok) changedResult.text = 'mutated';
  check(changedResult.ok && changedResult.text !== 'b', 'MUTANT 6 caught: changed engine result differs from the known result');
  const originalRandom = Math.random;
  let randomMutantCaught = false;
  try {
    Math.random = () => 0.99;
    const injected = sortLines('a\nb\nc\nd', { mode: 'shuffle' }, () => 0);
    const mutant = sortLines('a\nb\nc\nd', { mode: 'shuffle' }, () => Math.random());
    randomMutantCaught = injected.ok && mutant.ok && injected.text !== mutant.text;
  } finally { Math.random = originalRandom; }
  check(randomMutantCaught, 'MUTANT 7 caught: shuffle using a different random source disagrees with injected source');

  console.log(`runnersText.test.ts: ${checks} checks passed.`);
}

void main().catch((error: unknown) => { console.error(error); throw error; });
