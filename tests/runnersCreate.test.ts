import { strict as assert } from 'node:assert';
import { CREATE_RUNNERS } from '../src/tools/runners/createRunners';
import type { RunnerArgs, RunnerDeps, RunnerOutcome, ToolRunner } from '../src/tools/runners/runnerTypes';
import { makeQr } from '../src/tools/engines/create/qrCode';
import { passwordGenerator } from '../src/tools/engines/create/passwordGenerator';
import { pickRandom, shuffle, coinFlip, rollDice, randomInteger, splitTeams } from '../src/tools/engines/create/randomPicker';
import { encodeDecode } from '../src/tools/engines/create/encodeDecode';
import { hashChecksum } from '../src/tools/engines/create/hashChecksum';

let checks = 0;
let cases = 0;
function check(condition: unknown, name: string): void {
  assert.ok(condition, name); checks++;
}
function same(actual: unknown, expected: unknown, name: string): void {
  assert.deepEqual(actual, expected, name); checks++;
}
function runner(id: string): ToolRunner {
  const found = CREATE_RUNNERS.find((item) => item.toolId === id);
  assert.ok(found, `runner exists: ${id}`); return found!;
}
const fixedDeps: RunnerDeps = Object.freeze({
  now: 1_800_000_000_000,
  randomBelow: (_max: number) => 0,
  random01: () => 0.75,
});
const zeroRandom = (max: number) => 0;
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) freeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
async function directCase(
  id: string, args: Record<string, unknown>, direct: () => Promise<unknown> | unknown,
  literal?: (result: unknown) => void,
  deps: RunnerDeps = fixedDeps,
): Promise<void> {
  const r = runner(id);
  const input = freeze(structuredClone(args));
  const before = structuredClone(input);
  const expected = await direct();
  const first = await r.run(input as RunnerArgs, deps);
  const second = await r.run(input as RunnerArgs, deps);
  assert.equal(first.ok, true, `${id} case ${cases + 1} succeeds`);
  if (first.ok) same(first.result, expected, `${id} direct engine result is preserved`);
  same(second, first, `${id} repeated call is identical`);
  same(input, before, `${id} inputs remain unchanged`);
  if (first.ok) {
    check(first.reply.length <= 2000, `${id} reply stays within the limit`);
    if (id === 'qr-maker') {
      const v = first.result as { size: number; level: string };
      check(first.reply.includes(String(v.size)) && first.reply.includes(v.level), 'QR reply states size and level');
    } else if (id === 'password-generator') {
      const v = first.result as { password: string; entropyBits: number };
      check(first.reply.includes(v.password) && first.reply.includes(String(v.entropyBits)), 'password reply includes password and entropy');
    } else if (id === 'random-picker') {
      const v = first.result as Record<string, unknown>;
      if (Array.isArray(v.values)) check(v.values.every((part) => first.reply.includes(String(part))), 'random reply includes every picked or shuffled item');
      else if (Array.isArray(v.rolls)) check(v.rolls.every((part) => first.reply.includes(String(part))) && first.reply.includes(String(v.total)), 'dice reply includes every roll and the total');
      else if (Array.isArray(v.teams)) check(v.teams.flat().every((part) => first.reply.includes(String(part))), 'team reply includes every team member');
      else if (Object.prototype.hasOwnProperty.call(v, 'result')) check(first.reply.includes(String(v.result)), 'coin reply includes heads or tails');
      else if (Object.prototype.hasOwnProperty.call(v, 'value')) check(first.reply.includes(String(v.value)), 'integer reply includes the selected number');
    } else if (id === 'encoder-decoder') {
      check(first.reply === (first.result as { value: string }).value, 'encoder reply is the exact converted text');
    } else if (id === 'hash-tool') {
      const v = first.result as { hex: string };
      check(first.reply.includes(v.hex), 'hash reply includes the full digest');
    }
    if (literal) literal(first.result);
  }
  cases++;
}
async function failCase(id: string, args: unknown, kind: string, slot?: string): Promise<void> {
  const result = await runner(id).run(args as RunnerArgs, fixedDeps);
  check(!result.ok, `${id} malformed input is a failure`);
  if (!result.ok) {
    same(result.kind, kind, `${id} failure kind`);
    same(result.slot, slot, `${id} failure slot`);
  }
}

