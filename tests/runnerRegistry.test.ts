import { ALL_RUNNERS, DEFAULT_SWITCHES, execute, findRunner, modeFor, runnerToolIds } from '../src/tools/runners/runnerRegistry';
import type { RunnerDeps, ToolRunner } from '../src/tools/runners/runnerTypes';
import { listSchemas } from '../src/brain/mind/schema/actionSchemas';

let n = 0;
function check(ok: boolean, name: string): void { n++; if (!ok) throw new Error('FAILED: ' + name); }
const deps: RunnerDeps = Object.freeze({ now: 1000, randomBelow: () => 0, random01: () => 0 });

// registry
const ids = runnerToolIds();
check(ids.length === 19, '19 runners registered (18 + the text-counter pilot)');
check(new Set(ids).size === ids.length, 'no tool id twice');
const schemaIds = new Set(listSchemas().map((s) => s.tool));
check(ids.every((i) => schemaIds.has(i)), 'every runner has a schema');
check(Object.isFrozen(ALL_RUNNERS) && Object.isFrozen(DEFAULT_SWITCHES), 'registry and default switches are frozen');
for (const id of ['timer', 'hash-tool', 'calculator', 'sort-lines', 'text-counter']) check(findRunner(id)?.toolId === id, 'finds ' + id);
for (const id of ['rephraser', 'grammar-helper', '', '__proto__', 'constructor', 'toString']) check(findRunner(id) === null, 'no runner for ' + JSON.stringify(id));
check(findRunner(undefined as unknown as string) === null, 'non-text id gives none');

// switch
check(modeFor('timer') === 'legacy', 'default is legacy');
check(modeFor('timer', { timer: 'runner' }) === 'runner', 'on gives runner');
check(modeFor('timer', { timer: 'legacy' }) === 'legacy', 'off gives legacy');
check(modeFor('timer', { timer: 'yes' as never }) === 'legacy', 'unknown value is legacy');
check(modeFor('timer', { other: 'runner' }) === 'legacy', 'other tool on does not turn this on');
check(modeFor('__proto__', {}) === 'legacy', 'proto key on plain switches is legacy');
check(modeFor('toString', {}) === 'legacy', 'inherited key is legacy');
check(modeFor('timer', null as never) === 'legacy', 'null switches is legacy');

// execute with a spy registry
let calls = 0;
const spy: ToolRunner = { toolId: 'spy', async run() { calls++; return { ok: true, toolId: 'spy', result: 1, reply: 'ok' }; } };
const thrower: ToolRunner = { toolId: 'thrower', async run() { throw new Error('boom'); } };
const rejecter: ToolRunner = { toolId: 'rejecter', run() { return Promise.reject(new Error('no')); } };
const syncThrower: ToolRunner = { toolId: 'sync', run() { throw new Error('sync'); } };
const reg = [spy, thrower, rejecter, syncThrower];
const frozenArgs = Object.freeze({ a: 1 });

const off = await execute('spy', frozenArgs, deps, DEFAULT_SWITCHES, reg);
check(off.route === 'legacy' && off.why === 'switch-off' && calls === 0, 'switch off never runs the runner');
const none = await execute('missing', frozenArgs, deps, { missing: 'runner' }, reg);
check(none.route === 'legacy' && none.why === 'no-runner', 'switch on but no runner stays legacy');
const on = await execute('spy', frozenArgs, deps, { spy: 'runner' }, reg);
check(on.route === 'runner' && on.outcome.ok === true && calls === 1, 'switch on runs the runner once');
for (const id of ['thrower', 'rejecter', 'sync']) {
  const r = await execute(id, frozenArgs, deps, { [id]: 'runner' }, reg);
  check(r.route === 'runner' && r.outcome.ok === false && r.outcome.kind === 'engine-refused', id + ' failure is typed, never thrown');
}
check(JSON.stringify(frozenArgs) === '{"a":1}', 'args unchanged');

// real runner through the registry
const hash = await execute('hash-tool', { input: 'abc', algorithm: 'SHA-256' }, deps, { 'hash-tool': 'runner' });
check(hash.route === 'runner' && hash.outcome.ok && hash.outcome.reply.includes('ba7816bf8f01cfea'), 'real hash runner gives the known SHA-256');
const hashOff = await execute('hash-tool', { input: 'abc', algorithm: 'SHA-256' }, deps);
check(hashOff.route === 'legacy', 'real runner is legacy by default');
const again = await execute('hash-tool', { input: 'abc', algorithm: 'SHA-256' }, deps, { 'hash-tool': 'runner' });
check(JSON.stringify(again) === JSON.stringify(hash), 'same inputs give the same outcome');

console.log(`runnerRegistry.test.ts: ${n} checks passed.`);
