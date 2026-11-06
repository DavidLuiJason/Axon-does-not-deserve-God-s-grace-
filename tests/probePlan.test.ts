declare const console: { log: (value: string) => void };
import {
  newProbeRecord, recordSample, planProbe, PROBE_TABLE,
  type ProbeRecord, type ProbePlanValue
} from '../src/budget/probePlan';

let checks = 0;
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error('FAIL: ' + label);
  checks++;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), label);
}
const MESSAGE = 'Probe input is invalid.';
type AnyObject = Record<string, unknown>;
type AnyResult = { readonly ok: boolean; readonly error?: string; readonly message?: string; readonly value?: unknown };

function rec(
  domain: ProbeRecord['domain'], resource: string, measured: number, reported: number,
  limitEvents: number, safeHigh: number|null, limitLow: number|null, lastDate: string|null
): ProbeRecord {
  return {
    domain, resource, provider:'local', model:'weak', account:'owner', taskClass:'chat', workloadShape:'short',
    measured, reported, limitEvents, safeHigh, limitLow, lastDate
  };
}
const EMPTY = rec('TASK','steps',0,0,0,null,null,null);
function labels(overrides: AnyObject = {}): AnyObject {
  return {domain:'TASK',resource:'steps',provider:'local',model:'weak',account:'owner',taskClass:'chat',workloadShape:'short',...overrides};
}
function expectError(fn: (value: unknown) => AnyResult, value: unknown, code: string, label: string): void {
  const before = JSON.stringify(value);
  let result: AnyResult;
  try { result = fn(value); } catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(result.ok === false, label + ' fails');
  check(result.error === code, label + ' exact error code');
  check(result.message === MESSAGE, label + ' exact error message');
  equal(result,{ok:false,error:code,message:MESSAGE},label+' whole failure result');
  check(Object.isFrozen(result), label + ' failure frozen');
  check(JSON.stringify(value) === before, label + ' input unchanged');
}
function expectNew(value: unknown, expected: unknown, label: string): ProbeRecord {
  const before = JSON.stringify(value);
  let result: ReturnType<typeof newProbeRecord>;
  try { result = newProbeRecord(value); } catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(result.ok, label + ' succeeds');
  if (!result.ok) throw new Error('FAIL: ' + label + ' unexpected ' + result.error);
  equal(result, {ok:true,value:expected}, label + ' whole success result');
  equal(result.value, expected, label + ' exact value');
  check(result.value !== value, label + ' input object not returned');
  equal(Object.keys(result.value), [
    'domain','resource','provider','model','account','taskClass','workloadShape',
    'measured','reported','limitEvents','safeHigh','limitLow','lastDate'
  ], label + ' exact record key order');
  check(Object.isFrozen(result), label + ' result frozen');
  check(Object.isFrozen(result.value), label + ' record frozen');
  check(JSON.stringify(value) === before, label + ' input unchanged');
  return result.value;
}
function expectSample(value: unknown, expected: unknown, label: string): ProbeRecord {
  const before = JSON.stringify(value);
  const inputRecord = (value as AnyObject)?.record;
  const recordBefore = JSON.stringify(inputRecord);
  let result: ReturnType<typeof recordSample>;
  try { result = recordSample(value); } catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(result.ok, label + ' succeeds');
  if (!result.ok) throw new Error('FAIL: ' + label + ' unexpected ' + result.error);
  equal(result, {ok:true,value:expected}, label + ' whole success result');
  equal(result.value, expected, label + ' exact value');
  equal(Object.keys(result.value), [
    'domain','resource','provider','model','account','taskClass','workloadShape',
    'measured','reported','limitEvents','safeHigh','limitLow','lastDate'
  ], label + ' exact record key order');
  check(Object.isFrozen(result), label + ' result frozen');
  check(Object.isFrozen(result.value), label + ' record frozen');
  check(result.value !== inputRecord, label + ' returns a new record object');
  check(JSON.stringify(inputRecord) === recordBefore, label + ' input record unchanged');
  check(JSON.stringify(value) === before, label + ' request and sample unchanged');
  return result.value;
}
function expectPlan(value: unknown, expected: unknown, label: string): ProbePlanValue {
  const before = JSON.stringify(value);
  const recordBefore = JSON.stringify((value as AnyObject)?.record);
  let result: ReturnType<typeof planProbe>;
  try { result = planProbe(value); } catch { throw new Error('FAIL: ' + label + ' threw'); }
  check(result.ok, label + ' succeeds');
  if (!result.ok) throw new Error('FAIL: ' + label + ' unexpected ' + result.error);
  equal(result, {ok:true,value:expected}, label + ' whole success result');
  equal(result.value, expected, label + ' exact value');
  check(Object.isFrozen(result), label + ' result frozen');
  check(Object.isFrozen(result.value), label + ' plan value frozen');
  check(JSON.stringify((value as AnyObject).record) === recordBefore, label + ' input record unchanged');
  check(JSON.stringify(value) === before, label + ' request unchanged');
  return result.value;
}

