import { getSchema } from './runnerSchema';
import {
  LEGACY_ENGINE_DESCRIPTORS,
} from '../engines/legacyDescriptors';
import { QR_DESCRIPTOR, makeQr, type QrLevel } from '../engines/create/qrCode';
import { passwordGenerator, type PasswordOptions } from '../engines/create/passwordGenerator';
import {
  pickRandom, shuffle, coinFlip, rollDice, randomInteger, splitTeams,
} from '../engines/create/randomPicker';
import { encodeDecode, type Encoding } from '../engines/create/encodeDecode';
import { hashChecksum, type HashAlgorithm } from '../engines/create/hashChecksum';
import {
  RUNNER_REPLY_LIMIT, runnerFail, shortenReply,
  type RunnerArgs, type RunnerDeps, type RunnerOutcome, type ToolRunner,
} from './runnerTypes';

type PlainRecord = Record<string, unknown>;
type EngineFailure = { ok: false; error: string };
type EngineSuccess<T extends object> = { ok: true } & T;
type EngineResult<T extends object> = EngineFailure | EngineSuccess<T>;

function record(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function supplied(args: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(args, key) && args[key] !== undefined;
}
function missing(toolId: string, slot: string): RunnerOutcome {
  return runnerFail(toolId, 'missing-input', `Please provide ${slot}.`, slot);
}
function invalid(toolId: string, slot: string, message = `Please provide a valid ${slot}.`): RunnerOutcome {
  return runnerFail(toolId, 'invalid-input', message, slot);
}
function refused(toolId: string, error: string): RunnerOutcome {
  return runnerFail(toolId, 'engine-refused', `The tool could not complete the request (error code: ${error}).`);
}
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function choiceValues(toolId: string, slot: string): readonly string[] {
  const schema = getSchema(toolId);
  if (!schema?.slots.some((item) => item.name === slot && item.kind === 'choice')) return [];
  const descriptor = toolId === 'qr-maker'
    ? QR_DESCRIPTOR
    : LEGACY_ENGINE_DESCRIPTORS.find((item) => item.toolId === toolId);
  const input = descriptor?.inputs.find((item) => item.name === slot);
  return input && 'choices' in input && Array.isArray(input.choices) ? input.choices : [];
}
function validateChoice(toolId: string, args: PlainRecord, slot: string): RunnerOutcome | null {
  const value = args[slot];
  const choices = choiceValues(toolId, slot);
  if (typeof value !== 'string' || choices.length === 0 || !choices.includes(value)) {
    return invalid(toolId, slot, `Choose a supported ${slot}.`);
  }
  return null;
}
function requireSlot(toolId: string, args: PlainRecord, slot: string): RunnerOutcome | null {
  return supplied(args, slot) ? null : missing(toolId, slot);
}
function validateText(toolId: string, args: PlainRecord, slot: string): RunnerOutcome | null {
  return typeof args[slot] === 'string' ? null : invalid(toolId, slot);
}
function validateNumber(toolId: string, args: PlainRecord, slot: string): RunnerOutcome | null {
  return isNumber(args[slot]) ? null : invalid(toolId, slot);
}
function parseOptions(value: unknown): Omit<PasswordOptions, 'length'> | null {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) as unknown; } catch { return null; }
  }
  if (!record(parsed)) return null;
  const allowed = ['lower', 'upper', 'digits', 'symbols', 'excludeLookAlikes'];
  if (Object.keys(parsed).some((key) => !allowed.includes(key))) return null;
  if (Object.values(parsed).some((item) => typeof item !== 'boolean')) return null;
  return parsed as unknown as Omit<PasswordOptions, 'length'>;
}
function parseItems(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string')
    ? value.filter((item) => item.trim().length > 0) as string[] : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) return null;
      return parsed.filter((item) => item.trim().length > 0) as string[];
    } catch { return null; }
  }
  return value.split(/\r?\n/).filter((item) => item.trim().length > 0);
}
function listReply(values: readonly string[]): string {
  return values.join(', ');
}
function asOutcome<T extends PlainRecord>(
  toolId: string, result: EngineResult<T>, reply: (value: EngineSuccess<T>) => string,
): RunnerOutcome {
  if (!result.ok) return refused(toolId, result.error);
  return { ok: true, toolId, result, reply: shortenReply(reply(result), RUNNER_REPLY_LIMIT) };
}

