/** LIVE8-1: the Case Converter task action. Known answers are written by hand, never taken from the engine. The action is NOT in the shared engine yet (pin: LIVE8-3 changes it on purpose). */
import { createTaskEngine } from '../src/kernel/taskEngine';
import { getAxonEngine } from '../src/kernel/axonEngine';
import { TEXT_CASE_ACTION } from '../src/tools/textCaseAction';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const engine = createTaskEngine(); engine.registerAction(TEXT_CASE_ACTION);
const run = async (input: unknown) => { const s = await engine.submit('text.case', input); if (!s.ok) return { submitted: false as const }; const t = await engine.whenDone(s.task.id); return { submitted: true as const, task: t }; };
const KNOWN: ReadonlyArray<readonly [string, string, string]> = [
  ['UPPER', 'hello big world', 'HELLO BIG WORLD'], ['lower', 'Hello BIG World', 'hello big world'], ['Title', 'hello big world', 'Hello Big World'],
  ['Sentence', 'hELLO there. wORLD', 'Hello there. World'], ['camelCase', 'hello big world', 'helloBigWorld'], ['PascalCase', 'hello big world', 'HelloBigWorld'],
  ['snake_case', 'hello big world', 'hello_big_world'], ['kebab-case', 'hello big world', 'hello-big-world'], ['CONSTANT_CASE', 'hello big world', 'HELLO_BIG_WORLD'],
];
for (const [mode, text, want] of KNOWN) {
  const r = await run({ text, mode });
  check(r.submitted && r.task.state === 'COMPLETED' && (r.task.output as { text: string }).text === want, `known answer ${mode}`);
}
check(TEXT_CASE_ACTION.id === 'text.case' && TEXT_CASE_ACTION.capabilityId === 'text-tools' && TEXT_CASE_ACTION.executionClass === 'instant', 'identity of the action');
const done = await run({ text: 'a b', mode: 'UPPER' });
check(done.submitted && done.task.actionId === 'text.case' && /^task-\d+$/.test(done.task.id), 'the task is recorded with an id and its action');
check((await run({ mode: 'UPPER' })).submitted === false, 'missing text is refused at submit');
check((await run({ text: 'abc' })).submitted === false, 'missing mode is refused at submit');
check((await run({ text: 3, mode: 'UPPER' })).submitted === false, 'text that is not text is refused at submit');
const bad = await run({ text: 'abc', mode: 'shout' });
check(bad.submitted && bad.task.state === 'FAILED', 'an unknown mode ends FAILED, never a guessed answer');
const big = await run({ text: 'a'.repeat(200_001), mode: 'UPPER' });
check(big.submitted && big.task.state === 'FAILED', 'text over the engine limit ends FAILED');
const empty = await run({ text: '', mode: 'UPPER' });
check(empty.submitted ? empty.task.state === 'COMPLETED' && (empty.task.output as { text: string }).text === '' : true, 'empty text is handled, never throws');
check(getAxonEngine().getAction('text.case') === TEXT_CASE_ACTION, 'text.case is registered in the shared engine since LIVE8-3 (with its available chat action and its switch)');
check(getAxonEngine().getAction('text.count') !== undefined, 'Text Counter is still registered');
console.log('textCaseAction: ' + n + ' checks passed');