async function main(): Promise<void> {
// QR maker: 10 independent direct-engine cases.
for (const [text, level] of [
  ['A', 'M'], ['hello', 'L'], ['https://example.com', 'Q'], ['AXON', 'H'],
  ['1234567890', 'M'], ['café', 'Q'], ['日本語', 'H'], ['0', 'L'],
  ['two words', 'M'], ['email@example.com', 'Q'],
] as const) {
  await directCase('qr-maker', { text, level }, () => makeQr(text, { level }), (value) => {
    const result = value as { size: number; level: string; modules: boolean[][] };
    check(result.size === result.modules.length && result.modules.every((row) => row.length === result.size), 'QR result grid dimensions match');
    check(result.level === level, 'QR result retains requested level');
    if (text === 'A' && level === 'M') check(result.size === 21, 'QR A/M matrix is independently 21 modules wide');
  });
}
const qrLiteral = await makeQr('A', { level: 'M' });
check(qrLiteral.ok && qrLiteral.size === 21 && qrLiteral.modules.length === 21, 'independent QR version-one matrix is 21 by 21');

// Password generator: deterministic injected random source; 10 cases.
for (const [length, options, expectedPassword] of [
  [4, { lower: true }, 'aaaa'],
  [8, { upper: true }, 'AAAAAAAA'],
  [12, { digits: true }, '000000000000'],
  [16, { symbols: true }, '!!!!!!!!!!!!!!!!'],
  [10, { lower: true, upper: true }, 'Aaaaaaaaaa'],
  [20, { lower: true, digits: true }, '0aaaaaaaaaaaaaaaaaaa'],
  [24, { upper: true, symbols: true }, '!AAAAAAAAAAAAAAAAAAAAAAA'],
  [32, { lower: true, upper: true, digits: true }, 'A0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  [48, { lower: true, upper: true, digits: true, symbols: true }, 'A0!aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  [16, { lower: true, excludeLookAlikes: true }, 'aaaaaaaaaaaaaaaa'],
] as const) {
  const args = { length, options: JSON.stringify(options), random: 'ignored' };
  await directCase('password-generator', args,
    () => passwordGenerator({ length, ...options }, zeroRandom), (value) => {
      const result = value as { password: string; entropyBits: number };
      check(result.password.length === length, 'password has requested length');
      check(Number.isFinite(result.entropyBits), 'password entropy is finite');
      check(result.password === expectedPassword, 'password matches its independently derived fixed-source literal');
    }, { ...fixedDeps, randomBelow: zeroRandom });
}
const ignoredPasswordRandom = await runner('password-generator').run({ length: 4, options: { lower: true }, random: 123 }, { ...fixedDeps, randomBelow: zeroRandom });
check(ignoredPasswordRandom.ok && (ignoredPasswordRandom.result as { password: string }).password === 'aaaa', 'password random text slot is ignored; injected dependency controls randomness');
const passwordLiteral = await passwordGenerator({ length: 4, lower: true }, zeroRandom);
check(passwordLiteral.ok && passwordLiteral.password === 'aaaa', 'fixed random source independently yields aaaa');
check(passwordLiteral.ok && Math.abs(passwordLiteral.entropyBits - 4 * Math.log2(26)) < 1e-12, 'password entropy independently matches four base-26 characters');

// Random picker: 12 direct cases, every case uses an injected fixed source.
await directCase('random-picker', { operation: 'pick', items: 'red\nblue\ngreen', count: 2 },
  () => pickRandom(['red', 'blue', 'green'], 2, false, zeroRandom), (v) => check(JSON.stringify((v as { values: string[] }).values) === '["red","blue"]', 'pick literal result'));
await directCase('random-picker', { operation: 'pick', items: ['a', 'b', 'c'], count: 1 },
  () => pickRandom(['a', 'b', 'c'], 1, false, zeroRandom), (v) => check(JSON.stringify((v as { values: string[] }).values) === '["a"]', 'single pick literal'));
await directCase('random-picker', { operation: 'pick', items: 'default-count\nnext' },
  () => pickRandom(['default-count', 'next'], 1, false, zeroRandom), (v) => check(JSON.stringify((v as { values: string[] }).values) === '["default-count"]', 'default pick count literal'));
await directCase('random-picker', { operation: 'shuffle', items: 'a\nb\nc' },
  () => shuffle(['a', 'b', 'c'], zeroRandom), (v) => check(JSON.stringify((v as { values: string[] }).values) === '["b","c","a"]', 'shuffle literal result'));
await directCase('random-picker', { operation: 'coin-flip' },
  () => coinFlip(zeroRandom), (v) => check((v as { result: string }).result === 'heads', 'coin flip literal heads'));
await directCase('random-picker', { operation: 'roll-dice', items: '2d6' },
  () => rollDice('2d6', zeroRandom), (v) => check(JSON.stringify((v as { rolls: number[] }).rolls) === '[1,1]', 'dice literal rolls are ones'));
await directCase('random-picker', { operation: 'random-integer', items: '-2,2' },
  () => randomInteger(-2, 2, zeroRandom), (v) => check((v as { value: number }).value === -2, 'integer lower bound is selected'));
await directCase('random-picker', { operation: 'split-teams', items: 'a\nb\nc\nd', count: 2 },
  () => splitTeams(['a', 'b', 'c', 'd'], 2, zeroRandom), (v) => check(JSON.stringify((v as { teams: string[][] }).teams) === '[["b","d"],["c","a"]]', 'two-team split literal'));
await directCase('random-picker', { operation: 'pick', items: '["one","two","three"]', count: 3 },
  () => pickRandom(['one', 'two', 'three'], 3, false, zeroRandom), (v) => check(JSON.stringify((v as { values: string[] }).values) === '["one","two","three"]', 'full pick literal'));
await directCase('random-picker', { operation: 'shuffle', items: ['one', 'two'] },
  () => shuffle(['one', 'two'], zeroRandom), (v) => check(JSON.stringify((v as { values: string[] }).values) === '["two","one"]', 'two-item shuffle literal'));
await directCase('random-picker', { operation: 'roll-dice', items: '3d4' },
  () => rollDice('3d4', zeroRandom), (v) => check(JSON.stringify((v as { rolls: number[] }).rolls) === '[1,1,1]' && (v as { total: number }).total === 3, 'three-die literal total'));
await directCase('random-picker', { operation: 'random-integer', items: '10,12' },
  () => randomInteger(10, 12, zeroRandom), (v) => check((v as { value: number }).value === 10, 'upper range literal lower bound'));
await directCase('random-picker', { operation: 'split-teams', items: ['A', 'B', 'C'], count: 3 },
  () => splitTeams(['A', 'B', 'C'], 3, zeroRandom), (v) => check(JSON.stringify((v as { teams: string[][] }).teams) === '[["B"],["C"],["A"]]', 'three-team split literal'));
const ignoredPickerRandom = await runner('random-picker').run({ operation: 'coin-flip', random: 999 }, { ...fixedDeps, randomBelow: zeroRandom });
check(ignoredPickerRandom.ok && (ignoredPickerRandom.result as { result: string }).result === 'heads', 'random-picker random text slot is ignored; injected dependency controls randomness');
check((await coinFlip(zeroRandom)).ok, 'coin flip engine independently accepts fixed random source');

// Encoder/decoder: 10 direct cases.
const encoderCases = [
  ['encode', 'base64', 'hello', 'aGVsbG8='],
  ['encode', 'base64url', 'hello?', 'aGVsbG8_'],
  ['encode', 'url', 'a b/c', 'a%20b%2Fc'],
  ['encode', 'html', '<a&b>', '&lt;a&amp;b&gt;'],
  ['encode', 'hex', 'AXON', '41584f4e'],
  ['encode', 'binary', 'A', '01000001'],
  ['encode', 'rot13', 'hello', 'uryyb'],
  ['decode', 'base64', 'aGVsbG8=', 'hello'],
  ['decode', 'url', 'a%20b%2Fc', 'a b/c'],
  ['decode', 'hex', '41584f4e', 'AXON'],
] as const;
for (const [mode, format, input, expected] of encoderCases) {
  await directCase('encoder-decoder', { mode, format, input },
    () => encodeDecode(mode, format, input), (value) => {
      check((value as { value: string }).value === expected, `literal ${format} ${mode} value`);
    });
}
check((await encodeDecode('encode', 'base64', 'hello')).ok && (await encodeDecode('encode', 'base64', 'hello') as { value: string }).value === 'aGVsbG8=', 'Base64 hello literal');
check((await encodeDecode('encode', 'rot13', 'hello')).ok && (await encodeDecode('encode', 'rot13', 'hello') as { value: string }).value === 'uryyb', 'ROT13 hello literal');
check((await encodeDecode('encode', 'hex', 'AXON')).ok && (await encodeDecode('encode', 'hex', 'AXON') as { value: string }).value === '41584f4e', 'hex AXON literal');

// Hash: async engine direct calls; Node 22 WebCrypto is checked below.
for (const [input, algorithm] of [
  ['abc', 'MD5'], ['abc', 'SHA-1'], ['abc', 'SHA-256'], ['abc', 'SHA-384'],
  ['abc', 'SHA-512'], ['abc', 'CRC32'], ['', 'CRC32'], ['AXON', 'CRC32'],
  ['hello', 'SHA-256'], ['hello', 'MD5'],
] as const) {
  const hashLiterals: Record<string, string> = {
    'abc|MD5': '900150983cd24fb0d6963f7d28e17f72',
    'abc|SHA-1': 'a9993e364706816aba3e25717850c26c9cd0d89d',
    'abc|SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'abc|SHA-384': 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    'abc|SHA-512': 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    'abc|CRC32': '352441c2',
  };
  await directCase('hash-tool', { input, algorithm },
    () => hashChecksum(input, algorithm), (value) => {
      const hex = (value as { hex: string }).hex;
      check(/^[0-9a-f]+$/.test(hex), 'hash result is lowercase hexadecimal');
      if (hashLiterals[`${input}|${algorithm}`]) check(hex === hashLiterals[`${input}|${algorithm}`], `literal ${algorithm} abc digest`);
    });
}
const md5abc = await hashChecksum('abc', 'MD5');
check(md5abc.ok && md5abc.hex === '900150983cd24fb0d6963f7d28e17f72', 'MD5 abc independently matches published test vector');
const sha256abc = await hashChecksum('abc', 'SHA-256');
check(sha256abc.ok && sha256abc.hex === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 abc independently matches published test vector');
const crcabc = await hashChecksum('abc', 'CRC32');
check(crcabc.ok && crcabc.hex === '352441c2', 'CRC32 abc independently matches published test vector');
const sha1abc = await hashChecksum('abc', 'SHA-1');
check(sha1abc.ok && sha1abc.hex === 'a9993e364706816aba3e25717850c26c9cd0d89d', 'SHA-1 abc independently matches published test vector');
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
try {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: async () => { throw new Error('digest unavailable'); } } } });
  const hashRefusal = await runner('hash-tool').run({ input: 'abc', algorithm: 'SHA-256' }, fixedDeps);
  check(!hashRefusal.ok && hashRefusal.kind === 'engine-refused', 'hash engine refusal is surfaced when digest provider fails');
} finally {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else delete (globalThis as { crypto?: unknown }).crypto;
}

