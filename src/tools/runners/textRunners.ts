import { getSchema } from '../../brain/mind/schema/actionSchemas';
import {
  FIND_REPLACE_DESCRIPTOR,
  CASE_CONVERTER_DESCRIPTOR,
  TEXT_CLEANER_DESCRIPTOR,
  SORT_LINES_DESCRIPTOR,
  TEXT_COMPARE_DESCRIPTOR,
} from '../engines/legacyDescriptors';
import { findReplace } from '../engines/text/findReplace';
import { caseConvert } from '../engines/text/caseConvert';
import { textCleaner } from '../engines/text/textCleaner';
import { sortLines } from '../engines/text/sortLines';
import { textCompare } from '../engines/text/textCompare';
import {
  RUNNER_REPLY_LIMIT,
  runnerFail,
  shortenReply,
  type RunnerArgs,
  type RunnerDeps,
  type RunnerOutcome,
  type RunnerFailure,
  type ToolRunner,
} from './runnerTypes';

const DESCRIPTORS = [FIND_REPLACE_DESCRIPTOR, CASE_CONVERTER_DESCRIPTOR, TEXT_CLEANER_DESCRIPTOR, SORT_LINES_DESCRIPTOR, TEXT_COMPARE_DESCRIPTOR] as const;
type Descriptor = typeof DESCRIPTORS[number];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** R6 (Director): the engine has a sensible default, so the slot is optional here although the schema marks it needed. */
const ENGINE_DEFAULT_SLOTS: ReadonlySet<string> = new Set(['sort-lines:mode', 'text-compare:mode']);

function validate(toolId: string, descriptor: Descriptor, args: Record<string, unknown>): RunnerFailure | null {
  const schema = getSchema(toolId);
  if (!schema) return runnerFail(toolId, 'invalid-input', 'This action is not available.');
  const slots = new Map<string, (typeof schema.slots)[number]>(schema.slots.map((slot) => [slot.name, slot]));
  const descriptorInputs = new Map<string, { choices?: readonly string[] }>(descriptor.inputs.map((input) => [input.name, 'choices' in input ? { choices: input.choices } : {}]));
  for (const key of Object.keys(args)) {
    const slot = slots.get(key);
    if (!slot) return runnerFail(toolId, 'invalid-input', 'One of the supplied details is not recognised.', key);
    const value = args[key];
    if (value === undefined) continue;
    if (value === null) return runnerFail(toolId, 'invalid-input', 'That detail has the wrong kind of value.', key);
    if (slot.kind === 'text' && typeof value !== 'string') return runnerFail(toolId, 'invalid-input', 'That detail must be text.', key);
    if (slot.kind === 'yes-no' && typeof value !== 'boolean') return runnerFail(toolId, 'invalid-input', 'That detail must be yes or no.', key);
    if (slot.kind === 'choice') {
      const input = descriptorInputs.get(key);
      if (typeof value !== 'string' || !input?.choices || !input.choices.includes(value)) {
        return runnerFail(toolId, 'invalid-input', 'Choose one of the available options.', key);
      }
    }
  }
  for (const slot of schema.slots) {
    if (slot.required && !ENGINE_DEFAULT_SLOTS.has(`${toolId}:${slot.name}`) && (!Object.prototype.hasOwnProperty.call(args, slot.name) || args[slot.name] === undefined)) {
      return runnerFail(toolId, 'missing-input', 'Please provide this detail.', slot.name);
    }
  }
  return null;
}

function engineFailure(toolId: string, error: string): RunnerOutcome {
  return runnerFail(toolId, 'engine-refused', `The text could not be processed (${error}).`);
}

function success(toolId: string, result: unknown, reply: string): RunnerOutcome {
  return { ok: true, toolId, result, reply: shortenReply(reply, RUNNER_REPLY_LIMIT) };
}

