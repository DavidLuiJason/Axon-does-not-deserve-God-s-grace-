declare const console: { log: (value: string) => void };
import { decideActOrAsk } from '../src/decision/actOrAsk';
import { makeActOrAskInput, ActOrAskFeedArgs, FeedSchema } from '../src/decision/actOrAskFeed';

let checks = 0;
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error('FAIL: ' + label);
  checks++;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), label);
}
const MESSAGE = 'Act or ask feed input is invalid.';
type AnyArgs = Record<PropertyKey, unknown>;
const SCHEMAS: FeedSchema[] = [
 {tool:'counter',effects:['shows-result'],preconditions:[],undo:'not-needed',slots:[{name:'text',required:true}]},
 {tool:'converter',effects:['shows-result'],preconditions:[],undo:'not-needed',slots:[{name:'value',required:true},{name:'unit',required:true}]},
 {tool:'scanner',effects:['uses-camera','shows-result'],preconditions:['permission'],undo:'not-needed',slots:[]},
 {tool:'noter',effects:['stores-note'],preconditions:[],undo:'by-removal',slots:[{name:'text',required:true},{name:'title',required:false}]},
 {tool:'mailer',effects:['sends'],preconditions:['owner-approval'],undo:'irreversible',slots:[{name:'to',required:true},{name:'body',required:true}]},
 {tool:'remover',effects:['deletes'],preconditions:['owner-approval'],undo:'by-tool',slots:[{name:'file',required:true}]},
 {tool:'payer',effects:['spends','sends'],preconditions:['owner-approval'],undo:'irreversible',slots:[]},
 {tool:'oddpure',effects:['shows-result','writes-file'],preconditions:[],undo:'not-needed',slots:[]},
 {tool:'backup',effects:['sends'],preconditions:[],undo:'by-tool',slots:[]},
 {tool:'weird',effects:['deletes'],preconditions:[],undo:'not-needed',slots:[]}
];
const BASE: ActOrAskFeedArgs = {
 resolution:{kind:'none'}, schemas:SCHEMAS, slotDefaults:[{tool:'converter',slot:'unit'}],
 extraReadingTools:[], contextFills:[], safeStepFills:[], charter:{never:[],ask:[]}, costly:false
};
function args(changes: Partial<ActOrAskFeedArgs> = {}): ActOrAskFeedArgs {
  return { ...BASE, ...changes };
}
function expectSuccess(value: unknown, expected: unknown, label: string): void {
  const before = JSON.stringify(value);
  let result: ReturnType<typeof makeActOrAskInput>;
  try { result = makeActOrAskInput(value as ActOrAskFeedArgs); }
  catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(result.ok, label + ' succeeds');
  if (result.ok) {
    equal(result.value, expected, label + ' all eight exact fields');
    check(Object.isFrozen(result), label + ' result frozen');
    check(Object.isFrozen(result.value), label + ' value frozen');
  }
  check(JSON.stringify(value) === before, label + ' input unchanged');
}
function expected(permission:'ALLOW'|'ASK'|'NEVER', undo:'READ-ONLY'|'UNDOABLE'|'NOT-UNDOABLE',
  outward:'NONE'|'SEND'|'DELETE'|'MONEY', costly:boolean, readings:'ONE-CLEAR'|'TWO-CLOSE'|'NO-READING',
  missing:'NONE'|'CONTEXT-ANSWERS'|'SAFE-STEP-ANSWERS'|'OWNER-ONLY', readingChangesResult:boolean,
  inputChangesResult:boolean): unknown {
  return {permission,undo,outward,costly,readings,missing,readingChangesResult,inputChangesResult};
}
function expectError(value: unknown, code: string, label: string): void {
  let result: ReturnType<typeof makeActOrAskInput>;
  try { result = makeActOrAskInput(value as ActOrAskFeedArgs); }
  catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(!result.ok, label + ' fails');
  if (!result.ok) {
    check(result.error === code, label + ' exact code');
    check(result.message === MESSAGE, label + ' exact message');
    check(Object.isFrozen(result), label + ' failure frozen');
  }
}

