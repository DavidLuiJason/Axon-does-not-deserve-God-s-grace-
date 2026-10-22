import assert from 'node:assert/strict';
import { summarizeText } from '../src/tools/engines/text/summarize';
const median=(xs:number[])=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const fit=(s:string,n:number)=>s.repeat(Math.ceil(n/s.length)).slice(0,n);
const shapes:{name:string;make:(n:number)=>string;options?:{sentences?:number;code?:'skip'|'keep'}}[]=[
 {name:'a-period',make:n=>fit('a.',n)},
 {name:'ordinary-short',make:n=>fit('hello. world.  ',n)},
 {name:'email-like',make:n=>fit('x@y.z. ',n)},
 {name:'no-terminator',make:n=>fit('abc def ',n)},
 {name:'lone-backticks',make:n=>fit('`a. ',n)},
 {name:'url-like',make:n=>fit('http://a.b.c. ',n)},
 {name:'abbreviation',make:n=>fit('Mr. a. ',n)},
 {name:'period-only',make:n=>'.'.repeat(n)},
 {name:'blank-lines',make:n=>fit('\n\n',n)},
 {name:'bullet-lines',make:n=>fit('- Bullet item with a few ordinary words to make this line longer and more realistic.\n',n)},
 {name:'fenced-keep',make:n=>fit('Text sentence here.\n```js\nconst a = 1;\n```\n',n),options:{sentences:2,code:'keep'}},
 {name:'4999-sentences',make:n=>'Sentence number has ordinary descriptive words here. '.repeat(4999).slice(0,300000),options:{sentences:20}}
];
for(const shape of shapes){
 const lengths=shape.name==='4999-sentences'?[261000]:[20000,40000,80000,160000,300000];
 const times:number[]=[];
 for(const n of lengths){const text=shape.make(n);summarizeText(text,shape.options);const samples:number[]=[];for(let rep=0;rep<3;rep++){const t=performance.now();const r=summarizeText(text,shape.options);const elapsed=performance.now()-t;assert.ok(r.ok || (r.ok===false&&['too-many-sentences','empty-input'].includes(r.error)),`${shape.name} ${n}: ${r.ok?'ok':r.error}`);if(shape.name==='4999-sentences'){assert.equal(r.ok,true);if(r.ok)assert.equal(r.stats.sentencesIn,4999);}samples.push(elapsed);}const m=median(samples);times.push(m);assert.ok(m<1000,`${shape.name} ${n}: ${m.toFixed(2)}ms`);}
 for(let i=1;i<times.length;i++)if(times[i-1]>=5)assert.ok(times[i]<=times[i-1]*3,`${shape.name} ratio ${lengths[i-1]}->${lengths[i]}: ${times[i-1].toFixed(2)} to ${times[i].toFixed(2)}ms`);
 console.log(`speed ${shape.name}: ${times.map(x=>x.toFixed(2)+'ms').join(', ')}`);
}
const cjk=Array.from({length:5000},()=>('公园里的孩子们正在快乐地玩耍并且一起学习新的知识和技能'.repeat(2)+'。')).join('');const start=performance.now();const r=summarizeText(cjk,{sentences:20});const elapsed=performance.now()-start;assert.equal(r.ok,true);assert.ok(elapsed<1000,`300k CJK ${elapsed}ms`);console.log(`speed CJK 300000: ${elapsed.toFixed(2)}ms`);

const blankStart=performance.now();const blankResult=summarizeText('\n'.repeat(5000));const blankMs=performance.now()-blankStart;assert.equal(blankResult.ok,false);if(!blankResult.ok)assert.equal(blankResult.error,'empty-input');assert.ok(blankMs<1000);console.log(`speed fixed 5000 blank lines: ${blankMs.toFixed(2)}ms`);
const bulletText=Array.from({length:5000},(_,i)=>('- '+(`Bullet line ${String(i).padStart(4,'0')} contains ordinary words and details`).padEnd(56,'x').slice(0,56))).join('\n');assert.ok(bulletText.length<=300000);const bulletStart=performance.now();const bulletResult=summarizeText(bulletText);const bulletMs=performance.now()-bulletStart;assert.equal(bulletResult.ok,true);if(bulletResult.ok)assert.equal(bulletResult.stats.sentencesIn,5000);assert.ok(bulletMs<1000);console.log(`speed fixed 5000 bullet lines (${bulletText.length} chars): ${bulletMs.toFixed(2)}ms`);
const blockText='Prose sentence here.\n```js\nconst value = 1;\n```\n'.repeat(3000);const blockStart=performance.now();const blockResult=summarizeText(blockText,{sentences:5,code:'keep'});const blockMs=performance.now()-blockStart;assert.equal(blockResult.ok,true);if(blockResult.ok)assert.equal(blockResult.codeBlocks,3000);assert.ok(blockMs<1000);console.log(`speed fixed 3000 fenced blocks with code keep (${blockText.length} chars): ${blockMs.toFixed(2)}ms`);