function expectBothBadRecord(value: unknown, label: string): void {
  expectError(recordSample, {record:value,sample:{kind:'ran',amount:5,date:'2026-11-02',source:'MEASURED'}}, 'bad-record', label + ' recordSample');
  expectError(planProbe, {record:value,ownerYes:true}, 'bad-record', label + ' planProbe');
}

equal(PROBE_TABLE,{probePercent:10,labelMax:64,amountMax:1000000000000},'PROBE_TABLE exact');
check(Object.isFrozen(PROBE_TABLE),'PROBE_TABLE frozen');
const KEY_ORDER = ['domain','resource','provider','model','account','taskClass','workloadShape','measured','reported','limitEvents','safeHigh','limitLow','lastDate'];
equal(Object.keys(EMPTY),KEY_ORDER,'record helper key order');

// A. Every newProbeRecord hand-worked row.
expectNew(labels(),rec('TASK','steps',0,0,0,null,null,null),'N1');
expectNew(labels({domain:'ACCOUNT',resource:'aiCalls',provider:'p',model:'m',account:'a',taskClass:'t',workloadShape:'w'}),
  {...rec('ACCOUNT','aiCalls',0,0,0,null,null,null),provider:'p',model:'m',account:'a',taskClass:'t',workloadShape:'w'},'N2');
expectNew(labels({provider:'x'.repeat(64),model:'m',account:'a',taskClass:'t',workloadShape:'w'}),
  {...EMPTY,provider:'x'.repeat(64),model:'m',account:'a',taskClass:'t',workloadShape:'w'},'N3');
expectError(newProbeRecord,labels({provider:'x'.repeat(65)}),'bad-label','N4');
expectError(newProbeRecord,labels({provider:''}),'bad-label','N5');
expectError(newProbeRecord,labels({provider:' x'}),'bad-label','N6');
expectError(newProbeRecord,labels({model:'m '}),'bad-label','N7');
expectError(newProbeRecord,labels({account:5}),'bad-label','N8');
const missingWorkload = labels(); delete missingWorkload.workloadShape;
expectError(newProbeRecord,missingWorkload,'bad-label','N9');
expectError(newProbeRecord,labels({resource:'ramMb'}),'bad-resource','N10');
expectError(newProbeRecord,labels({resource:'nope'}),'bad-resource','N11');
expectError(newProbeRecord,labels({resource:'constructor'}),'bad-resource','N12');
const missingResource = labels(); delete missingResource.resource;
expectError(newProbeRecord,missingResource,'bad-resource','N13');
expectError(newProbeRecord,labels({domain:'task'}),'bad-domain','N14');
expectError(newProbeRecord,labels({domain:5}),'bad-domain','N15');
const missingDomain = labels(); delete missingDomain.domain;
expectError(newProbeRecord,missingDomain,'bad-domain','N16');
expectError(newProbeRecord,labels({domain:'nope',resource:'nope',provider:''}),'bad-domain','N17');
expectError(newProbeRecord,labels({resource:'nope',provider:''}),'bad-resource','N18');
const n19 = labels({domain:'DEVICE',resource:'networkMb',extra:1});
const n19Expected = {...rec('DEVICE','networkMb',0,0,0,null,null,null)};
const n19Value = expectNew(n19,n19Expected,'N19 extra ignored');
check(!Object.prototype.hasOwnProperty.call(n19Value,'extra'),'N19 extra absent');

