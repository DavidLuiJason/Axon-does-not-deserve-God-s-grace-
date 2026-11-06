declare const console:{log:(v:string)=>void};
// DIRECTOR checks for FEED1: inlined independent reference + differential over valid inputs + error-order combinations + gap checks.
// DIRECTOR REFERENCE for FEED1 (makeActOrAskInput). Independent of any builder code.
type Res = {kind:string;tool?:string;missingSlots?:string[];evidence?:string;choices?:string[]};
type Sch = {tool:string;effects:string[];preconditions:string[];undo:string;slots:{name:string;required:boolean}[]};
type Args = {resolution:Res;schemas:Sch[];slotDefaults:{tool:string;slot:string}[];extraReadingTools:string[];contextFills:string[];safeStepFills:string[];charter:{never:string[];ask:string[]};costly:boolean};
const PURE=['shows-result','reads-file','uses-camera','uses-microphone','uses-network'];
function ref(a:Args):any{
  const r=a.resolution;
  if(r.kind==='not-a-request'||r.kind==='negated'||r.kind==='unavailable') return {err:'not-for-j6'};
  const by=(t:string)=>a.schemas.find(s=>s.tool===t);
  let tools:string[]=[];
  if(r.kind==='match') tools=[r.tool!,...a.extraReadingTools]; if(r.kind==='ask') tools=[...r.choices!,...a.extraReadingTools];
  const distinct=tools.filter((t,i)=>tools.indexOf(t)===i);
  for(const t of (r.kind==='match'?[r.tool!,...a.extraReadingTools]:r.kind==='ask'?[...r.choices!,...a.extraReadingTools]:[])) if(!by(t)) return {err:'unknown-tool'};
  if(r.kind==='match'){const s=by(r.tool!)!; for(const m of r.missingSlots!){const sl=s.slots.find(x=>x.name===m); if(!sl||!sl.required) return {err:'bad-missing-slot'};}}
  if(r.kind==='none') return {permission:'ALLOW',undo:'READ-ONLY',outward:'NONE',costly:a.costly,readings:'NO-READING',missing:'NONE',readingChangesResult:false,inputChangesResult:false};
  let perm=0,undo=0,out=0; // perm 0 ALLOW 1 ASK 2 NEVER; undo 0 RO 1 UNDOABLE 2 NOT; out 0 NONE 1 SEND 2 DELETE 3 MONEY
  for(const t of distinct){const s=by(t)!;
    let p=0; if(a.charter.never.includes(t))p=2; else if(a.charter.ask.includes(t)||s.preconditions.includes('owner-approval')||s.effects.some(e=>['sends','spends','deletes'].includes(e)))p=1;
    const nonPure=s.effects.some(e=>!PURE.includes(e));
    let u= s.undo==='irreversible'?2: (s.undo==='not-needed'? (nonPure?2:0):1);
    let o=0; if(s.effects.includes('sends'))o=Math.max(o,1); if(s.effects.includes('deletes'))o=Math.max(o,2); if(s.effects.includes('spends'))o=Math.max(o,3);
    perm=Math.max(perm,p);undo=Math.max(undo,u);out=Math.max(out,o);}
  const two=distinct.length>1||(r.kind==='match'&&r.evidence==='value');
  let missing=0,ic=false; // 0 NONE 1 CONTEXT 2 SAFE 3 OWNER
  if(r.kind==='match'){for(const m of r.missingSlots!){let k=a.contextFills.includes(m)?1:a.safeStepFills.includes(m)?2:3; missing=Math.max(missing,k); if(k===3&&!a.slotDefaults.some(d=>d.tool===r.tool&&d.slot===m))ic=true;}}
  return {permission:['ALLOW','ASK','NEVER'][perm],undo:['READ-ONLY','UNDOABLE','NOT-UNDOABLE'][undo],outward:['NONE','SEND','DELETE','MONEY'][out],costly:a.costly,readings:two?'TWO-CLOSE':'ONE-CLEAR',missing:['NONE','CONTEXT-ANSWERS','SAFE-STEP-ANSWERS','OWNER-ONLY'][missing],readingChangesResult:two,inputChangesResult:ic};
}

