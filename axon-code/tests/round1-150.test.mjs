import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeProject, analyzeSourceFile, applyPatch, chooseExecutionPlan, classifyResources,
  detectLanguage, normalizeProjectPath, planSelectiveExecution, proposeSafeFixes,
  RuntimeRegistry
} from '../dist/index.js';

const mem = (entries, overrides = {}) => {
  const files = new Map(Object.entries(entries));
  return {
    async listFiles() { return [...files].map(([path, content]) => ({ path, sizeBytes: Buffer.byteLength(content), kind: 'text' })); },
    async readTextFile(path, maxBytes) { const v = files.get(path); return v === undefined || Buffer.byteLength(v) > maxBytes ? null : v; },
    ...overrides
  };
};
const cases = [];
const add = (category, name, fn) => cases.push({ category, name, fn });

// 1–20: virtual path validation and normalization.
for (const [input, expected] of [
  ['src/main.ts','src/main.ts'], ['./src/main.ts','src/main.ts'], ['src//main.ts','src/main.ts'], ['src/./main.ts','src/main.ts'],
  ['a/b/c.js','a/b/c.js'], ['index.js','index.js'], ['assets/image.png','assets/image.png'], ['folder with spaces/a.ts','folder with spaces/a.ts'],
  ['../secret',null], ['a/../secret',null], ['/etc/passwd',null], ['C:/Windows/x',null], ['\\server\\share',null], ['a\\b',null],
  ['',null], ['.',null], ['a/../../b',null], ['a\0b',null], ['x'.repeat(256),null], ['a/'.repeat(130)+'b','a/'.repeat(130)+'b']
]) add('PATH', `normalize path ${JSON.stringify(input)}`, () => assert.equal(normalizeProjectPath(input), expected));

// 21–35: file-language recognition.
for (const [path, expected] of [
  ['a.js','javascript'],['a.mjs','javascript'],['a.cjs','javascript'],['a.jsx','javascript'],['a.ts','typescript'],['a.tsx','typescript'],
  ['a.mts','typescript'],['a.cts','typescript'],['a.json','json'],['a.css','css'],['a.html','html'],['a.htm','html'],['README.md','unknown'],['a.py','unknown'],['game.apk','unknown']
]) add('LANGUAGE', `detect ${path}`, () => assert.equal(detectLanguage(path), expected));

// 36–55: JSON parser diagnostics, valid and invalid documents.
const validJson = ['{}','[]','{"a":1}','{"a":[true,false,null]}',' {\n "x": "hello"\n}'];
validJson.forEach((s,i) => add('JSON', `valid JSON ${i+1}`, async () => assert.equal((await analyzeSourceFile('x.json',s,'json')).length,0)));
const invalidJson = ['{','[','{"a":}','{"a":1,}','{"a" 1}','{"a":"x}','[1,2,]','true false','undefined','{"a":NaN}','{"a":Infinity}','{a:1}','"unterminated','[1 2]','{"a":1 "b":2}'];
invalidJson.forEach((s,i) => add('JSON', `invalid JSON ${i+1}`, async () => {
  const d = await analyzeSourceFile('bad.json',s,'json');
  assert.ok(d.some(x=>x.code==='JSON_PARSE_ERROR'), `expected JSON_PARSE_ERROR for ${s}`);
  assert.ok(d[0].location.line>=1 && d[0].location.column>=1);
}));

// 56–75: structural scanner cases; known limitations are separately noted in the report.
const balanced = ['const x = 1;','function f(){ return [1,2]; }','if (a) { b(); }','const x = {a:[1]};','// }\nconst x = (1);','/* { */ let x = 1;','const s = "{";','const t = `hello { world`;','class A { method(){ return true; } }','export default function(){ return {}; }'];
balanced.forEach((s,i)=>add('SCANNER',`balanced source ${i+1}`,async()=>assert.equal((await analyzeSourceFile('x.js',s,'javascript')).filter(x=>x.code.includes('DELIMITER')).length,0)));
const broken = ['function f( {','const x = [1,2;','const x = {a:1;','foo(1,2;','if (x] {}','function f(){','const x = ;','const f = () => ;','const x = "unterminated','/* comment never closes'];
broken.forEach((s,i)=>add('SCANNER',`broken source ${i+1}`,async()=>{
  const d=await analyzeSourceFile('bad.js',s,'javascript');
  assert.ok(d.length>0,`expected at least one finding for ${s}`);
}));

