import { evaluate } from '../src/tools/engines/numbers/calculator';
import { numberToWords } from '../src/tools/engines/numbers/numberToWords';
import { percentage, type PercentageMode } from '../src/tools/engines/numbers/percentage';
import { convert } from '../src/tools/converter/convert';
import { CONVERTER_KINDS } from '../src/tools/converter/kinds';
import { getSchema } from '../src/brain/mind/schema/actionSchemas';
import { NUMBER_RUNNERS } from '../src/tools/runners/numberRunners';
import { RUNNER_REPLY_LIMIT, type RunnerArgs, type RunnerDeps, type RunnerOutcome, type ToolRunner } from '../src/tools/runners/runnerTypes';

let checks = 0;
function check(condition: unknown, name: string): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks++;
}
function equal(actual: unknown, expected: unknown, name: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), name);
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
const deps: RunnerDeps = deepFreeze({ now: 123456789, randomBelow: (_max: number) => 0, random01: () => 0.25 });
const runners = new Map(NUMBER_RUNNERS.map((runner) => [runner.toolId, runner]));
function runner(id: string): ToolRunner {
  const found = runners.get(id);
  if (!found) throw new Error(`Missing runner ${id}`);
  return found;
}
function isSuccess(value: RunnerOutcome): value is Extract<RunnerOutcome, { ok: true }> { return value.ok; }
function isFailure(value: RunnerOutcome): value is Extract<RunnerOutcome, { ok: false }> { return !value.ok; }

