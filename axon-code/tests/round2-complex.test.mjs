import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize, analyzeProject, analyzeSourceFile, chooseExecutionPlan, classifyResources, planSelectiveExecution, normalizeProjectPath, detectLanguage, DIAGNOSTIC_RENDER_PROFILES} from '../dist/index.js';
const MB=1024*1024, GB=1024*MB;
const runtimes=[{id:'js',label:'JS contract',languages:['javascript','typescript'],platforms:['android'],available:true,supportsStreaming:true,supportsCheckpoint:true,isolation:'worker'},{id:'web',label:'Web contract',languages:['html','css','javascript'],platforms:['android'],available:true,supportsStreaming:true,supportsCheckpoint:false,isolation:'process'},{id:'remote',label:'Remote contract',languages:['javascript'],platforms:['remote'],available:true,supportsStreaming:true,supportsCheckpoint:true,isolation:'remote'}];
const dev=(ram,extra={})=>({availableRamBytes:ram,availableStorageBytes:2*GB,networkAllowed:false,gpuAvailable:true,thermalState:'normal',...extra});
const wl=(o={})=>({runtimeId:'js',estimatedPeakRamBytes:512*MB,requiredStorageBytes:100*MB,...o});
const src=(files)=>({async listFiles(){return files.map(([path,text,kind='text'])=>({path,sizeBytes:Buffer.byteLength(text),kind}));},async readTextFile(path,max){const f=files.find(x=>x[0]===path);return !f||f[2]==='binary'?null:f[1].slice(0,max);}});
let count=0; const T=(name,fn)=>{count++;test(`R2-${String(count).padStart(3,'0')} ${name}`,fn);};

// 1–20: complex lexical/token invariants
const lex=[
'function f(){return [1,{x:(2)}];}','const x=1; // } ] )','/* { [ ( */ const x=1;',`const s="a\\\"b";`,"const s='hello';",'const t=`hello ${name}`;','const t=`one\ntwo`;','const café="naïve";','const $x=1;','let _x=2;','const n=1_000_000;','const n=0xFF;','const x=obj?.a?.b;','const x=a??b;','const x={...a};','const f=(x)=>x+1;','async function f(){await g();}','const x=1;\r\nconst y=2;',`const ${'a'.repeat(2000)}=1;`,Array.from({length:500},(_,i)=>`const v${i}=${i};`).join('\n')];
for(let i=0;i<lex.length;i++) T(`lexer complexity ${i+1}`,()=>{const r=tokenize(lex[i]);assert.ok(r.tokens.length>0);assert.deepEqual(r.issues,[]);for(const t of r.tokens){assert.ok(t.start>=0&&t.end>=t.start&&t.end<=lex[i].length);assert.ok(t.line>=1&&t.column>=1);}});

