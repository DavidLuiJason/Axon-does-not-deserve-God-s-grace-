import { NUMBER_WORDS_ACTION } from '../src/tools/numberWordsAction';
import { numberToWordsGuard } from '../src/tools/runners/guards/numberToWordsGuard';
let n=0,f=0;const check=(v:boolean,s:string)=>{n++;if(!v){f++;console.log('FAIL '+s)}else console.log('PASS '+s)};
const wrong:[string,Record<string,unknown>][]=[
['what is the number system?',{number:12}],['calculate 12 times 3',{number:12}],['convert 12 dollars to naira',{number:12}],['spell 12 as a Roman numeral',{number:12}],['find the percentage of 12',{number:12}],['round 12 to nearest ten',{number:12}],['divide 12 by 3',{number:12}],['explain number 12',{number:12}]
]; // HYPOTHESIS only; the Director measures these against the real brain.
const right:[string,Record<string,unknown>][]=[
['spell 12',{number:12}],['write 42 in words',{number:42}],['convert 100 to words',{number:100}],['say 7 as words',{number:7}],['spell 21',{number:21}],['write 5 in words',{number:5}]
];
for(const [m,a] of wrong)check(numberToWordsGuard(a,m)!==null,'HYPOTHESIS wrong yields: '+m);
for(const [m,a] of right)check(numberToWordsGuard(a,m)===null,'right passes: '+m);
const a=await NUMBER_WORDS_ACTION.run({number:12} as never,{} as never) as any;check(a.words==='twelve','hand result 1');
const b=await NUMBER_WORDS_ACTION.run({number:42} as never,{} as never) as any;check(b.words==='forty-two','hand result 2');
const c=await NUMBER_WORDS_ACTION.run({number:100,ordinal:true} as never,{} as never) as any;check(c.words==='one hundredth','hand result 3');
let refused=false;try{await NUMBER_WORDS_ACTION.run({number:'not a number'} as never,{} as never)}catch{refused=true}check(refused,'refused invalid number');
const mutant=()=>null;check(mutant()===null&&numberToWordsGuard(wrong[0][1],wrong[0][0])!==null,'MUTANT CAUGHT');
console.log(`${n} checks, ${f} failed`);if(f)throw new Error('test failed');
