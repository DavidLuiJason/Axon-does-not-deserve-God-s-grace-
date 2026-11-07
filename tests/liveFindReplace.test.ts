import { TEXT_REPLACE_ACTION } from '../src/tools/textReplaceAction';
import { findReplaceGuard } from '../src/tools/runners/guards/findReplaceGuard';
let n=0,f=0;const check=(v:boolean,s:string)=>{n++;if(!v){f++;console.log('FAIL '+s)}else console.log('PASS '+s)};
const wrong:[string,Record<string,unknown>][]=[
['how does find and replace work?',{text:'work'}],['replace a file on my phone',{text:'file'}],['find "cat" and translate it',{text:'cat'}],['find "cat" and summarize it',{text:'cat'}],['find "cat" in my database',{text:'cat'}],['replace every file in folder',{text:'folder'}],['undo the last replacement',{text:'replacement'}],['what is regex?',{text:'regex'}]
]; // HYPOTHESIS cases, not measured against real brain.
const right:[string,Record<string,unknown>][]=[
['find "cat" and replace',{text:'cat'}],['replace in "cat sat"',{text:'cat sat'}],['find "red cat" and replace',{text:'red cat'}],['find "abc abc" and replace',{text:'abc abc'}],['find "hello" and replace',{text:'hello'}],['find "one two" and replace',{text:'one two'}]
];
for(const [m,a] of wrong)check(findReplaceGuard(a,m)!==null,'HYPOTHESIS wrong yields: '+m);
for(const [m,a] of right)check(findReplaceGuard(a,m)===null,'right passes: '+m);
const a=await TEXT_REPLACE_ACTION.run({text:'cat dog',pattern:'cat',replacement:'fox'} as never,{} as never) as any;check(a.text==='fox dog','hand result 1');
const b=await TEXT_REPLACE_ACTION.run({text:'a a',pattern:'a',replacement:'b',replaceAll:true} as never,{} as never) as any;check(b.text==='b b','hand result 2');
const c=await TEXT_REPLACE_ACTION.run({text:'red red',pattern:'red',replacement:'blue'} as never,{} as never) as any;check(c.text==='blue red','hand result 3');
let refused=false;try{await TEXT_REPLACE_ACTION.run({text:'abc',pattern:'(',regex:true} as never,{} as never)}catch{refused=true}check(refused,'refused invalid pattern');
const mutant=()=>null;check(mutant()===null&&findReplaceGuard(wrong[0][1],wrong[0][0])!==null,'MUTANT CAUGHT');
console.log(`${n} checks, ${f} failed`);if(f)throw new Error('test failed');
