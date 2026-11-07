import { PASSWORD_ACTION } from '../src/tools/passwordAction';
import { passwordGeneratorGuard } from '../src/tools/runners/guards/passwordGeneratorGuard';
let n=0,f=0;const check=(v:boolean,s:string)=>{n++;if(!v){f++;console.log('FAIL '+s)}else console.log('PASS '+s)};
const wrong:[string,Record<string,unknown>][]=[
['how are passwords stored?',{options:{lower:true}}],['recover my old password',{options:{lower:true}}],['crack a password',{options:{lower:true}}],['decrypt this password',{options:{lower:true}}],['reveal my account password',{options:{lower:true}}],['retrieve saved password',{options:{lower:true}}],['generate password for wifi recovery',{options:{lower:true}}],['find my existing password',{options:{lower:true}}]
]; // HYPOTHESIS cases, unmeasured.
const right:[string,Record<string,unknown>][]=[
['generate password',{options:{lower:true}}],['create a password',{options:{upper:true}}],['generate a strong password',{options:{digits:true}}],['make a new password',{options:{symbols:true}}],['generate password now',{options:{lower:true,upper:true}}],['create password',{options:{lower:true,digits:true}}]
];
for(const [m,a] of wrong)check(passwordGeneratorGuard(a,m)!==null,'HYPOTHESIS wrong yields: '+m);
for(const [m,a] of right)check(passwordGeneratorGuard(a,m)===null,'right passes: '+m);
const cryptoApi=globalThis.crypto as unknown as {getRandomValues:(array:Uint32Array)=>Uint32Array};
const oldRandom=cryptoApi.getRandomValues;
cryptoApi.getRandomValues=(array)=>{array.fill(0);return array;};
const a=await PASSWORD_ACTION.run({length:4,options:{lower:true}} as never,{} as never) as any;check(a.password==='aaaa','hand result 1');
const b=await PASSWORD_ACTION.run({length:5,options:{upper:true}} as never,{} as never) as any;check(b.password==='AAAAA','hand result 2');
const c=await PASSWORD_ACTION.run({length:4,options:{digits:true}} as never,{} as never) as any;check(c.password==='0000','hand result 3');
cryptoApi.getRandomValues=oldRandom;
let refused=false;try{await PASSWORD_ACTION.run({length:3,options:{lower:true}} as never,{} as never)}catch{refused=true}check(refused,'refused too-short password');
const mutant=()=>null;check(mutant()===null&&passwordGeneratorGuard(wrong[0][1],wrong[0][0])!==null,'MUTANT CAUGHT');
console.log(`${n} checks, ${f} failed`);if(f)throw new Error('test failed');