import { makeActOrAskInput } from '../src/decision/actOrAskFeed';
import { decideActOrAsk } from '../src/decision/actOrAsk';
let n=0; const ck=(c:boolean,l:string)=>{if(!c)throw new Error('FAIL: '+l);n++;};
const S:any=[
 {tool:'counter',effects:['shows-result'],preconditions:[],undo:'not-needed',slots:[{name:'text',required:true}]},
 {tool:'converter',effects:['shows-result'],preconditions:[],undo:'not-needed',slots:[{name:'value',required:true},{name:'unit',required:true}]},
 {tool:'scanner',effects:['uses-camera','shows-result'],preconditions:['permission'],undo:'not-needed',slots:[]},
 {tool:'noter',effects:['stores-note'],preconditions:[],undo:'by-removal',slots:[{name:'text',required:true},{name:'title',required:false}]},
 {tool:'mailer',effects:['sends'],preconditions:['owner-approval'],undo:'irreversible',slots:[{name:'to',required:true},{name:'body',required:true}]},
 {tool:'remover',effects:['deletes'],preconditions:['owner-approval'],undo:'by-tool',slots:[{name:'file',required:true}]},
 {tool:'payer',effects:['spends','sends'],preconditions:['owner-approval'],undo:'irreversible',slots:[]},
 {tool:'oddpure',effects:['shows-result','writes-file'],preconditions:[],undo:'not-needed',slots:[]},
 {tool:'backup',effects:['sends'],preconditions:[],undo:'by-tool',slots:[]},
 {tool:'weird',effects:['deletes'],preconditions:[],undo:'not-needed',slots:[]},
];
const names=S.map((s:any)=>s.tool); const sub=(a:string[])=>a.reduce((acc:string[][],x)=>acc.concat(acc.map(y=>[...y,x])),[[]]);
const D=[{tool:'converter',slot:'unit'}];
const slotsOf=(t:string)=>S.find((s:any)=>s.tool===t).slots.map((x:any)=>x.name);
// 1. full differential on valid inputs
let c=0;
const resos:any[]=[{kind:'none'}];
for(const t of names){const req=S.find((s:any)=>s.tool===t).slots.filter((x:any)=>x.required).map((x:any)=>x.name);
  for(const ms of sub(req))for(const ev of [undefined,'value','concept','both'])resos.push({kind:'match',tool:t,missingSlots:ms,...(ev?{evidence:ev}:{})});}
for(const a of names)for(const b of names)if(a!==b)resos.push({kind:'ask',choices:[a,b]});
resos.push({kind:'ask',choices:['counter','mailer','payer','noter']});
const charters=[{never:[],ask:[]},{never:['mailer'],ask:[]},{never:[],ask:names},{never:['counter','noter'],ask:['remover']}];
const extras:string[][]=[[],['counter'],['payer'],['noter','weird'],['converter','converter'],['counter','noter','mailer','scanner']];
const fills:[string[],string[]][]=[[[],[]],[['text','value','unit','to','body','file'],[]],[[],['text','value','unit','to','body','file']],[['unit'],['value']],[['text'],['text']]];
for(const r of resos)for(const e of extras){ if(r.kind==='none'&&e.length)continue;
 for(const ch of charters)for(const [cf,sf] of fills)for(const co of [false,true]){
  const a:any={resolution:r,schemas:S,slotDefaults:D,extraReadingTools:e,contextFills:cf,safeStepFills:sf,charter:ch,costly:co};
  const snap=JSON.stringify(a); const x:any=makeActOrAskInput(a); const y:any=ref(a); c++;
  ck(JSON.stringify(a)===snap,'unchanged');
  if(y.err){ck(x.ok===false&&x.error===y.err&&x.message==='Act or ask feed input is invalid.'&&Object.isFrozen(x),'err '+snap);continue;}
  ck(x.ok===true&&Object.isFrozen(x)&&Object.isFrozen(x.value),'ok/frozen '+snap);
  const keys=['permission','undo','outward','costly','readings','missing','readingChangesResult','inputChangesResult'];
  ck(JSON.stringify(Object.keys(x.value))===JSON.stringify(keys),'key order');
  for(const k of keys)ck(x.value[k]===y[k],k+' '+snap);
  ck((decideActOrAsk(x.value) as any).ok===true,'J6 accepts');
 }}
