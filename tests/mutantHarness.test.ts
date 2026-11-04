import {runMutants, differential, deepEqual, type MutantResult} from '../src/testkit/mutantHarness';
type EngineFailure={ok:false;error:string;message:string}; type EngineSuccess<T>={ok:true;value:T};
declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
const original=(x:unknown)=>(x as number)+1;
const cases=[{id:'c1',input:1,expected:2},{id:'c2',input:0,expected:1}];
const mutants=[
 {id:'m1',fn:(x:unknown)=>(x as number)+2},
 {id:'m2',fn:(x:unknown)=>(x as number)+1},
 {id:'m3',fn:(_x:unknown)=>{throw new Error('bad');}},
 {id:'m4',fn:(x:unknown)=>(x===0?5:(x as number)+1)}
];
const r=runMutants(original,mutants,cases);
check(r.ok,'hand mutant run succeeds');
if(r.ok){
 check(JSON.stringify(r.value.caught)===JSON.stringify([{mutantId:'m1',caughtBy:'c1',how:'wrong-answer'},{mutantId:'m3',caughtBy:'c1',how:'threw'},{mutantId:'m4',caughtBy:'c2',how:'wrong-answer'}]),'hand caught order and first case');
 check(JSON.stringify(r.value.survived)===JSON.stringify(['m2'])&&r.value.caughtCount===3&&r.value.total===4,'hand survivor and counts');
}
const wrong=runMutants(original,mutants,[{id:'wrong',input:1,expected:3}]);
check(!wrong.ok&&(wrong as EngineFailure).error==='original-fails'&&(wrong as EngineFailure).message.includes('wrong'),'original failure names case');
const d=differential((x:unknown)=>(x as number)*2,(x:unknown)=>(x as number)+(x as number),[1,2,3]);
check(d.ok&&d.value.agree===3&&d.value.differ.length===0,'hand differential equal');
const d2=differential((x:unknown)=>(x as number)*2,(x:unknown)=>(x===2?9:(x as number)*2),[1,2,3]);
check(d2.ok&&d2.value.agree===2&&JSON.stringify(d2.value.differ)===JSON.stringify([{index:1,a:4,b:9}]),'hand differential one mismatch');
check((runMutants(original,[],cases) as EngineFailure).error==='empty-list','empty mutants');
check((runMutants(original,mutants,[]) as EngineFailure).error==='empty-list','empty cases');
check((runMutants(original,[mutants[0],mutants[0]],cases) as EngineFailure).error==='duplicate-id','duplicate mutant id');
check((runMutants(original,mutants,[cases[0],cases[0]]) as EngineFailure).error==='duplicate-id','duplicate case id');
check(runMutants(original,[{id:'same',fn:original}],[{id:'one',input:1,expected:2}]).ok,'surviving mutant');
check(runMutants(()=>{throw Error('original');},mutants,cases) instanceof Object&&!(runMutants(()=>{throw Error('original');},mutants,cases) as EngineSuccess<MutantResult>).ok,'throwing original fails');
const throwsAgree=differential(()=>{throw Error('a');},()=>{throw Error('b');},[0]);
check(throwsAgree.ok&&throwsAgree.value.agree===1&&throwsAgree.value.differ.length===0,'two throws agree');
const oneThrows=differential(()=>1,()=>{throw Error('b');},[0]);
check(oneThrows.ok&&oneThrows.value.agree===0&&oneThrows.value.differ.length===1,'one throw differs');
check(deepEqual({a:1,b:[2,3]},{b:[2,3],a:1}),'object key order ignored');
check(!deepEqual([1,2],[2,1]),'array order matters');
check(deepEqual({nested:{x:1},list:[{y:2}]},{list:[{y:2}],nested:{x:1}}),'nested plain objects compare deeply');
check(deepEqual(NaN,NaN)&&!deepEqual(0,-0),'Object.is primitives');
check(differential(()=>1,()=>1,[]).ok,'empty differential inputs allowed');
check(r.ok&&Object.isFrozen(r.value)&&Object.isFrozen(r.value.caught)&&Object.isFrozen(r.value.caught[0]),'frozen harness result');
// DIRECTOR EXTRAS (Batch 4 verification, 2026-11-04): gaps found by hand-made breakages
check(!deepEqual([1,undefined],[1])&&!deepEqual([1],[1,undefined]),'arrays of different length differ');
check(!deepEqual({a:1},{a:1,b:2})&&!deepEqual({a:1,b:2},{a:1}),'objects with different key counts differ');
check(!deepEqual({a:1},{b:1}),'objects with different key names differ');
check(!deepEqual(new Date(0),new Date(1)),'class instances are not compared as plain objects');
check(deepEqual({a:1,b:[2]},{b:[2],a:1})&&deepEqual(Number.NaN,Number.NaN)&&!deepEqual(0,-0),'key order ignored; NaN equals NaN; 0 and -0 differ');
const xt=(x:unknown)=>{if(x===1)throw new Error('boom');return x;};
const xd1=differential(xt,(x:unknown)=>x,[0,1,2]);
check(xd1.ok&&xd1.value.agree===2&&xd1.value.differ.length===1&&xd1.value.differ[0].index===1,'a throw against an answer differs');
const xd2=differential((x:unknown)=>x,xt,[1]);
check(xd2.ok&&xd2.value.agree===0&&xd2.value.differ.length===1,'an answer against a throw differs');
const xd3=differential(xt,xt,[1]);
check(xd3.ok&&xd3.value.agree===1,'two throws agree');
console.log('MUTANT_HARNESS OK: '+checks+' checks');