function makeRunner(toolId: string, descriptor: Descriptor, execute: (args: Record<string, unknown>, deps: RunnerDeps) => RunnerOutcome): ToolRunner {
  return {
    toolId,
    async run(args: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
      try {
        if (!record(args)) return runnerFail(toolId, 'invalid-input', 'The supplied details are not valid.');
        const failure = validate(toolId, descriptor, args);
        if (failure) return failure;
        return execute(args, deps);
      } catch {
        return runnerFail(toolId, 'engine-refused', 'The text could not be processed.');
      }
    },
  };
}

const findReplaceRunner = makeRunner('find-replace', FIND_REPLACE_DESCRIPTOR, (args) => {
  const options: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean; replaceAll?: boolean } = {};
  for (const key of ['caseSensitive', 'wholeWord', 'regex', 'replaceAll'] as const) {
    if (args[key] !== undefined) options[key] = args[key] as boolean;
  }
  const result = findReplace(args.text as string, args.pattern as string, (args.replacement ?? '') as string, options);
  if (!result.ok) return engineFailure('find-replace', result.error);
  return success('find-replace', result, `${result.matchCount} matches replaced.\n${result.text}`);
});

const caseConverterRunner = makeRunner('case-converter', CASE_CONVERTER_DESCRIPTOR, (args) => {
  const result = caseConvert(args.text as string, args.mode as Parameters<typeof caseConvert>[1]);
  if (!result.ok) return engineFailure('case-converter', result.error);
  return success('case-converter', result, result.text);
});

const textCleanerRunner = makeRunner('text-cleaner', TEXT_CLEANER_DESCRIPTOR, (args) => {
  const options: Parameters<typeof textCleaner>[1] = {};
  for (const key of ['trimEachLine', 'collapseRepeatedSpaces', 'removeBlankLines', 'collapseBlankLines', 'straightenQuotesAndDashes', 'removeZeroWidth', 'normalizeLineEndings'] as const) {
    if (args[key] !== undefined) options[key] = args[key] as boolean;
  }
  const result = textCleaner(args.text as string, options);
  if (!result.ok) return engineFailure('text-cleaner', result.error);
  const labels = [
    ['trimEachLine', 'lines trimmed'],
    ['collapseRepeatedSpaces', 'repeated spaces reduced'],
    ['removeBlankLines', 'blank lines removed'],
    ['collapseBlankLines', 'extra blank lines collapsed'],
    ['straightenQuotesAndDashes', 'quotes and dashes straightened'],
    ['removeZeroWidth', 'invisible characters removed'],
    ['normalizeLineEndings', 'line endings normalized'],
  ] as const;
  const changed = labels.filter(([key]) => result.counts[key] > 0).map(([key, label]) => `${label}: ${result.counts[key]}`).join(', ');
  return success('text-cleaner', result, `${result.text}\nChanges: ${changed || 'none'}.`);
});

const sortLinesRunner = makeRunner('sort-lines', SORT_LINES_DESCRIPTOR, (args, deps) => {
  const options: Parameters<typeof sortLines>[1] = {};
  for (const key of ['mode', 'ignoreCase', 'removeDuplicates', 'ignoreBlankLines'] as const) {
    if (args[key] !== undefined) options[key] = args[key] as never;
  }
  const random = options.mode === 'shuffle' ? deps.random01 : undefined;
  const result = sortLines(args.text as string, options, random);
  if (!result.ok) return engineFailure('sort-lines', result.error);
  return success('sort-lines', result, `${result.text}\nLine count: ${result.lineCount}.`);
});

const textCompareRunner = makeRunner('text-compare', TEXT_COMPARE_DESCRIPTOR, (args) => {
  const result = textCompare(args.original as string, args.revised as string, args.mode as Parameters<typeof textCompare>[2]);
  if (!result.ok) return engineFailure('text-compare', result.error);
  const { same, add, remove } = result.counts;
  return success('text-compare', result, `Same: ${same}; added: ${add}; removed: ${remove}.`);
});

export const TEXT_RUNNERS: readonly ToolRunner[] = Object.freeze([
  findReplaceRunner,
  caseConverterRunner,
  textCleanerRunner,
  sortLinesRunner,
  textCompareRunner,
]);
