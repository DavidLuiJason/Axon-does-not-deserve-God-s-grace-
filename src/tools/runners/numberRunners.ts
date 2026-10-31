import { getSchema } from '../../brain/mind/schema/actionSchemas';
import { LEGACY_ENGINE_DESCRIPTORS } from '../engines/legacyDescriptors';
import { evaluate } from '../engines/numbers/calculator';
import { numberToWords } from '../engines/numbers/numberToWords';
import { percentage, type PercentageMode } from '../engines/numbers/percentage';
import { CONVERTER_KINDS } from '../converter/kinds';
import { convert } from '../converter/convert';
import {
  RUNNER_REPLY_LIMIT,
  runnerFail,
  shortenReply,
  type RunnerArgs,
  type RunnerDeps,
  type RunnerOutcome,
  type ToolRunner
} from './runnerTypes';

type PlainRecord = Record<string, unknown>;

const descriptors = new Map<string, (typeof LEGACY_ENGINE_DESCRIPTORS)[number]>(
  LEGACY_ENGINE_DESCRIPTORS.map((descriptor) => [descriptor.toolId, descriptor])
);

function isRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function own(record: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function validateSchemaArgs(toolId: string, raw: unknown, optionalRequired: readonly string[] = []):
  { ok: true; args: PlainRecord } | { ok: false; failure: ReturnType<typeof runnerFail> } {
  if (!isRecord(raw)) {
    return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'Provide the tool inputs as named values.') };
  }
  const schema = getSchema(toolId);
  if (!schema) return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'The tool inputs are not available.') };
  const descriptor = descriptors.get(toolId);
  const known = new Set(schema.slots.map((slot) => slot.name));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'This input is not accepted.', key) };
    }
  }
  for (const slot of schema.slots) {
    const value = raw[slot.name];
    const present = own(raw, slot.name) && value !== undefined;
    if (!present) {
      if (slot.required && !optionalRequired.includes(slot.name)) {
        return { ok: false, failure: runnerFail(toolId, 'missing-input', 'Provide this value.', slot.name) };
      }
      continue;
    }
    if (slot.kind === 'file') {
      return { ok: false, failure: runnerFail(toolId, 'needs-file', 'This request needs a file, which cannot be supplied as text.', slot.name) };
    }
    let valid = false;
    switch (slot.kind) {
      case 'text':
        valid = typeof value === 'string' ||
          (toolId === 'percentage-helper' && slot.name === 'values' && isRecord(value));
        break;
      case 'number':
        valid = (typeof value === 'number' && Number.isFinite(value)) ||
          (toolId === 'number-to-words' && slot.name === 'number' && typeof value === 'string');
        break;
      case 'yes-no': valid = typeof value === 'boolean'; break;
      case 'choice': {
        valid = typeof value === 'string';
        const choices = descriptor?.inputs.find((input) => input.name === slot.name);
        if (valid && choices && 'choices' in choices && (choices as { choices?: readonly string[] }).choices) valid = (choices as { choices: readonly string[] }).choices.includes(value as string);
        break;
      }
      default: valid = false;
    }
    if (!valid) {
      return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'This value has the wrong type or is not an available choice.', slot.name) };
    }
  }
  return { ok: true, args: raw };
}

function refused(toolId: string, code: string): RunnerOutcome {
  return runnerFail(toolId, 'engine-refused', `The tool could not complete this request (${code}).`);
}

function success(toolId: string, result: unknown, reply: string): RunnerOutcome {
  return { ok: true, toolId, result, reply: shortenReply(reply, RUNNER_REPLY_LIMIT) };
}

function parseValues(toolId: string, mode: PercentageMode, raw: unknown):
  { ok: true; values: Record<string, number | string> } | { ok: false; failure: ReturnType<typeof runnerFail> } {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) as unknown; }
    catch { return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'The values must be valid structured numbers.', 'values') }; }
  }
  if (!isRecord(value)) {
    return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'Provide the values as an object.', 'values') };
  }
  const keys: Record<PercentageMode, readonly string[]> = {
    'percent-of': ['x', 'y'],
    'what-percent': ['x', 'y'],
    change: ['a', 'b'],
    adjust: ['x', 'y'],
    'percent-of-what': ['x', 'y']
  };
  const needed = keys[mode];
  for (const key of needed) {
    if (!own(value, key) || value[key] === undefined) {
      return { ok: false, failure: runnerFail(toolId, 'missing-input', `The values need ${key}.`, 'values') };
    }
    const item = value[key];
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) return { ok: false, failure: runnerFail(toolId, 'invalid-input', `The value ${key} must be a finite number.`, 'values') };
    } else if (typeof item === 'string') {
      if (!/^[+-]?\d+(?:\.\d+)?$/.test(item.trim()) || item.trim().length > 100) {
        return { ok: false, failure: runnerFail(toolId, 'invalid-input', `The value ${key} must be numeric.`, 'values') };
      }
    } else {
      return { ok: false, failure: runnerFail(toolId, 'invalid-input', `The value ${key} must be numeric.`, 'values') };
    }
  }
  if (Object.keys(value).some((key) => !needed.includes(key))) {
    return { ok: false, failure: runnerFail(toolId, 'invalid-input', 'The values contain an unneeded key.', 'values') };
  }
  return { ok: true, values: value as Record<string, number | string> };
}

function runCalculator(raw: RunnerArgs): RunnerOutcome {
  const checked = validateSchemaArgs('calculator', raw, ['angle']);
  if (!checked.ok) return checked.failure;
  const args = checked.args;
  const angle = args.angle as 'deg' | 'rad' | undefined;
  const result = evaluate(args.expression as string, angle === undefined ? {} : { angle });
  if (!result.ok) return refused('calculator', result.error);
  return success('calculator', result, `The answer is ${result.formatted}.`);
}

