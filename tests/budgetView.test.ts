declare const console: { log: (value: string) => void };
import { budgetView, BUDGET_VIEW_TABLE } from '../src/budget/budgetView';
import { newBudget, reserve, settle, type BudgetState } from '../src/budget/budgetBroker';
import { DEVICE_RESOURCES } from '../src/budget/resources/deviceResources';
import { TASK_RESOURCES } from '../src/budget/resources/taskResources';
import { ACCOUNT_RESOURCES } from '../src/budget/resources/accountResources';
import { BUILDER_RESOURCES } from '../src/budget/resources/builderResources';

let checks = 0;
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error('FAIL: ' + label);
  checks++;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), label);
}
const MESSAGE = 'Budget view input is invalid.';
type Fixture = { domain: 'DEVICE'|'TASK'|'ACCOUNT'|'BUILDER'; state: BudgetState };
function state(value: unknown): BudgetState { return value as BudgetState; }
const F1: Fixture = {domain:'TASK',state:state({capacity:{steps:100,tests:20,files:50},verificationReserve:{steps:10},used:{steps:5,tests:3},observed:['steps','tests'],samples:{steps:5,tests:2},reservations:[]})};
const F2: Fixture = {domain:'TASK',state:state({capacity:{steps:10},verificationReserve:{},used:{steps:51},observed:['steps'],samples:{steps:5},reservations:[]})};
const F3: Fixture = {domain:'TASK',state:state({capacity:{steps:10,tests:20},verificationReserve:{},used:{steps:51,tests:0},observed:['steps'],samples:{steps:5,tests:5},reservations:[]})};
const F4: Fixture = {domain:'TASK',state:state({capacity:{steps:100},verificationReserve:{steps:10},used:{},observed:['steps'],samples:{steps:5},reservations:[{id:'a',kind:'work',amounts:{steps:50}}]})};
const F5: Fixture = {domain:'DEVICE',state:state({capacity:{ramMb:2000,networkMb:100,batteryPct:100},verificationReserve:{},used:{ramMb:500},observed:['ramMb'],samples:{ramMb:5,networkMb:5,batteryPct:5},reservations:[]})};
const F6: Fixture = {domain:'ACCOUNT',state:state({capacity:{aiCalls:20,attachments:10},verificationReserve:{},used:{aiCalls:2},observed:['aiCalls'],samples:{aiCalls:5,attachments:5},reservations:[]})};
const F7: Fixture = {domain:'BUILDER',state:state({capacity:{testMinutes:60,repoFiles:4000},verificationReserve:{testMinutes:10},used:{},observed:[],samples:{testMinutes:5,repoFiles:0},reservations:[]})};