// B. Every recordSample hand-worked row.
const ran = (amount:number,date:string,source:'MEASURED'|'REPORTED'='MEASURED') => ({kind:'ran',amount,date,source});
const limit = (amount:number,date:string,source:'REPORTED'='REPORTED') => ({kind:'limit',amount,date,source});
expectSample({record:EMPTY,sample:ran(20,'2026-11-01')},rec('TASK','steps',1,0,0,20,null,'2026-11-01'),'S1');
expectSample({record:rec('TASK','steps',1,0,0,20,null,'2026-11-01'),sample:ran(10,'2026-10-30')},rec('TASK','steps',2,0,0,20,null,'2026-11-01'),'S2');
expectSample({record:rec('TASK','steps',2,0,0,20,null,'2026-11-01'),sample:ran(50,'2026-11-06','REPORTED')},rec('TASK','steps',2,1,0,50,null,'2026-11-06'),'S3');
expectSample({record:rec('TASK','steps',2,1,0,50,null,'2026-11-06'),sample:limit(80,'2026-11-05')},rec('TASK','steps',2,1,1,50,80,'2026-11-06'),'S4');
expectSample({record:rec('TASK','steps',2,1,1,50,80,'2026-11-06'),sample:limit(60,'2026-11-06')},rec('TASK','steps',2,1,2,50,60,'2026-11-06'),'S5');
expectSample({record:rec('TASK','steps',2,1,1,50,80,'2026-11-06'),sample:limit(90,'2026-11-07')},rec('TASK','steps',2,1,2,50,80,'2026-11-07'),'S6');
expectSample({record:rec('TASK','steps',2,1,1,50,80,'2026-11-06'),sample:ran(30,'2026-11-06')},rec('TASK','steps',3,1,1,50,80,'2026-11-06'),'S7');
expectSample({record:rec('TASK','steps',2,1,2,50,60,'2026-11-06'),sample:limit(90,'2026-11-04')},rec('TASK','steps',2,1,3,50,60,'2026-11-06'),'S8');
expectSample({record:EMPTY,sample:limit(40,'2026-11-02')},rec('TASK','steps',0,0,1,null,40,'2026-11-02'),'S9');
expectSample({record:EMPTY,sample:ran(1e12,'2026-11-02')},rec('TASK','steps',1,0,0,1e12,null,'2026-11-02'),'S10');
expectSample({record:EMPTY,sample:ran(1,'2026-02-31','REPORTED')},rec('TASK','steps',0,1,0,1,null,'2026-02-31'),'S11 calendar boundary accepted');
expectSample({record:EMPTY,sample:ran(1,'2026-11-02')},rec('TASK','steps',1,0,0,1,null,'2026-11-02'),'S12');
expectError(recordSample,{record:EMPTY,sample:{kind:'limit',amount:40,date:'2026-11-02',source:'MEASURED'}},'bad-sample','S20');
expectError(recordSample,{record:EMPTY,sample:ran(0,'2026-11-02')},'bad-sample','S21');
expectError(recordSample,{record:EMPTY,sample:ran(-1,'2026-11-02')},'bad-sample','S22');
expectError(recordSample,{record:EMPTY,sample:ran(1.5,'2026-11-02')},'bad-sample','S23');
expectError(recordSample,{record:EMPTY,sample:ran('5' as unknown as number,'2026-11-02')},'bad-sample','S24');
expectError(recordSample,{record:EMPTY,sample:ran(1e12+1,'2026-11-02')},'bad-sample','S25');
expectError(recordSample,{record:EMPTY,sample:{kind:'RAN',amount:5,date:'2026-11-02',source:'MEASURED'}},'bad-sample','S30');
expectError(recordSample,{record:EMPTY,sample:{kind:'ran',amount:5,date:'2026-11-02',source:'measured'}},'bad-sample','S31');
expectError(recordSample,{record:EMPTY,sample:{kind:'ran',date:'2026-11-02',source:'MEASURED'}},'bad-sample','S32');
const s33 = expectSample({record:EMPTY,sample:{amount:5,date:'2026-11-02',source:'MEASURED',kind:'ran',extra:9}},
  rec('TASK','steps',1,0,0,5,null,'2026-11-02'),'S33 extra sample key ignored');