function runNumberWords(raw: RunnerArgs): RunnerOutcome {
  const checked = validateSchemaArgs('number-to-words', raw, ['ordinal']);
  if (!checked.ok) return checked.failure;
  const args = checked.args;
  const input = args.number;
  let engineInput: string | bigint;
  if (typeof input === 'number') {
    if (!Number.isSafeInteger(input)) {
      return runnerFail('number-to-words', 'invalid-input', 'Use a whole number within the safe number range, or a string of digits.', 'number');
    }
    engineInput = BigInt(input);
  } else if (typeof input === 'string' && /^\d+$/.test(input)) {
    engineInput = input;
  } else {
    return runnerFail('number-to-words', 'invalid-input', 'Use a whole number or a string containing only digits.', 'number');
  }
  const ordinal = args.ordinal as boolean | undefined;
  const result = numberToWords(engineInput, ordinal === undefined ? {} : { ordinal });
  if (!result.ok) return refused('number-to-words', result.error);
  return success('number-to-words', result, result.words);
}

function runPercentage(raw: RunnerArgs): RunnerOutcome {
  const checked = validateSchemaArgs('percentage-helper', raw);
  if (!checked.ok) return checked.failure;
  const args = checked.args;
  const mode = args.mode as PercentageMode;
  const parsed = parseValues('percentage-helper', mode, args.values);
  if (!parsed.ok) return parsed.failure;
  const result = percentage(mode, parsed.values);
  if (!result.ok) return refused('percentage-helper', result.error);
  const sentences: Record<PercentageMode, string> = {
    'percent-of': `${parsed.values.x} percent of ${parsed.values.y} is ${result.formatted}.`,
    'what-percent': `${parsed.values.x} is ${result.formatted} percent of ${parsed.values.y}.`,
    change: `The percentage change from ${parsed.values.a} to ${parsed.values.b} is ${result.formatted} percent.`,
    adjust: `The adjusted value is ${result.formatted}.`,
    'percent-of-what': `${parsed.values.y} is ${result.formatted} percent of the whole.`
  };
  return success('percentage-helper', result, sentences[mode]);
}

function runConverter(raw: RunnerArgs): RunnerOutcome {
  const checked = validateSchemaArgs('converter', raw, ['text', 'toFormat']);
  if (!checked.ok) return checked.failure;
  const args = checked.args;
  const from = args.from as string;
  const to = args.to as string;
  const matches = CONVERTER_KINDS.filter((kind) =>
    kind.units.some((unit) => unit.id === from) && kind.units.some((unit) => unit.id === to)
  );
  if (matches.length === 0) {
    return runnerFail('converter', 'invalid-input', 'No supported conversion kind contains both selected formats.', 'from');
  }
  if (matches.length > 1) {
    return runnerFail('converter', 'invalid-input', `These formats match more than one kind: ${matches.map((kind) => kind.name).join(', ')}.`, 'from');
  }
  const kind = matches[0]!;
  if (kind.entry === 'file' || args.image !== undefined || args.toFormat !== undefined || args.maxSide !== undefined) {
    return runnerFail('converter', 'needs-file', 'This conversion needs an image file and cannot run from text.');
  }
  for (const unsupported of ['text', 'delimiter', 'header', 'html'] as const) {
    if (args[unsupported] !== undefined) {
      return runnerFail('converter', 'invalid-input', 'This option is not supported by the current converter engine.', unsupported);
    }
  }
  const options: { detectTypes?: boolean; rootName?: string; indent?: 2 | 4 } = {};
  if (args.detectTypes !== undefined) options.detectTypes = args.detectTypes as boolean;
  if (args.rootName !== undefined) options.rootName = args.rootName as string;
  if (args.indent !== undefined) {
    const indent = args.indent;
    if (indent !== '2' && indent !== '4') {
      return runnerFail('converter', 'invalid-input', 'Choose an indentation of 2 or 4 spaces.', 'indent');
    }
    options.indent = Number(indent) as 2 | 4;
  }
  const result = convert({
    kind: kind.id,
    from,
    to,
    input: args.input as string,
    ...(Object.keys(options).length ? { options } : {})
  });
  if (!result.ok) return refused('converter', result.error);
  const reply = result.value === args.input
    ? `The input was kept as ${result.value}. ${result.example}`
    : `The converted result is ${result.value}. ${result.example}`;
  return success('converter', result, reply);
}

export const NUMBER_RUNNERS: readonly ToolRunner[] = [
  { toolId: 'calculator', run: async (args: RunnerArgs, _deps: RunnerDeps) => { try { return runCalculator(args); } catch { return runnerFail('calculator', 'invalid-input', 'The calculation inputs could not be read.'); } } },
  { toolId: 'number-to-words', run: async (args: RunnerArgs, _deps: RunnerDeps) => { try { return runNumberWords(args); } catch { return runnerFail('number-to-words', 'invalid-input', 'The number inputs could not be read.'); } } },
  { toolId: 'percentage-helper', run: async (args: RunnerArgs, _deps: RunnerDeps) => { try { return runPercentage(args); } catch { return runnerFail('percentage-helper', 'invalid-input', 'The percentage inputs could not be read.'); } } },
  { toolId: 'converter', run: async (args: RunnerArgs, _deps: RunnerDeps) => { try { return runConverter(args); } catch { return runnerFail('converter', 'invalid-input', 'The conversion inputs could not be read.'); } } }
];