// 2. error order: corruptions (step, field, apply) -- pairs and triples, same-field pairs skipped
const base=()=>({resolution:{kind:'match',tool:'counter',missingSlots:['text']},schemas:JSON.parse(JSON.stringify(S)),slotDefaults:[...D],extraReadingTools:[] as string[],contextFills:[] as string[],safeStepFills:[] as string[],charter:{never:[] as string[],ask:[] as string[]},costly:false} as any);
const cor:[number,string,(a:any)=>void][]=[
 [2,'top',a=>{a.confidence=1}],[3,'top',a=>{a.zzz=1}],[3,'top',a=>{a[Symbol('s')]=1}],
 [4,'resolution',a=>{a.resolution={kind:'match',tool:'counter',missingSlots:'x'}}],
 [5,'schemas',a=>{a.schemas=[...a.schemas,a.schemas[0]]}],
 [6,'slotDefaults',a=>{a.slotDefaults=[{tool:'a'}]}],
 [7,'extra',a=>{a.extraReadingTools=['counter','counter','counter','counter','counter']}],
 [8,'ctx',a=>{a.contextFills=[1]}],[9,'safe',a=>{a.safeStepFills=['']}],[10,'charter',a=>{a.charter={never:[]}}],[11,'costly',a=>{a.costly='no'}],
 [12,'resolution',a=>{a.resolution={kind:'negated'}}],
 [13,'extra',a=>{a.extraReadingTools=['ghost']}],
 [14,'resolution',a=>{a.resolution={kind:'match',tool:'counter',missingSlots:['nope']}}],
];
const apply=(idx:number[])=>{const a=base(); for(const i of idx)cor[i][2](a); return a;};
const codes:Record<number,string>={2:'confidence-not-allowed',3:'unknown-key',4:'bad-resolution',5:'bad-schemas',6:'bad-slot-defaults',7:'bad-extra-readings',8:'bad-context-fills',9:'bad-safe-fills',10:'bad-charter',11:'bad-costly',12:'not-for-j6',13:'unknown-tool',14:'bad-missing-slot'};
let combos=0;
const L=cor.length; const sets:number[][]=[];
for(let i=0;i<L;i++){sets.push([i]);for(let j=i+1;j<L;j++){sets.push([i,j]);for(let k=j+1;k<L;k++)sets.push([i,j,k]);}}
for(const s of sets){const fields=s.map(i=>cor[i][1]); const dupF=fields.filter(f=>f!=='top').some((f,i,arr)=>arr.indexOf(f)!==i); if(dupF)continue;
  // interaction: kind negated with ghost extra still step 12 < 13 fine; resolution corruption 14 needs valid steps first: ok
  const exp=codes[Math.min(...s.map(i=>cor[i][0]))]; const x:any=makeActOrAskInput(apply(s)); combos++;
  ck(x.ok===false&&x.error===exp&&x.message==='Act or ask feed input is invalid.'&&Object.isFrozen(x),'order '+s.map(i=>cor[i][0]).join('+')+' exp '+exp+' got '+(x.error||'ok'));}
// 3. odd inputs
for(const v of [null,[],'x',5,undefined,true])ck((makeActOrAskInput(v as any) as any).error==='bad-input','non-object');
const a0:any=base(); delete a0.charter; ck((makeActOrAskInput(a0) as any).error==='bad-charter','missing key');
const a1:any=base(); const ne=Object.defineProperty(a1,'hid',{value:1,enumerable:false}); ck((makeActOrAskInput(ne) as any).error==='unknown-key','non-enumerable extra');
const a2:any=base(); a2.resolution={kind:'match',tool:'counter',missingSlots:[],evidence:undefined}; ck((makeActOrAskInput(a2) as any).error==='bad-resolution','evidence undefined');
const a3:any=base(); a3.resolution={kind:'none',evidence:'value'}; ck((makeActOrAskInput(a3) as any).error==='bad-resolution','evidence on none');
const a4:any=base(); a4.resolution={kind:'ask',choices:['counter']}; ck((makeActOrAskInput(a4) as any).error==='bad-resolution','1 choice');
const a5:any=base(); a5.resolution={kind:'ask',choices:['counter','converter','scanner','noter','mailer']}; ck((makeActOrAskInput(a5) as any).error==='bad-resolution','5 choices');
const a6:any=base(); a6.resolution={kind:'ask',choices:['counter','counter']}; ck((makeActOrAskInput(a6) as any).error==='bad-resolution','dup choices');
const a7:any=base(); a7.resolution={kind:'none'}; a7.extraReadingTools=['counter']; ck((makeActOrAskInput(a7) as any).error==='bad-extra-readings','none+extras');
const a8:any=base(); a8.resolution={kind:'negated'}; a8.extraReadingTools=['counter']; ck((makeActOrAskInput(a8) as any).error==='not-for-j6','negated+extras ok order');
const a9:any=base(); a9.resolution={kind:'match',tool:'counter',missingSlots:['text','text']}; ck((makeActOrAskInput(a9) as any).error==='bad-resolution','dup missing slots');
const a10:any=base(); a10.schemas[0].extra=1; ck((makeActOrAskInput(a10) as any).error==='bad-schemas','schema extra key');
const a11:any=base(); a11.schemas[0].effects=['sends','sends']; ck((makeActOrAskInput(a11) as any).error==='bad-schemas','dup effects');
const a12:any=base(); a12.schemas[0].slots=[{name:'t',required:true},{name:'t',required:false}]; ck((makeActOrAskInput(a12) as any).error==='bad-schemas','dup slot names');
const a13:any=base(); a13.resolution={kind:'match',tool:'counter',missingSlots:[],[Symbol('q')]:1}; ck((makeActOrAskInput(a13) as any).error==='bad-resolution','symbol in resolution');
const a14:any=base(); a14.schemas=[]; a14.resolution={kind:'none'}; ck((makeActOrAskInput(a14) as any).ok===true,'empty schemas + none ok');
const a15:any=base(); a15.extraReadingTools=['counter','converter','scanner','noter']; ck((makeActOrAskInput(a15) as any).ok===true,'exactly 4 extras ok');
const g:any=base(); Object.defineProperty(g,'costly',{get(){throw new Error('g')},enumerable:true}); ck((makeActOrAskInput(g) as any).ok===false,'throwing getter contained');
const x1:any=makeActOrAskInput(base()),x2:any=makeActOrAskInput(base()); ck(x1.value!==x2.value,'fresh objects');

