import {flagLicence, flagMany, type LicenceFlagValue} from '../src/web/licenceFlags';
type EngineFailure={ok:false;error:string;message:string};
declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
const sa=flagLicence(' cc-by-sa-4.0 ');
check(sa.ok&&JSON.stringify(sa.value.flags)===JSON.stringify(['attribution-required','share-alike'])&&sa.value.mayBundle==='owner-decision'&&sa.value.needsOwnerDecision,'hand share alike');
const by=flagLicence('CC-BY-4.0');
check(by.ok&&JSON.stringify(by.value.flags)===JSON.stringify(['attribution-required'])&&by.value.mayBundle==='yes-with-credit'&&!by.value.needsOwnerDecision,'hand attribution');
const cc0=flagLicence('CC0-1.0');
check(cc0.ok&&JSON.stringify(cc0.value.flags)===JSON.stringify(['public-domain-claimed'])&&cc0.value.mayBundle==='yes'&&!cc0.value.needsOwnerDecision,'hand public domain claim');
const none=flagLicence(null);
check(none.ok&&JSON.stringify(none.value.flags)===JSON.stringify(['no-licence-found'])&&none.value.mayBundle==='no'&&none.value.needsOwnerDecision,'hand null');
const unknown=flagLicence('Made-Up-1');
check(unknown.ok&&JSON.stringify(unknown.value.flags)===JSON.stringify(['unknown-licence'])&&unknown.value.mayBundle==='owner-decision','hand unknown');
const many=flagMany(['MIT','GPL-3.0-only',null,'CC0-1.0']);
check(many.ok&&JSON.stringify(many.value.ownerDecisionIndexes)===JSON.stringify([1,2])&&many.value.total===4&&many.value.needOwnerDecision===2,'hand many');
const mixed=flagMany(['MIT',7 as unknown as string,null]);
check(mixed.ok&&mixed.value.items[1].ok===false&&JSON.stringify(mixed.value.ownerDecisionIndexes)===JSON.stringify([2])&&mixed.value.needOwnerDecision===1,'bad member is not counted as owner decision');
check(flagLicence('CC-BY-NC-4.0').ok&&JSON.stringify((flagLicence('CC-BY-NC-4.0') as {ok:true;value:LicenceFlagValue}).value.flags)===JSON.stringify(['attribution-required','non-commercial']),'flag order is canonical');
check(flagLicence(undefined).ok&&JSON.stringify((flagLicence(undefined) as {ok:true;value:LicenceFlagValue}).value.flags)===JSON.stringify(['no-licence-found']),'undefined is missing');
check(flagLicence('   ').ok&&JSON.stringify((flagLicence('   ') as {ok:true;value:LicenceFlagValue}).value.flags)===JSON.stringify(['no-licence-found']),'blank is missing');
check(flagLicence(' mIt ').ok&&((flagLicence(' mIt ') as {ok:true;value:LicenceFlagValue}).value.mayBundle==='yes-with-credit'),'trim and case fold');
check(flagLicence('Apache-2.0').ok&&((flagLicence('Apache-2.0') as {ok:true;value:LicenceFlagValue}).value.flags[0]==='attribution-required'),'Apache attribution');
check(flagLicence('WordNet').ok&&((flagLicence('WordNet') as {ok:true;value:LicenceFlagValue}).value.flags[0]==='attribution-required'),'WordNet attribution');
check(flagLicence('CC-BY-NC-4.0').ok&&((flagLicence('CC-BY-NC-4.0') as {ok:true;value:LicenceFlagValue}).value.flags[1]==='non-commercial'),'non-commercial flag');
check(flagLicence('CC-BY-ND-4.0').ok&&((flagLicence('CC-BY-ND-4.0') as {ok:true;value:LicenceFlagValue}).value.flags[1]==='no-derivatives'),'no derivatives flag');
check(flagLicence('GPL-3.0-only').ok&&((flagLicence('GPL-3.0-only') as {ok:true;value:LicenceFlagValue}).value.flags[0]==='share-alike'),'GPL share alike');
check((flagLicence(7 as unknown as string) as EngineFailure).error==='bad-input','non-string rejected');
check(sa.ok&&sa.value.label==='REPORTED','never claim verified');
check(Object.isFrozen(sa)&&sa.ok&&Object.isFrozen(sa.value.flags)&&many.ok&&Object.isFrozen(many.value.items),'frozen outputs');
// DIRECTOR EXTRAS (Batch 4 verification, 2026-11-04): gaps found by hand-made breakages
for(const id of ['CC-BY-NC-4.0','CC-BY-ND-4.0','CC-BY-SA-4.0','GPL-3.0-only','Made-Up-1']){const r=flagLicence(id);check(r.ok&&r.value.mayBundle==='owner-decision'&&r.value.needsOwnerDecision===true,'owner decision for '+id);}
for(const id of ['MIT','CC0-1.0',null,undefined,'   ','Made-Up-1']){const r=flagLicence(id as string|null|undefined);check(r.ok&&r.value.label==='REPORTED','label is always REPORTED: '+String(id));}
const xb=flagLicence('   ');check(xb.ok&&xb.value.flags[0]==='no-licence-found'&&xb.value.mayBundle==='no'&&xb.value.needsOwnerDecision===true,'blank text counts as no licence found');
check((flagMany('MIT' as unknown as string[]) as EngineFailure).error==='bad-input','flagMany rejects a non-array');
console.log('LICENCE_FLAGS OK: '+checks+' checks');
