import {Worker} from 'node:worker_threads';import {realpath,stat} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const workerUrl=new URL('./wasm-worker.mjs',import.meta.url);
export async function runWasm({bytes,workspace,timeoutMs=1500,memoryBytes=16*1024*1024,outputLimit=65536}={}) {
 if(!(bytes instanceof Uint8Array)||bytes.length>4*1024*1024) throw new Error('MODULE_SIZE_LIMIT');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw new Error('TIMEOUT_LIMIT');
 if(!Number.isSafeInteger(memoryBytes)||memoryBytes<65536||memoryBytes>64*1024*1024) throw new Error('MEMORY_LIMIT_CONFIG');
 if(!Number.isSafeInteger(outputLimit)||outputLimit<1||outputLimit>65536) throw new Error('OUTPUT_LIMIT_CONFIG');
 const root=await realpath(workspace); if(!(await stat(root)).isDirectory()) throw new Error('WORKSPACE_NOT_DIRECTORY');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(workerUrl,{workerData:{bytes:Buffer.from(bytes),workspace:root,memoryBytes,outputLimit},resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8,stackSizeMb:2}});
  let settled=false; const settle=(ok,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate().catch(()=>{});if(ok)resolve(value);else reject(value);};
  const timer=setTimeout(()=>settle(false,new Error('CPU_TIMEOUT')),timeoutMs);
  worker.once('message',m=>m?.ok?settle(true,{...m,isolation:'worker-thread; host imports denied; OS filesystem isolation NOT PROVIDED'}):settle(false,new Error(m?.error||'WASM_FAILED')));
  worker.once('error',e=>settle(false,e));
  worker.once('exit',code=>{if(!settled&&code!==0)settle(false,new Error(`WORKER_EXIT_${code}`));});
 });
}