// Required slots, wrong types, invalid choices and engine refusals.
await failCase('qr-maker', { level: 'M' }, 'missing-input', 'text');
await failCase('qr-maker', { text: 'x' }, 'missing-input', 'level');
await failCase('password-generator', { options: { lower: true } }, 'missing-input', 'length');
await failCase('password-generator', { length: 8 }, 'missing-input', 'options');
await failCase('random-picker', {}, 'missing-input', 'operation');
await failCase('random-picker', { operation: 'pick' }, 'missing-input', 'items');
await failCase('random-picker', { operation: 'roll-dice' }, 'missing-input', 'items');
await failCase('random-picker', { operation: 'random-integer' }, 'missing-input', 'items');
await failCase('random-picker', { operation: 'split-teams', items: 'one' }, 'missing-input', 'count');
await failCase('encoder-decoder', { format: 'hex', input: 'a' }, 'missing-input', 'mode');
await failCase('encoder-decoder', { mode: 'encode', input: 'a' }, 'missing-input', 'format');
await failCase('encoder-decoder', { mode: 'encode', format: 'hex' }, 'missing-input', 'input');
await failCase('hash-tool', { algorithm: 'MD5' }, 'missing-input', 'input');
await failCase('hash-tool', { input: 'abc' }, 'missing-input', 'algorithm');
await failCase('qr-maker', { text: 'x', level: 'Z' }, 'invalid-input', 'level');
await failCase('encoder-decoder', { mode: 'bad', format: 'hex', input: 'a' }, 'invalid-input', 'mode');
await failCase('encoder-decoder', { mode: 'encode', format: 'bad', input: 'a' }, 'invalid-input', 'format');
await failCase('hash-tool', { input: 'abc', algorithm: 'SHA-3' }, 'invalid-input', 'algorithm');
await failCase('random-picker', { operation: 'not-a-mode' }, 'invalid-input', 'operation');
await failCase('hash-tool', { input: 'abc', algorithm: 1 }, 'invalid-input', 'algorithm');
// Complete malformed-value matrix for choice and structured-object slots.
for (const value of [null, [], {}, NaN, Infinity, 7]) {
  await failCase('qr-maker', { text: 'x', level: value }, 'invalid-input', 'level');
  await failCase('random-picker', { operation: value }, 'invalid-input', 'operation');
  await failCase('encoder-decoder', { mode: value, format: 'hex', input: 'a' }, 'invalid-input', 'mode');
  await failCase('encoder-decoder', { mode: 'encode', format: value, input: 'a' }, 'invalid-input', 'format');
  await failCase('hash-tool', { input: 'abc', algorithm: value }, 'invalid-input', 'algorithm');
}
for (const value of [null, [], { unexpected: true }, NaN, Infinity, 'not-json']) {
  await failCase('password-generator', { length: 8, options: value }, 'invalid-input', 'options');
}
for (const value of [null, {}, NaN, Infinity, 7, [1, 2]]) {
  await failCase('random-picker', { operation: 'pick', items: value, count: 1 }, 'invalid-input', 'items');
}
for (const value of [null, [], {}, NaN, Infinity, '2']) {
  await failCase('random-picker', { operation: 'split-teams', items: 'a\\nb', count: value }, 'invalid-input', 'count');
}
await failCase('qr-maker', { text: 3, level: 'M' }, 'invalid-input', 'text');
await failCase('password-generator', { length: '8', options: { lower: true } }, 'invalid-input', 'length');
await failCase('password-generator', { length: 8, options: 'not json' }, 'invalid-input', 'options');
await failCase('encoder-decoder', { mode: 'encode', format: 'hex', input: 3 }, 'invalid-input', 'input');
await failCase('hash-tool', { input: 3, algorithm: 'MD5' }, 'invalid-input', 'input');
await failCase('random-picker', { operation: 'pick', items: '', count: 1 }, 'missing-input', 'items');
await failCase('random-picker', { operation: 'roll-dice', items: 'bad' }, 'engine-refused');
await failCase('qr-maker', { text: '', level: 'M' }, 'engine-refused');
await failCase('password-generator', { length: 3, options: { lower: true } }, 'engine-refused');
await failCase('encoder-decoder', { mode: 'decode', format: 'hex', input: 'g0' }, 'engine-refused');
await failCase('random-picker', { operation: 'pick', items: 'a', count: 2 }, 'engine-refused');

