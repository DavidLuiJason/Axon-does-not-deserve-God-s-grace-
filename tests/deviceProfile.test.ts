import assert from 'node:assert/strict';
import { deviceProfile, speedProbe } from '../src/tools/engines/device/deviceProfile.ts';
let checks = 0; function check(a: unknown, e: unknown, label: string) { assert.deepEqual(a,e,label); checks++; }
const uas = [
 ['Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36','13','Chrome 120.0.0.0'],
 ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36','10','Chrome 91.0.4472.120'],
 ['Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36','12','Chrome 115.0.0.0'],
 ['Mozilla/5.0 (Linux; Android 11; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/99.0.4844.88 Mobile Safari/537.36','11','WebView 99.0.4844.88'],
 ['Mozilla/5.0 (Linux; Android 9; Mi A2) AppleWebKit/537.36 Chrome/80.0.3987.99 Mobile Safari/537.36','9','Chrome 80.0.3987.99'],
 ['Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36','14','Chrome 124.0.0.0'],
 ['Mozilla/5.0 (Linux; Android 8.1.0; Nexus 6P) AppleWebKit/537.36 Chrome/70.0.3538.80 Mobile Safari/537.36','8.1.0','Chrome 70.0.3538.80'],
 ['Mozilla/5.0 (Linux; Android 12; Tablet) AppleWebKit/537.36 Chrome/110.0.0.0 Safari/537.36','12','Chrome 110.0.0.0'],
 ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36','unknown','Chrome 123.0.0.0'],
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1','unknown','unknown'],
 ['Custom agent with no version tokens','unknown','unknown'],
] as const;
for (const [ua, android, browser] of uas) { const r=deviceProfile({userAgent:ua}); assert.equal(r.ok,true); if(r.ok){ const row=(label:string)=>r.report.rows.find(x=>x.label===label)?.value; check(row('Android version'),android,`android ${ua}`); check(row('Browser / WebView'),browser,`browser ${ua}`); } checks++; }
const report=deviceProfile({screenWidth:360,screenHeight:800,pixelRatio:2.625,deviceMemory:3.75,online:false,languages:['en-NG','ar'],storageEstimate:{usage:100,quota:1000}});
assert.equal(report.ok,true); if(report.ok){ check(report.report.rows.find(r=>r.label==='Device memory')?.value,'3.8 GB (navigator.deviceMemory; rounded)','memory rounding note'); check(report.report.rows.find(r=>r.label==='Orientation')?.value,'unknown','missing field unknown'); check(report.report.plainText.includes('Online: false'),true,'plain text copy'); } checks++;
check(deviceProfile(null as never),{ok:false,error:'invalid-environment',message:'Provide a device environment object.'},'invalid environment');
check(speedProbe(()=>100,()=>{}),{milliseconds:0,label:'fast'},'fake clock zero'); let times=[20,36]; check(speedProbe(()=>times.shift()!,()=>{}),{milliseconds:16,label:'moderate'},'fake clock moderate'); times=[0,80]; check(speedProbe(()=>times.shift()!,()=>{}),{milliseconds:80,label:'slow'},'fake clock slow'); check(speedProbe(()=>NaN,()=>{}),{milliseconds:null,label:'unknown'},'bad clock'); check(speedProbe(()=>0,()=>{throw new Error('broken')}),{milliseconds:null,label:'unknown'},'work failure');
console.log(`deviceProfile: ${checks} checks passed`);