check(!Object.prototype.hasOwnProperty.call(s33,'extra'),'S33 extra absent');
const badDates = ['2026-13-01','2026-00-10','2026-11-32','2026-11-00','2026/11/01','26-11-01','2026-1-01','','2026-11-011','2026-1a-01'];
for (const date of badDates) expectError(recordSample,{record:EMPTY,sample:{kind:'ran',amount:5,source:'MEASURED',date}},'bad-sample','S3d '+date);

// C. All 16 malformed records through BOTH recordSample and planProbe.
const badRecords: Array<[string,unknown]> = [
 ['B1',rec('TASK','steps',-1,0,0,null,null,null)],
 ['B2',rec('TASK','steps',1,0,0,null,null,null)],
 ['B3',rec('TASK','steps',1,0,0,10,null,null)],
 ['B4',rec('TASK','steps',1,0,0,10,5,'2026-11-01')],
 ['B5',rec('TASK','steps',0,0,1,null,null,null)],
 ['B6',rec('TASK','steps',0,0,1,null,5,null)],
 ['B7',rec('TASK','steps',0,0,1,3,5,'2026-11-01')],
 ['B8',rec('TASK','steps',1,0,0,0,null,'2026-11-01')],
 ['B9',rec('task' as ProbeRecord['domain'],'steps',0,0,0,null,null,null)],
 ['B10',rec('TASK','ramMb',0,0,0,null,null,null)],
 ['B11',{...EMPTY,provider:''}],
 ['B12',rec('TASK','steps',1.5,0,0,5,null,'2026-11-01')],
 ['B13',rec('TASK','steps',1,0,0,5,null,'2026-11-32')],
 ['B14',rec('TASK','steps',1,0,0,5,null,null)],
 ['B15',rec('TASK','steps',0,0,0,5,null,null)],
 ['B16',rec('TASK','steps',0,0,0,null,null,'2026-11-01')]
];
for (const [id,bad] of badRecords) expectBothBadRecord(bad,id);

