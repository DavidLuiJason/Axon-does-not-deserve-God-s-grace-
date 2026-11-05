import {nextCycle} from '../src/decision/deepDiveStop';
import {compareManifests} from '../src/export/manifestCompare';
declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
// Director checks: boundaries the builder's own tests left open (found by Director mutants).
const run=(cost:number)=>nextCycle({cycles:[{gain:1,cost}],successMet:false,ownerStop:false,budget:10000000});
const c1=run(1000000);check(c1.ok&&c1.value.decision==='CONTINUE'&&c1.value.spent===1000000,'a cycle cost of exactly 1,000,000 is valid');
const c2=run(1000001);check(!c2.ok&&c2.error==='bad-cycles','a cycle cost of 1,000,001 is bad-cycles');
const H1='1'.repeat(64),H2='2'.repeat(64);
const many=(n:number)=>Array.from({length:n},(_,i)=>({path:'f'+i,sha256:H1,bytes:1}));
const a100=compareManifests([],many(100000));check(a100.ok&&a100.value.extra.length===100000,'an AFTER list of exactly 100,000 entries is valid');
const a101=compareManifests([],many(100001));check(!a101.ok&&a101.error==='bad-manifest','an AFTER list of 100,001 entries is bad-manifest');
const b101=compareManifests(many(100001),[]);check(!b101.ok&&b101.error==='bad-manifest','a BEFORE list of 100,001 entries is bad-manifest');
const d=compareManifests([{path:'b',sha256:H1,bytes:1},{path:'a',sha256:H1,bytes:1}],[{path:'b',sha256:H2,bytes:1},{path:'a',sha256:H2,bytes:1}]);
check(d.ok&&d.value.different.join()==='a,b'&&d.value.same===0&&!d.value.identical,'different paths come out sorted (a before b)');
console.log('BATCH6_DIRECTOR_CHECKS OK: '+checks+' checks');
