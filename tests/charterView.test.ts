import assert from 'node:assert/strict';
import { defaultCharter, charterHash, validateCharter, CHARTER_LIMITS, type Charter, type Sha256 } from '../src/mind/charter/charter.ts';
import { loadCharterText, serializeCharter, charterToFeedView, CHARTER_UNTRUSTED_NOTICE, type CharterLoad } from '../src/mind/charter/charterView.ts';

const sha:Sha256 = (s:string) => { let h=2166136261; for(let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619); return (h>>>0).toString(16); };
let checks=0;
const check=(actual:unknown,expected:unknown,label:string)=>{ assert.deepEqual(actual,expected,label); checks++; };
const yes=(value:unknown,label:string)=>{ assert.equal(value,true,label); checks++; };
const no=(value:unknown,label:string)=>{ assert.equal(value,false,label); checks++; };
const mk=(lanes:Record<string,Record<string,'allowed'|'ask'|'never'>>):Charter=>{
 const built:Record<string,any>={};
 for(const [id,rules] of Object.entries(lanes)){
  const actions:Record<string,any>={};
  for(const [id2,level] of Object.entries(rules)) actions[id2]={level,reason:'r'};
  built[id]={id,name:id,actions};
 }
 return {version:1,revision:1,lanes:built,fences:{neverTouch:[],maxSpendPerAction:0,maxSpendPerDay:0},createdAt:'',signedAt:null,signature:null};
};
const sign=(c:Charter):Charter=>{const d={...c,signedAt:'2026-11-06T00:00:00Z'};return {...d,signature:`${charterHash(d,sha)}:owner`};};
const ser=(c:Charter)=>{const r=serializeCharter(c);assert.equal(r.ok,true);checks++;return r.ok?r.text:'';};
const T=['sort-lines','counter','noter','voice-cloner','calc'];
const A=sign(mk({tools:{'tools.sort-lines':'never','tools.counter':'ask','tools.noter':'allowed'}}));
const defaultPlus=defaultCharter();
const B=sign({...defaultPlus,lanes:{...defaultPlus.lanes,tools:{id:'tools',name:'tools',actions:{'tools.calc':{level:'ask',reason:'r'}}}}});
const O=sign(mk({a:{'a.b.c':'ask'},'a.b':{'a.b.c':'never'}}));
const bi=loadCharterText({kind:'absent'},sha);
const sg=(c:Charter)=>loadCharterText({kind:'text',text:ser(c)},sha);
const un=loadCharterText({kind:'unreadable'},sha);
const view=(load:CharterLoad,toolIds:readonly string[],links:readonly any[]=[])=>charterToFeedView({load,toolIds,links});
const expected=(never:string[],ask:string[],status:'built-in'|'signed'|'charter-untrusted',notice='')=>({never,ask,status,notice});