// D. Every P row with both ownerYes values.
const planRows: Array<[string,ProbeRecord,unknown,unknown]> = [
 ['P1',rec('TASK','steps',0,0,0,null,null,null),{outcome:'NO-RANGE',maxAmount:null,measured:0,reported:0,ownerCost:false},{outcome:'NO-RANGE',maxAmount:null,measured:0,reported:0,ownerCost:false}],
 ['P2',rec('TASK','steps',2,0,0,100,null,'2026-11-01'),{outcome:'PROBE',maxAmount:10,measured:2,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:10,measured:2,reported:0,ownerCost:false}],
 ['P3',rec('TASK','steps',2,0,0,99,null,'2026-11-01'),{outcome:'PROBE',maxAmount:9,measured:2,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:9,measured:2,reported:0,ownerCost:false}],
 ['P4',rec('TASK','steps',2,0,0,10,null,'2026-11-01'),{outcome:'PROBE',maxAmount:1,measured:2,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:1,measured:2,reported:0,ownerCost:false}],
 ['P5',rec('TASK','steps',2,0,0,9,null,'2026-11-01'),{outcome:'NO-RANGE',maxAmount:null,measured:2,reported:0,ownerCost:false},{outcome:'NO-RANGE',maxAmount:null,measured:2,reported:0,ownerCost:false}],
 ['P6',rec('TASK','steps',5,0,0,100,null,'2026-11-01'),{outcome:'NOT-NEEDED',maxAmount:null,measured:5,reported:0,ownerCost:false},{outcome:'NOT-NEEDED',maxAmount:null,measured:5,reported:0,ownerCost:false}],
 ['P7',rec('TASK','steps',4,3,0,100,null,'2026-11-01'),{outcome:'PROBE',maxAmount:10,measured:4,reported:3,ownerCost:false},{outcome:'PROBE',maxAmount:10,measured:4,reported:3,ownerCost:false}],
 ['P8',rec('TASK','steps',0,2,0,100,null,'2026-11-01'),{outcome:'PROBE',maxAmount:10,measured:0,reported:2,ownerCost:false},{outcome:'PROBE',maxAmount:10,measured:0,reported:2,ownerCost:false}],
 ['P9',rec('ACCOUNT','aiCalls',0,2,0,100,null,'2026-11-01'),{outcome:'NEEDS-OWNER-YES',maxAmount:null,measured:0,reported:2,ownerCost:true},{outcome:'PROBE',maxAmount:10,measured:0,reported:2,ownerCost:true}],
 ['P10',rec('DEVICE','ramMb',1,0,0,100,null,'2026-11-01'),{outcome:'PROBE',maxAmount:10,measured:1,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:10,measured:1,reported:0,ownerCost:false}],
 ['P11',rec('DEVICE','networkMb',1,0,0,100,null,'2026-11-01'),{outcome:'NEEDS-OWNER-YES',maxAmount:null,measured:1,reported:0,ownerCost:true},{outcome:'PROBE',maxAmount:10,measured:1,reported:0,ownerCost:true}],
 ['P12',rec('ACCOUNT','aiCalls',5,0,0,100,null,'2026-11-01'),{outcome:'NOT-NEEDED',maxAmount:null,measured:5,reported:0,ownerCost:true},{outcome:'NOT-NEEDED',maxAmount:null,measured:5,reported:0,ownerCost:true}],
 ['P13',rec('TASK','steps',2,0,1,50,50,'2026-11-01'),{outcome:'CONFLICT',maxAmount:null,measured:2,reported:0,ownerCost:false},{outcome:'CONFLICT',maxAmount:null,measured:2,reported:0,ownerCost:false}],
 ['P14',rec('TASK','steps',2,0,1,50,51,'2026-11-01'),{outcome:'PROBE',maxAmount:5,measured:2,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:5,measured:2,reported:0,ownerCost:false}],
 ['P15',rec('TASK','steps',2,0,1,50,40,'2026-11-01'),{outcome:'CONFLICT',maxAmount:null,measured:2,reported:0,ownerCost:false},{outcome:'CONFLICT',maxAmount:null,measured:2,reported:0,ownerCost:false}],
 ['P16',rec('TASK','steps',5,0,1,50,40,'2026-11-01'),{outcome:'CONFLICT',maxAmount:null,measured:5,reported:0,ownerCost:false},{outcome:'CONFLICT',maxAmount:null,measured:5,reported:0,ownerCost:false}],
 ['P17',rec('ACCOUNT','turns',1,0,2,50,40,'2026-11-01'),{outcome:'CONFLICT',maxAmount:null,measured:1,reported:0,ownerCost:true},{outcome:'CONFLICT',maxAmount:null,measured:1,reported:0,ownerCost:true}],
 ['P18',rec('TASK','steps',0,0,1,null,30,'2026-11-01'),{outcome:'NO-RANGE',maxAmount:null,measured:0,reported:0,ownerCost:false},{outcome:'NO-RANGE',maxAmount:null,measured:0,reported:0,ownerCost:false}],
 ['P19',rec('BUILDER','repoFiles',0,1,0,4000,null,'2026-11-01'),{outcome:'PROBE',maxAmount:400,measured:0,reported:1,ownerCost:false},{outcome:'PROBE',maxAmount:400,measured:0,reported:1,ownerCost:false}],
 ['P20',rec('BUILDER','testMinutes',3,0,0,60,null,'2026-11-01'),{outcome:'PROBE',maxAmount:6,measured:3,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:6,measured:3,reported:0,ownerCost:false}],
 ['P21',rec('TASK','steps',2,0,0,1e12,null,'2026-11-01'),{outcome:'PROBE',maxAmount:100000000000,measured:2,reported:0,ownerCost:false},{outcome:'PROBE',maxAmount:100000000000,measured:2,reported:0,ownerCost:false}]
];
for (const [id,record,falseExpected,trueExpected] of planRows) {
  expectPlan({record,ownerYes:false},falseExpected,id+' ownerYes false');
  expectPlan({record,ownerYes:true},trueExpected,id+' ownerYes true');
}