const qrRunner: ToolRunner = {
  toolId: 'qr-maker',
  async run(rawArgs: RunnerArgs, _deps: RunnerDeps): Promise<RunnerOutcome> {
    try {
      if (!record(rawArgs)) return runnerFail(this.toolId, 'invalid-input', 'Please provide the QR details.');
      const args = rawArgs as PlainRecord;
      for (const slot of ['text', 'level']) { const m = requireSlot(this.toolId, args, slot); if (m) return m; }
      const t = validateText(this.toolId, args, 'text'); if (t) return t;
      const c = validateChoice(this.toolId, args, 'level'); if (c) return c;
      const result = makeQr(args.text as string, { level: args.level as QrLevel });
      if (!result.ok) return refused(this.toolId, result.error);
      return { ok: true, toolId: this.toolId, result, reply: shortenReply(`QR code made: ${result.size} × ${result.size} modules, error-correction level ${result.level}.`) };
    } catch { return runnerFail(this.toolId, 'engine-refused', 'The tool could not complete the request.'); }
  },
};

const passwordRunner: ToolRunner = {
  toolId: 'password-generator',
  async run(rawArgs: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
    try {
      if (!record(rawArgs)) return runnerFail(this.toolId, 'invalid-input', 'Please provide the password settings.');
      const args = rawArgs as PlainRecord;
      for (const slot of ['length', 'options']) { const m = requireSlot(this.toolId, args, slot); if (m) return m; }
      const n = validateNumber(this.toolId, args, 'length'); if (n) return n;
      if (!Number.isInteger(args.length)) return invalid(this.toolId, 'length');
      const options = parseOptions(args.options); if (!options) return invalid(this.toolId, 'options');
      if (typeof deps?.randomBelow !== 'function') return runnerFail(this.toolId, 'engine-refused', 'A random source was not supplied.');
      const result = passwordGenerator({ length: args.length as number, ...options }, deps.randomBelow);
      if (!result.ok) return refused(this.toolId, result.error);
      return { ok: true, toolId: this.toolId, result, reply: shortenReply(`Password: ${result.password}. Entropy: ${result.entropyBits} bits.`) };
    } catch { return runnerFail(this.toolId, 'engine-refused', 'The tool could not complete the request.'); }
  },
};

