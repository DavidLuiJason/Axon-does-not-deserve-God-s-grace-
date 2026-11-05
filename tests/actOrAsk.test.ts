declare const console: { log: (value: string) => void };
import { decideActOrAsk, ActOrAskInput } from '../src/decision/actOrAsk';

let checks = 0;
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error('FAIL: ' + label);
  checks++;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), label);
}
const MESSAGE = 'Act or ask input is invalid.';
type AnyInput = Record<string, unknown>;
const BASE: ActOrAskInput = {
  permission:'ALLOW', undo:'UNDOABLE', outward:'NONE', costly:false,
  readings:'ONE-CLEAR', missing:'NONE', readingChangesResult:false, inputChangesResult:false
};
function input(overrides: Partial<ActOrAskInput> = {}): ActOrAskInput { return { ...BASE, ...overrides }; }
function expectSuccess(value: unknown, expected: unknown, label: string): void {
  const before = JSON.stringify(value);
  let result: ReturnType<typeof decideActOrAsk>;
  try { result = decideActOrAsk(value as ActOrAskInput); }
  catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(result.ok, label + ' succeeds');
  if (result.ok) {
    equal(result.value, expected, label + ' exact value');
    check(Object.isFrozen(result), label + ' result frozen');
    check(Object.isFrozen(result.value), label + ' value frozen');
    check(Object.isFrozen(result.value.reasonCodes), label + ' reasonCodes frozen');
  }
  check(JSON.stringify(value) === before, label + ' input unchanged');
}
function expectError(value: unknown, code: string, label: string): void {
  const result = decideActOrAsk(value as ActOrAskInput);
  check(!result.ok, label + ' fails');
  if (!result.ok) {
    check(result.error === code, label + ' exact error code');
    check(result.message === MESSAGE, label + ' exact error message');
    check(Object.isFrozen(result), label + ' failure frozen');
  }
}

const expectedRows: Array<[string, ActOrAskInput, unknown]> = [
['1 clear, undoable', input(), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['one-reading']}],
['2 clear, read-only', input({undo:'READ-ONLY'}), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['one-reading']}],
['3 two close, changes, undoable', input({readings:'TWO-CLOSE',readingChangesResult:true}), {outcome:'ACT',askKind:null,sayReading:true,reasonCodes:['two-readings-undoable']}],
['4 two close, same result', input({readings:'TWO-CLOSE'}), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['readings-same-result']}],
['5 two close, changes, not undoable', input({readings:'TWO-CLOSE',readingChangesResult:true,undo:'NOT-UNDOABLE'}), {outcome:'ASK',askKind:'CLARIFICATION',sayReading:false,reasonCodes:['two-readings','not-undoable']}],
['6 two close, changes, sends', input({readings:'TWO-CLOSE',readingChangesResult:true,outward:'SEND'}), {outcome:'ASK',askKind:'CLARIFICATION',sayReading:false,reasonCodes:['two-readings','not-undoable']}],
['7 no reading', input({readings:'NO-READING'}), {outcome:'ASK',askKind:'CLARIFICATION',sayReading:false,reasonCodes:['no-reading']}],
['8 owner-only input matters', input({missing:'OWNER-ONLY',inputChangesResult:true}), {outcome:'ASK',askKind:'MISSING-INPUT',sayReading:false,reasonCodes:['missing-input']}],
['9 owner-only default', input({missing:'OWNER-ONLY'}), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['one-reading','default-used']}],
['10 context answers', input({missing:'CONTEXT-ANSWERS',inputChangesResult:true}), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['one-reading','context-answers']}],
['11 safe step answers', input({missing:'SAFE-STEP-ANSWERS',inputChangesResult:true}), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['one-reading','safe-step-answers']}],
['12 NEVER with no reading', input({permission:'NEVER',readings:'NO-READING'}), {outcome:'BLOCK',askKind:null,sayReading:false,reasonCodes:['permission-never']}],
['13 permission ASK', input({permission:'ASK'}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['permission-ask']}],
['14 deletes', input({outward:'DELETE'}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['deletes']}],
['15 money and costly', input({outward:'MONEY',costly:true}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['spends-money','costly']}],
['16 not undoable', input({undo:'NOT-UNDOABLE'}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['not-undoable']}],
['17 costly only', input({costly:true}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['costly']}],
['18 ALLOW does not lift approval', input({undo:'NOT-UNDOABLE',outward:'SEND'}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['not-undoable','sends']}],
['19 readings then owner-only', input({readings:'TWO-CLOSE',readingChangesResult:true,missing:'OWNER-ONLY',inputChangesResult:true}), {outcome:'ASK',askKind:'MISSING-INPUT',sayReading:false,reasonCodes:['missing-input']}],
['20 no reading beats missing', input({readings:'NO-READING',missing:'OWNER-ONLY',inputChangesResult:true}), {outcome:'ASK',askKind:'CLARIFICATION',sayReading:false,reasonCodes:['no-reading']}],
['21 NEVER beats not undoable', input({permission:'NEVER',undo:'NOT-UNDOABLE'}), {outcome:'BLOCK',askKind:null,sayReading:false,reasonCodes:['permission-never']}],
['22 same readings plus default', input({readings:'TWO-CLOSE',missing:'OWNER-ONLY'}), {outcome:'ACT',askKind:null,sayReading:false,reasonCodes:['readings-same-result','default-used']}],
['23 readings matter and context answers', input({readings:'TWO-CLOSE',readingChangesResult:true,missing:'CONTEXT-ANSWERS'}), {outcome:'ACT',askKind:null,sayReading:true,reasonCodes:['two-readings-undoable','context-answers']}],
['24 permission ASK beats say reading', input({permission:'ASK',readings:'TWO-CLOSE',readingChangesResult:true}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['permission-ask']}],
['25 read-only but costly', input({undo:'READ-ONLY',costly:true}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['costly']}],
['26 all four approval reasons', input({permission:'ASK',undo:'NOT-UNDOABLE',outward:'MONEY',costly:true}), {outcome:'ASK',askKind:'APPROVAL',sayReading:false,reasonCodes:['permission-ask','not-undoable','spends-money','costly']}]
];
for (const [label, value, expected] of expectedRows) expectSuccess(value, expected, label);

