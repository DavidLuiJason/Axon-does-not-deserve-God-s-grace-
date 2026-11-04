type EngineSuccess<T>={readonly ok:true;readonly value:T}; type EngineFailure={readonly ok:false;readonly error:string;readonly message:string}; type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type RecheckItem={id:string;lastCheckedMs:number|null;intervalMs:number;importance:1|2|3;failedChecks:number};
export type DueItem={id:string;reason:'never-checked'|'overdue';overdueMs:number|null;escalate:boolean};
export type NotDueItem={id:string;dueAtMs:number};
export type RecheckPlan={due:readonly DueItem[];deferred:readonly string[];notDue:readonly NotDueItem[]};
const rqFail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
const rqOk=<T>(value:T):EngineResult<T>=>Object.freeze({ok:true,value});
export function planRechecks(items:readonly RecheckItem[],nowMs:number,maxDue?:number):EngineResult<RecheckPlan>{
 if(!Array.isArray(items)) return rqFail('bad-item','items must be an array');
 if(typeof nowMs!=='number'||!Number.isFinite(nowMs)) return rqFail('bad-now','nowMs must be finite');
 if(maxDue!==undefined&&(!Number.isInteger(maxDue)||maxDue<0)) return rqFail('bad-max','maxDue must be an integer greater than or equal to zero');
 const seen=new Set<string>(), due:Array<{entry:DueItem;importance:number;index:number}>=[], notDue:NotDueItem[]=[];
 for(let i=0;i<items.length;i++){
  const x=items[i];
  if(!x||typeof x!=='object'||typeof x.id!=='string'||x.id.trim()===''||
   !(x.lastCheckedMs===null||(typeof x.lastCheckedMs==='number'&&Number.isFinite(x.lastCheckedMs)))||
   typeof x.intervalMs!=='number'||!Number.isFinite(x.intervalMs)||x.intervalMs<=0||
   ![1,2,3].includes(x.importance)||!Number.isInteger(x.failedChecks)||x.failedChecks<0)
   return rqFail('bad-item',`invalid item at index ${i}`);
  if(seen.has(x.id)) return rqFail('duplicate-id',`duplicate id: ${x.id}`);
  seen.add(x.id);
  if(x.lastCheckedMs===null){
   due.push({entry:Object.freeze({id:x.id,reason:'never-checked',overdueMs:null,escalate:x.failedChecks>=2}),importance:x.importance,index:i});
  }else{
   const dueAtMs=x.lastCheckedMs+x.intervalMs;
   if(!Number.isFinite(dueAtMs)) return rqFail('bad-item',`non-finite due time for ${x.id}`);
   if(nowMs>=dueAtMs) due.push({entry:Object.freeze({id:x.id,reason:'overdue',overdueMs:nowMs-dueAtMs,escalate:x.failedChecks>=2}),importance:x.importance,index:i});
   else notDue.push(Object.freeze({id:x.id,dueAtMs}));
  }
 }
 due.sort((a,b)=>b.importance-a.importance||
  (a.entry.reason===b.entry.reason?0:a.entry.reason==='never-checked'?-1:1)||
  ((b.entry.overdueMs??0)-(a.entry.overdueMs??0))||a.index-b.index);
 const limit=maxDue===undefined?due.length:maxDue;
 const selected=due.slice(0,limit).map(x=>x.entry);
 const deferred=due.slice(limit).map(x=>x.entry.id);
 return rqOk(Object.freeze({due:Object.freeze(selected),deferred:Object.freeze(deferred),notDue:Object.freeze(notDue)}));
}
