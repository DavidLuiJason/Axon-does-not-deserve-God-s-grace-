type EngineSuccess<T>={readonly ok:true;readonly value:T};
type EngineFailure={readonly ok:false;readonly error:string;readonly message:string};
type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type Stage='CANDIDATE'|'CHECKED'|'ADMITTED';
export type Evidence={readonly sourceRecorded:boolean;readonly independentlyConfirmed:boolean;readonly knownAnswerTest:boolean;readonly ownerApprovedSource:boolean;readonly repeats:number};
export type Item={readonly id:string;readonly stage:Stage;readonly evidence:Evidence};
export type Move={readonly item:Item;readonly to:Stage;readonly by:'axon'|'owner'};
export type MoveResult={readonly id:string;readonly from:Stage;readonly stage:Stage;readonly label:'NOT-VERIFIED'|'CHECKED'|'ADMITTED'};
const fail=(error:string,message:string):EngineResult<never>=>Object.freeze({ok:false,error,message});
const stages:readonly string[]=['CANDIDATE','CHECKED','ADMITTED'];
export function moveItem(move:Move):EngineResult<MoveResult>{
 if(move===null||typeof move!=='object'||move.item===null||typeof move.item!=='object'||(move.by!=='axon'&&move.by!=='owner'))return fail('bad-move','Move, item and actor must be valid.');
 const item=move.item,e=item.evidence;
 if(typeof item.id!=='string'||item.id.length<1||item.id.length>60||/\s/.test(item.id)||!stages.includes(item.stage)||e===null||typeof e!=='object'||typeof e.sourceRecorded!=='boolean'||typeof e.independentlyConfirmed!=='boolean'||typeof e.knownAnswerTest!=='boolean'||typeof e.ownerApprovedSource!=='boolean'||!Number.isInteger(e.repeats)||e.repeats<0||e.repeats>1000000)return fail('bad-item','Item identity, stage or evidence is invalid.');
 if(!stages.includes(move.to))return fail('bad-target','Target stage is invalid.');
 const adjacent=(item.stage==='CANDIDATE'&&move.to==='CHECKED')||(item.stage==='CHECKED'&&move.to==='ADMITTED')||((item.stage==='CHECKED'||item.stage==='ADMITTED')&&move.to==='CANDIDATE');
 if(!adjacent)return fail('not-adjacent','The requested stage move is not adjacent.');
 if((move.to==='ADMITTED'||item.stage==='ADMITTED')&&move.by==='axon')return fail('owner-only','Only the owner may admit or move an admitted item.');
 if(item.stage==='CANDIDATE'&&move.to==='CHECKED'&&!(e.sourceRecorded&&e.independentlyConfirmed&&e.knownAnswerTest))return fail('missing-evidence','Forward movement requires all specified evidence.');
 if(item.stage==='CHECKED'&&move.to==='ADMITTED'&&!e.ownerApprovedSource)return fail('missing-evidence','Admission requires owner approval of the source.');
 const label=move.to==='CANDIDATE'?'NOT-VERIFIED':move.to==='CHECKED'?'CHECKED':'ADMITTED';
 return Object.freeze({ok:true,value:Object.freeze({id:item.id,from:item.stage,stage:move.to,label})});
}