const rows: Array<[string, Partial<ActOrAskFeedArgs>, unknown]> = [
['1 counter', {resolution:{kind:'match',tool:'counter',missingSlots:[]}}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','NONE',false,false)],
['2 noter', {resolution:{kind:'match',tool:'noter',missingSlots:[]}}, expected('ALLOW','UNDOABLE','NONE',false,'ONE-CLEAR','NONE',false,false)],
['3 mailer', {resolution:{kind:'match',tool:'mailer',missingSlots:[]}}, expected('ASK','NOT-UNDOABLE','SEND',false,'ONE-CLEAR','NONE',false,false)],
['4 remover', {resolution:{kind:'match',tool:'remover',missingSlots:[]}}, expected('ASK','UNDOABLE','DELETE',false,'ONE-CLEAR','NONE',false,false)],
['5 payer', {resolution:{kind:'match',tool:'payer',missingSlots:[]}}, expected('ASK','NOT-UNDOABLE','MONEY',false,'ONE-CLEAR','NONE',false,false)],
['6 oddpure', {resolution:{kind:'match',tool:'oddpure',missingSlots:[]}}, expected('ALLOW','NOT-UNDOABLE','NONE',false,'ONE-CLEAR','NONE',false,false)],
['7 weird', {resolution:{kind:'match',tool:'weird',missingSlots:[]}}, expected('ASK','NOT-UNDOABLE','DELETE',false,'ONE-CLEAR','NONE',false,false)],
['8 backup', {resolution:{kind:'match',tool:'backup',missingSlots:[]}}, expected('ASK','UNDOABLE','SEND',false,'ONE-CLEAR','NONE',false,false)],
['9 scanner', {resolution:{kind:'match',tool:'scanner',missingSlots:[]}}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','NONE',false,false)],
['10 counter missing text', {resolution:{kind:'match',tool:'counter',missingSlots:['text']}}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','OWNER-ONLY',false,true)],
['11 converter missing unit', {resolution:{kind:'match',tool:'converter',missingSlots:['unit']}}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','OWNER-ONLY',false,false)],
['12 converter missing both', {resolution:{kind:'match',tool:'converter',missingSlots:['value','unit']}}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','OWNER-ONLY',false,true)],
['13 context', {resolution:{kind:'match',tool:'counter',missingSlots:['text']},contextFills:['text']}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','CONTEXT-ANSWERS',false,false)],
['14 safe step', {resolution:{kind:'match',tool:'counter',missingSlots:['text']},safeStepFills:['text']}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','SAFE-STEP-ANSWERS',false,false)],
['15 context beats safe', {resolution:{kind:'match',tool:'counter',missingSlots:['text']},contextFills:['text'],safeStepFills:['text']}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','CONTEXT-ANSWERS',false,false)],
['16 context plus owner-only', {resolution:{kind:'match',tool:'converter',missingSlots:['value','unit']},contextFills:['value']}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','OWNER-ONLY',false,false)],
['17 safe beats context only for remaining', {resolution:{kind:'match',tool:'converter',missingSlots:['value','unit']},contextFills:['unit'],safeStepFills:['value']}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','SAFE-STEP-ANSWERS',false,false)],
['18 ask counter converter', {resolution:{kind:'ask',choices:['counter','converter']}}, expected('ALLOW','READ-ONLY','NONE',false,'TWO-CLOSE','NONE',true,false)],
['19 ask counter mailer', {resolution:{kind:'ask',choices:['counter','mailer']}}, expected('ASK','NOT-UNDOABLE','SEND',false,'TWO-CLOSE','NONE',true,false)],
['20 ask counter noter', {resolution:{kind:'ask',choices:['counter','noter']}}, expected('ALLOW','UNDOABLE','NONE',false,'TWO-CLOSE','NONE',true,false)],
['21 extra converter', {resolution:{kind:'match',tool:'counter',missingSlots:[]},extraReadingTools:['converter']}, expected('ALLOW','READ-ONLY','NONE',false,'TWO-CLOSE','NONE',true,false)],
['22 duplicate extra readings collapse', {resolution:{kind:'match',tool:'counter',missingSlots:[]},extraReadingTools:['counter','counter']}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','NONE',false,false)],
['23 value evidence', {resolution:{kind:'match',tool:'counter',missingSlots:[],evidence:'value'}}, expected('ALLOW','READ-ONLY','NONE',false,'TWO-CLOSE','NONE',true,false)],
['24 both evidence', {resolution:{kind:'match',tool:'counter',missingSlots:[],evidence:'both'}}, expected('ALLOW','READ-ONLY','NONE',false,'ONE-CLEAR','NONE',false,false)],
['25 none', {resolution:{kind:'none'}}, expected('ALLOW','READ-ONLY','NONE',false,'NO-READING','NONE',false,false)],
['26 charter never mailer', {resolution:{kind:'match',tool:'mailer',missingSlots:[]},charter:{never:['mailer'],ask:[]}}, expected('NEVER','NOT-UNDOABLE','SEND',false,'ONE-CLEAR','NONE',false,false)],
['27 charter never among readings', {resolution:{kind:'ask',choices:['counter','mailer']},charter:{never:['mailer'],ask:[]}}, expected('NEVER','NOT-UNDOABLE','SEND',false,'TWO-CLOSE','NONE',true,false)],
['28 charter ask counter', {resolution:{kind:'match',tool:'counter',missingSlots:[]},charter:{never:[],ask:['counter']}}, expected('ASK','READ-ONLY','NONE',false,'ONE-CLEAR','NONE',false,false)],
['29 costly', {resolution:{kind:'match',tool:'counter',missingSlots:[]},costly:true}, expected('ALLOW','READ-ONLY','NONE',true,'ONE-CLEAR','NONE',false,false)],
['30 extra noter + missing', {resolution:{kind:'match',tool:'counter',missingSlots:['text']},extraReadingTools:['noter']}, expected('ALLOW','UNDOABLE','NONE',false,'TWO-CLOSE','OWNER-ONLY',true,true)],
['31 ask counter payer', {resolution:{kind:'ask',choices:['counter','payer']}}, expected('ASK','NOT-UNDOABLE','MONEY',false,'TWO-CLOSE','NONE',true,false)],
['32 noter missing text context title', {resolution:{kind:'match',tool:'noter',missingSlots:['text']},contextFills:['title']}, expected('ALLOW','UNDOABLE','NONE',false,'ONE-CLEAR','OWNER-ONLY',false,true)]
];
for (const [label, changes, want] of rows) expectSuccess(args(changes), want, label);

// Exact validation codes and fixed failure message.
expectError(null,'bad-input','null');
expectError([],'bad-input','array input');
expectError({...BASE,confidence:0,extra:1},'confidence-not-allowed','confidence before unknown');
expectError({...BASE,extra:1,resolution:null},'unknown-key','unknown before resolution');
expectError({...BASE,resolution:null,schemas:null},'bad-resolution','resolution before schemas');
expectError({...BASE,costly:'yes',resolution:{kind:'negated'}},'bad-costly','costly before not-for-j6');
expectError(args({resolution:{kind:'negated'}}),'not-for-j6','negated');
expectError(args({resolution:{kind:'not-a-request'}}),'not-for-j6','not-a-request');
expectError(args({resolution:{kind:'unavailable'}}),'not-for-j6','unavailable');
expectError(args({resolution:{kind:'match',tool:'ghost',missingSlots:[]}}),'unknown-tool','unknown match tool');
expectError(args({resolution:{kind:'ask',choices:['counter','ghost']}}),'unknown-tool','unknown ask tool');
expectError(args({resolution:{kind:'match',tool:'counter',missingSlots:[]},extraReadingTools:['ghost']}),'unknown-tool','unknown extra reading');
expectError(args({resolution:{kind:'match',tool:'noter',missingSlots:['title']}}),'bad-missing-slot','optional slot not missing-required');
expectError(args({resolution:{kind:'match',tool:'counter',missingSlots:['nope']}}),'bad-missing-slot','unknown missing slot');
expectError({...BASE,resolution:{kind:'match',tool:'counter',missingSlots:[],evidence:'guess'}},'bad-resolution','invalid evidence');
expectError({...BASE,resolution:{kind:'match',tool:'counter',missingSlots:[],extra:1}},'bad-resolution','resolution extra key');
expectError({...BASE,resolution:{kind:'match',tool:'counter',missingSlots:[],[Symbol('x')]:1}},'bad-resolution','resolution symbol key');
expectError({...BASE,[Symbol('x')]:1},'unknown-key','top symbol key');
expectError({...BASE,resolution:undefined},'bad-resolution','missing required key');
const inheritedResolution = Object.assign(Object.create({resolution:{kind:'none'}}), BASE) as AnyArgs;
delete inheritedResolution.resolution;
expectError(inheritedResolution,'bad-resolution','inherited key is still missing');
expectError({...BASE,schemas:[...SCHEMAS,SCHEMAS[0]]},'bad-schemas','duplicate schema tool');
expectError({...BASE,resolution:{kind:'ask',choices:['counter']}},'bad-resolution','one choice');
expectError({...BASE,resolution:{kind:'ask',choices:['counter','converter','noter','scanner','backup']}},'bad-resolution','five choices');
expectError({...BASE,extraReadingTools:['counter','converter','noter','scanner','backup']},'bad-extra-readings','five extra readings');
expectError({...BASE,extraReadingTools:['counter']},'bad-extra-readings','none with extra readings');
expectError({...BASE,slotDefaults:[{tool:'counter'}]},'bad-slot-defaults','bad slot default');
expectError({...BASE,contextFills:['']},'bad-context-fills','bad context fill');
expectError({...BASE,safeStepFills:['']},'bad-safe-fills','bad safe fill');
expectError({...BASE,charter:{never:[],ask:[],extra:true}},'bad-charter','charter extra key');
expectError({...BASE,charter:{never:['x'],ask:[1]}},'bad-charter','charter bad entry');
expectError({...BASE,costly:1},'bad-costly','bad costly');

// Additional error-order pins, including unknown tool before bad missing slot.
expectError({...BASE,confidence:1,extra:1,resolution:null},'confidence-not-allowed','confidence plus extra key');
expectError({...BASE,extra:1,resolution:null},'unknown-key','extra key plus bad resolution');
expectError({...BASE,resolution:null,schemas:null},'bad-resolution','bad resolution plus bad schemas');
expectError({...BASE,costly:1,resolution:{kind:'negated'}},'bad-costly','bad costly plus negated');
expectError({...BASE,resolution:{kind:'match',tool:'ghost',missingSlots:['nope']}},'unknown-tool','unknown tool before bad missing');
expectError({...BASE,resolution:{kind:'ask',choices:['counter','counter']}},'bad-resolution','duplicate choices');
expectError({...BASE,schemas:[{...SCHEMAS[0],slots:[{name:'text',required:true},{name:'text',required:false}]}]},'bad-schemas','duplicate schema slot');
expectError({...BASE,schemas:[{...SCHEMAS[0],effects:['shows-result','shows-result']}]},'bad-schemas','duplicate effects');
expectError({...BASE,schemas:[{...SCHEMAS[0],[Symbol('x')]:1}]},'bad-schemas','schema symbol key');

// The feed's successful values must always be accepted by J6.
const fixtureTools = SCHEMAS.map(schema => schema.tool);
for (const schema of SCHEMAS) {
  const required = schema.slots.filter(slot => slot.required).map(slot => slot.name);
  const subsets: string[][] = [];
  for (let mask = 0; mask < (1 << required.length); mask++) {
    const subset: string[] = [];
    for (let i = 0; i < required.length; i++) if ((mask & (1 << i)) !== 0) subset.push(required[i]);
    subsets.push(subset);
  }
  for (const missingSlots of subsets) {
    for (const evidence of ['absent','value','concept'] as const) {
      for (const extraMode of ['none', ...fixtureTools] as const) {
        for (const charterMode of ['clear','never-this','ask-all'] as const) {
          for (const contextMode of ['empty','all-required'] as const) {
            const resolution = evidence === 'absent'
              ? {kind:'match' as const,tool:schema.tool,missingSlots}
              : {kind:'match' as const,tool:schema.tool,missingSlots,evidence};
            const extraReadingTools = extraMode === 'none' ? [] : [extraMode];
            const charter = charterMode === 'clear' ? {never:[],ask:[]} :
              charterMode === 'never-this' ? {never:[schema.tool],ask:[]} : {never:[],ask:fixtureTools};
            const contextFills = contextMode === 'empty' ? [] : required;
            const candidate = args({resolution,extraReadingTools,charter,contextFills});
            const result = makeActOrAskInput(candidate);
            check(result.ok, 'sweep feed accepts ' + schema.tool + ' ' + evidence + ' ' + extraMode + ' ' + charterMode + ' ' + contextMode);
            if (result.ok) {
              const j6 = decideActOrAsk(result.value);
              check(j6.ok, 'sweep J6 accepts ' + schema.tool + ' ' + evidence + ' ' + extraMode + ' ' + charterMode + ' ' + contextMode);
            }
          }
        }
      }
    }
  }
}
let askPairs = 0;
for (const first of fixtureTools) for (const second of fixtureTools) {
  if (first === second) continue;
  const result = makeActOrAskInput(args({resolution:{kind:'ask',choices:[first,second]}}));
  check(result.ok, 'ordered ask pair succeeds ' + first + ' / ' + second);
  if (result.ok) check(decideActOrAsk(result.value).ok, 'ordered ask pair J6 accepts ' + first + ' / ' + second);
  askPairs++;
}
check(askPairs === fixtureTools.length * (fixtureTools.length - 1), 'all ordered different-tool ask pairs visited');

console.log('ACT_OR_ASK_FEED OK: ' + checks + ' checks');