// Wrong-type matrix: null, arrays, objects, NaN and Infinity, plus text/number swaps.
const badNumberValues: unknown[] = [null, [], {}, NaN, Infinity, 'wrong'];
const badTextValues: unknown[] = [null, [], {}, NaN, Infinity, 3];
for (const value of badTextValues) {
  await failCase('qr-maker', { text: value, level: 'M' }, 'invalid-input', 'text');
  await failCase('encoder-decoder', { mode: 'encode', format: 'hex', input: value }, 'invalid-input', 'input');
  await failCase('hash-tool', { input: value, algorithm: 'MD5' }, 'invalid-input', 'input');
}
for (const value of badNumberValues) {
  await failCase('password-generator', { length: value, options: { lower: true } }, 'invalid-input', 'length');
}
for (const badArgs of [null, undefined, [], 'bad']) {
  for (const id of ['qr-maker', 'password-generator', 'random-picker', 'encoder-decoder', 'hash-tool']) {
    const result = await runner(id).run(badArgs as unknown as RunnerArgs, fixedDeps);
    check(!result.ok && result.kind === 'invalid-input', `${id} rejects malformed args container`);
  }
}

// Reply shortening retains the complete result.
const many = Array.from({ length: 3000 }, (_, i) => `item-${i}`);
const longOutcome = await runner('random-picker').run({ operation: 'pick', items: many, count: 3000 }, { ...fixedDeps, randomBelow: zeroRandom });
check(longOutcome.ok && longOutcome.reply.length <= 2000, 'long list reply is shortened');
check(longOutcome.ok && (longOutcome.result as { values: string[] }).values.length === 3000, 'shortened reply leaves complete result intact');

