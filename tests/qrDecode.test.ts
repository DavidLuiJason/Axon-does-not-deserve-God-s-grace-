import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { decodeQr } from '../src/tools/engines/create/qrDecode';
import { makeQr, type QrLevel } from '../src/tools/engines/create/qrCode';

type Vector={version:number;level:QrLevel;payload:string;modules:string[]};
const fixture=JSON.parse(readFileSync(new URL('./fixtures/qr-vectors.json',import.meta.url),'utf8')) as {generator:string;vectors:Vector[]};
let checks=0;
function check(ok:unknown,message:string):asserts ok {assert.ok(ok,message);checks++;}
function matrix(v:Vector):boolean[][] {return v.modules.map(row=>Array.from(row,c=>c==='1'));}
let seed=0x21a2026;function rnd():number{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 $%*+-./:abcdefghijklmnopqrstuvwxyz-éñ中🙂';
const start=performance.now();
for(const v of fixture.vectors){const r=decodeQr(matrix(v));check(r.ok,`independent v${v.version}/${v.level}: ${r.ok?'':r.error+' '+r.message}`);if(r.ok){check(r.text===v.payload,`payload mismatch v${v.version}/${v.level}`);check(r.version===v.version&&r.level===v.level,`metadata mismatch v${v.version}/${v.level}`);}}
const levels:QrLevel[]=['L','M','Q','H'];
for(let i=0;i<600;i++){
 const level=levels[i%4],len=1+Math.floor(rnd()*Math.min(90,25+(i%10)*7));let payload='';for(let j=0;j<len;j++)payload+=alphabet[Math.floor(rnd()*alphabet.length)];
 const made=makeQr(payload,{level});if(!made.ok)continue;const decoded=decodeQr(made.modules);check(decoded.ok,`round trip ${i}: ${decoded.ok?'':decoded.error}`);if(decoded.ok)check(decoded.text===payload,`round trip payload mismatch ${i}`);
}
for(let i=0;i<2000;i++){
 const version=1+Math.floor(rnd()*40),n=17+4*version,m=Array.from({length:n},()=>Array.from({length:n},()=>rnd()<0.5));
 let r;try{r=decodeQr(m);}catch(e){assert.fail(`garbage matrix threw: ${String(e)}`);}check(!r!.ok,`garbage matrix returned text at iteration ${i}`);
}
const known=fixture.vectors[0],base=matrix(known);const inverted=decodeQr(base.map(r=>r.map(x=>!x)));check(inverted.ok&&inverted.transformed==='inverted','inversion tolerance');
const mirrored=decodeQr(base[0].map((_,x)=>base.map(r=>r[x])));check(mirrored.ok&&mirrored.transformed==='mirrored','transpose tolerance');
check(!decodeQr([]).ok,'empty matrix rejected');check(decodeQr(Array.from({length:22},()=>Array(22).fill(false))).ok===false,'bad size rejected');
const elapsed=performance.now()-start;
console.log(`C21A qr decoder: PASS ${checks} checks; independent vectors=${fixture.vectors.length}; seeded round-trip attempts=600; garbage matrices=2000; elapsed=${elapsed.toFixed(2)} ms; version-40 single-decode timing measured by fixture run below.`);
const v40=fixture.vectors.find(v=>v.version===40&&v.level==='H')!;const t0=performance.now();const v40result=decodeQr(matrix(v40));const ms=performance.now()-t0;check(v40result.ok&&v40result.text===v40.payload,'version 40 decode');console.log(`MEASURED version 40/H decode: ${ms.toFixed(3)} ms; result=${v40result.ok?'PASS':v40result.error}`);

// Damage safety (Director addition): random module flips must never produce WRONG text.
{
  let wrong = 0, recovered = 0, corrected = 0, failedTyped = 0;
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const v = fixture.vectors[Math.floor(rnd() * fixture.vectors.length)];
    const m = matrix(v).map(r => r.slice());
    const flips = rnd() < 0.7 ? 1 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * 60);
    for (let k = 0; k < flips; k++) { const y = Math.floor(rnd() * m.length), x = Math.floor(rnd() * m.length); m[y][x] = !m[y][x]; }
    const r = decodeQr(m);
    if (r.ok) { if (r.text !== v.payload) wrong++; else { recovered++; if (r.correctedCodewords > 0) corrected++; } } else failedTyped++;
  }
  check(wrong === 0, `damage test returned wrong text ${wrong} times`);
  check(corrected > 0, 'damage test never exercised error correction');
  console.log(`DAMAGE: ${N} damaged symbols: wrong text=${wrong}; decoded exactly=${recovered} (with corrections=${corrected}); typed failures=${failedTyped}`);
}