// Pin and load fixtures.
check(charterHash(defaultCharter(),sha),'167fb2be','default hash pin');
check(bi.status,'built-in','L01 status'); check(bi.reason,'no-stored-charter','L01 reason');
check(ser(bi.charter!),ser(defaultCharter()),'L01 default content');
check(un,{status:'untrusted',reason:'unreadable',charter:null},'L02 unreadable');
const loadedA=sg(A); check(loadedA.status,'signed','L03 status'); check(loadedA.reason,'trusted','L03 reason'); check(ser(loadedA.charter!),ser(A),'L03 content');
check(loadCharterText({kind:'text',text:ser(mk({tools:{'tools.x':'ask'}}))},sha),{status:'untrusted',reason:'unsigned',charter:null},'L04 unsigned');
const changed=structuredClone(A); changed.lanes.tools.actions['tools.counter'].level='never';
check(loadCharterText({kind:'text',text:JSON.stringify(changed)},sha),{status:'untrusted',reason:'signature-mismatch',charter:null},'L05 tamper');
check(loadCharterText({kind:'text',text:''},sha).reason,'not-json','L06 empty');
check(loadCharterText({kind:'text',text:'{'},sha).reason,'not-json','L07 malformed');
check(loadCharterText({kind:'text',text:'null'},sha).reason,'invalid-charter','L08 null');
const maybe=structuredClone(A); maybe.lanes.tools.actions['tools.counter'].level='maybe' as any;
check(loadCharterText({kind:'text',text:JSON.stringify(maybe)},sha).reason,'unknown-level','L09 invalid level');
check(loadCharterText({kind:'text',text:'x'.repeat(1000001)},sha).reason,'input-too-large','L10 size before parse');
check(loadCharterText({kind:'text',text:'{'+ ' '.repeat(999998) +'}'},sha).reason,'invalid-charter','L11 exact cap');
for(const bad of [{kind:'text'},{kind:'text',text:5},{kind:'absent',extra:1},{kind:'other'},null,{kind:'absent',[Symbol('x')]:1}]){
 check(loadCharterText(bad as any,sha),{status:'untrusted',reason:'unreadable',charter:null},'L12 malformed stored');
}
check(loadCharterText({kind:'absent'},'nope' as any).reason,'unreadable','L13 bad hash function');
check(loadCharterText({kind:'text',text:ser(A)},()=>{throw Error('x')}).reason,'signature-mismatch','L14 throwing hash');
const wrongLane=structuredClone(A); wrongLane.lanes.tools.id='other';
check(loadCharterText({kind:'text',text:JSON.stringify(wrongLane)},sha).reason,'lane-id-mismatch','L15 lane mismatch');
check(loadCharterText({kind:'text',text:ser(A)},(s)=>sha(s)+'x').reason,'signature-mismatch','L16 hash mismatch');
yes(Object.isFrozen(un),'L17 unreadable frozen'); yes(Object.isFrozen(bi),'L17 builtin frozen');

// Serialize fixtures.
check(serializeCharter(mk({})),{ok:true,text:'{"createdAt":"","fences":{"maxSpendPerAction":0,"maxSpendPerDay":0,"neverTouch":[]},"lanes":{},"revision":1,"signature":null,"signedAt":null,"version":1}'},'S01');
check(serializeCharter(mk({tools:{'tools.x':'ask'}})),{ok:true,text:'{"createdAt":"","fences":{"maxSpendPerAction":0,"maxSpendPerDay":0,"neverTouch":[]},"lanes":{"tools":{"actions":{"tools.x":{"level":"ask","reason":"r"}},"id":"tools","name":"tools"}},"revision":1,"signature":null,"signedAt":null,"version":1}'},'S02');
check(serializeCharter(42),{ok:false,error:'invalid-charter',message:'Charter must be a plain object.'},'S03');
const errOf=(r:ReturnType<typeof serializeCharter>)=>r.ok?undefined:r.error;
const circular:any=mk({});circular.self=circular;check(errOf(serializeCharter(circular)),'circular-input','S04');
check(errOf(serializeCharter(maybe)),'unknown-level','S05');
const reverse={...A,lanes:Object.fromEntries(Object.entries(A.lanes).reverse())};
check(ser(reverse),ser(A),'S06 sorted lanes');
const defaultText=ser(defaultCharter());
check(loadCharterText({kind:'text',text:defaultText},sha).reason,'unsigned','S07 default unsigned');
check(ser(JSON.parse(defaultText)),defaultText,'S07 stable JSON');
for(const c of [A,B,O]){const r=loadCharterText({kind:'text',text:ser(c)},sha);check(r.status,'signed','S08 round trip status');check(ser(r.charter!),ser(c),'S08 round trip content');}

