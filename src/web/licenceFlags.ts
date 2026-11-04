type EngineSuccess<T>={readonly ok:true;readonly value:T}; type EngineFailure={readonly ok:false;readonly error:string;readonly message:string}; type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type LicenceFlag='attribution-required'|'share-alike'|'non-commercial'|'no-derivatives'|'public-domain-claimed'|'unknown-licence'|'no-licence-found';
export type LicenceFlagValue={flags:readonly LicenceFlag[];needsOwnerDecision:boolean;mayBundle:'yes'|'yes-with-credit'|'owner-decision'|'no';label:'REPORTED'};
export type LicenceItemResult=EngineResult<LicenceFlagValue>;
export type FlagManyResult={items:readonly LicenceItemResult[];ownerDecisionIndexes:readonly number[];total:number;needOwnerDecision:number};
const lfFail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
const lfOk=<T>(value:T):EngineResult<T>=>Object.freeze({ok:true,value});
const flagOrder:LicenceFlag[]=['attribution-required','share-alike','non-commercial','no-derivatives','public-domain-claimed','unknown-licence','no-licence-found'];
export function flagLicence(id:string|null|undefined):LicenceItemResult{
 if(id!==null&&id!==undefined&&typeof id!=='string')return lfFail('bad-input','licence id must be a string, null or undefined');
 const key=(id??'').trim().toLowerCase();let found:LicenceFlag[];
 if(key==='')found=['no-licence-found'];
 else if(key==='cc0-1.0')found=['public-domain-claimed'];
 else if(key==='cc-by-4.0'||key==='mit'||key==='apache-2.0'||key==='wordnet')found=['attribution-required'];
 else if(key==='cc-by-sa-4.0')found=['attribution-required','share-alike'];
 else if(key==='cc-by-nc-4.0')found=['attribution-required','non-commercial'];
 else if(key==='cc-by-nd-4.0')found=['attribution-required','no-derivatives'];
 else if(key==='gpl-3.0-only')found=['share-alike'];
 else found=['unknown-licence'];
 const flags=flagOrder.filter(f=>found.includes(f));
 let mayBundle:'yes'|'yes-with-credit'|'owner-decision'|'no';
 if(flags.includes('no-licence-found'))mayBundle='no';
 else if(flags.some(f=>f==='share-alike'||f==='non-commercial'||f==='no-derivatives'||f==='unknown-licence'))mayBundle='owner-decision';
 else if(flags.includes('attribution-required'))mayBundle='yes-with-credit';
 else mayBundle='yes';
 const needsOwnerDecision=mayBundle==='owner-decision'||mayBundle==='no';
 return lfOk(Object.freeze({flags:Object.freeze(flags),needsOwnerDecision,mayBundle,label:'REPORTED'}));
}
export function flagMany(ids:readonly (string|null|undefined)[]):EngineResult<FlagManyResult>{
 if(!Array.isArray(ids))return lfFail('bad-input','ids must be an array');
 const items:LicenceItemResult[]=[],ownerDecisionIndexes:number[]=[];
 for(let i=0;i<ids.length;i++){
  const item=flagLicence(ids[i]);items.push(item);
  if(item.ok&&item.value.needsOwnerDecision)ownerDecisionIndexes.push(i);
 }
 return lfOk(Object.freeze({items:Object.freeze(items),ownerDecisionIndexes:Object.freeze(ownerDecisionIndexes),total:ids.length,needOwnerDecision:ownerDecisionIndexes.length}));
}
