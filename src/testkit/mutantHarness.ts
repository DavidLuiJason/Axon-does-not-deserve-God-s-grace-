type EngineSuccess<T>={readonly ok:true;readonly value:T}; type EngineFailure={readonly ok:false;readonly error:string;readonly message:string}; type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type Fn=(input:unknown)=>unknown;
export type Mutant={id:string;fn:Fn};
export type TestCase={id:string;input:unknown;expected:unknown};
export type Caught={mutantId:string;caughtBy:string;how:'wrong-answer'|'threw'};
export type MutantResult={caught:readonly Caught[];survived:readonly string[];caughtCount:number;total:number};
export type DiffResult={agree:number;differ:readonly {index:number;a:unknown;b:unknown}[]};
const mhFail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
const mhOk=<T>(value:T):EngineResult<T>=>Object.freeze({ok:true,value});
export function deepEqual(a:unknown,b:unknown):boolean{
 if(Object.is(a,b))return true;
 if(Array.isArray(a)||Array.isArray(b)){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(!deepEqual(a[i],b[i]))return false;
  return true;
 }
 if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){
  const pa=Object.getPrototypeOf(a),pb=Object.getPrototypeOf(b);
  if((pa!==Object.prototype&&pa!==null)||(pb!==Object.prototype&&pb!==null))return false;
  const ak=Object.keys(a as object).sort(),bk=Object.keys(b as object).sort();
  if(ak.length!==bk.length)return false;
  for(let i=0;i<ak.length;i++)if(ak[i]!==bk[i]||!deepEqual((a as Record<string,unknown>)[ak[i]],(b as Record<string,unknown>)[bk[i]]))return false;
  return true;
 }
 return false;
}
export function runMutants(original:Fn,mutants:readonly Mutant[],cases:readonly TestCase[]):EngineResult<MutantResult>{
 if(!Array.isArray(mutants)||!Array.isArray(cases)||mutants.length===0||cases.length===0)return mhFail('empty-list','mutants and cases must both be non-empty');
 const mid=new Set<string>(),cid=new Set<string>();
 for(const m of mutants){if(!m||typeof m.id!=='string'||m.id.trim()===''||typeof m.fn!=='function')return mhFail('bad-input','invalid mutant');if(mid.has(m.id))return mhFail('duplicate-id',`duplicate mutant id: ${m.id}`);mid.add(m.id);}
 for(const c of cases){if(!c||typeof c.id!=='string'||c.id.trim()==='')return mhFail('bad-input','invalid case');if(cid.has(c.id))return mhFail('duplicate-id',`duplicate case id: ${c.id}`);cid.add(c.id);}
 if(typeof original!=='function')return mhFail('bad-input','original must be a function');
 const originals:unknown[]=[];const failed:string[]=[];
 for(const c of cases){
  try{const value=original(c.input);originals.push(value);if(!deepEqual(value,c.expected))failed.push(c.id);}
  catch{originals.push({threw:true});failed.push(c.id);}
 }
 if(failed.length)return mhFail('original-fails',`original failed cases: ${failed.join(', ')}`);
 const caught:Caught[]=[],survived:string[]=[];
 for(const m of mutants){
  let hit:Caught|undefined;
  for(const c of cases){
   try{const value=m.fn(c.input);if(!deepEqual(value,c.expected)){hit=Object.freeze({mutantId:m.id,caughtBy:c.id,how:'wrong-answer'});break;}}
   catch{hit=Object.freeze({mutantId:m.id,caughtBy:c.id,how:'threw'});break;}
  }
  if(hit)caught.push(hit);else survived.push(m.id);
 }
 return mhOk(Object.freeze({caught:Object.freeze(caught),survived:Object.freeze(survived),caughtCount:caught.length,total:mutants.length}));
}
export function differential(a:Fn,b:Fn,inputs:readonly unknown[]):EngineResult<DiffResult>{
 if(typeof a!=='function'||typeof b!=='function'||!Array.isArray(inputs))return mhFail('bad-input','functions and inputs are required');
 let agree=0;const differ:{index:number;a:unknown;b:unknown}[]=[];
 for(let i=0;i<inputs.length;i++){
  let av:unknown,bv:unknown,at=false,bt=false;
  try{av=a(inputs[i]);}catch{at=true;av=Object.freeze({threw:true});}
  try{bv=b(inputs[i]);}catch{bt=true;bv=Object.freeze({threw:true});}
  if(at===bt&&(at||deepEqual(av,bv)))agree++;
  else differ.push(Object.freeze({index:i,a:at?Object.freeze({threw:true}):av,b:bt?Object.freeze({threw:true}):bv}));
 }
 return mhOk(Object.freeze({agree,differ:Object.freeze(differ)}));
}