// E. Every planProbe bad-input row.
expectError(planProbe,{record:EMPTY},'bad-owner-yes','X1');
expectError(planProbe,{record:EMPTY,ownerYes:'true'},'bad-owner-yes','X2');
expectError(planProbe,{record:EMPTY,ownerYes:1},'bad-owner-yes','X3');
expectError(planProbe,{record:EMPTY,ownerYes:null},'bad-owner-yes','X4');
expectError(planProbe,{ownerYes:true},'bad-record','X5');
expectError(planProbe,{record:null,ownerYes:true},'bad-record','X6');
expectError(planProbe,{record:[],ownerYes:true},'bad-record','X7');
expectError(planProbe,{record:rec('TASK','steps',-1,0,0,null,null,null),ownerYes:'x'},'bad-record','X8 record before ownerYes');

// F. Special inputs for all three functions and special values.
for (const bad of [undefined,null,[],'x',5]) {
  expectError(newProbeRecord,bad,'bad-input','newProbeRecord bad input '+String(bad));
  expectError(recordSample,bad,'bad-input','recordSample bad input '+String(bad));
  expectError(planProbe,bad,'bad-input','planProbe bad input '+String(bad));
}
for (const domain of ['constructor','__proto__','toString']) {
  expectError(newProbeRecord,labels({domain}),'bad-domain','prototype domain '+domain);
}
for (const resource of ['constructor','__proto__','toString']) {
  expectError(newProbeRecord,labels({resource}),'bad-resource','prototype resource '+resource);
}
for (const amount of [NaN,Infinity,-Infinity,true]) {
  expectError(recordSample,{record:EMPTY,sample:{kind:'ran',amount,date:'2026-11-02',source:'MEASURED'}},'bad-sample','special amount '+String(amount));
}
const nanRecord = {...rec('TASK','steps',1,0,0,5,null,'2026-11-01'),measured:NaN};
expectBothBadRecord(nanRecord,'NaN measured');
const infiniteHigh = {...rec('TASK','steps',1,0,0,5,null,'2026-11-01'),safeHigh:Infinity};
expectBothBadRecord(infiniteHigh,'infinite safeHigh');
for (const ownerYes of [undefined,null,'true',1]) {
  expectError(planProbe,{record:EMPTY,ownerYes},'bad-owner-yes','ownerYes special '+String(ownerYes));
}
// Explicit first-failure ordering.
expectError(newProbeRecord,{domain:'bad',resource:'bad',provider:''},'bad-domain','ORDER new domain before resource and label');
expectError(newProbeRecord,{domain:'TASK',resource:'bad',provider:''},'bad-resource','ORDER resource before label');
expectError(recordSample,{record:badRecords[0][1],sample:null},'bad-record','ORDER record before sample');
expectError(planProbe,{record:badRecords[0][1],ownerYes:'bad'},'bad-record','ORDER record before ownerYes');
const sampleInput = {kind:'ran',amount:5,date:'2026-11-02',source:'MEASURED',extra:1};
const extraRecord = {...EMPTY,extra:2};
const extraSampleResult = expectSample({record:extraRecord,sample:sampleInput},rec('TASK','steps',1,0,0,5,null,'2026-11-02'),'extra input record key ignored');
check(!Object.prototype.hasOwnProperty.call(extraSampleResult,'extra'),'extra input record key not copied');

