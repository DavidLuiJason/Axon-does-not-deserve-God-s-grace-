import assert from 'node:assert/strict';
import { createToolStore, TOOL_STORE_LIMITS, TOOL_STORE_SCHEMA_VERSION, type ToolStoreStorage } from '../src/tools/shared/toolStore.ts';
let checks=0; function check(a:unknown,e:unknown,label:string){assert.deepEqual(a,e,label);checks++;}
function fake(initial: string|null=null, mode: {read?:boolean;write?:boolean;remove?:boolean}={}) { let raw=initial; const storage:ToolStoreStorage={getItem(){if(mode.read)throw Error('read');return raw;},setItem(_k,v){if(mode.write)throw Error('write');raw=v;},removeItem(){if(mode.remove)throw Error('remove');raw=null;}}; return {storage,raw:()=>raw}; }
const f=fake(); const s=createToolStore('timer',f.storage); check(s.key,'axon.tool.timer.v1','namespaced key'); check(s.status().ok,true,'empty store'); check(s.set('elapsed',{ms:120}),{ok:true},'set object'); check(s.get('elapsed'),{ok:true,value:{ms:120}},'get object'); const exported=s.exportData(); assert.equal(exported.ok,true); if(exported.ok){const parsed=JSON.parse(exported.text);check(parsed.schemaVersion,TOOL_STORE_SCHEMA_VERSION,'schema version');check(parsed.values.elapsed,{ms:120},'export values');}checks++;
check(s.set('__proto__','safe'),{ok:true},'prototype key is data'); check(s.get('__proto__'),{ok:true,value:'safe'},'prototype key round trip'); check(s.remove('elapsed'),{ok:true},'remove key'); check(s.get('elapsed'),{ok:true,value:null},'missing key');
check(s.set('',1).ok,false,'empty key rejected'); check(s.set('x',undefined).ok,false,'undefined rejected'); const circular:Record<string,unknown>={};circular.self=circular;check(s.set('cycle',circular).ok,false,'circular rejected'); check(s.set('large','x'.repeat(TOOL_STORE_LIMITS.bytesPerTool+1)).ok,false,'oversize value rejected'); check(s.set('a','x'.repeat(TOOL_STORE_LIMITS.bytesPerTool-10)).ok,false,'total store cap enforced');
const corrupt=fake('{'); const bad=createToolStore('bad',corrupt.storage); check(bad.status().ok,false,'corrupt JSON surfaced'); check(bad.set('x',1).ok,false,'corrupt store not overwritten');
const newer=fake(JSON.stringify({schemaVersion:TOOL_STORE_SCHEMA_VERSION+1,values:{x:1}})); const future=createToolStore('future',newer.storage); check(future.status().ok,false,'newer schema surfaced'); check(future.set('x',2).ok,false,'newer schema not overwritten');
const wrong=fake(JSON.stringify({schemaVersion:1,values:[]}));check(createToolStore('wrong',wrong.storage).status().ok,false,'invalid structure rejected');
const read=fake(null,{read:true});check(createToolStore('read',read.storage).status().ok,false,'read exception surfaced'); const write=fake(null,{write:true}); const w=createToolStore('write',write.storage);check(w.set('x',1),{ok:false,error:'storage-write-failed',message:'Data could not be saved; the in-memory value was not changed.'},'write exception surfaced');check(w.get('x'),{ok:true,value:null},'failed write not applied in memory');
const remove=fake(null,{remove:true});check(createToolStore('remove',remove.storage).eraseAll().ok,false,'remove exception surfaced');check(createToolStore('../bad').status().ok,false,'invalid id rejected'); check(createToolStore('../bad').eraseAll().ok,false,'invalid id cannot erase'); const tooLarge=fake(' '.repeat(TOOL_STORE_LIMITS.bytesPerTool+1));check(createToolStore('huge',tooLarge.storage).status().ok,false,'oversized persisted data blocked');
const erase=fake('{');check(createToolStore('erase',erase.storage).eraseAll().ok,false,'corrupt data not erased implicitly');
const memory=createToolStore('memory');check(memory.set('count',0),{ok:true},'default memory storage');check(memory.get('count'),{ok:true,value:0},'zero retained');check(memory.set('unicode','עברית🙂'),{ok:true},'unicode stored');check(memory.get('unicode'),{ok:true,value:'עברית🙂'},'unicode round trip');check(memory.eraseAll(),{ok:true},'erase valid store');check(memory.get('count'),{ok:true,value:null},'erase clears data');

// Director addition: a corrupt, oversized or newer-schema store must be recoverable by an explicit forced erase, otherwise the tool stays broken for good.
{
 const mk=(initial:string|null)=>{const m=new Map<string,string>(); if(initial!==null) m.set('axon.tool.recover.v1',initial); return {m,storage:{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)},removeItem:(k:string)=>{m.delete(k)}}};};
 for (const bad of ['{', JSON.stringify({schemaVersion:99,values:{}}), JSON.stringify({schemaVersion:1,values:[]}), ' '.repeat(TOOL_STORE_LIMITS.bytesPerTool+1)]) {
  const f=mk(bad); const s=createToolStore('recover',f.storage);
  check(s.status().ok,false,'blocked store reports its problem'); check(s.set('a',1).ok,false,'blocked store refuses writes');
  check(s.eraseAll().ok,false,'plain erase still refuses unreadable data'); check(f.m.get('axon.tool.recover.v1'),bad,'unreadable data untouched');
  check(s.eraseAll({force:true}),{ok:true},'forced erase recovers'); check(f.m.has('axon.tool.recover.v1'),false,'forced erase removed the data');
  check(s.set('a',1),{ok:true},'store works again after recovery'); check(createToolStore('recover',f.storage).get('a'),{ok:true,value:1},'recovered value persists');
 }
}
console.log(`toolStore: ${checks} checks passed`);
