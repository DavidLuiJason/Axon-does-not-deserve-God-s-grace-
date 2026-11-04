import {planRechecks, type RecheckItem, type RecheckPlan} from '../src/knowledge/recheckQueue';
type EngineFailure={ok:false;error:string;message:string};
declare const console:{log:(s:string)=>void};
function check(condition:boolean,label:string):void{if(!condition)throw new Error('FAIL: '+label);checks++;}
let checks=0;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const items=[
 {id:'A',lastCheckedMs:0,intervalMs:400000,importance:1 as const,failedChecks:0},
 {id:'B',lastCheckedMs:500000,intervalMs:600000,importance:1 as const,failedChecks:0},
 {id:'C',lastCheckedMs:null,intervalMs:100,importance:1 as const,failedChecks:0},
 {id:'D',lastCheckedMs:100000,intervalMs:100000,importance:3 as const,failedChecks:2},
 {id:'E',lastCheckedMs:600000,intervalMs:400000,importance:2 as const,failedChecks:0}
];
const r=planRechecks(items,1000000);
check(r.ok,'hand plan succeeds');
if(r.ok){
 check(same(r.value.due.map(x=>x.id),['D','E','C','A']),'hand due order');
 check(r.value.due[0].overdueMs===800000&&r.value.due[0].escalate,'D overdue and escalation');
 check(r.value.due[1].overdueMs===0,'E exact due boundary');
 check(r.value.due[2].reason==='never-checked'&&r.value.due[2].overdueMs===null,'never checked');
 check(r.value.due[3].overdueMs===600000,'A overdue amount');
 check(same(r.value.notDue,[{id:'B',dueAtMs:1100000}]),'not due in input order');
}
const limited=planRechecks(items,1000000,2);
check(limited.ok,'limited plan succeeds');
if(limited.ok){check(same(limited.value.due.map(x=>x.id),['D','E']),'maxDue selection');check(same(limited.value.deferred,['C','A']),'deferred order');}
check(planRechecks([],0).ok,'empty items allowed');
const ties=planRechecks([
 {id:'first',lastCheckedMs:0,intervalMs:1,importance:2,failedChecks:0},
 {id:'second',lastCheckedMs:0,intervalMs:1,importance:2,failedChecks:0}
],1);
check(ties.ok&&JSON.stringify(ties.value.due.map(x=>x.id))===JSON.stringify(['first','second']),'exact ties preserve input order');
check(planRechecks(items,1000000).ok&&((planRechecks(items,1000000) as {ok:true;value:RecheckPlan}).value.due.length===4),'default maxDue returns all due');
check((planRechecks([{...items[0],lastCheckedMs:Infinity}],0) as EngineFailure).error==='bad-item','non-finite item time');
check(planRechecks(items,1000000,0).ok&&planRechecks(items,1000000,0).ok&&((planRechecks(items,1000000,0) as {ok:true;value:RecheckPlan}).value.due.length===0),'zero maxDue');
check(!planRechecks([{...items[0],id:'A'}, {...items[0],id:'A'}],0).ok&&((planRechecks([{...items[0],id:'A'}, {...items[0],id:'A'}],0) as EngineFailure).error==='duplicate-id'),'duplicate id');
check((planRechecks([{...items[0],id:''}],0) as EngineFailure).error==='bad-item','empty id');
check((planRechecks([{...items[0],intervalMs:0}],0) as EngineFailure).error==='bad-item','nonpositive interval');
check((planRechecks([{...items[0],importance:4 as 1}],0) as EngineFailure).error==='bad-item','invalid importance');
check((planRechecks([{...items[0],failedChecks:-1}],0) as EngineFailure).error==='bad-item','negative failures');
check((planRechecks(items,Number.NaN) as EngineFailure).error==='bad-now','bad now');
check((planRechecks(items,0,-1) as EngineFailure).error==='bad-max','negative max');
check((planRechecks(items,0,1.5) as EngineFailure).error==='bad-max','fractional max');
check(Object.isFrozen(r)&&r.ok&&Object.isFrozen(r.value.due)&&Object.isFrozen(r.value.due[0]),'frozen result');
// DIRECTOR EXTRAS (Batch 4 verification, 2026-11-04): gaps found by hand-made breakages
const x1=planRechecks([{id:'N',lastCheckedMs:null,intervalMs:5,importance:1 as const,failedChecks:2}],0);
check(x1.ok&&x1.value.due[0].escalate===true&&x1.value.due[0].reason==='never-checked'&&x1.value.due[0].overdueMs===null,'never-checked item also escalates at 2 failures');
const x2=planRechecks([{id:'Q',lastCheckedMs:0,intervalMs:50,importance:1 as const,failedChecks:1},{id:'P',lastCheckedMs:0,intervalMs:10,importance:1 as const,failedChecks:1}],100);
check(x2.ok&&x2.value.due.map(d=>d.id).join()==='P,Q'&&x2.value.due.every(d=>d.escalate===false),'same importance: larger overdue first; 1 failure does not escalate');
console.log('RECHECK_QUEUE OK: '+checks+' checks');