// G. Four integration chains built using the engine's own record and sample functions.
function chainStart(domain:ProbeRecord['domain'],resource:string): ProbeRecord {
  const made = newProbeRecord({domain,resource,provider:'local',model:'weak',account:'owner',taskClass:'chat',workloadShape:'short'});
  check(made.ok,'integration new record succeeds');
  if (!made.ok) throw new Error('FAIL: integration new record');
  return made.value;
}
function chainSample(record:ProbeRecord, amount:number, date:string, source:'MEASURED'|'REPORTED', kind:'ran'|'limit'='ran'): ProbeRecord {
  const next = recordSample({record,sample:{kind,amount,date,source}});
  check(next.ok,'integration sample succeeds');
  if (!next.ok) throw new Error('FAIL: integration sample');
  return next.value;
}
let chain = chainStart('TASK','steps');
for (const [amount,date] of [[20,'2026-11-01'],[40,'2026-11-02'],[30,'2026-11-03'],[100,'2026-11-04']] as Array<[number,string]>) chain = chainSample(chain,amount,date,'MEASURED');
equal(chain,rec('TASK','steps',4,0,0,100,null,'2026-11-04'),'G1 record');
expectPlan({record:chain,ownerYes:false},{outcome:'PROBE',maxAmount:10,measured:4,reported:0,ownerCost:false},'G1 plan');
chain = chainSample(chain,60,'2026-11-05','MEASURED');
equal(chain,rec('TASK','steps',5,0,0,100,null,'2026-11-05'),'G2 record');
expectPlan({record:chain,ownerYes:false},{outcome:'NOT-NEEDED',maxAmount:null,measured:5,reported:0,ownerCost:false},'G2 plan');

let account = chainStart('ACCOUNT','aiCalls');
for (const [amount,date] of [[50,'2026-11-01'],[60,'2026-11-02'],[70,'2026-11-03'],[80,'2026-11-04'],[90,'2026-11-05']] as Array<[number,string]>) account = chainSample(account,amount,date,'REPORTED');
equal(account,rec('ACCOUNT','aiCalls',0,5,0,90,null,'2026-11-05'),'G3 record');
expectPlan({record:account,ownerYes:false},{outcome:'NEEDS-OWNER-YES',maxAmount:null,measured:0,reported:5,ownerCost:true},'G3 owner no');
expectPlan({record:account,ownerYes:true},{outcome:'PROBE',maxAmount:9,measured:0,reported:5,ownerCost:true},'G3 owner yes');
account = chainSample(account,85,'2026-11-06','REPORTED','limit');
equal(account,rec('ACCOUNT','aiCalls',0,5,1,90,85,'2026-11-06'),'G4 record');
expectPlan({record:account,ownerYes:true},{outcome:'CONFLICT',maxAmount:null,measured:0,reported:5,ownerCost:true},'G4 plan');

// H. Sweep h=1..2500 and enforce the exact floor/fraction property.
for (let h=1; h<=2500; h++) {
  const record = rec('TASK','steps',2,0,0,h,null,'2026-11-01');
  const result = planProbe({record,ownerYes:false});
  check(result.ok,'sweep '+h+' succeeds');
  if (!result.ok) throw new Error('FAIL: sweep '+h+' unexpected error');
  if (h <= 9) {
    equal(result.value,{outcome:'NO-RANGE',maxAmount:null,measured:2,reported:0,ownerCost:false},'sweep '+h+' no range');
  } else {
    const expected = Math.floor(h/10);
    equal(result.value,{outcome:'PROBE',maxAmount:expected,measured:2,reported:0,ownerCost:false},'sweep '+h+' exact floor');
    check(result.value.maxAmount !== null && result.value.maxAmount * 100 <= h * 10,'sweep '+h+' probe does not exceed 10 percent');
    check(result.value.maxAmount !== null && (result.value.maxAmount + 1) * 100 > h * 10,'sweep '+h+' is largest allowed whole amount');
  }
}

// I. Resource ownerCost facts, including reported-only records never becoming NOT-NEEDED.
const ownerCostFacts: Array<[ProbeRecord['domain'],string,boolean]> = [
 ['DEVICE','ramMb',false],['DEVICE','networkMb',true],
 ['TASK','steps',false],['TASK','toolCalls',false],['TASK','files',false],['TASK','outputKb',false],['TASK','tests',false],
 ['ACCOUNT','aiCalls',true],['ACCOUNT','turns',true],['ACCOUNT','contextChars',true],['ACCOUNT','attachments',true],
 ['BUILDER','builderMemoryMb',false],['BUILDER','archiveExpandMb',false],['BUILDER','repoFiles',false],['BUILDER','testMinutes',false],['BUILDER','reviewCommands',false]
];
for (const [domain,resource,ownerCost] of ownerCostFacts) {
  const record = rec(domain,resource,0,5,0,100,null,'2026-11-01');
  const result = expectPlan({record,ownerYes:true},{outcome:'PROBE',maxAmount:10,measured:0,reported:5,ownerCost},'ownerCost '+domain+'.'+resource);
  check(result.outcome !== 'NOT-NEEDED','reported-only never NOT-NEEDED '+domain+'.'+resource);
}
for (const [domain,resource] of [['DEVICE','toString'],['TASK','constructor'],['ACCOUNT','__proto__'],['BUILDER','hasOwnProperty']] as Array<[ProbeRecord['domain'],string]>) {
  expectBothBadRecord(rec(domain,resource,0,0,0,null,null,null),'closed set '+domain+'.'+resource);
}