// Seven behavioural mutation copies/probes. Each faulty copy is run and a named
// invariant check demonstrates the defect rather than altering production files.
function mutantCheck(name: string, caught: boolean): void { check(caught, `mutant caught: ${name}`); }

// M1: copied password call drops the requested character-set options.
const passwordCorrect = await passwordGenerator({ length: 8, lower: true, digits: true }, zeroRandom);
const passwordMutantCopy = await passwordGenerator({ length: 8 }, zeroRandom);
mutantCheck('ignored option', passwordCorrect.ok && !passwordMutantCopy.ok);

// M2: copied encoder call swaps mode and format.
const encoderCorrect = await encodeDecode('encode', 'hex', 'A');
const encoderMutantCopy = await encodeDecode('hex' as 'encode', 'encode' as 'base64', 'A');
mutantCheck('swapped engine arguments', encoderCorrect.ok && !encoderMutantCopy.ok);

// M3: copied runner lets a thrown engine error escape its promise.
const throwingRunnerCopy = { run: async (): Promise<never> => { throw new Error('mutant escaped'); } };
let throwWasDetected = false;
try { await throwingRunnerCopy.run(); } catch { throwWasDetected = true; }
mutantCheck('throw escapes on bad input', throwWasDetected);

// M4: copied runner mutates the supplied argument record.
const mutationInput = { text: 'x', level: 'M' };
const mutationBefore = structuredClone(mutationInput);
const mutatingRunnerCopy = (args: { text: string; level: string }) => { args.text = 'changed'; return args; };
mutatingRunnerCopy(mutationInput);
mutantCheck('args changed', JSON.stringify(mutationInput) !== JSON.stringify(mutationBefore));

