declare const console: { log: (v: string) => void };
import { decideActOrAsk } from '../src/decision/actOrAsk';
let n = 0;
function ck(c: boolean, l: string) { if (!c) throw new Error('FAIL: ' + l); n++; }
const B: any = { permission:'ALLOW', undo:'UNDOABLE', outward:'NONE', costly:false, readings:'ONE-CLEAR', missing:'NONE', readingChangesResult:false, inputChangesResult:false };
// 26 rows, written independently from the card
const rows: [number, any, string, any, boolean, string[]][] = [
[1,{},'ACT',null,false,['one-reading']],
[2,{undo:'READ-ONLY'},'ACT',null,false,['one-reading']],
[3,{readings:'TWO-CLOSE',readingChangesResult:true},'ACT',null,true,['two-readings-undoable']],
[4,{readings:'TWO-CLOSE'},'ACT',null,false,['readings-same-result']],
[5,{readings:'TWO-CLOSE',readingChangesResult:true,undo:'NOT-UNDOABLE'},'ASK','CLARIFICATION',false,['two-readings','not-undoable']],
[6,{readings:'TWO-CLOSE',readingChangesResult:true,outward:'SEND'},'ASK','CLARIFICATION',false,['two-readings','not-undoable']],
[7,{readings:'NO-READING'},'ASK','CLARIFICATION',false,['no-reading']],
[8,{missing:'OWNER-ONLY',inputChangesResult:true},'ASK','MISSING-INPUT',false,['missing-input']],
[9,{missing:'OWNER-ONLY'},'ACT',null,false,['one-reading','default-used']],
[10,{missing:'CONTEXT-ANSWERS',inputChangesResult:true},'ACT',null,false,['one-reading','context-answers']],
[11,{missing:'SAFE-STEP-ANSWERS',inputChangesResult:true},'ACT',null,false,['one-reading','safe-step-answers']],
[12,{permission:'NEVER',readings:'NO-READING'},'BLOCK',null,false,['permission-never']],
[13,{permission:'ASK'},'ASK','APPROVAL',false,['permission-ask']],
[14,{outward:'DELETE'},'ASK','APPROVAL',false,['deletes']],
[15,{outward:'MONEY',costly:true},'ASK','APPROVAL',false,['spends-money','costly']],
[16,{undo:'NOT-UNDOABLE'},'ASK','APPROVAL',false,['not-undoable']],
[17,{costly:true},'ASK','APPROVAL',false,['costly']],
[18,{undo:'NOT-UNDOABLE',outward:'SEND'},'ASK','APPROVAL',false,['not-undoable','sends']],
[19,{readings:'TWO-CLOSE',readingChangesResult:true,missing:'OWNER-ONLY',inputChangesResult:true},'ASK','MISSING-INPUT',false,['missing-input']],
[20,{readings:'NO-READING',missing:'OWNER-ONLY',inputChangesResult:true},'ASK','CLARIFICATION',false,['no-reading']],
[21,{permission:'NEVER',undo:'NOT-UNDOABLE'},'BLOCK',null,false,['permission-never']],
[22,{readings:'TWO-CLOSE',missing:'OWNER-ONLY'},'ACT',null,false,['readings-same-result','default-used']],
[23,{readings:'TWO-CLOSE',readingChangesResult:true,missing:'CONTEXT-ANSWERS'},'ACT',null,true,['two-readings-undoable','context-answers']],
[24,{permission:'ASK',readings:'TWO-CLOSE',readingChangesResult:true},'ASK','APPROVAL',false,['permission-ask']],
[25,{undo:'READ-ONLY',costly:true},'ASK','APPROVAL',false,['costly']],
[26,{permission:'ASK',undo:'NOT-UNDOABLE',outward:'MONEY',costly:true},'ASK','APPROVAL',false,['permission-ask','not-undoable','spends-money','costly']],
];
for (const [i,ch,o,k,s,r] of rows) {
  const x: any = decideActOrAsk({ ...B, ...ch });
  ck(x.ok === true && x.value.outcome===o && x.value.askKind===k && x.value.sayReading===s && JSON.stringify(x.value.reasonCodes)===JSON.stringify(r), 'row '+i);
}
// independent reference, differential over all 3456
const P=['ALLOW','ASK','NEVER'],U=['READ-ONLY','UNDOABLE','NOT-UNDOABLE'],O=['NONE','SEND','DELETE','MONEY'],R=['ONE-CLEAR','TWO-CLOSE','NO-READING'],M=['NONE','CONTEXT-ANSWERS','SAFE-STEP-ANSWERS','OWNER-ONLY'],T=[false,true];
function ref(i:any){
  if(i.undo==='READ-ONLY'&&i.outward!=='NONE') return {err:'read-only-with-effect'};
  if(i.permission==='NEVER') return {o:'BLOCK',k:null,s:false,r:['permission-never']};
  if(i.readings==='NO-READING') return {o:'ASK',k:'CLARIFICATION',s:false,r:['no-reading']};
  const can = i.undo!=='NOT-UNDOABLE' && i.outward==='NONE'; const a:string[]=[]; let s=false;
  if(i.readings==='ONE-CLEAR') a.push('one-reading');
  else if(!i.readingChangesResult) a.push('readings-same-result');
  else if(can){a.push('two-readings-undoable');s=true;}
  else return {o:'ASK',k:'CLARIFICATION',s:false,r:['two-readings','not-undoable']};
  if(i.missing==='OWNER-ONLY'){ if(i.inputChangesResult) return {o:'ASK',k:'MISSING-INPUT',s:false,r:['missing-input']}; a.push('default-used'); }
  if(i.missing==='CONTEXT-ANSWERS')a.push('context-answers');
  if(i.missing==='SAFE-STEP-ANSWERS')a.push('safe-step-answers');
  const ap:string[]=[]; if(i.permission==='ASK')ap.push('permission-ask'); if(i.undo==='NOT-UNDOABLE')ap.push('not-undoable');
  if(i.outward==='SEND')ap.push('sends'); if(i.outward==='DELETE')ap.push('deletes'); if(i.outward==='MONEY')ap.push('spends-money'); if(i.costly)ap.push('costly');
  if(ap.length) return {o:'ASK',k:'APPROVAL',s:false,r:ap};
  return {o:'ACT',k:null,s,r:a};
}
let c=0;
for(const p of P)for(const u of U)for(const o of O)for(const co of T)for(const r of R)for(const m of M)for(const a of T)for(const b of T){
  const i={permission:p,undo:u,outward:o,costly:co,readings:r,missing:m,readingChangesResult:a,inputChangesResult:b}; const snap=JSON.stringify(i);
  const x:any=decideActOrAsk(i as any); const e:any=ref(i); c++;
  ck(JSON.stringify(i)===snap,'input unchanged');
  if(e.err){ ck(x.ok===false&&x.error===e.err&&x.message==='Act or ask input is invalid.'&&Object.isFrozen(x),'err '+snap); continue; }
  ck(x.ok&&x.value.outcome===e.o&&x.value.askKind===e.k&&x.value.sayReading===e.s&&JSON.stringify(x.value.reasonCodes)===JSON.stringify(e.r),'diff '+snap);
  ck(Object.isFrozen(x)&&Object.isFrozen(x.value)&&Object.isFrozen(x.value.reasonCodes),'frozen');
  ck(x.value.reasonCodes.every((q:string)=>q.split('').every(ch=>'abcdefghijklmnopqrstuvwxyz0123456789-'.indexOf(ch)>=0)),'code chars');
  ck(!('confidence' in x.value) && Object.keys(x.value).length===4,'shape');
}
ck(c===3456,'3456');
// odd inputs
const bad=(v:any)=>decideActOrAsk(v) as any;
ck(bad(null).error==='bad-input'&&bad([]).error==='bad-input'&&bad('x').error==='bad-input'&&bad(undefined).error==='bad-input'&&bad(5).error==='bad-input','non-objects');
ck(bad({...B,confidence:1,extra:1}).error==='confidence-not-allowed','conf first');
ck(bad({...B,extra:1,permission:'X'}).error==='unknown-key','key before perm');
ck(bad({...B,[Symbol('s')]:1}).error==='unknown-key','symbol');
const ne:any={...B}; Object.defineProperty(ne,'hid',{value:1,enumerable:false}); ck(bad(ne).error==='unknown-key','non-enumerable');
const {permission,...noP}=B; ck(bad(noP).error==='bad-permission','missing key');
ck(bad({...B,permission:'X',undo:'X'}).error==='bad-permission','perm before undo');
ck(bad({...B,undo:'READ-ONLY',outward:'SEND',costly:'no'}).error==='bad-costly','validation before cross-check');
ck(bad({...B,confidence:undefined}).error==='confidence-not-allowed','confidence undefined key');
const pr:any=Object.create({permission:'ALLOW'}); ck(bad(pr).ok===false,'inherited-only keys do not count as present (all eight are own and required)');
const thrower:any=new Proxy({}, {ownKeys(){throw new Error('x')}}); ck(bad(thrower).ok===false,'proxy throw does not escape');
const g:any={...B}; Object.defineProperty(g,'undo',{get(){throw new Error('g')},enumerable:true}); ck(bad(g).ok===false,'getter throw does not escape');
{const w=(decideActOrAsk({...B,readings:'TWO-CLOSE',undo:'NOT-UNDOABLE'}) as any).value; ck(w.outcome==='ASK'&&w.askKind==='APPROVAL'&&w.reasonCodes.join()==='not-undoable','same-result two readings, not undoable: APPROVAL with only not-undoable');}
ck((decideActOrAsk({...B,readings:'TWO-CLOSE',outward:'SEND'}) as any).value.askKind==='APPROVAL','same-result readings with send go to approval');
const x1=decideActOrAsk(B) as any, x2=decideActOrAsk(B) as any; ck(x1!==x2&&x1.value.reasonCodes!==x2.value.reasonCodes,'fresh objects');
console.log('J6 DIRECTOR OK: '+n+' checks');
