import {parentPort,workerData} from 'node:worker_threads';
import {WASI} from 'node:wasi';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
function uleb(b,s){let n=0,shift=0,v;do{if(s.i>=b.length)throw new Error('MALFORMED_WASM');v=b[s.i++];n|=(v&127)<<shift;shift+=7;if(shift>35)throw new Error('MALFORMED_WASM');}while(v&128);return n>>>0;}
function enforceMemoryMaximum(bytes,limit){if(bytes.length<8)throw new Error('MALFORMED_WASM');const s={i:8};while(s.i<bytes.length){const id=bytes[s.i++],size=uleb(bytes,s),end=s.i+size;if(end>bytes.length)throw new Error('MALFORMED_WASM');if(id===5){const count=uleb(bytes,s);for(let n=0;n<count;n++){const flags=uleb(bytes,s),min=uleb(bytes,s);if(!(flags&1))throw new Error('MEMORY_MAX_REQUIRED');const max=uleb(bytes,s);if(flags&2)throw new Error('SHARED_MEMORY_DENIED');if(min*65536>limit||max*65536>limit)throw new Error('MEMORY_LIMIT');}}s.i=end;}}
let tmp,fd;
try{
 enforceMemoryMaximum(workerData.bytes,workerData.memoryBytes);
 const module=await WebAssembly.compile(workerData.bytes);
 const imports=WebAssembly.Module.imports(module);
 const wasiImports=imports.some(x=>x.module==='wasi_snapshot_preview1');
 if(imports.some(x=>x.module!=='wasi_snapshot_preview1'))throw new Error('HOST_IMPORT_DENIED');
 let wasi,instance,output='';
 if(wasiImports){tmp=fs.mkdtempSync(path.join(os.tmpdir(),'axon-wasi-'));const outFile=path.join(tmp,'stdout.bin');fd=fs.openSync(outFile,'w+');wasi=new WASI({version:'preview1',args:[],env:{},preopens:{'/workspace':workerData.workspace},stdout:fd,stderr:fd});instance=await WebAssembly.instantiate(module,{wasi_snapshot_preview1:wasi.wasiImport});try{wasi.start(instance);}catch(e){if(e?.code!=='ERR_WASI_EXIT')throw e;}fs.closeSync(fd);fd=undefined;const out=fs.readFileSync(outFile);if(out.length>workerData.outputLimit)throw new Error('OUTPUT_LIMIT');output=out.toString('utf8');}
 else{if(imports.length)throw new Error('IMPORT_DENIED');instance=await WebAssembly.instantiate(module,{});const fn=instance.exports.run||instance.exports.main;if(typeof fn==='function')fn();}
 const memories=Object.values(instance.exports).filter(x=>x instanceof WebAssembly.Memory);const bytes=memories.reduce((n,m)=>n+m.buffer.byteLength,0);if(bytes>workerData.memoryBytes)throw new Error('MEMORY_LIMIT');
 parentPort.postMessage({ok:true,result:instance.exports.result?.value??null,output,memoryBytes:bytes});
}catch(e){if(fd!==undefined)try{fs.closeSync(fd);}catch{}parentPort.postMessage({ok:false,error:String(e?.message||e)});}
finally{if(tmp)try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