// 21–40: bounded multi-file project analysis
for(let i=0;i<10;i++) T(`project graph scale ${i+1}`,async()=>{const r=await analyzeProject('p',src([[`src/main${i}.js`,`import {f} from './lib${i}.js'; export const run=()=>f();`],[`src/lib${i}.js`,`export function f(){return ${i};}`],['assets/a.bin','bytes','binary']]));assert.equal(r.outline.files,3);assert.equal(r.outline.inspectedFiles,2);assert.equal(r.outline.localDependencies,1);assert.equal(r.outline.dependencyGraphComplete,true);});
const analyzerCases=[
['exact file limit', [['a.js','x'.repeat(32)]],{maxFileBytes:32,maxTotalReadBytes:32},r=>assert.equal(r.files[0].inspected,true)],
['over file limit',[['a.js','x'.repeat(33)]],{maxFileBytes:32,maxTotalReadBytes:100},r=>assert.ok(r.diagnostics.some(d=>d.code==='FILE_TOO_LARGE_TO_INSPECT'))],
['exact total budget',[['a.js','a'.repeat(20)],['b.js','b'.repeat(20)]],{maxFileBytes:30,maxTotalReadBytes:40},r=>assert.equal(r.scannedBytes,40)],
['total budget exceeded',[['a.js','a'.repeat(20)],['b.js','b'.repeat(21)]],{maxFileBytes:30,maxTotalReadBytes:40},r=>assert.equal(r.truncated,true)],
['file count cap',Array.from({length:6},(_,i)=>[`f${i}.js`,'x']),{maxFiles:5},r=>assert.equal(r.files.length,5)],
['unsafe traversal',[['../secret.js','x']],{},r=>assert.ok(r.diagnostics.some(d=>d.code==='UNSAFE_PROJECT_PATH'))],
['absolute path',[['/etc/passwd.js','x']],{},r=>assert.equal(r.files.length,0)],
['binary metadata',[['asset.js','ignored','binary']],{},r=>assert.equal(r.files[0].inspected,false)],
['unknown language',[['x.py','def f(:']],{},r=>assert.equal(r.files[0].language,'unknown')],
['zero files cap',[['a.js','x']],{maxFiles:0},r=>assert.equal(r.files.length,0)],
['zero byte budget',[['a.js','x']],{maxTotalReadBytes:0},r=>assert.equal(r.files[0].inspected,false)],
['entrypoint detection',[['src/main.ts','export const x=1;'],['lib/u.ts','export const y=2;']],{},r=>assert.ok(r.outline.entryPoints.includes('src/main.ts'))],
['package manifest entry',[['package.json','{}']],{},r=>assert.ok(r.outline.entryPoints.includes('package.json'))],
['empty project',[],{},r=>assert.equal(r.outline.files,0)],
['deep safe path',[['a/b/c/d/e/main.js','const x=1;']],{},r=>assert.equal(r.files.length,1)],
['unresolved local import',[['main.js',`import x from './missing.js';`]],{},r=>assert.ok(r.diagnostics.some(d=>d.code==='LOCAL_IMPORT_NOT_RESOLVED'))],
['dynamic import uncertainty',[['main.js',`import('./'+name+'.js')`]],{},r=>assert.equal(r.outline.dependencyGraphComplete,false)],
['literal dynamic import',[['main.js',`import('./lazy.js')`],['lazy.js','export default 1']],{},r=>assert.equal(r.outline.dynamicImportPresent,false)],
['scoped package extraction',[['main.js',`import x from '@scope/pkg/sub';`]],{},r=>assert.deepEqual(r.outline.externalDependencies,['@scope/pkg'])],
['read failure', [['a.js','x']],{},async r=>assert.ok(r.diagnostics.some(d=>d.code==='FILE_READ_FAILED'))]
];
for(const [name,files,limits,check] of analyzerCases) T(`analyzer ${name}`,async()=>{let s=src(files);if(name==='read failure')s={async listFiles(){return [{path:'a.js',sizeBytes:1,kind:'text'}]},async readTextFile(){return null;}};const r=await analyzeProject('case',s,{limits});await check(r);});

// 41–60: import recognition and language boundary checks
const langs=[['a.js','javascript'],['a.mjs','javascript'],['a.cjs','javascript'],['a.jsx','javascript'],['a.ts','typescript'],['a.tsx','typescript'],['a.mts','typescript'],['a.cts','typescript'],['a.json','json'],['a.css','css'],['a.html','html'],['a.htm','html'],['A.JS','javascript'],['A.TS','typescript'],['a.py','unknown'],['Main.kt','unknown'],['Main.java','unknown'],['a.swift','unknown'],['a.cpp','unknown'],['a.wasm','unknown']];
for(const [p,l] of langs)T(`language boundary ${p}`,()=>assert.equal(detectLanguage(p),l));

