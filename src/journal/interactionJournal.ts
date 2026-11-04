type EngineSuccess<T>={readonly ok:true;readonly value:T}; type EngineFailure={readonly ok:false;readonly error:string;readonly message:string}; type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type Episode={id:string;provider:string;model:string;accountAlias:string;objective:string;verdict:'ACCEPTED'|'NOT ACCEPTED'|'PENDING';limitHit:boolean;commands:number;tests:'RUN'|'NOT RUN'};
export type Profile={value:string;episodes:number;accepted:number;notAccepted:number;pending:number;limitHits:number;commandsTotal:number;lastEpisodeId:string;enough:boolean};
export type ProfileKey='provider'|'model'|'accountAlias';
const ijFail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
const ijOk=<T>(value:T):EngineResult<T>=>Object.freeze({ok:true,value});
const episodeKeys=['id','provider','model','accountAlias','objective','verdict','limitHit','commands','tests'];
const secretKeys=['password','apikey','api_key','token','cookie','secret'];
function validateEpisode(value:unknown):EngineFailure|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,error:'bad-episode',message:'episode must be an object'};
 const x=value as Record<string,unknown>;
 for(const k of Object.keys(x))if(secretKeys.includes(k.toLowerCase()))return {ok:false,error:'secret-field',message:`secret field rejected: ${k}`};
 for(const k of Object.keys(x))if(!episodeKeys.includes(k))return {ok:false,error:'unknown-field',message:`unknown field: ${k}`};
 for(const k of episodeKeys)if(!Object.prototype.hasOwnProperty.call(x,k))return {ok:false,error:'bad-episode',message:`missing field: ${k}`};
 for(const k of ['id','provider','model','accountAlias','objective'])if(typeof x[k]!=='string'||(x[k] as string).trim()==='')return {ok:false,error:'bad-episode',message:`${k} must be a non-empty string`};
 if(!['ACCEPTED','NOT ACCEPTED','PENDING'].includes(x.verdict as string)||typeof x.limitHit!=='boolean'||!Number.isInteger(x.commands)||(x.commands as number)<0||!['RUN','NOT RUN'].includes(x.tests as string))
  return {ok:false,error:'bad-episode',message:'episode field has an invalid type or value'};
 return null;
}
export function appendEpisode(journal:readonly Episode[],episode:unknown):EngineResult<readonly Episode[]>{
 if(!Array.isArray(journal))return ijFail('bad-episode','journal must be an array');
 const invalid=validateEpisode(episode);if(invalid)return invalid;
 const ids=new Set<string>();
 for(const e of journal){const bad=validateEpisode(e);if(bad)return bad;if(ids.has(e.id))return ijFail('duplicate-id',`duplicate episode id: ${e.id}`);ids.add(e.id);}
 const fresh=episode as Episode;if(ids.has(fresh.id))return ijFail('duplicate-id',`duplicate episode id: ${fresh.id}`);
 const copy=journal.map(e=>Object.freeze({...e}));
 copy.push(Object.freeze({...fresh}));
 return ijOk(Object.freeze(copy));
}
export function profileOf(journal:readonly Episode[],key:ProfileKey):EngineResult<readonly Profile[]>{
 if(!Array.isArray(journal)||!['provider','model','accountAlias'].includes(key))return ijFail('bad-episode','invalid journal or profile key');
 const map=new Map<string,{episodes:number;accepted:number;notAccepted:number;pending:number;limitHits:number;commandsTotal:number;lastEpisodeId:string}>();
 const ids=new Set<string>();
 for(let i=0;i<journal.length;i++){
  const e=journal[i],bad=validateEpisode(e);if(bad)return bad;
  if(ids.has(e.id))return ijFail('duplicate-id',`duplicate episode id: ${e.id}`);ids.add(e.id);
  const value=e[key];let p=map.get(value);
  if(!p){p={episodes:0,accepted:0,notAccepted:0,pending:0,limitHits:0,commandsTotal:0,lastEpisodeId:e.id};map.set(value,p);}
  p.episodes++;if(e.verdict==='ACCEPTED')p.accepted++;else if(e.verdict==='NOT ACCEPTED')p.notAccepted++;else p.pending++;
  if(e.limitHit)p.limitHits++;p.commandsTotal+=e.commands;p.lastEpisodeId=e.id;
 }
 const profiles:Profile[]=[];
 for(const [value,p] of map)profiles.push(Object.freeze({value,...p,enough:p.episodes>=3}));
 return ijOk(Object.freeze(profiles));
}
