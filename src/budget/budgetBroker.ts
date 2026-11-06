type EngineSuccess<T>={readonly ok:true;readonly value:T}; type EngineFailure={readonly ok:false;readonly error:string;readonly message:string}; type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type Vec=Readonly<Record<string,number>>;
export type Reservation={id:string;kind:'work'|'verification';amounts:Readonly<Record<string,number>>};
export type BudgetState={readonly capacity:Readonly<Record<string,number>>;readonly verificationReserve:Readonly<Record<string,number>>;readonly used:Readonly<Record<string,number>>;readonly observed:readonly string[];readonly samples:Readonly<Record<string,number>>;readonly reservations:readonly Reservation[]};
export type RemainingItem={resource:string;remaining:number;basis:'ESTIMATE'|'OBSERVED'};
export type Settlement={state:BudgetState;overruns:readonly string[]};
const bbFail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
const bbOk=<T>(value:T):EngineResult<T>=>Object.freeze({ok:true,value});
function freezeState(capacity:Record<string,number>,verificationReserve:Record<string,number>,used:Record<string,number>,observed:string[],reservations:Reservation[],samples:Record<string,number>={}):BudgetState{
 return Object.freeze({capacity:Object.freeze({...capacity}),verificationReserve:Object.freeze({...verificationReserve}),used:Object.freeze({...used}),observed:Object.freeze([...observed]),samples:Object.freeze({...samples}),reservations:Object.freeze(reservations.map(r=>Object.freeze({id:r.id,kind:r.kind,amounts:Object.freeze({...r.amounts})})))});
}
function validVector(v:unknown):v is Vec{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function checkAmounts(v:Vec,capacity:Readonly<Record<string,number>>):EngineFailure|null{
 for(const k of Object.keys(v)){
  if(!Object.prototype.hasOwnProperty.call(capacity,k))return {ok:false,error:'unknown-resource',message:`unknown resource: ${k}`};
  if(typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<0)return {ok:false,error:'invalid-amount',message:`invalid amount for ${k}`};
 }
 return null;
}
export function newBudget(capacity:Vec,verificationReserve?:Vec):EngineResult<BudgetState>{
 if(!validVector(capacity)||Object.keys(capacity).length===0)return bbFail('bad-capacity','capacity must be a non-empty resource vector');
 const cap:Record<string,number>={};
 for(const k of Object.keys(capacity)){if(k.trim()===''||typeof capacity[k]!=='number'||!Number.isFinite(capacity[k])||capacity[k]<0)return bbFail('bad-capacity',`invalid capacity for ${k}`);cap[k]=capacity[k];}
 const reserve:Record<string,number>={};
 if(verificationReserve!==undefined){
  if(!validVector(verificationReserve))return bbFail('bad-capacity','verification reserve must be a vector');
  const bad=checkAmounts(verificationReserve,cap);if(bad)return bbFail('bad-capacity',bad.message);
  for(const k of Object.keys(verificationReserve)){if(verificationReserve[k]>cap[k])return bbFail('bad-capacity',`verification reserve exceeds capacity for ${k}`);reserve[k]=verificationReserve[k];}
 }
 return bbOk(freezeState(cap,reserve,{},[],[]));
}
export function reserve(s:BudgetState,id:string,v:Vec,kind:'work'|'verification'):EngineResult<BudgetState>{
 if(!s||!s.capacity||!Array.isArray(s.reservations)||typeof id!=='string'||id.trim()===''||!validVector(v)||!['work','verification'].includes(kind))return bbFail('bad-capacity','invalid budget state, id, vector or reservation kind');
 const bad=checkAmounts(v,s.capacity);if(bad)return bad;
 if(s.reservations.some(r=>r.id===id))return bbFail('duplicate-reservation',`reservation already exists: ${id}`);
 const totals:Record<string,number>={};
 for(const k of Object.keys(s.capacity)){
  let reserved=0;for(const r of s.reservations)reserved+=r.amounts[k]??0;
  totals[k]=(s.used[k]??0)+reserved;
 }
 for(const k of Object.keys(v).sort()){
  const ceiling=kind==='work'?s.capacity[k]-(s.verificationReserve[k]??0):s.capacity[k];
  const short=totals[k]+v[k]-ceiling;
  if(short>0)return bbFail('over-budget',`${k} is over budget by ${short}`);
 }
 const reservations=[...s.reservations,{id,kind,amounts:Object.freeze({...v})}];
 return bbOk(freezeState({...s.capacity},{...s.verificationReserve},{...s.used},[...s.observed],reservations,{...(s.samples??{})}));
}
export function settle(s:BudgetState,id:string,actual:Vec):EngineResult<Settlement>{
 if(!s||!Array.isArray(s.reservations)||!validVector(actual))return bbFail('bad-capacity','invalid budget state or actual vector');
 const bad=checkAmounts(actual,s.capacity);if(bad)return bad;
 const index=s.reservations.findIndex(r=>r.id===id);if(index<0)return bbFail('no-reservation',`no reservation: ${id}`);
 const used:Record<string,number>={...s.used};
 for(const k of Object.keys(actual))used[k]=(used[k]??0)+actual[k];
 const observed=new Set(s.observed);for(const k of Object.keys(actual))observed.add(k);
 const samples:Record<string,number>={...(s.samples??{})};for(const k of Object.keys(actual))samples[k]=(samples[k]??0)+1;
 const reservations=s.reservations.filter((_,i)=>i!==index);
 const overruns=Object.keys(s.capacity).filter(k=>(used[k]??0)>s.capacity[k]).sort();
 const state=freezeState({...s.capacity},{...s.verificationReserve},used,[...observed].sort(),[...reservations],samples);
 return bbOk(Object.freeze({state,overruns:Object.freeze(overruns)}));
}
export function release(s:BudgetState,id:string):EngineResult<BudgetState>{
 if(!s||!Array.isArray(s.reservations))return bbFail('bad-capacity','invalid budget state');
 const index=s.reservations.findIndex(r=>r.id===id);if(index<0)return bbFail('no-reservation',`no reservation: ${id}`);
 return bbOk(freezeState({...s.capacity},{...s.verificationReserve},{...s.used},[...s.observed],s.reservations.filter((_,i)=>i!==index),{...(s.samples??{})}));
}
export function remaining(s:BudgetState):readonly RemainingItem[]{
 const rows:RemainingItem[]=[];
 for(const k of Object.keys(s.capacity).sort()){
  let reserved=0;for(const r of s.reservations)reserved+=r.amounts[k]??0;
  rows.push(Object.freeze({resource:k,remaining:s.capacity[k]-(s.used[k]??0)-reserved,basis:s.observed.includes(k)?'OBSERVED':'ESTIMATE'}));
 }
 return Object.freeze(rows);
}
