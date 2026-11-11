import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProject, analyzeSourceFile, chooseExecutionPlan, classifyResources, detectLanguage, RuntimeRegistry, normalizeProjectPath } from '../dist/index.js';
const MB=1024*1024, GB=1024*MB;
const runtimes=[
 {id:'js-web',label:'JS web contract',languages:['javascript','typescript'],platforms:['web','desktop'],available:true,supportsStreaming:true,supportsCheckpoint:false,isolation:'worker'},
 {id:'js-node',label:'JS process contract',languages:['javascript','typescript'],platforms:['desktop','server'],available:true,supportsStreaming:true,supportsCheckpoint:true,isolation:'process'},
 {id:'remote-js',label:'Remote JS contract',languages:['javascript'],platforms:['remote'],available:true,supportsStreaming:true,supportsCheckpoint:true,isolation:'remote'}
];
const dev=(ram,extra={})=>({availableRamBytes:ram,availableStorageBytes:20*GB,networkAllowed:false,gpuAvailable:true,cpuCores:4,thermalState:'normal',batteryPercent:80,...extra});
const work=(o={})=>({runtimeId:'js-web',estimatedPeakRamBytes:512*MB,requiredStorageBytes:100*MB,...o});
const source=(entries)=>({async listFiles(){return entries.map(([path,body,kind='text'])=>({path,sizeBytes:Buffer.byteLength(body),kind}));},async readTextFile(path,max){const e=entries.find(x=>x[0]===path);return !e||e[2]==='binary'?null:e[1].slice(0,max);}});
let count=0; const T=(name,fn)=>{count++;test(`R3-${String(count).padStart(3,'0')} ${name}`,fn);};

