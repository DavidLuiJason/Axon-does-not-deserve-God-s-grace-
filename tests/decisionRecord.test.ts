declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
import {makeDecisionRecord} from '../src/decision/decisionRecord';

function base(overrides:Record<string,unknown>={}){return {route:'FAST',depth:'DIRECT',permission:'ALLOW',stepsLeft:5,reasonCodes:['one-capability'],...overrides} as any;}
function expectError(value:any,code:string,message:string,label:string):void{const result=makeDecisionRecord(value);check(!result.ok,label+' code branch');if(!result.ok){check(result.error===code,label+' exact error');check(result.message===message,label+' exact message');check(Object.isFrozen(result),label+' frozen failure');}}
function expectSuccess(value:any,label:string):any{const result=makeDecisionRecord(value);check(result.ok,label+' succeeds');check(Object.isFrozen(result),label+' result frozen');if(result.ok){check(Object.isFrozen(result.value),label+' value frozen');check(Object.isFrozen(result.value.reasonCodes),label+' reasons frozen');if(result.value.ask!==null)check(Object.isFrozen(result.value.ask),label+' ask frozen');return result.value;}return null;}
const M={
'bad-input':'Decision record input is invalid.',
'confidence-not-allowed':'Decision record input is invalid.',
'unknown-key':'Decision record input is invalid.',
'bad-route':'Decision record input is invalid.',
'bad-depth':'Decision record input is invalid.',
'bad-depth-source':'Decision record input is invalid.',
'bad-ask':'Decision record input is invalid.',
'more-than-one-question':'Decision record input is invalid.',
'bad-permission':'Decision record input is invalid.',
'bad-steps':'Decision record input is invalid.',
'bad-reasons':'Decision record input is invalid.',
'permission-ask-mismatch':'Decision record input is invalid.',
'blocked-with-question':'Decision record input is invalid.'
} as const;

// Card oracle A: independently written expected value.
const aInput=base();const aBefore=JSON.stringify(aInput);const a=expectSuccess(aInput,'oracle A');
check(JSON.stringify(a)===JSON.stringify({route:'FAST',depth:'DIRECT',depthSource:'AUTO',ask:null,permission:'ALLOW',stepsLeft:5,reasonCodes:['one-capability']}),'oracle A exact record');
check(JSON.stringify(aInput)===aBefore,'oracle A input unchanged');
// Card oracle B.
const b=expectSuccess(base({route:'DEEP',depth:'DEEP-DIVE',depthSource:'OWNER',ask:{kind:'CLARIFICATION',question:'  Which file? '}}),'oracle B');
check(b.ask?.question==='Which file?','oracle B trimmed question');check(b.depthSource==='OWNER','oracle B owner source');
// Card oracle C: crossed route/depth combinations are both valid.
check(expectSuccess(base({route:'FAST',depth:'STRUCTURED'}),'oracle C1').depth==='STRUCTURED','oracle C1 cross pair');
check(expectSuccess(base({route:'DEEP',depth:'DIRECT'}),'oracle C2').route==='DEEP','oracle C2 cross pair');
// Card oracle D.
expectError(base({permission:'ASK',ask:null}),'permission-ask-mismatch',M['permission-ask-mismatch'],'oracle D1');
expectError(base({permission:'ASK',ask:{kind:'CLARIFICATION',question:'Which?'}}),'permission-ask-mismatch',M['permission-ask-mismatch'],'oracle D2');
expectError(base({permission:'ALLOW',ask:{kind:'APPROVAL',question:'Send it?'}}),'permission-ask-mismatch',M['permission-ask-mismatch'],'oracle D3');
check(expectSuccess(base({permission:'ASK',ask:{kind:'APPROVAL',question:'Send it?'}}),'oracle D4').ask?.kind==='APPROVAL','oracle D4 approval allowed');
// Card oracle E, including the specified precedence.
check(expectSuccess(base({permission:'NEVER',ask:null}),'oracle E1').ask===null,'oracle E1 blocked null ask');
expectError(base({permission:'NEVER',ask:{kind:'CLARIFICATION',question:'Why?'}}),'blocked-with-question',M['blocked-with-question'],'oracle E2');
expectError(base({permission:'NEVER',ask:{kind:'APPROVAL',question:'Send?'}}),'permission-ask-mismatch',M['permission-ask-mismatch'],'oracle E3 mismatch precedes blocked');
// Card oracle F.
expectError(base({confidence:0.9}),'confidence-not-allowed',M['confidence-not-allowed'],'oracle F1');
expectError(base({extra:true}),'unknown-key',M['unknown-key'],'oracle F2');
expectError(base({confidence:0.9,extra:true}),'confidence-not-allowed',M['confidence-not-allowed'],'oracle F3 confidence precedence');
// Card oracle G.
expectError(base({ask:{kind:'CLARIFICATION',question:'Which? Or that?'}}),'more-than-one-question',M['more-than-one-question'],'oracle G1');
expectError(base({ask:{kind:'CLARIFICATION',question:''}}),'bad-ask',M['bad-ask'],'oracle G2 empty');
expectError(base({ask:{kind:'CLARIFICATION',question:'   '}}),'bad-ask',M['bad-ask'],'oracle G3 whitespace');
expectError(base({ask:{kind:'CLARIFICATION',question:'x'.repeat(201)}}),'bad-ask',M['bad-ask'],'oracle G4 201 chars');
check(expectSuccess(base({ask:{kind:'CLARIFICATION',question:'x'.repeat(200)}}),'oracle G5 200 chars').ask?.question.length===200,'oracle G5 maximum length');
check(expectSuccess(base({ask:{kind:'CLARIFICATION',question:'Which?'}}),'oracle G6 one question mark').ask?.question==='Which?','oracle G6 exactly one mark');
// Card oracle H.
expectError(base({route:'ASK'}),'bad-route',M['bad-route'],'oracle H1 ASK is not route');
expectError(base({depth:'DEEP DIVE'}),'bad-depth',M['bad-depth'],'oracle H2 exact depth spelling');
expectError(base({reasonCodes:[]}),'bad-reasons',M['bad-reasons'],'oracle H3 empty reasons');
expectError(base({reasonCodes:['same','same']}),'bad-reasons',M['bad-reasons'],'oracle H4 duplicate reasons');
expectError(base({reasonCodes:Array.from({length:11},(_,i)=>'r'+i)}),'bad-reasons',M['bad-reasons'],'oracle H5 eleven reasons');
expectError(base({reasonCodes:['Bad Code']}),'bad-reasons',M['bad-reasons'],'oracle H6 invalid reason syntax');
check(expectSuccess(base({reasonCodes:Array.from({length:10},(_,i)=>'r'+i)}),'oracle H7 ten reasons').reasonCodes.length===10,'oracle H7 maximum reasons');
check(expectSuccess(base({reasonCodes:Array.from({length:9},(_,i)=>'r'+i)}),'reason count 9').reasonCodes.length===9,'reason count 9 accepted');
expectError(base({stepsLeft:-1}),'bad-steps',M['bad-steps'],'oracle H8 negative steps');
expectError(base({stepsLeft:1001}),'bad-steps',M['bad-steps'],'oracle H9 over maximum steps');
expectError(base({stepsLeft:1.5}),'bad-steps',M['bad-steps'],'oracle H10 fractional steps');
check(expectSuccess(base({stepsLeft:0}),'oracle H11 zero steps').stepsLeft===0,'oracle H11 minimum steps');
check(expectSuccess(base({stepsLeft:1000}),'oracle H12 max steps').stepsLeft===1000,'oracle H12 maximum steps');
// Card oracle I: question count is checked before permission validity.
expectError(base({ask:{kind:'CLARIFICATION',question:'One? Two?'},permission:'x'}),'more-than-one-question',M['more-than-one-question'],'oracle I order');