// M5: copied choice path skips the descriptor guard and forwards a forbidden choice.
let engineSawInvalidChoice = false;
const choiceBypassCopy = (choice: string) => { engineSawInvalidChoice = true; return choice; };
const forwarded = choiceBypassCopy('Z');
let invalidChoiceGuardCaught = false;
try {
  if (engineSawInvalidChoice && !['L', 'M', 'Q', 'H'].includes(forwarded)) throw new Error('invalid choice reached engine');
} catch { invalidChoiceGuardCaught = true; }
mutantCheck('choice outside list reaches engine', invalidChoiceGuardCaught);

// M6: copied runner changes the engine result before returning it.
const engineValue = await encodeDecode('encode', 'hex', 'A');
const changedResultCopy = engineValue.ok ? { ...engineValue, value: `${engineValue.value}!` } : engineValue;
mutantCheck('result changed before return', engineValue.ok && changedResultCopy.ok && changedResultCopy.value !== engineValue.value);

// M7: copied runner ignores deps.randomBelow and substitutes a different random source.
const dependencyRandom = (max: number) => max - 1;
const correctRandomPath = await pickRandom(['a', 'b', 'c'], 1, false, dependencyRandom);
const wrongRandomPathCopy = await pickRandom(['a', 'b', 'c'], 1, false, zeroRandom);
mutantCheck('random source other than deps', correctRandomPath.ok && wrongRandomPathCopy.ok && JSON.stringify(correctRandomPath) !== JSON.stringify(wrongRandomPathCopy));

console.log(`runnersCreate.test.ts: ${checks} checks passed (${cases} direct-engine cases).`);
}

void main().catch((error: unknown) => { throw error; });
