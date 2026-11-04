import {newBudget, reserve, settle, release, remaining, type BudgetState} from '../src/budget/budgetBroker';
type EngineFailure={ok:false;error:string;message:string};
declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
const created=newBudget({steps:10,tokens:1000},{steps:2});
check(created.ok,'create budget');
let s=created.ok?created.value:null;
if(s){
 const t1=reserve(s,'t1',{steps:5,tokens:400},'work');
 check(t1.ok,'reserve t1');
 if(t1.ok){
  s=t1.value;
  check(JSON.stringify(remaining(s))===JSON.stringify([{resource:'steps',remaining:5,basis:'ESTIMATE'},{resource:'tokens',remaining:600,basis:'ESTIMATE'}]),'hand remaining after t1');
  check(remaining(s)[0].remaining===5,'verification reserve is not deducted from remaining');
 }
 const t2=reserve(s,'t2',{steps:4},'work');
 check(!t2.ok&&(t2 as EngineFailure).error==='over-budget'&&(t2 as EngineFailure).message.includes('steps')&&(t2 as EngineFailure).message.includes('1'),'hand t2 short by one');
 const v1=reserve(s,'v1',{steps:4},'verification');
 check(v1.ok,'verification may use reserve');
 if(v1.ok){
  const st=settle(v1.value,'t1',{steps:3,tokens:100});
  check(st.ok&&st.value.overruns.length===0,'settle t1 no overrun');
  if(st.ok){
   s=st.value.state;
   check(JSON.stringify(remaining(s))===JSON.stringify([{resource:'steps',remaining:3,basis:'OBSERVED'},{resource:'tokens',remaining:900,basis:'OBSERVED'}]),'hand remaining after settlement');
  }
  const sv=settle(s,'v1',{steps:9});
  check(sv.ok&&JSON.stringify(sv.value.overruns)===JSON.stringify(['steps']),'settle verification records overrun');
  if(sv.ok)check(remaining(sv.value.state)[0].remaining===-2,'hand negative remaining');
 }
}
check((newBudget({steps:-1}) as EngineFailure).error==='bad-capacity','negative capacity');
check((newBudget({steps:2},{steps:3}) as EngineFailure).error==='bad-capacity','reserve above capacity');
check((newBudget({steps:2,tokens:4}) as {ok:true;value:BudgetState}).value.capacity.steps===2,'multiple capacities');
const b=newBudget({a:5});check(b.ok,'simple state');
if(b.ok){
 check((reserve(b.value,'x',{z:1},'work') as EngineFailure).error==='unknown-resource','unknown resource');
 check((reserve(b.value,'x',{a:-1},'work') as EngineFailure).error==='invalid-amount','negative amount');
 check((reserve(b.value,'x',{a:Infinity},'work') as EngineFailure).error==='invalid-amount','nonfinite amount');
 check((reserve(b.value,'x',{a:6},'work') as EngineFailure).error==='over-budget','capacity boundary rejects excess');
 const one=reserve(b.value,'x',{a:2},'work');
 check(one.ok,'first reservation');
 if(one.ok){
  check((reserve(one.value,'x',{a:1},'work') as EngineFailure).error==='duplicate-reservation','duplicate reservation');
  check((release(one.value,'x') as {ok:true;value:BudgetState}).value.reservations.length===0,'release frees reservation');
  check((release(one.value,'missing') as EngineFailure).error==='no-reservation','release missing');
  const actual=settle(one.value,'x',{a:1});
  check(actual.ok&&remaining(actual.value.state)[0].remaining===4,'settle uses actual not estimate');
  const omitted=settle(one.value,'x',{});
  check(omitted.ok&&remaining(omitted.value.state)[0].remaining===5&&remaining(omitted.value.state)[0].basis==='ESTIMATE','missing actual resource counts zero and stays estimate');
  check((settle(one.value,'missing',{}) as EngineFailure).error==='no-reservation','settle missing');
  check((settle(one.value,'x',{z:1}) as EngineFailure).error==='unknown-resource','settle unknown resource');
  check((settle(one.value,'x',{a:-1}) as EngineFailure).error==='invalid-amount','settle invalid amount');
  check(Object.isFrozen(one.value)&&Object.isFrozen(one.value.reservations)&&Object.isFrozen(one.value.reservations[0]),'state frozen');
  check(b.value.reservations.length===0&&remaining(b.value)[0].remaining===5,'old state unchanged');
 }
}
// DIRECTOR EXTRAS (Batch 4 verification, 2026-11-04): gaps found by hand-made breakages
const xerr=(r:unknown)=>(r as {error?:string;message?:string});
const xa=newBudget({a:10});
check(xa.ok&&reserve(xa.value,'t',{a:10},'work').ok,'an exact fit is allowed');
const xc=newBudget({b:1,a:1});
const xcr=xc.ok?reserve(xc.value,'t',{b:5,a:5},'work'):null;
check(!!xcr&&!xcr.ok&&xcr.message.startsWith('a ')&&xcr.message.includes('4'),'over-budget names the FIRST short resource alphabetically, with the amount');
const xd=newBudget({z:1,a:1});
if(xd.ok){const r1=reserve(xd.value,'t',{z:1,a:1},'work');if(r1.ok){const st=settle(r1.value,'t',{z:3,a:3});check(st.ok&&st.value.overruns.join()==='a,z','overruns are alphabetical');}else check(false,'xd reserve');}else check(false,'xd');
check(xd.ok&&remaining(xd.value).map(r=>r.resource).join()==='a,z','remaining is sorted by resource name');
const xe=newBudget({a:5});
if(xe.ok){const r1=reserve(xe.value,'t',{a:5},'work');if(r1.ok){const st=settle(r1.value,'t',{a:5});check(st.ok&&st.value.overruns.length===0,'used equal to capacity is not an overrun');}else check(false,'xe reserve');}else check(false,'xe');
const xf=newBudget({a:10});
if(xf.ok){const r1=reserve(xf.value,'t',{a:6},'work');if(r1.ok){const st=settle(r1.value,'t',{a:6});if(st.ok){const r2=reserve(st.value.state,'u',{a:5},'work');check(!r2.ok&&xerr(r2).error==='over-budget'&&(xerr(r2).message??'').includes('1'),'settled usage counts against later reservations');}else check(false,'xf settle');}else check(false,'xf reserve');}else check(false,'xf');
check(xerr(newBudget({})).error==='bad-capacity','empty capacity is rejected');
console.log('BUDGET_BROKER OK: '+checks+' checks');
