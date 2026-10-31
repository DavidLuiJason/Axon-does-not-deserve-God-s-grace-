/** LIVE1a: the live-switch file is PINNED. Turning any tool on must change this test on purpose. */
import { LIVE_SWITCHES, STATE_TOOL_IDS } from '../src/tools/runners/liveSwitches';
import { DEFAULT_SWITCHES, modeFor, runnerToolIds } from '../src/tools/runners/runnerRegistry';
import { TIME_RUNNERS } from '../src/tools/runners/timeRunners';
let n = 0;
const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const PINNED_ON: string[] = [];
check(JSON.stringify(Object.keys(LIVE_SWITCHES).filter((id) => LIVE_SWITCHES[id] === 'runner').sort()) === JSON.stringify(PINNED_ON), 'pinned list of tools that are ON');
check(Object.keys(LIVE_SWITCHES).every((id) => LIVE_SWITCHES[id] === 'runner' || LIVE_SWITCHES[id] === 'legacy'), 'every value is a mode');
check(LIVE_SWITCHES['text-counter'] !== 'runner', 'text-counter stays OFF until LIVE2a (task record) is proven');
check(Object.isFrozen(LIVE_SWITCHES) && Object.isFrozen(DEFAULT_SWITCHES), 'both frozen');
check(runnerToolIds().every((id) => modeFor(id, LIVE_SWITCHES) === 'legacy' || PINNED_ON.includes(id)), 'no runner is ON unless pinned');
check(Object.keys(DEFAULT_SWITCHES).length === 0, 'DEFAULT_SWITCHES itself never changes');
check(STATE_TOOL_IDS.length === TIME_RUNNERS.length && STATE_TOOL_IDS.length > 0 && STATE_TOOL_IDS.every((id, i) => id === TIME_RUNNERS[i]!.toolId), 'state tools are the time family');
check(STATE_TOOL_IDS.includes('text-counter') === false, 'text counter needs no state');
console.log('liveSwitches: ' + n + ' checks passed');