// A. Higher-resource tiers: characterize whether additional headroom changes the plan.
const tiers=[1*GB,2*GB,3*GB,4*GB,6*GB,8*GB,12*GB,16*GB,24*GB,32*GB];
for(const [i,ram] of tiers.entries()) T(`high RAM tier ${ram/GB} GB accepts fitting workload`,()=>{const p=chooseExecutionPlan(work({estimatedPeakRamBytes:768*MB}),dev(ram),runtimes);assert.equal(p.mode,'FULL_LOCAL');assert.equal(p.canStart,true);assert.equal(p.availableRamBytes,ram);});
for(const [i,ram] of tiers.entries()) T(`high RAM tier ${ram/GB} GB does not falsely claim measured performance`,()=>{const p=chooseExecutionPlan(work({estimatedPeakRamBytes:768*MB}),dev(ram),runtimes);assert.equal(p.estimated,true);assert.equal(p.confidence,'low');assert.match(p.reasons.join(' '),/Estimated peak RAM/);});
T('high RAM does not silently change declared quality',()=>{const p=chooseExecutionPlan(work({estimatedPeakRamBytes:1*GB,reducedQuality:{label:'low',estimatedPeakRamBytes:128*MB,qualityChanges:['lower texture resolution']}}),dev(8*GB),runtimes);assert.equal(p.mode,'FULL_LOCAL');assert.deepEqual(p.qualityChanges,[]);});
T('high RAM does not select remote when local fits',()=>{const p=chooseExecutionPlan(work({remoteRuntimeId:'remote-js'}),dev(8*GB,{networkAllowed:true}),runtimes);assert.equal(p.mode,'FULL_LOCAL');});
T('high RAM still blocks unavailable runtime',()=>{const p=chooseExecutionPlan(work({runtimeId:'missing'}),dev(32*GB),runtimes);assert.equal(p.mode,'UNSUPPORTED');});
T('high RAM still blocks insufficient storage',()=>{const p=chooseExecutionPlan(work({requiredStorageBytes:5*GB}),dev(32*GB,{availableStorageBytes:1*GB}),runtimes);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
T('high RAM does not bypass GPU requirement',()=>{const p=chooseExecutionPlan(work({gpuRequired:true}),dev(32*GB,{gpuAvailable:false}),runtimes);assert.equal(p.canStart,false);});
T('high RAM does not bypass thermal state classification',()=>{assert.equal(classifyResources({timestamp:1,resources:dev(32*GB,{thermalState:'critical'})},1,1),'THERMAL_PRESSURE');});

// B. CPU/GPU/storage/battery/thermal device profiles: current planner's actual fields.
const cpu=[1,2,4,8,16,32];
for(const n of cpu) T(`CPU core count ${n} is retained in device profile input`,()=>{const d=dev(2*GB,{cpuCores:n});assert.equal(d.cpuCores,n);const p=chooseExecutionPlan(work(),d,runtimes);assert.equal(p.mode,'FULL_LOCAL');});
const batteries=[0,1,5,10,20,50,80,100];
for(const b of batteries) T(`battery level ${b}% does not get mistaken for RAM`,()=>{const d=dev(2*GB,{batteryPercent:b});const p=chooseExecutionPlan(work(),d,runtimes);assert.equal(p.availableRamBytes,2*GB);});
for(const state of ['normal','warm','hot','critical','unknown']) T(`thermal state ${state} classification`,()=>{const result=classifyResources({timestamp:1,resources:dev(2*GB,{thermalState:state})},256*MB,100);assert.equal(result,state==='hot'||state==='critical'?'THERMAL_PRESSURE':'READY');});
T('unknown GPU is not treated as available for GPU-required workload',()=>{const p=chooseExecutionPlan(work({gpuRequired:true}),dev(2*GB,{gpuAvailable:undefined}),runtimes);assert.equal(p.canStart,false);});
T('network disabled blocks remote fallback',()=>{const p=chooseExecutionPlan(work({estimatedPeakRamBytes:4*GB,remoteRuntimeId:'remote-js'}),dev(1*GB,{networkAllowed:false}),runtimes);assert.equal(p.mode,'WAIT_FOR_RESOURCES');});
T('network enabled permits declared remote fallback',()=>{const p=chooseExecutionPlan(work({estimatedPeakRamBytes:4*GB,remoteRuntimeId:'remote-js'}),dev(1*GB,{networkAllowed:true}),runtimes);assert.equal(p.mode,'REMOTE_REQUIRED');});

// C. Common real-world code-project use cases: inventory/analysis only where supported.
const cases=[
 ['personal website','index.html','<html><script src="main.js"></script></html>','html'],['portfolio site','src/main.ts','export const portfolio = true;','typescript'],['e-commerce frontend','src/cart.ts','export function total(){return 42;}','typescript'],['blog CMS frontend','src/editor.js','export const editor = {};','javascript'],['dashboard','src/dashboard.tsx','export const Dashboard = () => null;','typescript'],['REST API','server.js','const http = require("http");','javascript'],['GraphQL service','api/index.ts','export const schema = {};','typescript'],['CLI tool','bin/cli.js','#!/usr/bin/env node\nconsole.log("ok");','javascript'],['npm library','index.js','export function add(a,b){return a+b;}','javascript'],['browser extension','extension/background.js','chrome.runtime.onInstalled.addListener(()=>{});','javascript'],['VS Code extension','extension.ts','export function activate(){}','typescript'],['Electron desktop app','src/main.js','const {app}=require("electron");','javascript'],['Tauri web frontend','src/main.ts','export const invoke = true;','typescript'],['PWA service worker','sw.js','self.addEventListener("fetch",()=>{});','javascript'],['form validation','validate.js','export const valid = value => !!value;','javascript'],['chat application','chat.ts','export function sendMessage(){}','typescript'],['real-time collaboration','sync.js','export const channel = "room";','javascript'],['data visualization','chart.ts','export const points = [1,2,3];','typescript'],['game browser client','game.js','export function update(dt){}','javascript'],['test suite','math.test.js','import {add} from "./math.js";','javascript'],['build configuration','vite.config.ts','export default {};','typescript'],['JSON app config','settings.json','{"theme":"dark","version":1}','json'],['CSS design system','tokens.css',':root { --space: 8px; }','css'],['HTML email template','email.html','<table><tr><td>Hello</td></tr></table>','html'],['Python data science','analysis.py','import pandas as pd\nprint(1)','unknown'],['Android Kotlin app','MainActivity.kt','class MainActivity {}','unknown'],['Android Java app','MainActivity.java','class MainActivity {}','unknown'],['C++ native library','src/core.cpp','int core(){return 1;}','unknown'],['Rust command line','src/main.rs','fn main() {}','unknown'],['C# Unity game','Assets/Game.cs','class Player {}','unknown'],['Unreal C++ game','Source/Game.cpp','int main(){return 0;}','unknown'],['Swift macOS app','App.swift','import SwiftUI','unknown'],['Go service','main.go','package main','unknown'],['PHP website','index.php','<?php echo "hi";','unknown'],['Ruby service','app.rb','puts "hi"','unknown'],['Jupyter notebook export','notebook.ipynb','{"cells":[],"metadata":{},"nbformat":4}','unknown'],['WASM module','module.wasm','binary','unknown']
];
for(const [name,path,body,expected] of cases) T(`end-user project: ${name}`,async()=>{const r=await analyzeProject(name,source([[path,body,path.endsWith('.wasm')?'binary':'text']]));assert.equal(r.outline.files,1);assert.equal(r.files[0].language,expected);});

// D. Multi-file application layouts and import graph behaviour.
for(let i=0;i<15;i++) T(`multi-file web app topology ${i+1}`,async()=>{const entries=[['src/main.ts',`import { service } from './service${i}.js'; export const start=()=>service();`], [`src/service${i}.js`,`import { data } from './data${i}.js'; export const service=()=>data;`],[`src/data${i}.js`,`export const data=${i};`],['public/index.html','<main></main>'],['styles.css','body{}']];const a=await analyzeProject('web-app',source(entries));assert.equal(a.outline.inspectedFiles,5);assert.equal(a.outline.localDependencies,2);assert.equal(a.outline.dependencyGraphComplete,true);});

// E. Diagnostic robustness for common user mistakes.
const diagCases=[
 ['unclosed function','function f(){','UNCLOSED_DELIMITER'],['unclosed array','const a=[1,2;','UNCLOSED_DELIMITER'],['unclosed object','const a={x:1;','UNCLOSED_DELIMITER'],['unclosed string','const s="hello;','UNCLOSED_STRING'],['extra close','function f(){}}','UNEXPECTED_CLOSING_DELIMITER'],['bad JSON trailing comma','{"x":1,}','JSON_PARSE_ERROR'],['bad JSON missing quote','{x:1}','JSON_PARSE_ERROR'],['bad JSON missing value','{"x":}','JSON_PARSE_ERROR'],['bad CSS brace','a { color:red;','UNCLOSED_DELIMITER'],['empty JS','',null]
];
for(const [name,code,expected] of diagCases) T(`user mistake diagnostic: ${name}`,async()=>{const language=name.startsWith('bad JSON')?'json':name==='bad CSS brace'?'css':'javascript';const ds=await analyzeSourceFile('sample.'+(language==='json'?'json':language==='css'?'css':'js'),code,language);if(expected)assert.ok(ds.some(d=>d.code===expected),`${name}: ${JSON.stringify(ds)}`);else assert.equal(ds.length,0);});

// F. Runtime registry platform handling: platform fit is delegated to adapters, not automatically enforced.
const registry=new RuntimeRegistry();
const adapter=(id,platforms,available=true)=>({descriptor:{id,label:id,languages:['javascript'],platforms,available,supportsStreaming:false,supportsCheckpoint:false,isolation:'process'},canHandle:req=>req.runtimeId===id&&platforms.includes(req.platform??'desktop'),execute:async req=>({requestId:req.requestId,status:'not-implemented',stdout:'',stderr:'',diagnostics:[],elapsedMs:0,artifacts:[],evidence:'UNKNOWN',notes:[]})});
registry.register(adapter('desktop-js',['desktop']));registry.register(adapter('web-js',['web']));registry.register(adapter('server-js',['server']));
for(const [id,platform] of [['desktop-js','desktop'],['web-js','web'],['server-js','server']]) T(`runtime adapter platform route ${platform}`,()=>{const a=registry.get(id);assert.ok(a);assert.ok(a.descriptor.platforms.includes(platform));});
T('registry lists platform metadata',()=>{assert.deepEqual(registry.list().map(x=>x.platforms[0]),['desktop','web','server']);});
T('registry does not claim runtime execution by registration alone',async()=>{const a=registry.get('desktop-js');const out=await a.execute({requestId:'r',projectId:'p',entryFiles:['main.js'],runtimeId:'desktop-js',mode:'FULL_LOCAL',timeoutMs:100,outputLimitBytes:100,networkAllowed:false,fileAccess:'none'});assert.equal(out.status,'not-implemented');assert.equal(out.evidence,'UNKNOWN');});

// G. Resource planning boundary combinations and monotonic fit checks.
for(const [i,ram] of [256,384,512,768,1024,1536,2048,3072,4096,6144,8192].map(x=>x*MB).entries()) T(`RAM fit boundary monotonic ${i+1}`,()=>{const p=chooseExecutionPlan(work({estimatedPeakRamBytes:512*MB}),dev(ram),runtimes);assert.equal(p.canStart,ram>=512*MB);});
for(const [i,storage] of [0,1,99,100,101,1024,1*MB,100*MB,1*GB].entries()) T(`storage boundary ${i+1}`,()=>{const p=chooseExecutionPlan(work({requiredStorageBytes:100}),dev(2*GB,{availableStorageBytes:storage}),runtimes);assert.equal(p.canStart,storage>=100);});
T('resource planner keeps estimates labelled estimated at 32 GB',()=>{const p=chooseExecutionPlan(work(),dev(32*GB),runtimes);assert.equal(p.estimated,true);});
T('resource classifier unknown for NaN RAM',()=>{assert.equal(classifyResources({timestamp:1,resources:dev(NaN)},1,1),'UNKNOWN');});
T('resource classifier unknown for negative storage',()=>{assert.equal(classifyResources({timestamp:1,resources:dev(2*GB,{availableStorageBytes:-1})},1,1),'UNKNOWN');});

// H. Path safety for common project/archive paths.
const safe=['src/main.js','src/components/Button.tsx','assets/icons/logo.svg','public/index.html','packages/core/src/index.ts','test/fixtures/a.json'];
for(const p of safe) T(`safe project path ${p}`,()=>assert.equal(normalizeProjectPath(p),p));
const unsafe=['../outside.js','../../etc/passwd','/root/.ssh/id_rsa','C:/Windows/system.ini','a\\..\\b.js','a\0b.js'];
for(const p of unsafe) T(`unsafe project path ${JSON.stringify(p)}`,()=>assert.equal(normalizeProjectPath(p),null));
T('R3 generated test count is 150',()=>assert.equal(count,151));