// 76–85: basic HTML structure.
const htmlGood=['<div></div>','<main><p>Hello</p></main>','<img src="x">','<br>','<input disabled>'];
htmlGood.forEach((s,i)=>add('HTML',`balanced HTML ${i+1}`,async()=>assert.equal((await analyzeSourceFile('x.html',s,'html')).length,0)));
const htmlBad=['<div>','</div>','<div></span>','<main><p>x</main>','<section><b>'];
htmlBad.forEach((s,i)=>add('HTML',`unbalanced HTML ${i+1}`,async()=>assert.ok((await analyzeSourceFile('bad.html',s,'html')).length>0)));

// 86–100: project inventory, imports, bounded reads, diagnostics.
for(let i=0;i<4;i++) add('PROJECT',`entry point detection ${i+1}`,async()=>{
  const name=['main.js','index.ts','app.jsx','server.mjs','bootstrap.ts'][i];
  const a=await analyzeProject('p',mem({[name]:'export const ready = true;'}));
  assert.ok(a.outline.entryPoints.includes(name));
});
for(let i=0;i<5;i++) add('PROJECT',`local dependency resolution ${i+1}`,async()=>{
  const ext=['.js','.ts','.tsx','.json','.mjs'][i]; const imp=ext==='.json' ? "import data from './dep.json';" : "import { x } from './dep';";
  const content=ext==='.json'?'{}':'export const x = 1;';
  const a=await analyzeProject('p',mem({'src/main.js':imp,['src/dep'+ext]:content}));
  assert.equal(a.outline.localDependencies,1);
});
add('PROJECT','dynamic import is marked incomplete',async()=>{const a=await analyzeProject('p',mem({'main.js':"import('./'+name+'.js');"}));assert.equal(a.outline.dynamicImportPresent,true);assert.equal(a.outline.dependencyGraphComplete,false);});
add('PROJECT','missing local import is reported',async()=>{const a=await analyzeProject('p',mem({'main.js':"import './missing.js';"}));assert.ok(a.diagnostics.some(x=>x.code==='LOCAL_IMPORT_NOT_RESOLVED'));});
add('PROJECT','binary file is metadata-only',async()=>{const a=await analyzeProject('p',{async listFiles(){return [{path:'asset.png',sizeBytes:999,kind:'binary'}]},async readTextFile(){throw Error('must not read binary')}});assert.equal(a.files[0].inspected,false);});
add('PROJECT','per-file byte cap is enforced',async()=>{const a=await analyzeProject('p',mem({'main.js':'x'.repeat(100)}),{limits:{maxFileBytes:20}});assert.ok(a.diagnostics.some(x=>x.code==='FILE_TOO_LARGE_TO_INSPECT'));assert.equal(a.files[0].inspected,false);});
add('PROJECT','file-count cap is enforced',async()=>{const a=await analyzeProject('p',mem({'a.js':'','b.js':'','c.js':''}),{limits:{maxFiles:2}});assert.ok(a.diagnostics.some(x=>x.code==='FILE_LIMIT_REACHED'));assert.equal(a.files.length,2);});
add('PROJECT','provider read failure is reported',async()=>{const a=await analyzeProject('p',{async listFiles(){return [{path:'a.js',sizeBytes:2,kind:'text'}]},async readTextFile(){return null}});assert.ok(a.diagnostics.some(x=>x.code==='FILE_READ_FAILED'));});
add('PROJECT','external dependency names are collected',async()=>{const a=await analyzeProject('p',mem({'main.js':"import x from 'react'; import y from '@scope/pkg/sub';"}));assert.deepEqual(a.outline.externalDependencies,['@scope/pkg','react']);});