const randomRunner: ToolRunner = {
  toolId: 'random-picker',
  async run(rawArgs: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome> {
    try {
      if (!record(rawArgs)) return runnerFail(this.toolId, 'invalid-input', 'Please provide the selection details.');
      const args = rawArgs as PlainRecord;
      const opMissing = requireSlot(this.toolId, args, 'operation'); if (opMissing) return opMissing;
      const opBad = validateChoice(this.toolId, args, 'operation'); if (opBad) return opBad;
      const operation = args.operation as string;
      if (typeof deps?.randomBelow !== 'function') return runnerFail(this.toolId, 'engine-refused', 'A random source was not supplied.');
      if (operation === 'coin-flip') {
        const result = coinFlip(deps.randomBelow);
        return asOutcome(this.toolId, result, (r) => `The result is ${r.result}.`);
      }
      const itemsRequired = operation !== 'coin-flip';
      let items: string[] = [];
      if (itemsRequired) {
        const m = requireSlot(this.toolId, args, 'items'); if (m) return m;
        const parsed = parseItems(args.items);
        if (!parsed) return invalid(this.toolId, 'items');
        if (operation === 'pick' || operation === 'shuffle' || operation === 'split-teams') {
          if (parsed.length === 0) return missing(this.toolId, 'items');
          items = parsed;
        }
      }
      if (operation === 'pick') {
        const count = supplied(args, 'count') ? args.count : 1;
        if (!isNumber(count) || !Number.isInteger(count)) return invalid(this.toolId, 'count');
        const result = pickRandom(items, count as number, false, deps.randomBelow);
        return asOutcome(this.toolId, result, (r) => `Picked: ${listReply(r.values)}.`);
      }
      if (operation === 'shuffle') {
        const result = shuffle(items, deps.randomBelow);
        return asOutcome(this.toolId, result, (r) => `Shuffled order: ${listReply(r.values)}.`);
      }
      if (operation === 'roll-dice') {
        if (typeof args.items !== 'string') return invalid(this.toolId, 'items');
        const result = rollDice(args.items, deps.randomBelow);
        return asOutcome(this.toolId, result, (r) => `Roll: ${r.rolls.join(', ')}. Total: ${r.total}.`);
      }
      if (operation === 'random-integer') {
        if (typeof args.items !== 'string') return invalid(this.toolId, 'items', 'Enter the two bounds as min,max.');
        const match = /^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/.exec(args.items);
        if (!match) return invalid(this.toolId, 'items', 'Enter the two bounds as min,max.');
        const min = Number(match[1]), max = Number(match[2]);
        if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) return invalid(this.toolId, 'items');
        const result = randomInteger(min, max, deps.randomBelow);
        return asOutcome(this.toolId, result, (r) => `Random number: ${r.value}.`);
      }
      if (operation === 'split-teams') {
        const m = requireSlot(this.toolId, args, 'count'); if (m) return m;
        const n = validateNumber(this.toolId, args, 'count'); if (n) return n;
        if (!Number.isInteger(args.count)) return invalid(this.toolId, 'count');
        const result = splitTeams(items, args.count as number, deps.randomBelow);
        return asOutcome(this.toolId, result, (r) => `Teams: ${r.teams.map((team, i) => `Team ${i + 1}: ${listReply(team)}`).join('; ')}.`);
      }
      return invalid(this.toolId, 'operation');
    } catch { return runnerFail(this.toolId, 'engine-refused', 'The tool could not complete the request.'); }
  },
};

const encoderRunner: ToolRunner = {
  toolId: 'encoder-decoder',
  async run(rawArgs: RunnerArgs, _deps: RunnerDeps): Promise<RunnerOutcome> {
    try {
      if (!record(rawArgs)) return runnerFail(this.toolId, 'invalid-input', 'Please provide the text and format.');
      const args = rawArgs as PlainRecord;
      for (const slot of ['mode', 'format', 'input']) { const m = requireSlot(this.toolId, args, slot); if (m) return m; }
      for (const slot of ['mode', 'format']) { const c = validateChoice(this.toolId, args, slot); if (c) return c; }
      const t = validateText(this.toolId, args, 'input'); if (t) return t;
      const result = encodeDecode(args.mode as 'encode' | 'decode', args.format as Encoding, args.input as string);
      return asOutcome(this.toolId, result, (r) => r.value);
    } catch { return runnerFail(this.toolId, 'engine-refused', 'The tool could not complete the request.'); }
  },
};

const hashRunner: ToolRunner = {
  toolId: 'hash-tool',
  async run(rawArgs: RunnerArgs, _deps: RunnerDeps): Promise<RunnerOutcome> {
    try {
      if (!record(rawArgs)) return runnerFail(this.toolId, 'invalid-input', 'Please provide the text to hash.');
      const args = rawArgs as PlainRecord;
      for (const slot of ['input', 'algorithm']) { const m = requireSlot(this.toolId, args, slot); if (m) return m; }
      const t = validateText(this.toolId, args, 'input'); if (t) return t;
      const c = validateChoice(this.toolId, args, 'algorithm'); if (c) return c;
      const algorithm = args.algorithm as HashAlgorithm;
      const result = await hashChecksum(args.input as string, algorithm);
      return asOutcome(this.toolId, result, (r) => `${algorithm} digest: ${r.hex}`);
    } catch { return runnerFail(this.toolId, 'engine-refused', 'The tool could not complete the request.'); }
  },
};

export const CREATE_RUNNERS: readonly ToolRunner[] = Object.freeze([
  qrRunner, passwordRunner, randomRunner, encoderRunner, hashRunner,
]);