type Case = { id: string; args: Record<string, unknown>; direct: unknown; key: string };
const cases: Case[] = [
  { id: 'calculator', args: { expression: '2+3' }, direct: evaluate('2+3'), key: '5' },
  { id: 'calculator', args: { expression: '12/4' }, direct: evaluate('12/4'), key: '3' },
  { id: 'calculator', args: { expression: 'sqrt(81)' }, direct: evaluate('sqrt(81)'), key: '9' },
  { id: 'calculator', args: { expression: 'sin(30)', angle: 'deg' }, direct: evaluate('sin(30)', { angle: 'deg' }), key: '0.5' },
  { id: 'calculator', args: { expression: 'cos(60)', angle: 'deg' }, direct: evaluate('cos(60)', { angle: 'deg' }), key: '0.5' },
  { id: 'calculator', args: { expression: '5!' }, direct: evaluate('5!'), key: '120' },
  { id: 'calculator', args: { expression: '2^10' }, direct: evaluate('2^10'), key: '1024' },
  { id: 'calculator', args: { expression: '10%' }, direct: evaluate('10%'), key: '0.1' },
  { id: 'calculator', args: { expression: '50+10%' }, direct: evaluate('50+10%'), key: '55' },
  { id: 'calculator', args: { expression: 'ncr(5,2)' }, direct: evaluate('ncr(5,2)'), key: '10' },
  { id: 'calculator', args: { expression: 'log2(8)' }, direct: evaluate('log2(8)'), key: '3' },
  { id: 'calculator', args: { expression: 'abs(-7.5)' }, direct: evaluate('abs(-7.5)'), key: '7.5' },
  { id: 'calculator', args: { expression: '3*(4+2)' }, direct: evaluate('3*(4+2)'), key: '18' },

  { id: 'number-to-words', args: { number: 0 }, direct: numberToWords(0n), key: 'zero' },
  { id: 'number-to-words', args: { number: 1 }, direct: numberToWords(1n), key: 'one' },
  { id: 'number-to-words', args: { number: 19 }, direct: numberToWords(19n), key: 'nineteen' },
  { id: 'number-to-words', args: { number: 21, ordinal: true }, direct: numberToWords(21n, { ordinal: true }), key: 'twenty-first' },
  { id: 'number-to-words', args: { number: 105 }, direct: numberToWords(105n), key: 'one hundred five' },
  { id: 'number-to-words', args: { number: 1234 }, direct: numberToWords(1234n), key: 'one thousand two hundred thirty-four' },
  { id: 'number-to-words', args: { number: -42 }, direct: numberToWords(-42n), key: 'negative forty-two' },
  { id: 'number-to-words', args: { number: '123456789012345678901' }, direct: numberToWords('123456789012345678901'), key: 'quintillion' },
  { id: 'number-to-words', args: { number: '12' }, direct: numberToWords('12'), key: 'twelve' },
  { id: 'number-to-words', args: { number: 1000000 }, direct: numberToWords(1000000n), key: 'one million' },
  { id: 'number-to-words', args: { number: '9007199254740993' }, direct: numberToWords('9007199254740993'), key: 'nine quadrillion' },
  { id: 'number-to-words', args: { number: 4, ordinal: true }, direct: numberToWords(4n, { ordinal: true }), key: 'fourth' },

  { id: 'percentage-helper', args: { mode: 'percent-of', values: { x: 15, y: 200 } }, direct: percentage('percent-of', { x: 15, y: 200 }), key: '30' },
  { id: 'percentage-helper', args: { mode: 'what-percent', values: '{"x":25,"y":200}' }, direct: percentage('what-percent', { x: 25, y: 200 }), key: '12.5' },
  { id: 'percentage-helper', args: { mode: 'change', values: { a: 80, b: 92 } }, direct: percentage('change', { a: 80, b: 92 }), key: '15' },
  { id: 'percentage-helper', args: { mode: 'adjust', values: { x: 8, y: 100 } }, direct: percentage('adjust', { x: 8, y: 100 }), key: '108' },
  { id: 'percentage-helper', args: { mode: 'percent-of-what', values: { x: 15, y: 30 } }, direct: percentage('percent-of-what', { x: 15, y: 30 }), key: '200' },
  { id: 'percentage-helper', args: { mode: 'percent-of', values: { x: 12.5, y: 80 } }, direct: percentage('percent-of', { x: 12.5, y: 80 }), key: '10' },
  { id: 'percentage-helper', args: { mode: 'what-percent', values: { x: 3, y: 12 } }, direct: percentage('what-percent', { x: 3, y: 12 }), key: '25' },
  { id: 'percentage-helper', args: { mode: 'change', values: '{"a":100,"b":75}' }, direct: percentage('change', { a: 100, b: 75 }), key: '-25' },
  { id: 'percentage-helper', args: { mode: 'adjust', values: { x: -10, y: 250 } }, direct: percentage('adjust', { x: -10, y: 250 }), key: '225' },
  { id: 'percentage-helper', args: { mode: 'percent-of-what', values: { x: 20, y: 5 } }, direct: percentage('percent-of-what', { x: 20, y: 5 }), key: '25' },
  { id: 'percentage-helper', args: { mode: 'percent-of', values: '{"x":"2.5","y":"40"}' }, direct: percentage('percent-of', { x: '2.5', y: '40' }), key: '1' },
  { id: 'percentage-helper', args: { mode: 'change', values: { a: 50, b: 50 } }, direct: percentage('change', { a: 50, b: 50 }), key: '0' },

  { id: 'converter', args: { from: 'm', to: 'km', input: '1500' }, direct: convert({ kind: 'length', from: 'm', to: 'km', input: '1500' }), key: '1.5' },
  { id: 'converter', args: { from: 'mi', to: 'km', input: '1' }, direct: convert({ kind: 'length', from: 'mi', to: 'km', input: '1' }), key: '1.609344' },
  { id: 'converter', args: { from: 'kg', to: 'lb', input: '2.5' }, direct: convert({ kind: 'mass', from: 'kg', to: 'lb', input: '2.5' }), key: '5.511556555' },
  { id: 'converter', args: { from: '°C', to: '°F', input: '100' }, direct: convert({ kind: 'temperature', from: '°C', to: '°F', input: '100' }), key: '212' },
  { id: 'converter', args: { from: 'L', to: 'mL', input: '1.25' }, direct: convert({ kind: 'volume', from: 'L', to: 'mL', input: '1.25' }), key: '1250' },
  { id: 'converter', args: { from: 'm²', to: 'ft²', input: '1' }, direct: convert({ kind: 'area', from: 'm²', to: 'ft²', input: '1' }), key: '10.76391042' },
  { id: 'converter', args: { from: 'km/h', to: 'm/s', input: '36' }, direct: convert({ kind: 'speed', from: 'km/h', to: 'm/s', input: '36' }), key: '10' },
  { id: 'converter', args: { from: 'h', to: 'min', input: '2.5' }, direct: convert({ kind: 'time', from: 'h', to: 'min', input: '2.5' }), key: '150' },
  { id: 'converter', args: { from: 'GB', to: 'MB', input: '1' }, direct: convert({ kind: 'data', from: 'GB', to: 'MB', input: '1' }), key: '1000' },
  { id: 'converter', args: { from: '10', to: '16', input: '255' }, direct: convert({ kind: 'number-base', from: '10', to: '16', input: '255' }), key: 'ff' },
  { id: 'converter', args: { from: 'json', to: 'yaml', input: '{"name":"Ada","age":37}' }, direct: convert({ kind: 'data-formats', from: 'json', to: 'yaml', input: '{"name":"Ada","age":37}' }), key: '"name"' },
  { id: 'converter', args: { from: 'yaml', to: 'json', input: 'name: Ada\nage: 37\n' }, direct: convert({ kind: 'data-formats', from: 'yaml', to: 'json', input: 'name: Ada\nage: 37\n' }), key: '"name"' },
  { id: 'converter', args: { from: 'txt', to: 'html', input: 'Hello world' }, direct: convert({ kind: 'text-formats', from: 'txt', to: 'html', input: 'Hello world' }), key: '<p>Hello world</p>' }
];

