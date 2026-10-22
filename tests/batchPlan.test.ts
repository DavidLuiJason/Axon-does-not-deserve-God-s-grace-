import assert from 'node:assert/strict';
import { planBatch, createBatchRun, batchReport, zipEntries, BATCH_LIMITS, BATCH_CONVERT_DESCRIPTOR } from '../src/tools/engines/files/batchPlan';
const enc = (s: string) => new TextEncoder().encode(s);
const f = (name: string, content: string, size = enc(content).length) => ({ name, head: enc(content), size });
const files = [f('same.json','{"a":1}'), f('SAME.json','{"b":2}'), f('out.yaml','a: 1'), f('bad.pdf','%PDF-1.7')];
const p = planBatch(files, 'yaml'); assert.equal(p.ok, true); assert.equal(BATCH_CONVERT_DESCRIPTOR.toolId, 'batch-convert');
if (!p.ok) throw new Error(p.message);
assert.equal(p.items.length, 4); assert.equal(p.items.filter(x => x.status === 'ready').length, 2); assert.equal(p.items.filter(x => x.status === 'skipped').length, 2);
assert.equal(new Set(p.items.map(x => x.outputName.toLocaleLowerCase('en-US'))).size, p.items.length);
assert.ok(!files.some(x => x.name.toLocaleLowerCase('en-US') === p.items[0].outputName.toLocaleLowerCase('en-US')));
assert.equal((planBatch(Array.from({length:BATCH_LIMITS.maxFiles+1},(_,i)=>f(`${i}.json`,'{}')), 'yaml') as any).error, 'too-many-files');
assert.equal((planBatch([f('huge.json','{}',BATCH_LIMITS.maxTotalBytes+1)], 'yaml') as any).error, 'too-large');
const runResult = createBatchRun(p, { maxHeldBytes: 2 }); assert.ok(!('error' in runResult));
if (!('error' in runResult)) {
 const run = runResult;
 assert.equal(run.snapshot().state, 'idle'); const one = run.next(); assert.ok(one); assert.equal(run.snapshot().remaining, 2);
 if (one) { assert.deepEqual(run.complete('missing',{ok:true}), {ok:false,error:'unknown-id',message:'Unknown batch item id: missing.'}); assert.equal(run.complete(one.id,{ok:true,bytes:new Uint8Array([1,2,3])}).ok, false); assert.equal(run.snapshot().done, 0); assert.equal(run.complete(one.id,{ok:true,bytes:new Uint8Array([1,2])}).ok, true); assert.equal(run.complete(one.id,{ok:true}).ok, false); }
 const held = run.drain(); assert.equal(held.length,1); assert.equal(held[0].bytes.length,2);
 const two = run.next(); assert.ok(two); if(two) assert.equal(run.complete(two.id,{ok:false,message:'bad conversion'}).ok,true);
 run.cancel(); assert.equal(run.next(),null); assert.equal(run.complete('file-4',{ok:true}).ok,false);
 const report = batchReport(run); assert.equal(report.rows.length,4); assert.ok(report.text.includes('failed'));
}
assert.equal((zipEntries([{name:'a.txt',bytes:enc('a')},{name:'A.TXT',bytes:enc('b') }]) as any).error, 'duplicate-name');
const z=zipEntries([{name:'a.txt',bytes:enc('a')}]); assert.equal(z.ok,true);
// Deterministic 2,000-operation walk: legal and illegal operations must preserve count invariants.
const many = planBatch(Array.from({length:20},(_,i)=>f(`item${i}.json`,`{"i":${i}}`)), 'yaml'); assert.equal(many.ok,true);
if(many.ok){ const rr=createBatchRun(many,{maxHeldBytes:100000}); if(!('error' in rr)){ const r=rr; let seed=0xC17; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;}; for(let i=0;i<2000;i++){const op=rand()%4; if(op===0){r.next();}else if(op===1){const id=`file-${(rand()%25)+1}`;r.complete(id,{ok:(rand()%2)===0,bytes:new Uint8Array(rand()%5)});}else if(op===2){r.drain();}else if((rand()%17)===0){r.cancel();} const s=r.snapshot(); assert.equal(s.done+s.failed+s.skipped+s.remaining,20); assert.ok(s.percent>=0&&s.percent<=100); } }}
console.log('batchPlan: 31 assertions plus 2,000 seeded operations passed');
