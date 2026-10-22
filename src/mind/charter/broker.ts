import { CHARTER_LIMITS, charterHash, validateCharter, type Charter, type Sha256 } from './charter.ts';
export type Origin='owner'|'axon'|'tool'|'external';
export interface Request { lane:string; action:string; origin:Origin; target?:{kind:string;id:string}; cost?:{amount:number}; scope?:string[] }
export interface DecisionRecord { at:string; lane:string; action:string; origin:Origin; target?:{kind:string;id:string}; decision:'allow'|'ask'|'deny'; ruleId:string; reason:string; actionHash:string }
export interface DecisionContext { now:string; spentToday:number; integrity:{ok:boolean}; approvedScopes?:readonly string[] }
export interface Approval { token:string; actionHash:string; issuedAt:string; expiresAt:string; usedTokens:ReadonlySet<string> }
export interface Decision { decision:'allow'|'ask'|'deny'; ruleId:string; reason:string; needsApproval?:{actionHash:string;prompt:string}; record:DecisionRecord }
const READ_ONLY=new Set(['read','search','list','view','summarise','fetch-readonly']);
const systemRead=new Set(['system.read-charter']);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
export function isReadOnlyAction(action:string):boolean { const dot=action.lastIndexOf('.'); return dot>=0&&READ_ONLY.has(action.slice(dot+1)); }
export function actionHash(request:Pick<Request,'lane'|'action'|'target'|'cost'>,sha256:Sha256):string { const canonical={lane:request.lane,action:request.action,target:request.target?{kind:request.target.kind,id:request.target.id}:null,cost:request.cost?{amount:request.cost.amount}:null}; return sha256(JSON.stringify(canonical,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(x=>[x,v[x]])):v)); }
export function decide(charter:Charter,request:Request,context:DecisionContext,sha256:Sha256=(s)=>s):Decision {
 let lane='',act='',origin:Origin='external',at=''; let decision:Decision['decision']='deny',ruleId='bad-request',reason='bad-request',hash='';
 try {
  if(!plain(request)||!plain(context)||typeof request.lane!=='string'||typeof request.action!=='string'||!(['owner','axon','tool','external'] as unknown[]).includes(request.origin)||typeof context.now!=='string'||typeof context.spentToday!=='number'||!Number.isFinite(context.spentToday)||context.spentToday<0||!plain(context.integrity)||typeof context.integrity.ok!=='boolean'||(request.target!==undefined&&(!plain(request.target)||typeof request.target.kind!=='string'||typeof request.target.id!=='string'))||(request.cost!==undefined&&(!plain(request.cost)||typeof request.cost.amount!=='number'))) throw new Error('bad');
  lane=request.lane;act=request.action;origin=request.origin;at=context.now;hash=actionHash(request,sha256);
  const valid=validateCharter(charter); if(!valid.ok){ruleId='charter-not-trusted';reason='The Charter is invalid and cannot authorise actions.';}
  else if(!valid.value.lanes[lane]||!valid.value.lanes[lane].actions[act]){ruleId='not-in-charter';reason='This action is not listed in the owner’s Charter.';}
  else if(!context.integrity.ok&&!systemRead.has(act)){ruleId='charter-not-trusted';reason='The Charter is unsigned, invalid or has failed its integrity check.';}
  else {const rule=valid.value.lanes[lane].actions[act];ruleId=`${lane}:${act}`;reason=rule.reason;
   if(rule.level==='never'){decision='deny';reason='The owner’s Charter forbids this action.';}
   else if(request.cost&&(request.cost.amount<0||!Number.isFinite(request.cost.amount)||request.cost.amount>(rule.maxCost??Infinity)||request.cost.amount>valid.value.fences.maxSpendPerAction||context.spentToday+request.cost.amount>valid.value.fences.maxSpendPerDay)){decision='deny';ruleId='cost-limit';reason='The action exceeds a cost limit or has an invalid cost.';}
   else if(request.target&&valid.value.fences.neverTouch.some(p=>p.endsWith('*')?`${request.target!.kind}:${request.target!.id}`.startsWith(p.slice(0,-1)):`${request.target!.kind}:${request.target!.id}`===p)){decision='deny';ruleId='never-touch';reason='The target is protected by the owner’s never-touch fence.';}
   else if(origin==='external'&&!isReadOnlyAction(act)){decision='ask';ruleId='origin-fence';reason='External content cannot authorise a state-changing action; the owner must approve it.';}
   else if(origin==='tool'&&!isReadOnlyAction(act)&&!(rule.level==='allowed'&&Array.isArray(request.scope)&&request.scope.length>0&&Array.isArray(context.approvedScopes)&&request.scope.every(s=>typeof s==='string'&&context.approvedScopes!.includes(s)))){decision='ask';ruleId='origin-fence';reason='A tool cannot authorise a state-changing action without an owner-approved scope.';}
   else {decision=rule.level==='allowed'?'allow':'ask';}
  }
 }catch{decision='deny';ruleId='bad-request';reason='bad-request';}
 const rec:DecisionRecord={at,lane,action:act,origin,decision,ruleId,reason,actionHash:hash};
 return decision==='ask'?{decision,ruleId,reason,needsApproval:{actionHash:hash,prompt:`Approve ${act} in ${lane}?`},record:rec}:{decision,ruleId,reason,record:rec};
}
export function appendRecord(log:readonly DecisionRecord[],record:DecisionRecord,maxEntries:number):{entries:DecisionRecord[];dropped:number;error?:'invalid-limit'} { if(!Number.isSafeInteger(maxEntries)||maxEntries<0||maxEntries>CHARTER_LIMITS.logEntries)return {entries:log.slice(),dropped:0,error:'invalid-limit'}; const all=[...log,record];const n=Math.max(0,all.length-maxEntries);return {entries:all.slice(n),dropped:n}; }
export function resolveAsk(pending:{request:Request;actionHash:string},answer:'approve'|'deny',approval:Approval,context:{now:string},sha256:Sha256):{ok:true;decision:'allow'|'deny';reason:string;usedTokens:Set<string>}|{ok:false;error:'hash-mismatch'|'expired'|'replayed'|'denied'|'bad-approval';reason:string;usedTokens:Set<string>} {
 let used=new Set<string>();try {
  if(approval&&approval.usedTokens instanceof Set)used=new Set(approval.usedTokens);
  if(answer==='deny')return {ok:true,decision:'deny',reason:'The owner denied this action.',usedTokens:used};
  if(!plain(pending)||!plain(pending.request)||!approval||typeof approval.token!=='string'||!approval.token||typeof approval.actionHash!=='string'||!approval.expiresAt||!context||typeof context.now!=='string'||typeof pending.actionHash!=='string')return {ok:false,error:'bad-approval',reason:'Approval data is invalid.',usedTokens:used};
  if(approval.actionHash!==pending.actionHash||approval.actionHash!==actionHash(pending.request,sha256))return {ok:false,error:'hash-mismatch',reason:'Approval does not match this exact action.',usedTokens:used};
  if(!Number.isFinite(Date.parse(approval.expiresAt))||!Number.isFinite(Date.parse(context.now))||Date.parse(context.now)>Date.parse(approval.expiresAt))return {ok:false,error:'expired',reason:'Approval has expired.',usedTokens:used};
  if(used.has(approval.token))return {ok:false,error:'replayed',reason:'This approval token was already used.',usedTokens:used};used.add(approval.token);return {ok:true,decision:'allow',reason:'The exact action was approved once.',usedTokens:used};
 } catch {return {ok:false,error:'bad-approval',reason:'Approval data is invalid.',usedTokens:used};}
}