// 61–80: selective execution must not overclaim safety
for(let i=0;i<10;i++)T(`selective safety ${i+1}`,async()=>{const r=await analyzeProject('p',src([['main.js',`import './dep.js';`],['dep.js','export const x=1;'],['other.js','const unused=1;']]));const p=planSelectiveExecution(r,{id:'component',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true});assert.equal(p.canRunInIsolation,true);assert.deepEqual(p.selectedFiles.sort(),['dep.js','main.js']);assert.deepEqual(p.omittedFiles,['other.js']);});
const selective=[
['side effects not declared',{sideEffectFree:false,dynamicDependenciesDeclared:true},false],
['dynamic deps not declared',{sideEffectFree:true,dynamicDependenciesDeclared:false},false],
['missing entry',{entryFiles:['missing.js'],sideEffectFree:true,dynamicDependenciesDeclared:true},false],
['unresolved import',null,false],
['dynamic import',null,false],
['binary entry',{entryFiles:['asset.js'],sideEffectFree:true,dynamicDependenciesDeclared:true},false],
['uninspected entry',null,false],
['empty component',{entryFiles:[],sideEffectFree:true,dynamicDependenciesDeclared:true},false],
['missing component id',{id:'',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true},false],
['incomplete analysis',null,false]
];
for(const [name,opts,expected] of selective)T(`selective ${name}`,async()=>{let files=[['main.js','export const x=1;'],['other.js','const y=2;']];if(name==='unresolved import')files=[['main.js',`import './missing.js'`]];if(name==='dynamic import')files=[['main.js',`import('./'+x)`]];if(name==='binary entry')files=[['asset.js','binary','binary']];if(name==='uninspected entry'||name==='incomplete analysis')files=[['main.js','x'.repeat(20)]];const a=await analyzeProject('s',src(files),(name==='uninspected entry'||name==='incomplete analysis')?{limits:{maxFileBytes:5}}:{});const o=opts??{id:'c',entryFiles:['main.js'],sideEffectFree:true,dynamicDependenciesDeclared:true};const p=planSelectiveExecution(a,o);assert.equal(p.canRunInIsolation,expected);});