// 4. gaps found in the builder test and in the card fixtures
const CS:any=[
 {tool:'gate',effects:['shows-result'],preconditions:['owner-approval'],undo:'not-needed',slots:[{name:'unit',required:true}]},
 {tool:'converter',effects:['shows-result'],preconditions:[],undo:'not-needed',slots:[{name:'value',required:true},{name:'unit',required:true}]},
 {tool:'remover',effects:['deletes'],preconditions:[],undo:'by-tool',slots:[]},
 {tool:'mailer',effects:['sends'],preconditions:[],undo:'by-tool',slots:[]},
 {tool:'payer',effects:['spends'],preconditions:[],undo:'by-tool',slots:[]},
];
const cb=(r:any,x:any={})=>({resolution:r,schemas:CS,slotDefaults:[{tool:'converter',slot:'unit'}],extraReadingTools:[],contextFills:[],safeStepFills:[],charter:{never:[],ask:[]},costly:false,...x}) as any;
const gt:any=makeActOrAskInput(cb({kind:'match',tool:'gate',missingSlots:[]})); ck(gt.ok&&gt.value.permission==='ASK','owner-approval alone gives ASK');
const gd:any=makeActOrAskInput(cb({kind:'match',tool:'gate',missingSlots:['unit']})); ck(gd.ok&&gd.value.missing==='OWNER-ONLY'&&gd.value.inputChangesResult===true,'default of another tool does not count');
const cd:any=makeActOrAskInput(cb({kind:'match',tool:'converter',missingSlots:['unit']})); ck(cd.ok&&cd.value.inputChangesResult===false,'own default counts');
const o1:any=makeActOrAskInput(cb({kind:'ask',choices:['remover','mailer']})); ck(o1.value.outward==='DELETE','DELETE beats SEND');
const o2:any=makeActOrAskInput(cb({kind:'ask',choices:['remover','payer']})); ck(o2.value.outward==='MONEY','MONEY beats DELETE');
const o3:any=makeActOrAskInput(cb({kind:'ask',choices:['mailer','payer']})); ck(o3.value.outward==='MONEY','MONEY beats SEND');
const ob:any=base(); ob.resolution={kind:'match',tool:'noter',missingSlots:['title']}; ck((makeActOrAskInput(ob) as any).error==='bad-missing-slot','optional slot cannot be missing');
const e5:any=base(); e5.extraReadingTools=['counter','converter','scanner','noter','mailer']; ck((makeActOrAskInput(e5) as any).error==='bad-extra-readings','exactly 5 extras fail');
const e6:any=base(); e6.extraReadingTools=['counter','converter','scanner','noter','mailer','payer']; ck((makeActOrAskInput(e6) as any).error==='bad-extra-readings','6 extras fail');
const dm:any=base(); dm.resolution={kind:'match',tool:'converter',missingSlots:['unit','unit']}; ck((makeActOrAskInput(dm) as any).error==='bad-resolution','duplicate missing slots fail');
const nf:any=base(); nf.resolution={kind:'negated'}; ck(Object.isFrozen(makeActOrAskInput(nf)),'failure frozen');
console.log('FEED1 DIRECTOR OK: '+n+' checks; valid differential calls '+c+'; error-order combos '+combos);