// Frozen result/value/record checks and no copied extra keys.
const frozenRecordResult = newProbeRecord(labels({extra:'ignored'}));
check(frozenRecordResult.ok && Object.isFrozen(frozenRecordResult) && Object.isFrozen(frozenRecordResult.value),'new result/value frozen');
const frozenPlanResult = planProbe({record:rec('TASK','steps',1,0,0,100,null,'2026-11-01'),ownerYes:false});
check(frozenPlanResult.ok && Object.isFrozen(frozenPlanResult) && Object.isFrozen(frozenPlanResult.value),'plan result/value frozen');

// DIRECTOR EXTRAS (Director, 2026-11-06): edges the returned test did not pin; each was probed against the rules first.
function planOf(record: ProbeRecord, ownerYes: boolean): AnyResult { return planProbe({record,ownerYes}) as AnyResult; }
function planValue(outcome: string, maxAmount: number|null, measured: number, reported: number, ownerCost: boolean) { return {ok:true,value:{outcome,maxAmount,measured,reported,ownerCost}}; }
const accountNoRange = rec('ACCOUNT','aiCalls',0,0,1,null,30,'2026-11-01');
equal(planOf(accountNoRange,false),planValue('NEEDS-OWNER-YES',null,0,0,true),'extra: owner yes is asked before NO-RANGE (no safeHigh)');
equal(planOf(accountNoRange,true),planValue('NO-RANGE',null,0,0,true),'extra: with the yes, no safeHigh is NO-RANGE');
const accountTiny = rec('ACCOUNT','aiCalls',0,2,0,9,null,'2026-11-01');
equal(planOf(accountTiny,false),planValue('NEEDS-OWNER-YES',null,0,2,true),'extra: owner yes is asked before NO-RANGE (maxAmount 0)');
equal(planOf(accountTiny,true),planValue('NO-RANGE',null,0,2,true),'extra: with the yes, maxAmount 0 is NO-RANGE');
const sampleOk = {kind:'ran',amount:5,date:'2026-11-02',source:'MEASURED'};
for (const [label,bad] of [
  ['measured -1 with reported 1 (sum 0)',rec('TASK','steps',-1,1,0,null,null,null)],
  ['reported -1 with measured 1 (sum 0)',rec('TASK','steps',1,-1,0,null,null,null)],
  ['limitEvents -1 with a limitLow',rec('TASK','steps',0,0,-1,null,5,'2026-11-01')]
] as Array<[string,ProbeRecord]>) {
  expectError(planProbe as (value: unknown) => AnyResult,{record:bad,ownerYes:true},'bad-record','extra: negative count '+label+' in planProbe');
  expectError(recordSample as (value: unknown) => AnyResult,{record:bad,sample:sampleOk},'bad-record','extra: negative count '+label+' in recordSample');
}
for (const date of ['202:-11-01','202/-11-01','2026-11-0:','2026-1/-01','2026-:1-01']) {
  expectError(recordSample as (value: unknown) => AnyResult,{record:EMPTY,sample:{kind:'ran',amount:5,date,source:'MEASURED'}},'bad-sample','extra: date '+date+' refused as a sample date');
  expectError(planProbe as (value: unknown) => AnyResult,{record:rec('TASK','steps',1,0,0,5,null,date),ownerYes:true},'bad-record','extra: date '+date+' refused as a lastDate');
}

console.log('PROBE_PLAN OK: ' + checks + ' checks');