// V01-V21 exact expected values.
const vRows:[string,CharterLoad,string[],any[],unknown][]=[
 ['V01',bi,T,[],expected([],[],'built-in')],
 ['V02',bi,[],[],expected([],[],'built-in')],
 ['V03',sg(A),T,[],expected(['sort-lines'],['counter'],'signed')],
 ['V04',sg(A),[...T].reverse(),[],expected(['sort-lines'],['counter'],'signed')],
 ['V05',sg(A),T,[{tool:'noter',actions:['email.send']}],expected(['sort-lines'],['counter','noter'],'signed')],
 ['V06',bi,T,[{tool:'noter',actions:['email.send']}],expected([],['noter'],'built-in')],
 ['V07',bi,T,[{tool:'calc',actions:['money.pay']}],expected(['calc'],[],'built-in')],
 ['V08',bi,T,[{tool:'counter',actions:['email.read']}],expected([],[],'built-in')],
 ['V09',bi,T,[{tool:'noter',actions:['email.send','money.pay']}],expected(['noter'],[],'built-in')],
 ['V10',bi,T,[{tool:'noter',actions:['nope.verb']}],expected([],['noter'],'built-in')],
 ['V11',sg(B),T,[],expected([],['calc'],'signed')],
 ['V12',sg(B),T,[{tool:'calc',actions:['money.pay']}],expected(['calc'],[],'signed')],
 ['V13',sg(A),['sort-lines'],[{tool:'sort-lines',actions:['email.read']}],expected(['sort-lines'],[],'signed')],
 ['V14',sg(O),T,[{tool:'counter',actions:['a.b.c']}],expected(['counter'],[],'signed')],
 ['V15',un,T,[],expected([],T,'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)],
 ['V16',un,[],[],expected([],[],'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)],
 ['V17',un,T,[{tool:'calc',actions:['money.pay']}],expected([],T,'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)],
 ['V18',{status:'signed',reason:'trusted',charter:maybe},T,[],expected([],T,'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)],
 ['V19',{status:'built-in',reason:'no-stored-charter',charter:42 as any},T,[],expected([],T,'charter-untrusted',CHARTER_UNTRUSTED_NOTICE)],
 ['V20',sg(sign(mk({tools:{'tools.a.b':'never'}}))),['a.b','a'],[],expected(['a.b'],[],'signed')],
 ['V21',sg(sign(mk({tools:{'tools.counter':'allowed','tools.calc':'allowed'}}))),T,[],expected([],[],'signed')]
];
for(const [id,load,ids,links,want] of vRows){const r=view(load,ids,links);yes(r.ok,`${id} ok`);if(r.ok)check(r.value,want,id);}

// E01-E26 ordered failures and exact common message.
const okArgs:any={load:bi,toolIds:['a','b'],links:[]};
const badArgs=[
 [null,'bad-input'],[[],'bad-input'],[7,'bad-input'],
 [{...okArgs,x:1},'unknown-key'],[{...okArgs,[Symbol('s')]:1},'unknown-key'],[{load:bi,toolIds:['a','b']},'unknown-key'],
 [{...okArgs,load:{status:'x'}},'bad-load'],
 [{...okArgs,load:{status:'untrusted',reason:'x',charter:42}},'bad-load'],
 [{...okArgs,load:{status:'signed',reason:'x',charter:A}},'bad-load'],
 [{...okArgs,load:{status:'built-in',reason:'no-stored-charter'}},'bad-load'],
 [{...okArgs,load:{status:'untrusted',reason:'',charter:null}},'bad-load'],
 [{...okArgs,toolIds:['a','a']},'bad-tool-ids'],[{...okArgs,toolIds:['']},'bad-tool-ids'],[{...okArgs,toolIds:'a'},'bad-tool-ids'],[{...okArgs,toolIds:[1]},'bad-tool-ids'],
 [{...okArgs,links:[{tool:'a',actions:[],extra:1}]},'bad-links'],[{...okArgs,links:[{tool:'a',actions:[]},{tool:'a',actions:[]}]},'bad-links'],[{...okArgs,links:[{tool:'a',actions:['x','x']}]},'bad-links'],[{...okArgs,links:{}},'bad-links'],[{...okArgs,links:[{tool:'a',actions:['']}]},'bad-links'],
 [{...okArgs,links:[{tool:'zz',actions:[]}]},'unknown-link-tool'],
 [{...okArgs,load:{status:'x'},toolIds:['a','a'],links:7},'bad-load'],
 [{...okArgs,toolIds:['a','a'],links:7},'bad-tool-ids'],
 [{...okArgs,links:[{tool:'zz',actions:[1]}]},'bad-links'],
 [{...okArgs,load:un,links:[{tool:'zz',actions:[]}]},'unknown-link-tool']
] as const;
for(let i=0;i<badArgs.length;i++){const [arg,error]=badArgs[i];const r=charterToFeedView(arg as any);check(r,{ok:false,error,message:'Charter view input is invalid.'},`E${String(i+1).padStart(2,'0')}`);}
const symLink:any={tool:'a',actions:[]};symLink[Symbol('x')]=1;
check(charterToFeedView({...okArgs,links:[symLink]}),{ok:false,error:'bad-links',message:'Charter view input is invalid.'},'symbol inside link');
const symArgs:any={...okArgs};symArgs[Symbol('x')]=1;
check(charterToFeedView(symArgs),{ok:false,error:'unknown-key',message:'Charter view input is invalid.'},'symbol args key');
yes(Object.isFrozen(charterToFeedView(null as any)),'E26 frozen error');

// Sweep oracle: every single tool target and action across four loads.
const actions=['email.send','email.read','money.pay','system.edit-charter','nope.verb','a.b.c','files.write','web.fetch'];
const sweepLoads:[string,CharterLoad][]=[['bi',bi],['sgA',sg(A)],['sgB',sg(B)],['sgO',sg(O)]];
const oracle=(load:CharterLoad,tool:string,action:string):'never'|'ask'|'allowed'=>{
 if(load.status==='untrusted')return 'ask';
 const valid=validateCharter(load.charter);if(!valid.ok)return 'ask';
 let level: 'never'|'ask'|'allowed'='allowed';
 const ids=[`tools.${tool}`,action];
 for(const id of ids){let found=false;for(const lane of Object.values(valid.value.lanes)){const r=lane.actions[id];if(r){found=true;if(r.level==='never')level='never';else if(r.level==='ask'&&level!=='never')level='ask';}}
 if(id===action&&!found&&level!=='never')level='ask';
 }
 return level;
};
for(const [ln,load] of sweepLoads)for(const tool of T)for(const action of actions){
 const r=view(load,[tool],[{tool,actions:[action]}]);yes(r.ok,`sweep ${ln}/${tool}/${action}`);
 const level=oracle(load,tool,action);
 const want=expected(level==='never'?[tool]:[],level==='ask'?[tool]:[],load.status==='built-in'?'built-in':load.status==='signed'?'signed':'charter-untrusted',load.status==='untrusted'?CHARTER_UNTRUSTED_NOTICE:'');
 if(r.ok)check(r.value,want,`oracle ${ln}/${tool}/${action}`);
}

// Properties, ordering, disjointness, fail-closed, monotonicity, frozen outputs, input immutability.
for(const [id,load,ids,links] of vRows){
 const before=JSON.stringify({load,ids,links});
 const r=view(load,ids,links);yes(r.ok,`properties ${id}`);
 if(r.ok){
  const n=r.value.never as readonly string[],a=r.value.ask as readonly string[];
  no(n.some(x=>a.includes(x)),`disjoint ${id}`);
  yes(n.every(x=>ids.includes(x))&&a.every(x=>ids.includes(x)),`subset ${id}`);
  check([...n],[...ids.filter(x=>n.includes(x))],`never order ${id}`);
  check([...a],[...ids.filter(x=>a.includes(x))],`ask order ${id}`);
  if(load.status==='untrusted')check(a,ids,`untrusted all ask ${id}`);
  yes(Object.isFrozen(r),'result frozen');yes(Object.isFrozen(r.value),'value frozen');yes(Object.isFrozen(n),'never frozen');yes(Object.isFrozen(a),'ask frozen');
 }
 check(JSON.stringify({load,ids,links}),before,`inputs unchanged ${id}`);
}
for(const load of [bi,sg(A),sg(B),sg(O)])for(const tool of T)for(const action of actions){
 const base=view(load,[tool],[]);const linked=view(load,[tool],[{tool,actions:[action]}]);
 yes(base.ok&&linked.ok,'monotonic calls');
 if(base.ok&&linked.ok){const rank=(v:unknown)=>v==='never'?0:v==='ask'?1:2;const level=(v:any)=>v.never.includes(tool)?'never':v.ask.includes(tool)?'ask':'allowed';yes(rank(level(linked.value))<=rank(level(base.value)),`links do not loosen ${tool}/${action}`);}
}
console.log(`CHARTER_VIEW OK: ${checks} checks`);