// Two additional hand-worked oracles J and K.
const j=expectSuccess(base({route:'DEEP',depth:'ADVANCED',depthSource:'AUTO',ask:{kind:'MISSING-INPUT',question:'Which source? '},permission:'ALLOW',stepsLeft:42,reasonCodes:['missing-source','needs-context']}),'oracle J');
check(JSON.stringify(j)===JSON.stringify({route:'DEEP',depth:'ADVANCED',depthSource:'AUTO',ask:{kind:'MISSING-INPUT',question:'Which source?'},permission:'ALLOW',stepsLeft:42,reasonCodes:['missing-source','needs-context']}),'oracle J exact expected record');
const ten=['r1','r2','r3','r4','r5','r6','r7','r8','r9','r10'];
const k=expectSuccess(base({route:'DEEP',depth:'DEEP-DIVE',ask:{kind:'APPROVAL',question:'Proceed?'},permission:'ASK',stepsLeft:0,reasonCodes:ten}),'oracle K');
check(k.stepsLeft===0&&k.reasonCodes.length===10&&k.ask?.kind==='APPROVAL','oracle K boundary arithmetic 0 steps and 10 codes');

// All error classes, exact code and exact message.
expectError(null,'bad-input',M['bad-input'],'bad-input null');expectError([],'bad-input',M['bad-input'],'bad-input array');
expectError(base({depthSource:'MANUAL'}),'bad-depth-source',M['bad-depth-source'],'bad-depth-source');
expectError(base({ask:{kind:'OTHER',question:'Why?'}}),'bad-ask',M['bad-ask'],'bad-ask kind');
expectError(base({ask:{kind:'CLARIFICATION',question:4}}),'bad-ask',M['bad-ask'],'bad-ask nonstring question');
expectError(base({ask:{kind:'CLARIFICATION',question:'Why?',extra:true}}),'bad-ask',M['bad-ask'],'bad-ask extra own key');
expectError(base({permission:'BLOCK'}),'bad-permission',M['bad-permission'],'bad-permission');
expectError(base({reasonCodes:['UPPER']}),'bad-reasons',M['bad-reasons'],'bad-reasons uppercase');
expectError(base({reasonCodes:['a'.repeat(31)]}),'bad-reasons',M['bad-reasons'],'bad-reasons 31 chars');
check(expectSuccess(base({reasonCodes:['a'.repeat(29)]}),'reason code length 29').reasonCodes[0].length===29,'reason code length 29 accepted');
check(expectSuccess(base({reasonCodes:['a'.repeat(30)]}),'reason code length 30').reasonCodes[0].length===30,'reason code length 30 accepted');

