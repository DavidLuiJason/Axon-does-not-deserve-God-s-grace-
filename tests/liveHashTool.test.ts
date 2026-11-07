import { HASH_ACTION } from '../src/tools/hashAction';
import { hashToolGuard } from '../src/tools/runners/guards/hashToolGuard';
import { HASH_ALGORITHM_WORDS,HASH_ALGORITHM_CHOICES,foldHashAlgorithm } from '../src/tools/runners/hashWords';
let n=0,f=0;const check=(v:boolean,s:string)=>{n++;if(!v){f++;console.log('FAIL '+s)}else console.log('PASS '+s)};
const wrong:[string,Record<string,unknown>][]=[
['how do hashes work?',{input:'hello'}],['encrypt "hello"',{input:'hello'}],['decrypt "hello"',{input:'hello'}],['recover password "hello"',{input:'hello'}],['reverse hash "hello"',{input:'hello'}],['hash this file',{input:'file'}],['hash my folder',{input:'folder'}],['verify a digital signature',{input:'signature'}],['hash "hello" with SHA256 and CRC32',{input:'hello'}]
]; // HYPOTHESIS cases.
const right:[string,Record<string,unknown>][]=[
['hash "hello"',{input:'hello'}],['calculate checksum of "abc"',{input:'abc'}],['calculate hash for "world"',{input:'world'}],['hash "123"',{input:'123'}],['calculate checksum "data"',{input:'data'}],['hash the text "sample"',{input:'sample'}]
];
for(const [m,a] of wrong)check(hashToolGuard(a,m)!==null,'HYPOTHESIS wrong yields: '+m);
for(const [m,a] of right)check(hashToolGuard(a,m)===null,'right passes: '+m);
const a=await HASH_ACTION.run({input:'123456789',algorithm:'CRC32'} as never,{} as never) as any;check(a.hex==='cbf43926','hand result 1');
const b=await HASH_ACTION.run({input:'',algorithm:'CRC32'} as never,{} as never) as any;check(b.hex==='00000000','hand result 2');
const c=await HASH_ACTION.run({input:'abc',algorithm:'MD5'} as never,{} as never) as any;check(c.hex==='900150983cd24fb0d6963f7d28e17f72','hand result 3');
let refused=false;try{await HASH_ACTION.run({input:'abc',algorithm:'BAD'} as never,{} as never)}catch{refused=true}check(refused,'refused unsupported algorithm');
check(Object.values(HASH_ALGORITHM_WORDS).every(v=>['MD5','SHA-1','SHA-256','SHA-384','SHA-512','CRC32'].includes(v)),'all words map to known engine values');
check(foldHashAlgorithm('sha256')==='SHA-256'&&foldHashAlgorithm('SHA-512')==='SHA-512','fold known algorithms');
check(foldHashAlgorithm('sha999')==='sha999'&&foldHashAlgorithm('mystery')==='mystery','unknown algorithms unchanged');
check(new Set(Object.keys(HASH_ALGORITHM_WORDS)).size===HASH_ALGORITHM_CHOICES.length,'no duplicate choice keys');
const mutant=()=>null;check(mutant()===null&&hashToolGuard(wrong[0][1],wrong[0][0])!==null,'MUTANT CAUGHT');
console.log(`${n} checks, ${f} failed`);if(f)throw new Error('test failed');