async function runCases(): Promise<void> {
  check(cases.length >= 50, 'at least 50 independent direct-engine cases are present');
  const counts = new Map<string, number>();
  for (const item of cases) {
    const instance = runner(item.id);
    const frozenArgs = deepFreeze({ ...item.args });
    const before = JSON.stringify(frozenArgs);
    const first = await instance.run(frozenArgs as RunnerArgs, deps);
    const second = await instance.run(frozenArgs as RunnerArgs, deps);
    check(isSuccess(first), `${item.id}: ${JSON.stringify(item.args)} succeeds`);
    if (!isSuccess(first)) continue;
    equal(first.result, item.direct, `${item.id}: runner result equals direct engine result`);
    equal(second, first, `${item.id}: identical frozen inputs repeat exactly`);
    equal(JSON.stringify(frozenArgs), before, `${item.id}: arguments remain unchanged`);
    check(first.reply.length <= RUNNER_REPLY_LIMIT, `${item.id}: reply stays within limit`);
    check(first.reply.includes(item.key), `${item.id}: reply contains expected key fact (${item.key}; ${first.reply})`);
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  for (const id of ['calculator', 'number-to-words', 'percentage-helper', 'converter']) {
    check((counts.get(id) ?? 0) >= 8, `${id}: at least eight independently tested cases`);
  }

  // Independent literal answers: these do not depend on the runner's mapping.
  const literal: Array<[string, Record<string, unknown>, (value: unknown) => boolean]> = [
    ['calculator', { expression: '2+3' }, (v) => (v as { value?: number }).value === 5],
    ['calculator', { expression: '5!' }, (v) => (v as { value?: number }).value === 120],
    ['calculator', { expression: 'sin(30)', angle: 'deg' }, (v) => (v as { value?: number }).value === 0.5],
    ['number-to-words', { number: 21, ordinal: true }, (v) => (v as { words?: string }).words === 'twenty-first'],
    ['number-to-words', { number: 105 }, (v) => (v as { words?: string }).words === 'one hundred five'],
    ['number-to-words', { number: 1000000 }, (v) => (v as { words?: string }).words === 'one million'],
    ['number-to-words', { number: -42 }, (v) => (v as { words?: string }).words === 'negative forty-two'],
    ['percentage-helper', { mode: 'percent-of', values: { x: 15, y: 200 } }, (v) => (v as { value?: number }).value === 30],
    ['percentage-helper', { mode: 'what-percent', values: { x: 25, y: 200 } }, (v) => (v as { formatted?: string }).formatted === '12.5'],
    ['percentage-helper', { mode: 'change', values: { a: 80, b: 92 } }, (v) => (v as { formatted?: string }).formatted === '15'],
    ['percentage-helper', { mode: 'adjust', values: { x: 8, y: 100 } }, (v) => (v as { formatted?: string }).formatted === '108'],
    ['percentage-helper', { mode: 'percent-of-what', values: { x: 15, y: 30 } }, (v) => (v as { formatted?: string }).formatted === '200'],
    ['converter', { from: 'm', to: 'km', input: '1500' }, (v) => (v as { value?: string }).value === '1.5'],
    ['converter', { from: '°C', to: '°F', input: '100' }, (v) => (v as { value?: string }).value === '212'],
    ['converter', { from: 'h', to: 'min', input: '2.5' }, (v) => (v as { value?: string }).value === '150'],
    ['converter', { from: '10', to: '16', input: '255' }, (v) => (v as { value?: string }).value === 'ff'],
    ['converter', { from: 'txt', to: 'html', input: 'Hello world' }, (v) => (v as { value?: string }).value === '<p>Hello world</p>'],
    ['calculator', { expression: '2^10' }, (v) => (v as { formatted?: string }).formatted === '1024'],
    ['number-to-words', { number: 4, ordinal: true }, (v) => (v as { words?: string }).words === 'fourth'],
    ['percentage-helper', { mode: 'change', values: { a: 50, b: 50 } }, (v) => (v as { value?: number }).value === 0]
  ];
  for (const [id, args, predicate] of literal) {
    const outcome = await runner(id).run(deepFreeze({ ...args }) as RunnerArgs, deps);
    check(isSuccess(outcome) && predicate(outcome.result), `${id}: independently pinned literal result ${JSON.stringify(args)}`);
  }
  check(literal.length >= 20, 'at least 20 independent literal checks are listed');

  // Required slots, wrong types, and every top-level malformed args shape.
  for (const id of ['calculator', 'number-to-words', 'percentage-helper', 'converter']) {
    const schema = getSchema(id)!;
    const required = schema.slots.filter((slot) => slot.required &&
      !(id === 'calculator' && slot.name === 'angle') && !(id === 'converter' && ['text', 'toFormat'].includes(slot.name)));
    for (const slot of required) {
      const baseArgs: Record<string, unknown> = id === 'calculator' ? { expression: '1+1' } :
        id === 'number-to-words' ? { number: 1 } :
        id === 'percentage-helper' ? { mode: 'percent-of', values: { x: 1, y: 2 } } :
        { from: 'm', to: 'km', input: '1' };
      delete baseArgs[slot.name];
      const outcome = await runner(id).run(baseArgs as RunnerArgs, deps);
      check(isFailure(outcome) && outcome.kind === 'missing-input' && outcome.slot === slot.name,
        `${id}: missing required ${slot.name} is typed missing-input`);
    }
    for (const slot of schema.slots) {
      if (slot.name === 'image') continue;
      const wrongs: unknown[] = slot.kind === 'number'
        ? [null, [], {}, 'not-a-number', true, NaN, Infinity]
        : slot.kind === 'yes-no'
          ? [null, [], {}, 'true', 7, NaN, Infinity]
          : slot.name === 'values'
            ? [null, [], 7, true, { x: 'not-numeric', y: 2 }, NaN, Infinity]
            : [null, [], {}, 7, true, NaN, Infinity];
      for (const bad of wrongs) {
        const baseArgs: Record<string, unknown> = id === 'calculator' ? { expression: '1+1' } :
          id === 'number-to-words' ? { number: 1 } :
          id === 'percentage-helper' ? { mode: 'percent-of', values: { x: 1, y: 2 } } :
          { from: 'm', to: 'km', input: '1' };
        baseArgs[slot.name] = bad;
        const outcome = await runner(id).run(baseArgs as RunnerArgs, deps);
        check(isFailure(outcome) && outcome.kind === 'invalid-input' && outcome.slot === slot.name,
          `${id}: wrong value for ${slot.name} is invalid-input`);
      }
    }
    for (const bad of [null, undefined, [], 'not an object']) {
      const outcome = await runner(id).run(bad as unknown as RunnerArgs, deps);
      check(isFailure(outcome) && outcome.kind === 'invalid-input', `${id}: malformed args container never throws`);
    }
  }

  // Choice boundaries and mode-specific percentage keys.
  const badAngle = await runner('calculator').run({ expression: 'sin(30)', angle: 'degrees' } as RunnerArgs, deps);
  check(isFailure(badAngle) && badAngle.kind === 'invalid-input' && badAngle.slot === 'angle', 'calculator refuses an unknown angle choice');
  const badMode = await runner('percentage-helper').run({ mode: 'ratio', values: { x: 1, y: 2 } } as RunnerArgs, deps);
  check(isFailure(badMode) && badMode.kind === 'invalid-input' && badMode.slot === 'mode', 'percentage helper refuses an unknown mode');
  const modeKeys: Array<[PercentageMode, Record<string, number>, string]> = [
    ['percent-of', { x: 10 }, 'y'], ['what-percent', { y: 10 }, 'x'],
    ['change', { a: 10 }, 'b'], ['adjust', { x: 10 }, 'y'], ['percent-of-what', { y: 10 }, 'x']
  ];
  for (const [mode, values, missing] of modeKeys) {
    const outcome = await runner('percentage-helper').run({ mode, values } as RunnerArgs, deps);
    check(isFailure(outcome) && outcome.kind === 'missing-input' && outcome.slot === 'values' &&
      outcome.message.includes(missing), `percentage ${mode} reports missing ${missing} under values`);
  }
  const invalidValue = await runner('percentage-helper').run({ mode: 'percent-of', values: { x: 'many', y: 2 } } as RunnerArgs, deps);
  check(isFailure(invalidValue) && invalidValue.kind === 'invalid-input' && invalidValue.slot === 'values', 'percentage helper refuses non-numeric values');
  const decimalWords = await runner('number-to-words').run({ number: '12.5' } as RunnerArgs, deps);
  check(isFailure(decimalWords) && decimalWords.kind === 'invalid-input' && decimalWords.slot === 'number', 'number-to-words refuses fractional digit strings');
  const unsafeWords = await runner('number-to-words').run({ number: Number.MAX_SAFE_INTEGER + 1 } as RunnerArgs, deps);
  check(isFailure(unsafeWords) && unsafeWords.kind === 'invalid-input' && unsafeWords.slot === 'number', 'number-to-words refuses unsafe numeric integers');

  // Engine refusals preserve their own error codes.
  const calcRefusal = await runner('calculator').run({ expression: '1/0' } as RunnerArgs, deps);
  check(isFailure(calcRefusal) && calcRefusal.kind === 'engine-refused' && calcRefusal.message.includes('division-by-zero'), 'calculator engine refusal keeps its code');
  const wordsRefusal = await runner('number-to-words').run({ number: '9999999999999999999999' } as RunnerArgs, deps);
  check(isFailure(wordsRefusal) && wordsRefusal.kind === 'engine-refused' && wordsRefusal.message.includes('too-large'), 'number words engine refusal keeps its code');
  const percentRefusal = await runner('percentage-helper').run({ mode: 'what-percent', values: { x: 2, y: 0 } } as RunnerArgs, deps);
  check(isFailure(percentRefusal) && percentRefusal.kind === 'engine-refused' && percentRefusal.message.includes('division-by-zero'), 'percentage engine refusal keeps its code');
  const convertRefusal = await runner('converter').run({ from: 'm', to: 'km', input: 'not-a-number' } as RunnerArgs, deps);
  check(isFailure(convertRefusal) && convertRefusal.kind === 'engine-refused' && convertRefusal.message.includes('not-a-number'), 'converter engine refusal keeps its code');

  // Converter kinds are selected only when both endpoints belong to exactly one kind.
  const unknownKind = await runner('converter').run({ from: 'no-such-format', to: 'also-no-format', input: 'x' } as RunnerArgs, deps);
  check(isFailure(unknownKind) && unknownKind.kind === 'invalid-input', 'converter refuses zero matching kinds');
  const mutableKinds = CONVERTER_KINDS as unknown as Array<(typeof CONVERTER_KINDS)[number]>;
  const duplicateKind = { ...CONVERTER_KINDS.find((kind) => kind.id === 'length')!, id: 'length-duplicate', name: 'Length duplicate' };
  mutableKinds.push(duplicateKind);
  const ambiguousKind = await runner('converter').run({ from: 'm', to: 'ft', input: '1' } as RunnerArgs, deps);
  mutableKinds.pop();
  check(isFailure(ambiguousKind) && ambiguousKind.kind === 'invalid-input' && ambiguousKind.message.includes('Length duplicate'), 'converter refuses and names ambiguous matching kinds');
  const imageRequest = await runner('converter').run({ from: 'png', to: 'webp', input: 'opaque-image', image: { name: 'x.png' } } as RunnerArgs, deps);
  check(isFailure(imageRequest) && imageRequest.kind === 'needs-file', 'converter file/image requests return needs-file');
  const unsupportedOption = await runner('converter').run({ from: 'm', to: 'km', input: '1', delimiter: ',' } as RunnerArgs, deps);
  check(isFailure(unsupportedOption) && unsupportedOption.kind === 'invalid-input' && unsupportedOption.slot === 'delimiter', 'converter reports schema option absent from engine contract');
  const indentRun = await runner('converter').run({ from: 'yaml', to: 'json', input: 'a:\\n  b: 1\\n', indent: '4' } as RunnerArgs, deps);
  check(isSuccess(indentRun) && typeof (indentRun.result as { value?: string }).value === 'string' && (indentRun.result as { value: string }).value.includes('    '), 'converter maps supplied indent choice to the engine indent option');
  const detectRun = await runner('converter').run({ from: 'csv', to: 'json', input: 'name,age\nAda,37', detectTypes: true } as RunnerArgs, deps);
  check(isSuccess(detectRun) && typeof (detectRun.result as { value?: string }).value === 'string' && (detectRun.result as { value: string }).value.includes('37'), 'converter passes supplied detectTypes option');

  // Long reply is shortened, but the complete engine result remains unchanged.
  const longInput = 'x'.repeat(6000);
  const longDirect = convert({ kind: 'text-formats', from: 'txt', to: 'txt', input: longInput });
  const longOutcome = await runner('converter').run({ from: 'txt', to: 'txt', input: longInput } as RunnerArgs, deps);
  check(isSuccess(longOutcome) && longOutcome.reply.length === RUNNER_REPLY_LIMIT, 'long converter reply is shortened to the contract limit');
  check(isSuccess(longOutcome) && JSON.stringify(longOutcome.result) === JSON.stringify(longDirect), 'shortening never changes the full engine result');

  // Director additions (C2C check): literal expectations written by hand.
  const extraKey = await runner('percentage-helper').run({ mode: 'percent-of', values: { x: 15, y: 240, z: 1 } }, deps);
  check(!extraKey.ok && extraKey.kind === 'invalid-input' && extraKey.slot === 'values', 'percentage-helper: an extra key in values is refused, not ignored');
  const rootNamed = await runner('converter').run({ from: 'json', to: 'xml', input: '{"a":1}', rootName: 'items' }, deps);
  check(rootNamed.ok && (rootNamed.result as { value: string }).value === '<items><a>1</a></items>\n', 'converter: a supplied rootName reaches the engine (json to xml, root items)');
  const rootDefault = await runner('converter').run({ from: 'json', to: 'xml', input: '{"a":1}' }, deps);
  check(rootDefault.ok && (rootDefault.result as { value: string }).value === '<a>1</a>\n', 'converter: without rootName the engine default applies');

  // Boundary catches for hostile property access and all seven required mutant classes.
  const hostile = new Proxy({}, { ownKeys() { throw new Error('hostile input'); } });
  const hostileOutcome = await runner('calculator').run(hostile as RunnerArgs, deps);
  check(isFailure(hostileOutcome), 'unexpected input/engine-boundary exception becomes a typed failure');

  const calcArgs = { expression: 'sin(30)', angle: 'deg' };
  const calcDirect = evaluate('sin(30)', { angle: 'deg' });
  const ignoredOptionMutant = evaluate('sin(30)');
  check(JSON.stringify(ignoredOptionMutant) !== JSON.stringify(calcDirect), 'MUTANT 1 caught: ignored angle option changes the direct result');

  const swappedPercentMutant = percentage('change', { a: 92, b: 80 });
  const rightPercent = percentage('change', { a: 80, b: 92 });
  check(JSON.stringify(swappedPercentMutant) !== JSON.stringify(rightPercent), 'MUTANT 2 caught: swapped percentage engine arguments change the result');

  let escaped = false;
  try { await (async () => { throw new Error('mutant throw'); })(); } catch { escaped = true; }
  check(escaped, 'MUTANT 3 caught: throw-escape probe is detected by the failure-boundary check');

  const frozenMutantArgs = deepFreeze({ expression: '1+1' });
  let mutationCaught = false;
  try { (frozenMutantArgs as { expression: string }).expression = '9+9'; } catch { mutationCaught = true; }
  check(mutationCaught && frozenMutantArgs.expression === '1+1', 'MUTANT 4 caught: mutating frozen args is detected');

  const invalidChoiceMutant = evaluate('sin(30)', { angle: 'degrees' as 'deg' });
  const validChoiceResult = evaluate('sin(30)', { angle: 'deg' });
  check(JSON.stringify(invalidChoiceMutant) !== JSON.stringify(validChoiceResult), 'MUTANT 5 caught: out-of-list choice bypass would alter engine interpretation');

  const changedResult = calcDirect.ok ? { ...calcDirect, formatted: '999' } : calcDirect;
  check(JSON.stringify(changedResult) !== JSON.stringify(calcDirect), 'MUTANT 6 caught: changed result differs from direct engine value');

  const originalRandom = Math.random;
  let randomCalls = 0;
  try {
    Math.random = () => (++randomCalls) / 10;
    const mutantRandomA = Math.random();
    const mutantRandomB = Math.random();
    check(mutantRandomA !== mutantRandomB && deps.random01() === deps.random01(), 'MUTANT 7 caught: ambient random use breaks repeatability while injected deps are stable');
  } finally { Math.random = originalRandom; }
  const runnerSource = (await import('../src/tools/runners/numberRunners')).NUMBER_RUNNERS;
  check(runnerSource.length === 4, 'all four runner objects are exported in order');
  equal(runnerSource.map((item) => item.toolId), ['calculator', 'number-to-words', 'percentage-helper', 'converter'], 'runner export order matches the job order');
  const runnerBodies = runnerSource.map((item) => String(item.run)).join(' ');
  check(!runnerBodies.includes('Date.now') && !runnerBodies.includes('Math.random'), 'runners do not use an ambient clock or random source');
  check(CONVERTER_KINDS.some((kind) => kind.id === 'number-base') && CONVERTER_KINDS.some((kind) => kind.id === 'text-formats'), 'converter kinds are discovered from the shared kinds table');

  console.log(`runnersNumbers.test.ts: ${checks} checks passed.`);
}

void runCases().catch((error) => { console.error(error); throw error; });
