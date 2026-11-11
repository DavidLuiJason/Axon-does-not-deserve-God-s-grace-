/** LIVE1a: the live-switch file is PINNED. Turning any tool on must change this test on purpose. */
import { LIVE_SWITCHES, STATE_TOOL_IDS } from '../src/tools/runners/liveSwitches';
import { DEFAULT_SWITCHES, modeFor, runnerToolIds } from '../src/tools/runners/runnerRegistry';
import { TIME_RUNNERS } from '../src/tools/runners/timeRunners';
let n = 0;
const check = (ok: boolean, name: string): void => { n++; if (!ok) throw new Error('FAILED: ' + name); };
const PINNED_ON: string[] = ['case-converter', 'number-to-words', 'sort-lines', 'text-counter'];
check(JSON.stringify(Object.keys(LIVE_SWITCHES).filter((id) => LIVE_SWITCHES[id] === 'runner').sort()) === JSON.stringify(PINNED_ON), 'pinned list of tools that are ON');
check(Object.keys(LIVE_SWITCHES).every((id) => LIVE_SWITCHES[id] === 'runner' || LIVE_SWITCHES[id] === 'legacy'), 'every value is a mode');
check(LIVE_SWITCHES['text-counter'] === 'runner', 'text-counter is ON since LIVE2 (task record proven by LIVE2a)');
check(LIVE_SWITCHES['case-converter'] === 'runner', 'case-converter is ON since LIVE8-3 (task record proven by textCaseAction)');
check(Object.keys(LIVE_SWITCHES).every((id) => ['text-counter', 'case-converter', 'sort-lines', 'number-to-words'].includes(id)), 'no other tool is ON');
check(Object.isFrozen(LIVE_SWITCHES) && Object.isFrozen(DEFAULT_SWITCHES), 'both frozen');
check(runnerToolIds().every((id) => modeFor(id, LIVE_SWITCHES) === 'legacy' || PINNED_ON.includes(id)), 'no runner is ON unless pinned');
check(Object.keys(DEFAULT_SWITCHES).length === 0, 'DEFAULT_SWITCHES itself never changes');
check(JSON.stringify(STATE_TOOL_IDS) === JSON.stringify(['timer', 'stopwatch', 'tally-counter']) && STATE_TOOL_IDS.every((id) => TIME_RUNNERS.some((r) => r.toolId === id)), 'state tools are the three stateful time tools (STATE4 F1)');
check(STATE_TOOL_IDS.includes('date-calculator') === false && TIME_RUNNERS.some((r) => r.toolId === 'date-calculator'), 'the date calculator is stateless, so it is not a state tool');
check(STATE_TOOL_IDS.includes('text-counter') === false, 'text counter needs no state');
console.log('liveSwitches: ' + n + ' checks passed');