// 101–110: selective execution safety and dependency closure.
add('SELECTIVE','missing entry is rejected',async()=>{const a=await analyzeProject('p',mem({'main.js':'1'}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['missing.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.equal(p.status,'INVALID_COMPONENT');});
add('SELECTIVE','side effects prevent isolation',async()=>{const a=await analyzeProject('p',mem({'main.js':'1','other.js':'2'}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['main.js'],sideEffectFree:false,dynamicDependenciesDeclared:true});assert.equal(p.canRunInIsolation,false);});
add('SELECTIVE','undeclared dynamic imports prevent isolation',async()=>{const a=await analyzeProject('p',mem({'main.js':"import(path);"}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:false});assert.equal(p.canRunInIsolation,false);});
add('SELECTIVE','transitive dependencies are included',async()=>{const a=await analyzeProject('p',mem({'main.js':"import './a.js';",'a.js':"import './b.js';",'b.js':'export const b=1;','other.js':'1'}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.deepEqual(p.selectedFiles,['a.js','b.js','main.js']);});
add('SELECTIVE','cycles terminate safely',async()=>{const a=await analyzeProject('p',mem({'a.js':"import './b.js';",'b.js':"import './a.js';"}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['a.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.equal(p.selectedFiles.length,2);});
add('SELECTIVE','unresolved dependency prevents isolation',async()=>{const a=await analyzeProject('p',mem({'main.js':"import './gone.js';"}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.equal(p.canRunInIsolation,false);});
add('SELECTIVE','uninspected dependency prevents isolation',async()=>{const a=await analyzeProject('p',mem({'main.js':"import './big.js';",'big.js':'x'.repeat(100)}),{limits:{maxFileBytes:10}});const p=planSelectiveExecution(a,{id:'x',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.equal(p.canRunInIsolation,false);});
add('SELECTIVE','unrelated file may be omitted only with complete graph',async()=>{const a=await analyzeProject('p',mem({'main.js':'export const x=1;','other.js':'export const y=2;'}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.deepEqual(p.omittedFiles,['other.js']);});
add('SELECTIVE','empty component id rejected',async()=>{const a=await analyzeProject('p',mem({'main.js':'1'}));const p=planSelectiveExecution(a,{id:'',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.equal(p.status,'INVALID_COMPONENT');});
add('SELECTIVE','all entry files included',async()=>{const a=await analyzeProject('p',mem({'a.js':'1','b.js':'2'}));const p=planSelectiveExecution(a,{id:'x',entryFiles:['a.js','b.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.deepEqual(p.selectedFiles,['a.js','b.js']);});

// 111–125: resource classification and execution plan boundaries.
const rt={id:'js',label:'JS',languages:['javascript'],platforms:['web'],available:true,supportsStreaming:true,supportsCheckpoint:false,isolation:'worker'};
const workload=(over={})=>({runtimeId:'js',estimatedPeakRamBytes:100,requiredStorageBytes:10,...over});
const device=(over={})=>({availableRamBytes:200,availableStorageBytes:20,networkAllowed:false,gpuAvailable:true,...over});
add('RESOURCE','sufficient resources select full local',()=>assert.equal(chooseExecutionPlan(workload(),device(),[rt]).mode,'FULL_LOCAL'));
add('RESOURCE','insufficient storage waits',()=>assert.equal(chooseExecutionPlan(workload(),device({availableStorageBytes:1}),[rt]).mode,'WAIT_FOR_RESOURCES'));
add('RESOURCE','streaming strategy selected when supported',()=>assert.equal(chooseExecutionPlan(workload({estimatedPeakRamBytes:500,canStreamAssets:true,streamingWorkingSetBytes:80}),device({availableRamBytes:100}),[rt]).mode,'STREAMED_LOCAL'));
add('RESOURCE','streaming not selected if runtime lacks support',()=>assert.equal(chooseExecutionPlan(workload({estimatedPeakRamBytes:500,canStreamAssets:true,streamingWorkingSetBytes:80}),device({availableRamBytes:100}),[{...rt,supportsStreaming:false}]).mode,'WAIT_FOR_RESOURCES'));
add('RESOURCE','chunking selected for declared independent work',()=>assert.equal(chooseExecutionPlan(workload({estimatedPeakRamBytes:500,canChunkIndependentWork:true,chunkWorkingSetBytes:80}),device({availableRamBytes:100}),[rt]).mode,'CHUNKED_LOCAL'));
add('RESOURCE','reduced quality is explicitly labelled',()=>{const p=chooseExecutionPlan(workload({estimatedPeakRamBytes:500,reducedQuality:{label:'low',estimatedPeakRamBytes:70,qualityChanges:['lower textures']}}),device({availableRamBytes:100}),[rt]);assert.equal(p.mode,'REDUCED_QUALITY_LOCAL');assert.deepEqual(p.qualityChanges,['lower textures']);});
add('RESOURCE','no matching runtime is unsupported',()=>assert.equal(chooseExecutionPlan(workload({runtimeId:'missing'}),device(),[rt]).mode,'UNSUPPORTED'));
add('RESOURCE','remote fallback requires network permission',()=>{const p=chooseExecutionPlan(workload({estimatedPeakRamBytes:500,remoteRuntimeId:'remote'}),device({availableRamBytes:1,networkAllowed:false}),[rt,{...rt,id:'remote',isolation:'remote'}]);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
add('RESOURCE','remote fallback used when permitted',()=>{const p=chooseExecutionPlan(workload({estimatedPeakRamBytes:500,remoteRuntimeId:'remote'}),device({availableRamBytes:1,networkAllowed:true}),[rt,{...rt,id:'remote',isolation:'remote'}]);assert.equal(p.mode,'REMOTE_REQUIRED');});
add('RESOURCE','GPU requirement blocks without GPU',()=>{const p=chooseExecutionPlan(workload({gpuRequired:true}),device({gpuAvailable:false}),[rt]);assert.equal(p.canStart,false);});
add('RESOURCE','NaN memory classified unknown',()=>assert.equal(classifyResources({timestamp:1,resources:device({availableRamBytes:NaN})},1,1),'UNKNOWN'));
add('RESOURCE','hot thermal state takes priority',()=>assert.equal(classifyResources({timestamp:1,resources:device({thermalState:'hot',availableStorageBytes:0,availableRamBytes:0})},100,100),'THERMAL_PRESSURE'));
add('RESOURCE','low storage identified',()=>assert.equal(classifyResources({timestamp:1,resources:device({availableStorageBytes:1})},1,10),'LOW_STORAGE'));
add('RESOURCE','low memory identified',()=>assert.equal(classifyResources({timestamp:1,resources:device({availableRamBytes:1})},10,1),'LOW_MEMORY'));
add('RESOURCE','healthy sample classified ready',()=>assert.equal(classifyResources({timestamp:1,resources:device()},100,10),'READY'));

// 126–135: auto-fix safety and patch integrity.
add('AUTOFIX','OFF emits no patch',()=>assert.equal(proposeSafeFixes('a.js','x','OFF').patches.length,0));
add('AUTOFIX','SUGGEST offers final newline',()=>assert.equal(proposeSafeFixes('a.js','x','SUGGEST').patches[0].newText,'\n'));
add('AUTOFIX','SAFE_AUTO_FIX does not mutate',()=>assert.equal(proposeSafeFixes('a.js','x','SAFE_AUTO_FIX').applied,false));
add('AUTOFIX','empty file is not patched',()=>assert.equal(proposeSafeFixes('a.js','','SUGGEST').patches.length,0));
add('AUTOFIX','existing LF is not patched',()=>assert.equal(proposeSafeFixes('a.js','x\n','SUGGEST').patches.length,0));
add('AUTOFIX','existing CR is not patched',()=>assert.equal(proposeSafeFixes('a.js','x\r','SUGGEST').patches.length,0));
add('AUTOFIX','patch applies at end',()=>{const p=proposeSafeFixes('a.js','x','SUGGEST').patches[0];assert.equal(applyPatch('x',p),'x\n');});
add('AUTOFIX','stale patch rejected',()=>{const p=proposeSafeFixes('a.js','x','SUGGEST').patches[0];assert.throws(()=>applyPatch('y',p),/base does not match/);});
add('AUTOFIX','out-of-range patch rejected',()=>assert.throws(()=>applyPatch('x',{startOffset:3,endOffset:3,oldText:'',newText:'y'}),/range is invalid/));
add('AUTOFIX','patch cannot replace wrong source segment',()=>assert.throws(()=>applyPatch('abc',{startOffset:1,endOffset:2,oldText:'x',newText:'y'}),/base does not match/));

// 136–150: runtime registry contracts.
for(let i=0;i<5;i++) add('RUNTIME',`register and retrieve runtime ${i+1}`,()=>{const r=new RuntimeRegistry();const a={descriptor:{...rt,id:`r${i}`},canHandle:()=>true,execute:async()=>({})};r.register(a);assert.equal(r.get(`r${i}`),a);});
add('RUNTIME','duplicate runtime id rejected',()=>{const r=new RuntimeRegistry();const a={descriptor:rt,canHandle:()=>true,execute:async()=>({})};r.register(a);assert.throws(()=>r.register(a),/already registered/);});
add('RUNTIME','blank runtime id rejected',()=>{const r=new RuntimeRegistry();assert.throws(()=>r.register({descriptor:{...rt,id:'  '},canHandle:()=>true,execute:async()=>({})}),/required/);});
add('RUNTIME','unavailable runtime does not resolve',()=>{const r=new RuntimeRegistry();const a={descriptor:{...rt,available:false},canHandle:()=>true,execute:async()=>({})};r.register(a);assert.equal(r.resolve({runtimeId:'js'}),undefined);});
add('RUNTIME','canHandle false prevents resolution',()=>{const r=new RuntimeRegistry();const a={descriptor:rt,canHandle:()=>false,execute:async()=>({})};r.register(a);assert.equal(r.resolve({runtimeId:'js'}),undefined);});
add('RUNTIME','list returns descriptor copy',()=>{const r=new RuntimeRegistry();r.register({descriptor:rt,canHandle:()=>true,execute:async()=>({})});const l=r.list();l[0].languages.push('python');assert.equal(r.list()[0].languages.includes('python'),false);});
add('RUNTIME','missing runtime returns undefined',()=>assert.equal(new RuntimeRegistry().get('missing'),undefined));
add('RUNTIME','registry lists registered adapters',()=>{const r=new RuntimeRegistry();r.register({descriptor:rt,canHandle:()=>true,execute:async()=>({})});assert.equal(r.list().length,1);});
add('RUNTIME','resolve does not execute adapter',()=>{let called=false;const r=new RuntimeRegistry();r.register({descriptor:rt,canHandle:()=>true,execute:async()=>{called=true;return {}}});r.resolve({runtimeId:'js'});assert.equal(called,false);});
add('RUNTIME','descriptor platform metadata preserved',()=>{const r=new RuntimeRegistry();r.register({descriptor:rt,canHandle:()=>true,execute:async()=>({})});assert.deepEqual(r.list()[0].platforms,['web']);});

if (cases.length !== 150) { const counts = Object.groupBy(cases, x => x.category); throw new Error(`Expected 150 tests, assembled ${cases.length}: ${Object.entries(counts).map(([k,v])=>k+'='+v.length).join(', ')}`); }
for (const [index, item] of cases.entries()) {
  test(`R1-${String(index+1).padStart(3,'0')} [${item.category}] ${item.name}`, item.fn);
}
