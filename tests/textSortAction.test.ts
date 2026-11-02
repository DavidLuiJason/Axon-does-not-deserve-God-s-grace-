/** LIVE9-1: the Sort Lines task action. Known answers are written by hand, never taken from the engine. The action is NOT in the shared engine yet (LIVE9-3 registers it on purpose). */
import { createTaskEngine } from '../src/kernel/taskEngine';
import { getAxonEngine } from '../src/kernel/axonEngine';
import { TEXT_SORT_ACTION } from '../src/tools/textSortAction';
let n = 0; const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const engine = createTaskEngine(); engine.registerAction(TEXT_SORT_ACTION);
const run = async (input: unknown) => { const s = await engine.submit('text.sort', input); if (!s.ok) return { submitted: false as const }; const t = await engine.whenDone(s.task.id); return { submitted: true as const, task: t }; };
const out = (r: Awaited<ReturnType<typeof run>>) => (r.submitted ? (r.task.output as { text: string; lineCount: number } | undefined) : undefined);
const KNOWN: ReadonlyArray<readonly [string | undefined, string, string]> = [
  [undefined, 'pear\napple\nfig', 'apple\nfig\npear'], ['ascending', 'pear\napple\nfig', 'apple\nfig\npear'], ['descending', 'pear\napple\nfig', 'pear\nfig\napple'],
  ['by-length', 'ccc\na\nbb', 'a\nbb\nccc'], ['natural', 'f10\nf2\nf1', 'f1\nf2\nf10'], ['reverse', 'a\nb\nc', 'c\nb\na'], ['ascending', 'f10\nf2\nf1', 'f1\nf10\nf2'],
];
for (const [mode, text, want] of KNOWN) {
  const r = await run(mode === undefined ? { text } : { text, mode });
  const o = out(r);
  check(r.submitted && r.task.state === 'COMPLETED' && o?.text === want, `known answer ${mode ?? 'default'} ${JSON.stringify(text)}`);
  check(o?.lineCount === text.split('\n').length, `line count ${mode ?? 'default'}`);
}
const sh = await run({ text: 'a\nb\nc\nd', mode: 'shuffle' });
check(sh.submitted && sh.task.state === 'COMPLETED' && out(sh)!.text.split('\n').sort().join('\n') === 'a\nb\nc\nd' && out(sh)!.lineCount === 4, 'shuffle keeps exactly the same lines');
check(TEXT_SORT_ACTION.id === 'text.sort' && TEXT_SORT_ACTION.capabilityId === 'text-tools' && TEXT_SORT_ACTION.executionClass === 'instant', 'identity of the action');
const done = await run({ text: 'b\na' });
check(done.submitted && done.task.actionId === 'text.sort' && /^task-\d+$/.test(done.task.id), 'the task is recorded with an id and its action');
check((await run({ mode: 'ascending' })).submitted === false, 'missing text is refused at submit');
check((await run({ text: 3 })).submitted === false, 'text that is not text is refused at submit');
const bad = await run({ text: 'b\na', mode: 'sideways' });
check(bad.submitted && bad.task.state === 'FAILED', 'an unknown mode ends FAILED, never a guessed answer');
const big = await run({ text: 'a'.repeat(200_001) });
check(big.submitted && big.task.state === 'FAILED', 'text over the engine limit ends FAILED');
const empty = await run({ text: '' });
check(empty.submitted ? empty.task.state === 'COMPLETED' && out(empty)?.text === '' : true, 'empty text is handled, never throws');
check(getAxonEngine().getAction('text.sort') === undefined, 'text.sort is NOT registered in the shared engine yet (pin: LIVE9-3 changes it on purpose)');
check(getAxonEngine().getAction('text.case') !== undefined && getAxonEngine().getAction('text.count') !== undefined, 'the two live tools stay registered');
console.log('textSortAction: ' + n + ' checks passed');