type Expected = {outcome:string;reasons:readonly {code:string;resource:string}[];basis:readonly {resource:string;basis:string;samples:number}[];ownerCost:boolean};
const R=(code:string,resource:string)=>({code,resource});
const B=(resource:string,basis:string,samples:number)=>({resource,basis,samples});
const rows:Array<[string,Fixture,Record<string,number>,Expected]> = [
['1',F1,{steps:75},{outcome:'AVAILABLE',reasons:[],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['2',F1,{steps:76},{outcome:'CONSTRAINED',reasons:[R('margin','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['3',F1,{steps:85},{outcome:'CONSTRAINED',reasons:[R('margin','steps'),R('reserve-only','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['4',F1,{steps:86},{outcome:'BLOCKED',reasons:[R('over-budget','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['5',F1,{steps:1},{outcome:'AVAILABLE',reasons:[],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['6',F1,{tests:2},{outcome:'AVAILABLE',reasons:[],basis:[B('tests','ESTIMATE',2)],ownerCost:false}],
['7',F1,{tests:3},{outcome:'UNKNOWN',reasons:[R('estimate-only','tests')],basis:[B('tests','ESTIMATE',2)],ownerCost:false}],
['8',F1,{files:5},{outcome:'AVAILABLE',reasons:[],basis:[B('files','ESTIMATE',0)],ownerCost:false}],
['9',F1,{files:6},{outcome:'UNKNOWN',reasons:[R('estimate-only','files')],basis:[B('files','ESTIMATE',0)],ownerCost:false}],
['10',F1,{steps:75,tests:3},{outcome:'UNKNOWN',reasons:[R('estimate-only','tests')],basis:[B('steps','OBSERVED',5),B('tests','ESTIMATE',2)],ownerCost:false}],
['11',F1,{steps:86,tests:3},{outcome:'BLOCKED',reasons:[R('over-budget','steps'),R('estimate-only','tests')],basis:[B('steps','OBSERVED',5),B('tests','ESTIMATE',2)],ownerCost:false}],
['12',F1,{toolCalls:1},{outcome:'UNKNOWN',reasons:[R('no-figure','toolCalls')],basis:[],ownerCost:false}],
['13',F1,{steps:75,toolCalls:1},{outcome:'UNKNOWN',reasons:[R('no-figure','toolCalls')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['14',F2,{steps:1},{outcome:'BLOCKED',reasons:[R('overrun','steps'),R('over-budget','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['15',F3,{tests:2},{outcome:'AVAILABLE',reasons:[],basis:[B('tests','OBSERVED',5)],ownerCost:false}],
['16',F4,{steps:40},{outcome:'CONSTRAINED',reasons:[R('margin','steps'),R('reserve-only','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['17',F4,{steps:41},{outcome:'BLOCKED',reasons:[R('over-budget','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}],
['18',F5,{ramMb:100},{outcome:'AVAILABLE',reasons:[],basis:[B('ramMb','OBSERVED',5)],ownerCost:false}],
['19',F5,{networkMb:5},{outcome:'AVAILABLE',reasons:[],basis:[B('networkMb','OBSERVED',5)],ownerCost:true}],
['20',F5,{ramMb:100,networkMb:0},{outcome:'AVAILABLE',reasons:[],basis:[B('ramMb','OBSERVED',5)],ownerCost:false}],
['21',F6,{aiCalls:1},{outcome:'AVAILABLE',reasons:[],basis:[B('aiCalls','OBSERVED',5)],ownerCost:true}],
['22',F7,{testMinutes:49},{outcome:'CONSTRAINED',reasons:[R('margin','testMinutes')],basis:[B('testMinutes','OBSERVED',5)],ownerCost:false}],
['23',F7,{repoFiles:400},{outcome:'AVAILABLE',reasons:[],basis:[B('repoFiles','ESTIMATE',0)],ownerCost:false}],
['24',F7,{repoFiles:401},{outcome:'UNKNOWN',reasons:[R('estimate-only','repoFiles')],basis:[B('repoFiles','ESTIMATE',0)],ownerCost:false}],
['25',F5,{ramMb:1501},{outcome:'BLOCKED',reasons:[R('over-budget','ramMb')],basis:[B('ramMb','OBSERVED',5)],ownerCost:false}],
['26',F5,{ramMb:1500},{outcome:'CONSTRAINED',reasons:[R('margin','ramMb')],basis:[B('ramMb','OBSERVED',5)],ownerCost:false}]
];
function expectView(f:Fixture, request:Record<string,number>, expected:Expected, label:string): void {
  const beforeState=JSON.stringify(f.state), beforeRequest=JSON.stringify(request);
  const result=budgetView({domain:f.domain,state:f.state,request});
  check(result.ok,label+' succeeds');
  if(result.ok){
    equal(result.value,{domain:f.domain,...expected},label+' exact result');
    check(Object.isFrozen(result),label+' result frozen');
    check(Object.isFrozen(result.value),label+' value frozen');
    check(Object.isFrozen(result.value.reasons),label+' reasons frozen');
    check(Object.isFrozen(result.value.basis),label+' basis frozen');
    check(result.value.reasons.every(Object.isFrozen),label+' reason items frozen');
    check(result.value.basis.every(Object.isFrozen),label+' basis items frozen');
  }
  check(JSON.stringify(f.state)===beforeState,label+' state unchanged');
  check(JSON.stringify(request)===beforeRequest,label+' request unchanged');
}
for(const [label,f,request,expected] of rows) expectView(f,request,expected,'case '+label);

// Two integration rows: use the real budget broker to create and settle the state.
function integrated(k:number): BudgetState {
  const created=newBudget({steps:100},{steps:10});
  if(!created.ok) throw new Error('integration newBudget failed');
  let current=created.value;
  for(let i=1;i<=k;i++){
    const held=reserve(current,'r'+i,{steps:1},'work');
    if(!held.ok) throw new Error('integration reserve failed');
    const done=settle(held.value,'r'+i,{steps:1});
    if(!done.ok) throw new Error('integration settle failed');
    current=done.value.state;
  }
  return current;
}
expectView({domain:'TASK',state:integrated(5)},{steps:75},
 {outcome:'AVAILABLE',reasons:[],basis:[B('steps','OBSERVED',5)],ownerCost:false},'integration five samples');
expectView({domain:'TASK',state:integrated(4)},{steps:75},
 {outcome:'UNKNOWN',reasons:[R('estimate-only','steps')],basis:[B('steps','ESTIMATE',4)],ownerCost:false},'integration four samples');

// F1 boundary sweep, a=1..95.
for(let a=1;a<=95;a++){
  const expected:Expected = a<=75
    ? {outcome:'AVAILABLE',reasons:[],basis:[B('steps','OBSERVED',5)],ownerCost:false}
    : a<=85
      ? {outcome:'CONSTRAINED',reasons:a===85?[R('margin','steps'),R('reserve-only','steps')]:[R('margin','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false}
      : {outcome:'BLOCKED',reasons:[R('over-budget','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false};
  const got=budgetView({domain:'TASK',state:F1.state,request:{steps:a}});
  check(got.ok,'boundary '+a+' succeeds');
  if(got.ok) equal(got.value, {domain:'TASK',...expected},'boundary '+a+' exact');
}

// Validation order and exact failure contract.
function expectError(value:unknown, code:string, label:string):void{
  const result=budgetView(value);
  check(!result.ok,label+' fails');
  if(!result.ok){
    check(result.error===code,label+' code');
    check(result.message===MESSAGE,label+' exact message');
    check(Object.isFrozen(result),label+' failure frozen');
  }
}
const S=F1.state;
expectError(undefined,'bad-input','undefined');
expectError(null,'bad-input','null');
expectError([],'bad-input','array');
expectError('x','bad-input','string');
expectError({domain:'task',state:S,request:{steps:1}},'bad-domain','lowercase domain');
expectError({domain:5,state:S,request:{steps:1}},'bad-domain','numeric domain');
expectError({state:S,request:{steps:1}},'bad-domain','missing domain');
expectError({domain:'TASK',request:{steps:1}},'bad-state','missing state');
expectError({domain:'TASK',state:{},request:{steps:1}},'bad-state','empty state');
expectError({domain:'TASK',state:null,request:{steps:1}},'bad-state','null state');
const noSamples={capacity:S.capacity,verificationReserve:S.verificationReserve,used:S.used,observed:S.observed,reservations:S.reservations};
expectError({domain:'TASK',state:noSamples,request:{steps:1}},'bad-state','missing samples');
expectError({domain:'TASK',state:S},'bad-request','missing request');
expectError({domain:'TASK',state:S,request:[]},'bad-request','array request');
expectError({domain:'TASK',state:S,request:null},'bad-request','null request');
expectError({domain:'TASK',state:S,request:{nope:1}},'unknown-resource','unknown resource');
expectError({domain:'TASK',state:S,request:{steps:1,ramMb:1}},'unknown-resource','other domain name');
expectError({domain:'TASK',state:S,request:{constructor:1}},'unknown-resource','constructor name');
expectError({domain:'TASK',state:S,request:JSON.parse('{"__proto__":1}')},'unknown-resource','own proto name');
expectError({domain:'TASK',state:S,request:{steps:-1}},'bad-amount','negative amount');
expectError({domain:'TASK',state:S,request:{steps:NaN}},'bad-amount','NaN amount');
expectError({domain:'TASK',state:S,request:{steps:Infinity}},'bad-amount','infinite amount');
expectError({domain:'TASK',state:S,request:{steps:'5'}},'bad-amount','string amount');
expectError({domain:'TASK',state:S,request:{}},'empty-request','empty request');
expectError({domain:'TASK',state:S,request:{steps:0,tests:0}},'empty-request','all zero');
expectError({domain:'x',state:{},request:null},'bad-domain','ORDER domain first');
expectError({domain:'TASK',state:{},request:null},'bad-state','ORDER state before request');
expectError({domain:'TASK',state:S,request:{nope:1,steps:-1}},'unknown-resource','ORDER names before amounts');
expectError({domain:'TASK',state:S,request:{nope:0}},'unknown-resource','ORDER unknown before empty');

// All closed sets, exact entries/order and deep freezing.
const expectedSets=[
 ['DEVICE',DEVICE_RESOURCES,[['ramMb','megabytes',false],['cpuMs','milliseconds',false],['storageMb','megabytes',false],['batteryPct','percent',false],['networkMb','megabytes',true]]],
 ['TASK',TASK_RESOURCES,[['steps','steps',false],['toolCalls','calls',false],['files','files',false],['outputKb','kilobytes',false],['tests','tests',false]]],
 ['ACCOUNT',ACCOUNT_RESOURCES,[['aiCalls','calls',true],['turns','turns',true],['contextChars','characters',true],['attachments','files',true]]],
 ['BUILDER',BUILDER_RESOURCES,[['builderMemoryMb','megabytes',false],['archiveExpandMb','megabytes',false],['repoFiles','files',false],['testMinutes','minutes',false],['reviewCommands','commands',false]]]
] as const;
for(const [label,actual,expected] of expectedSets){
 equal(actual,expected.map(([name,unit,ownerCost])=>({name,unit,ownerCost})),label+' closed set exact/order');
 check(Object.isFrozen(actual),label+' array frozen');
 check(actual.every(Object.isFrozen),label+' entries frozen');
}
equal(BUDGET_VIEW_TABLE,{sampleMinimum:5,smallRequestPercent:10,marginPercent:{DEVICE:20,TASK:20,ACCOUNT:20,BUILDER:20}},'table exact');
check(Object.isFrozen(BUDGET_VIEW_TABLE),'table frozen');
check(Object.isFrozen(BUDGET_VIEW_TABLE.marginPercent),'nested table frozen');

// Additional ordering and zero-amount checks.
expectView(F1,{tests:3,steps:76},{outcome:'UNKNOWN',reasons:[R('margin','steps'),R('estimate-only','tests')],basis:[B('steps','OBSERVED',5),B('tests','ESTIMATE',2)],ownerCost:false},'resources sorted A-Z and all reasons retained');
expectView(F1,{toolCalls:0,steps:1},{outcome:'AVAILABLE',reasons:[],basis:[B('steps','OBSERVED',5)],ownerCost:false},'zero unknown-figure skipped');
expectView(F5,{networkMb:0,ramMb:1},{outcome:'AVAILABLE',reasons:[],basis:[B('ramMb','OBSERVED',5)],ownerCost:false},'zero owner-cost skipped');

// DIRECTOR EXTRAS (Director, 2026-11-06): edges the returned test did not pin; each was probed against the rules first.
const baseExtra={verificationReserve:{},used:{},observed:[] as string[],reservations:[] as unknown[]};
expectView({domain:'TASK',state:state({capacity:{steps:10},...baseExtra,used:{steps:10},observed:['steps'],samples:{steps:5}})},{steps:1},
 {outcome:'BLOCKED',reasons:[R('over-budget','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false},'extra: remaining exactly 0 is not an overrun');
expectView({domain:'TASK',state:state({capacity:{steps:100},...baseExtra,verificationReserve:{steps:0},samples:{steps:5}})},{steps:100},
 {outcome:'CONSTRAINED',reasons:[R('margin','steps')],basis:[B('steps','OBSERVED',5)],ownerCost:false},'extra: a reserve entry of 0 gives no reserve-only');
expectError({domain:'TASK',state:state({capacity:{steps:100},...baseExtra,samples:{steps:5}}),request:{steps:1,[Symbol('s')]:1}},'unknown-resource','extra: symbol key refused');
expectError({domain:'TASK',state:state({capacity:{steps:100},...baseExtra}),request:{toolCalls:1}},'bad-state','extra: missing samples refused even for a no-figure request');
expectError({domain:'TASK',state:state({capacity:{steps:100},...baseExtra,samples:{},reservations:{}}),request:{toolCalls:1}},'bad-state','extra: reservations not an array refused even for a no-figure request');
expectError({domain:'TASK',state:state({capacity:{steps:100},...baseExtra,samples:{steps:5},reservations:[{id:'__budget_view_probe__',kind:'work',amounts:{steps:1}}]}),request:{steps:1}},'bad-state','extra: unusable state (probe id taken) is bad-state');
expectView({domain:'TASK',state:state({capacity:{steps:100},...baseExtra,used:{tests:3},samples:{steps:5}})},{tests:1},
 {outcome:'UNKNOWN',reasons:[R('no-figure','tests')],basis:[],ownerCost:false},'extra: a used entry without a capacity entry is still no-figure');

console.log('BUDGET_VIEW OK: '+checks+' checks');
