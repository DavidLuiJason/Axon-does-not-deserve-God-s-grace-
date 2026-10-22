export type Level = 'allowed' | 'ask' | 'never';
export interface ActionRule { level: Level; reason: string; maxCost?: number }
export interface Lane { id: string; name: string; actions: Record<string, ActionRule> }
export interface Charter { version: 1; revision: number; lanes: Record<string, Lane>; fences: { neverTouch: string[]; maxSpendPerAction: number; maxSpendPerDay: number }; createdAt: string; signedAt: string | null; signature: string | null }
export const CHARTER_LIMITS = { lanes: 50, actionsPerLane: 200, reasonCharacters: 500, neverTouch: 100, logEntries: 10000, inputCharacters: 1_000_000 } as const;
export type CharterError = 'invalid-charter'|'unknown-level'|'empty-action-id'|'lane-id-mismatch'|'negative-spend'|'too-many-actions'|'too-many-lanes'|'invalid-id'|'invalid-reason'|'invalid-fence'|'input-too-large'|'circular-input'|'invalid-signature';
export type Result<T> = {ok:true; value:T} | {ok:false; error:CharterError; message:string};
const fail = (error:CharterError,message:string):Result<never>=>({ok:false,error,message});
const plain = (v:unknown):v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v) && (Object.getPrototypeOf(v)===Object.prototype || Object.getPrototypeOf(v)===null);
const idOk = (s:unknown):s is string => typeof s==='string' && s.length>0 && s.length<=256 && !['__proto__','constructor','prototype'].includes(s) && !/[\u0000-\u001f\u007f\s]/u.test(s);
export function defaultCharter(): Charter {
 const definitions: [string,string,[string,Level][]][] = [
 ['email','Email',[['read','allowed'],['search','allowed'],['summarise','allowed'],['draft','allowed'],['send','ask'],['delete','ask']]],
 ['messages','Messages',[['read','allowed'],['search','allowed'],['draft','allowed'],['send','ask'],['delete','ask']]],
 ['files','Files',[['read','allowed'],['search','allowed'],['list','allowed'],['summarise','allowed'],['draft','allowed'],['write','ask'],['delete','ask']]],
 ['media','Media',[['read','allowed'],['search','allowed'],['summarise','allowed'],['create','ask'],['delete','ask']]],
 ['code','Code',[['read','allowed'],['search','allowed'],['summarise','allowed'],['draft','allowed'],['write','ask'],['run','ask'],['delete','ask']]],
 ['security','Security',[['read','allowed'],['search','allowed'],['scan','ask'],['change','ask']]],
 ['learning','Learning',[['read','allowed'],['search','allowed'],['summarise','allowed'],['draft','allowed'],['save','ask']]],
 ['money','Money',[['read','never'],['search','never'],['pay','never'],['transfer','never'],['invest','never']]],
 ['web','Web',[['search','allowed'],['summarise','allowed'],['draft','allowed'],['fetch','ask'],['post','ask']]],
 ['apps','Apps',[['read-screen','ask'],['tap','ask'],['type','ask'],['install','ask']]],
 ['system','System',[['read-charter','allowed'],['edit-charter','never'],['edit-permissions','never'],['disable-journal','never'],['self-update','never'],['install','ask'],['edit','ask']]]
 ];
 const lanes:Record<string,Lane>=Object.create(null) as Record<string,Lane>;
 for(const [id,name,items] of definitions){const actions:Record<string,ActionRule>=Object.create(null) as Record<string,ActionRule>; for(const [verb,level] of items) actions[`${id}.${verb}`]={level,reason:level==='allowed'?'AXON may do this without asking.':level==='ask'?'AXON must ask the owner before doing this.':'This action is forbidden by the owner’s default Charter.'}; lanes[id]={id,name,actions};}
 return {version:1,revision:1,lanes,fences:{neverTouch:[],maxSpendPerAction:0,maxSpendPerDay:0},createdAt:'',signedAt:null,signature:null};
}
function canonicalValue(v:unknown, seen:Set<object>):unknown { if(v===null||typeof v!=='object') return v; if(seen.has(v as object)) throw new Error('circular'); seen.add(v as object); let out:unknown; if(Array.isArray(v)) out=v.map(x=>canonicalValue(x,seen)); else {const o:Record<string,unknown>=Object.create(null) as Record<string,unknown>; for(const k of Object.keys(v as object).sort()){if(k==='signature'||k==='signedAt') continue; Object.defineProperty(o,k,{value:canonicalValue((v as Record<string,unknown>)[k],seen),enumerable:true});} out=o;} seen.delete(v as object); return out; }
export function canonicalJson(charter: Charter): string { return JSON.stringify(canonicalValue(charter,new Set())); }
export type Sha256 = (text:string)=>string;
export function charterHash(charter: Charter, sha256: Sha256): string { try{return sha256(canonicalJson(charter));}catch{return '';} }
export function validateCharter(value: unknown): Result<Charter> {
 try {
  const raw=JSON.stringify(value); if(raw && raw.length>CHARTER_LIMITS.inputCharacters)return fail('input-too-large','Charter input exceeds the size limit.');
  if(!plain(value)) return fail('invalid-charter','Charter must be a plain object.');
  const c=value as unknown as Charter;
  if(c.version!==1 || !Number.isSafeInteger(c.revision)||c.revision<0 || !plain(c.lanes)||!plain(c.fences)) return fail('invalid-charter','Charter header or structure is invalid.');
  const laneKeys=Object.keys(c.lanes); if(laneKeys.length>CHARTER_LIMITS.lanes)return fail('too-many-lanes','Charter has more than 50 lanes.');
  if(!Array.isArray(c.fences.neverTouch)||c.fences.neverTouch.length>CHARTER_LIMITS.neverTouch||c.fences.neverTouch.some(x=>typeof x!=='string'||x.length>256))return fail('invalid-fence','neverTouch must contain at most 100 short strings.');
  for(const n of [c.fences.maxSpendPerAction,c.fences.maxSpendPerDay])if(typeof n!=='number'||!Number.isFinite(n)||n<0)return fail('negative-spend','Spend limits must be finite non-negative numbers.');
  for(const key of laneKeys){if(!idOk(key))return fail('invalid-id','Lane ids must be non-empty and contain no spaces or control characters.'); const lane=c.lanes[key];if(!plain(lane))return fail('invalid-charter','Each lane must be a plain object.');if(lane.id!==key)return fail('lane-id-mismatch','A lane id must match its key.');if(typeof lane.name!=='string'||!plain(lane.actions))return fail('invalid-charter','Lane name and actions are required.');const keys=Object.keys(lane.actions);if(keys.length>CHARTER_LIMITS.actionsPerLane)return fail('too-many-actions','A lane has more than 200 actions.');for(const aid of keys){if(!idOk(aid))return fail('empty-action-id','Action ids must be non-empty and contain no spaces or control characters.');if(!aid.startsWith(`${key}.`)||aid.length<=key.length+1)return fail('invalid-id','Action ids must use lane.verb form.');const r=lane.actions[aid];if(!plain(r))return fail('invalid-charter','Action rule must be a plain object.');if(!(['allowed','ask','never'] as unknown[]).includes(r.level))return fail('unknown-level','Action level must be allowed, ask or never.');if(typeof r.reason!=='string'||r.reason.length===0||r.reason.length>CHARTER_LIMITS.reasonCharacters)return fail('invalid-reason','Each rule needs a plain reason of at most 500 characters.');if(r.maxCost!==undefined&&(typeof r.maxCost!=='number'||!Number.isFinite(r.maxCost)||r.maxCost<0))return fail('negative-spend','maxCost must be finite and non-negative.');}}
  if(typeof c.createdAt!=='string'||!(c.signedAt===null||typeof c.signedAt==='string')||!(c.signature===null||typeof c.signature==='string'))return fail('invalid-charter','Charter timestamps or signature fields are invalid.');return {ok:true,value:c};
 }catch{return fail('circular-input','Charter could not be safely inspected.');}
}
export const CHARTER_DESCRIPTOR={toolId:'charter',displayName:'Charter and Permission Broker',purpose:'Checks whether a proposed action is permitted by the owner’s Charter.',examples:['Check whether email.send requires approval.','Explain why a request was denied.','Review a proposed Charter change.'],inputs:[{name:'action',kind:'text' as const,prompt:'Describe the action to check.'},{name:'lane',kind:'text' as const,prompt:'Name the action lane.'}]};