// Every validation error, with required own-key presence and first-failure order.
expectError(null,'bad-input','null input');
expectError([],'bad-input','array input');
expectError({confidence:0,...BASE,extra:1},'confidence-not-allowed','confidence precedes unknown key');
expectError({...BASE,extra:1,permission:'BAD'},'unknown-key','unknown key precedes bad permission');
expectError({...BASE,permission:'BAD',undo:'BAD'},'bad-permission','permission precedes undo');
expectError({...BASE,undo:'BAD',outward:'BAD'},'bad-undo','undo precedes outward');
expectError({...BASE,outward:'BAD',costly:'yes'},'bad-outward','outward precedes costly');
expectError({...BASE,costly:1,readings:'BAD'},'bad-costly','costly precedes readings');
expectError({...BASE,readings:'BAD',missing:'BAD'},'bad-readings','readings precedes missing');
expectError({...BASE,missing:'BAD',readingChangesResult:1},'bad-missing','missing precedes readingChangesResult');
expectError({...BASE,readingChangesResult:1,inputChangesResult:1},'bad-reading-changes','reading change precedes input change');
expectError({...BASE,inputChangesResult:1},'bad-input-changes','input change validation');
expectError({...BASE,undo:'READ-ONLY',outward:'SEND'},'read-only-with-effect','read-only with outward effect');
const symbolInput = {...BASE} as unknown as Record<PropertyKey, unknown>;
symbolInput[Symbol('unexpected')] = true;
expectError(symbolInput,'unknown-key','symbol own key');
const hiddenInput = {...BASE} as AnyInput;
Object.defineProperty(hiddenInput,'hidden',{value:1,enumerable:false});
expectError(hiddenInput,'unknown-key','non-enumerable own key');
const missingKey = {...BASE} as AnyInput;
delete missingKey.missing;
expectError(missingKey,'bad-missing','missing required key');
const undefinedKey = {...BASE, readings:undefined};
expectError(undefinedKey,'bad-readings','present undefined is invalid');

// Every Cartesian combination: 3 x 3 x 4 x 2 x 3 x 4 x 2 x 2 = 3456; never throws.
const permissions = ['ALLOW','ASK','NEVER'] as const;
const undos = ['READ-ONLY','UNDOABLE','NOT-UNDOABLE'] as const;
const outwards = ['NONE','SEND','DELETE','MONEY'] as const;
const costs = [false,true] as const;
const readings = ['ONE-CLEAR','TWO-CLOSE','NO-READING'] as const;
const missings = ['NONE','CONTEXT-ANSWERS','SAFE-STEP-ANSWERS','OWNER-ONLY'] as const;
const flags = [false,true] as const;
let combinations = 0;
for (const permission of permissions) for (const undo of undos) for (const outward of outwards)
for (const costly of costs) for (const reading of readings) for (const missing of missings)
for (const readingChangesResult of flags) for (const inputChangesResult of flags) {
  const candidate = {permission,undo,outward,costly,readings:reading,missing,readingChangesResult,inputChangesResult} as ActOrAskInput;
  let result: ReturnType<typeof decideActOrAsk>;
  try { result = decideActOrAsk(candidate); } catch { throw new Error('FAIL: combination threw'); }
  check(typeof result === 'object' && result !== null && typeof result.ok === 'boolean','combination returns EngineResult');
  if (result.ok) {
    const v = result.value;
    check((v.outcome === 'BLOCK') === (v.askKind === null && v.reasonCodes[0] === 'permission-never'), 'BLOCK consistency');
    if (v.outcome === 'ASK') check(v.askKind !== null,'ASK has askKind');
    if (v.outcome === 'ACT') check(v.askKind === null && v.reasonCodes.length > 0,'ACT has null askKind and reason');
    if (v.askKind === 'APPROVAL') {
      check(v.reasonCodes.some(code => ['permission-ask','not-undoable','sends','deletes','spends-money','costly'].includes(code)), 'approval has approval reason');
    }
    if (v.outcome === 'BLOCK') check(v.askKind === null,'BLOCK askKind null');
  }
  combinations++;
}
check(combinations === 3456,'all 3456 combinations visited');

console.log('ACT_OR_ASK OK: ' + checks + ' checks');