// Numeric boundaries: question length 0/1/2 and 199/200/201; step count -1/0/1 and 999/1000/1001.
expectError(base({ask:{kind:'CLARIFICATION',question:''}}),'bad-ask',M['bad-ask'],'question length 0');
check(expectSuccess(base({ask:{kind:'CLARIFICATION',question:'x'}}),'question length 1').ask?.question.length===1,'question length 1 accepted');
check(expectSuccess(base({ask:{kind:'CLARIFICATION',question:'xy'}}),'question length 2').ask?.question.length===2,'question length 2 accepted');
check(expectSuccess(base({ask:{kind:'CLARIFICATION',question:'x'.repeat(199)}}),'question length 199').ask?.question.length===199,'question length 199 accepted');
check(expectSuccess(base({stepsLeft:1}),'steps 1').stepsLeft===1,'steps 1 accepted');
check(expectSuccess(base({stepsLeft:999}),'steps 999').stepsLeft===999,'steps 999 accepted');

// Every enumerated list: first/last members and list rule boundaries.
check(expectSuccess(base({route:'FAST'}),'route first').route==='FAST','route first member');
check(expectSuccess(base({route:'DEEP'}),'route last').route==='DEEP','route last member');
check(expectSuccess(base({depth:'DIRECT'}),'depth first').depth==='DIRECT','depth first member');
check(expectSuccess(base({depth:'DEEP-DIVE'}),'depth last').depth==='DEEP-DIVE','depth last member');
check(expectSuccess(base({depthSource:'AUTO'}),'source first').depthSource==='AUTO','source first member');
check(expectSuccess(base({depthSource:'OWNER'}),'source last').depthSource==='OWNER','source last member');
check(expectSuccess(base({ask:{kind:'CLARIFICATION',question:'Why?'}}),'ask kind first').ask?.kind==='CLARIFICATION','ask first member');
check(expectSuccess(base({ask:{kind:'APPROVAL',question:'Okay?'},permission:'ASK'}),'ask kind last').ask?.kind==='APPROVAL','ask last member');
check(expectSuccess(base({permission:'ALLOW'}),'permission first').permission==='ALLOW','permission first member');
check(expectSuccess(base({permission:'NEVER'}),'permission last').permission==='NEVER','permission last member');
check(expectSuccess(base({reasonCodes:['a']}),'reason first').reasonCodes[0]==='a','reason list first');
check(expectSuccess(base({reasonCodes:['a','z']}),'reason last').reasonCodes[1]==='z','reason list last');
expectError(base({reasonCodes:['first','middle','first']}),'bad-reasons',M['bad-reasons'],'two reason entries qualify but duplicate is rejected');
expectError(base({reasonCodes:['a'.repeat(30),'b'.repeat(31)]}),'bad-reasons',M['bad-reasons'],'last invalid reason wins validation');

// Check order and own-key semantics.
expectError(base({ask:{kind:'CLARIFICATION',question:'Two? marks?'},permission:'x'}),'more-than-one-question',M['more-than-one-question'],'ask count before permission');
expectError(base({confidence:0.1,extra:1,route:'BAD'}),'confidence-not-allowed',M['confidence-not-allowed'],'confidence before unknown and route');
expectError(base({extra:1,route:'BAD'}),'unknown-key',M['unknown-key'],'unknown before route');
expectError(base({route:'BAD',depth:'BAD'}),'bad-route','Decision record input is invalid.','route before depth');
const hidden=base();Object.defineProperty(hidden,'extra',{value:1,enumerable:false});expectError(hidden,'unknown-key',M['unknown-key'],'non-enumerable own key');
const symbolKey=base();Object.defineProperty(symbolKey,Symbol('x'),{value:1});expectError(symbolKey,'unknown-key',M['unknown-key'],'symbol own key');
const explicitUndefined=base({depthSource:undefined});expectError(explicitUndefined,'bad-depth-source',M['bad-depth-source'],'present undefined depth source');

// Returned arrays/objects are copies; inputs remain unchanged.
const mutable={route:'FAST',depth:'DIRECT',permission:'ALLOW',stepsLeft:8,reasonCodes:['first','last'],ask:{kind:'CLARIFICATION',question:'  Keep?  '}};
const snapshot=JSON.stringify(mutable);const copied=expectSuccess(mutable,'copy and freeze');
check(JSON.stringify(mutable)===snapshot,'nested input unchanged');
check(copied.reasonCodes!==mutable.reasonCodes,'reason array copied');
check(copied.ask!==mutable.ask,'ask object copied');
check(copied.reasonCodes[0]==='first'&&copied.reasonCodes[1]==='last','copied reason order retained');
check(copied.ask?.question==='Keep?','copied question trimmed');

console.log('DECISION_RECORD OK: '+checks+' checks');
