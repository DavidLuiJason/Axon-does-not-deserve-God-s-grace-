import assert from 'node:assert/strict';
import {defaultCharter,charterHash} from '../src/mind/charter/charter.ts';
import {proposeChange,applyChange,proposalHash,signCharter,verifyCharter} from '../src/mind/charter/change.ts';
const sha=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16)};
let checks=0;const ck=(v:unknown,e:unknown,m:string)=>{assert.deepEqual(v,e,m);checks++};const c=defaultCharter();const now='2026-10-22T12:00:00Z';const ctx={now,usedTokens:new Set<string>()};
const changed=structuredClone(c);changed.lanes.email.actions['email.send'].level='allowed';const widening=proposeChange(c,{lanes:{email:changed.lanes.email}},'owner');ck(widening.widens,true,'widening detected');const denied=applyChange(c,{...widening,origin:'axon'},null,ctx,sha);ck(denied.ok,false,'axon widening refused');if(!denied.ok)ck(denied.error,'axon-cannot-widen','typed widening refusal');const approval={by:'owner' as const,actionHash:proposalHash(widening,sha),issuedAt:now,expiresAt:'2026-10-22T13:00:00Z',token:'owner-token'};const applied=applyChange(c,widening,approval,ctx,sha);ck(applied.ok,true,'owner-approved widening applies');if(applied.ok){ck(applied.value.revision,c.revision+1,'revision increments');ck(applied.value.signature,null,'changed charter unsigned');ck(applied.usedTokens.has('owner-token'),true,'approval token consumed');}
const narrow=structuredClone(c);narrow.lanes.email.actions['email.send'].level='never';const narrowing=proposeChange(c,{lanes:{email:narrow.lanes.email}},'axon');ck(narrowing.narrows,true,'narrowing detected');const narrowed=applyChange(c,narrowing,null,ctx,sha);ck(narrowed.ok,true,'axon may narrow permissions');
const expired=applyChange(c,widening,{...approval,expiresAt:'2026-10-22T11:00:00Z'},ctx,sha);ck(expired.ok,false,'expired approval refused');if(!expired.ok)ck(expired.error,'expired','expired reason typed');const replay=applyChange(c,widening,{...approval,token:'used'}, {...ctx,usedTokens:new Set(['used'])},sha);ck(replay.ok,false,'replay refused');
const proposal={...proposeChange(c,{fences:{maxSpendPerDay:5}},'external')};ck(proposal.widens,true,'spend increase widens');ck(applyChange(c,proposal,null,ctx,sha).ok,false,'external spend widening refused');const lowered=proposeChange(c,{fences:{maxSpendPerDay:0}},'axon');ck(lowered.widens,false,'unchanged limit not widening');
const approvalForCharter={by:'owner' as const,actionHash:charterHash(c,sha),issuedAt:now,expiresAt:'2026-10-22T13:00:00Z',token:'sign-token'};const signed=signCharter(c,approvalForCharter,sha,ctx);ck(signed.ok,true,'charter can be signed with matching owner approval');if(signed.ok){ck(verifyCharter(signed.value,sha).ok,true,'signed charter verifies');const tampered=structuredClone(signed.value);tampered.lanes.email.actions['email.read'].reason='tampered';ck(verifyCharter(tampered,sha).ok,false,'tampering fails signature verification');}
ck(applyChange(c,widening,{...approval,actionHash:'wrong'},ctx,sha).ok,false,'wrong approval hash refused');const forged={...widening,widens:false};ck(applyChange(c,forged,null,ctx,sha).ok,false,'forged non-widening flag cannot bypass approval');ck(proposalHash(widening,sha)!=='',true,'proposal hash generated');
// Seeded 5,000-operation invariant walk across all origins. Non-owner origins
// may tighten permissions, but must never create additional freedom.
{
 let seed=0x4d3041; const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
 const freedom=(x:'allowed'|'ask'|'never')=>x==='allowed'?2:x==='ask'?1:0;
 const lessFreeOrEqual=(before:typeof c,after:typeof c)=>{
  for(const [lid,lane] of Object.entries(after.lanes)){
   const old=before.lanes[lid];
   if(!old){if(Object.values(lane.actions).some(a=>a.level!=='never'))return false;continue;}
   for(const [aid,rule] of Object.entries(lane.actions)){
    const prior=old.actions[aid]; if(!prior&&rule.level!=='never')return false;
    if(prior&&freedom(rule.level)>freedom(prior.level))return false;
   }
  }
  if(after.fences.maxSpendPerAction>before.fences.maxSpendPerAction||after.fences.maxSpendPerDay>before.fences.maxSpendPerDay)return false;
  if(before.fences.neverTouch.some(x=>!after.fences.neverTouch.includes(x)))return false;
  return true;
 };
 let state=defaultCharter(); const tokens=new Set<string>(); const origins=['owner','axon','tool','external'] as const; let accepted=0;
 for(let i=0;i<5000;i++){
  const origin=origins[Math.floor(rnd()*origins.length)]; const level=(['allowed','ask','never'] as const)[Math.floor(rnd()*3)];
  const lanes=structuredClone(state.lanes); lanes.email.actions['email.send'].level=level;
  const patch:Parameters<typeof proposeChange>[1]={lanes:{email:lanes.email}};
  const mode=Math.floor(rnd()*3);
  if(mode===1)patch.fences={maxSpendPerDay:Math.floor(rnd()*4)};
  if(mode===2)patch.fences={neverTouch:rnd()<0.5?[]:['file:/protected*']};
  const proposal=proposeChange(state,patch,origin);
  const token=`walk-${i}`; const ownerApproval=origin==='owner'&&proposal.widens?{by:'owner' as const,actionHash:proposalHash(proposal,sha),issuedAt:now,expiresAt:'2026-10-23T00:00:00Z',token}:null;
  const result=applyChange(state,proposal,ownerApproval,{now,usedTokens:tokens},sha);
  if(result.ok){if(origin!=='owner')assert.equal(lessFreeOrEqual(state,result.value),true,`non-owner invariant at operation ${i}`);state=result.value;for(const t of result.usedTokens)tokens.add(t);accepted++;}
 }
 assert.ok(accepted>0); checks++;
}

console.log(`charterChange.test.ts: PASS (${checks} checks; 5,000 seeded invariant operations)`);