// 81–120: RAM ladder, 3GB down to 10MB, multiple workload strategies.
const ramLevels=[3*GB,2*GB,1536*MB,1*GB,768*MB,512*MB,384*MB,256*MB,192*MB,128*MB,96*MB,64*MB,48*MB,32*MB,24*MB,16*MB,10*MB,5*MB,1*MB,512*1024,100*1024,10*1024,1024,1,0];
for(const [i,ram] of ramLevels.entries())T(`RAM simulation streaming ladder ${Math.round(ram/MB)}MB`,()=>{const plan=chooseExecutionPlan(wl({canStreamAssets:true,streamingWorkingSetBytes:64*MB}),dev(ram),runtimes);const expected=ram>=512*MB?'FULL_LOCAL':ram>=64*MB?'STREAMED_LOCAL':'WAIT_FOR_RESOURCES';assert.equal(plan.mode,expected);assert.equal(plan.availableRamBytes,ram);assert.equal(plan.estimated,true);});
for(const [i,ram] of ramLevels.entries())T(`RAM simulation chunk ladder ${Math.round(ram/MB)}MB`,()=>{const plan=chooseExecutionPlan(wl({canChunkIndependentWork:true,chunkWorkingSetBytes:128*MB}),dev(ram),runtimes);const expected=ram>=512*MB?'FULL_LOCAL':ram>=128*MB?'CHUNKED_LOCAL':'WAIT_FOR_RESOURCES';assert.equal(plan.mode,expected);});
T('RAM ladder reduced quality is explicit',()=>{const p=chooseExecutionPlan(wl({reducedQuality:{label:'low detail',estimatedPeakRamBytes:32*MB,qualityChanges:['lower textures']} }),dev(32*MB),runtimes);assert.equal(p.mode,'REDUCED_QUALITY_LOCAL');assert.deepEqual(p.qualityChanges,['lower textures']);});
T('RAM ladder remote fallback',()=>{const p=chooseExecutionPlan(wl({remoteRuntimeId:'remote'}),dev(10*MB,{networkAllowed:true}),runtimes);assert.equal(p.mode,'REMOTE_REQUIRED');});
T('RAM ladder remote denied without network',()=>{const p=chooseExecutionPlan(wl({remoteRuntimeId:'remote'}),dev(10*MB),runtimes);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
T('RAM ladder GPU required and absent',()=>{const p=chooseExecutionPlan(wl({gpuRequired:true}),dev(2*GB,{gpuAvailable:false}),runtimes);assert.equal(p.canStart,false);});
T('RAM ladder storage insufficient',()=>{const p=chooseExecutionPlan(wl(),dev(2*GB,{availableStorageBytes:1}),runtimes);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
T('RAM ladder unknown runtime',()=>{const p=chooseExecutionPlan(wl({runtimeId:'missing'}),dev(2*GB),runtimes);assert.equal(p.mode,'UNSUPPORTED');});
T('RAM ladder exact full threshold',()=>assert.equal(chooseExecutionPlan(wl(),dev(512*MB),runtimes).mode,'FULL_LOCAL'));
T('RAM ladder just below full threshold',()=>assert.equal(chooseExecutionPlan(wl(),dev(512*MB-1),runtimes).mode,'WAIT_FOR_RESOURCES'));
T('RAM ladder exact stream threshold',()=>assert.equal(chooseExecutionPlan(wl({canStreamAssets:true,streamingWorkingSetBytes:64*MB}),dev(64*MB),runtimes).mode,'STREAMED_LOCAL'));
T('RAM ladder just below stream threshold',()=>assert.equal(chooseExecutionPlan(wl({canStreamAssets:true,streamingWorkingSetBytes:64*MB}),dev(64*MB-1),runtimes).mode,'WAIT_FOR_RESOURCES'));
T('RAM ladder resource classification 10MB',()=>assert.equal(classifyResources({timestamp:1,resources:dev(10*MB)},32*MB,1),'LOW_MEMORY'));
T('RAM ladder thermal priority',()=>assert.equal(classifyResources({timestamp:1,resources:dev(3*GB,{thermalState:'critical'})},32*MB,1),'THERMAL_PRESSURE'));
T('RAM ladder low storage',()=>assert.equal(classifyResources({timestamp:1,resources:dev(3*GB,{availableStorageBytes:0})},32*MB,1),'LOW_STORAGE'));
T('RAM ladder unknown NaN',()=>assert.equal(classifyResources({timestamp:1,resources:dev(NaN)},32*MB,1),'UNKNOWN'));
T('RAM ladder battery metadata does not change planner',()=>assert.equal(chooseExecutionPlan(wl(),dev(3*GB,{batteryPercent:1}),runtimes).mode,'FULL_LOCAL'));
T('RAM ladder warm device remains eligible',()=>assert.equal(chooseExecutionPlan(wl(),dev(3*GB,{thermalState:'warm'}),runtimes).mode,'FULL_LOCAL'));
T('RAM ladder 10MB never claims full quality',()=>{const p=chooseExecutionPlan(wl(),dev(10*MB),runtimes);assert.notEqual(p.mode,'FULL_LOCAL');assert.equal(p.canStart,false);});
T('RAM ladder low-memory mode marks estimate',()=>{const p=chooseExecutionPlan(wl(),dev(10*MB),runtimes);assert.equal(p.estimated,true);assert.equal(p.confidence,'low');});
T('RAM ladder streaming requires runtime support',()=>{const noStream=[{...runtimes[0],supportsStreaming:false}];const p=chooseExecutionPlan(wl({canStreamAssets:true,streamingWorkingSetBytes:64*MB}),dev(64*MB),noStream);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
T('RAM ladder chunking requires declared independent work',()=>{const p=chooseExecutionPlan(wl({canChunkIndependentWork:false,chunkWorkingSetBytes:1}),dev(1),runtimes);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
T('RAM ladder storage exact threshold',()=>assert.equal(chooseExecutionPlan(wl({requiredStorageBytes:100}),dev(3*GB,{availableStorageBytes:100}),runtimes).mode,'FULL_LOCAL'));
T('RAM ladder storage one byte short',()=>assert.equal(chooseExecutionPlan(wl({requiredStorageBytes:100}),dev(3*GB,{availableStorageBytes:99}),runtimes).mode,'WAIT_FOR_RESOURCES'));

// 121–135: representative project types; analysis is not execution.
const projectTypes=[
['browser app','index.html','<html><body><script src="app.js"></script></body></html>'],['frontend TS','src/main.ts','import {x} from "./x"; export const y=x;'],['node service','server.js','const http=require("http");'],['css-heavy','styles.css','body { color: red; }'],['json config','config.json','{"name":"app","version":"1"}'],['python project','main.py','print("hello")'],['android kotlin','MainActivity.kt','class MainActivity'],['android java','MainActivity.java','class MainActivity {}'],['native cpp','main.cpp','int main(){return 0;}'],['unity project','Assets/Game.cs','class Player {}'],['unreal project','Source/Game.cpp','int main(){return 0;}'],['wasm artifact','module.wasm','binary'],['large generated js','bundle.js','const x=1;'.repeat(5000)],['SVG asset','art.svg','<svg><path d="M0 0"/></svg>'],['mixed app','src/app.tsx','export default function App(){return null;}']];
for(const [name,path,code] of projectTypes)T(`project type ${name}`,async()=>{const r=await analyzeProject(name,src([[path,code,path.endsWith('.wasm')?'binary':'text']]));assert.equal(r.outline.files,1);assert.equal(r.files[0].language,detectLanguage(path));assert.equal(r.files[0].inspected,detectLanguage(path)!=='unknown'&&!path.endsWith('.wasm'));});

// 136–150: adversarial malformed inputs and explicit diagnostic render profiles.
const adversarial=['','\0','\uFEFFconst x=1;','😀'.repeat(1000),'\n'.repeat(5000),'/*'.repeat(1000),'"'.repeat(1000),'('.repeat(2000),')'.repeat(2000),'const x = '+ '1+'.repeat(10000)+'0;','<script>'.repeat(1000),'{"a":'.repeat(1000),'../../'.repeat(1000),'a'.repeat(100000),'const x = 1;'.repeat(20000)];
for(let i=0;i<adversarial.length;i++)T(`adversarial source ${i+1}`,async()=>{const code=adversarial[i];const r=tokenize(code);assert.ok(Array.isArray(r.tokens));assert.ok(Array.isArray(r.issues));if(i===0)assert.equal(r.tokens.length,0);});
T('render profiles are diagnostic-only',()=>{assert.ok(DIAGNOSTIC_RENDER_PROFILES.length>=5);for(const p of DIAGNOSTIC_RENDER_PROFILES)assert.equal(p.diagnosticOnly,true);});
T('project path rejects backslash',()=>assert.equal(normalizeProjectPath('a\\b.js'),null));
T('project path rejects null byte',()=>assert.equal(normalizeProjectPath('a\0b.js'),null));
T('project path rejects drive prefix',()=>assert.equal(normalizeProjectPath('C:/x.js'),null));
T('CSS malformed delimiters surfaced',async()=>{const d=await analyzeSourceFile('a.css','a { color: red;','css');assert.ok(d.some(x=>x.code==='UNCLOSED_DELIMITER'));});
T('JSON malformed nested object surfaced',async()=>{const d=await analyzeSourceFile('a.json','{"a":{"b":}}','json');assert.ok(d.length>0);});
T('resource planner rejects negative available RAM',()=>{const p=chooseExecutionPlan(wl(),dev(-1),runtimes);assert.equal(p.canStart,false);});
T('resource planner rejects NaN available RAM',()=>{const p=chooseExecutionPlan(wl(),dev(NaN),runtimes);assert.equal(p.canStart,false);});
T('resource planner rejects negative workload estimate',()=>{const p=chooseExecutionPlan(wl({estimatedPeakRamBytes:-1}),dev(3*GB),runtimes);assert.equal(p.canStart,false);});
T('resource planner rejects infinite storage requirement',()=>{const p=chooseExecutionPlan(wl({requiredStorageBytes:Infinity}),dev(3*GB),runtimes);assert.equal(p.canStart,false);});
T('R2 generated test count is 203',()=>assert.equal(count,203));
