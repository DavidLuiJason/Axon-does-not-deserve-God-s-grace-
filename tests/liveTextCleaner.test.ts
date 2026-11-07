import { TEXT_CLEAN_ACTION } from '../src/tools/textCleanAction';
import { textCleanerGuard } from '../src/tools/runners/guards/textCleanerGuard';
let n=0, failed=0; const check=(v:boolean,s:string)=>{n++;if(!v){failed++;console.log('FAIL '+s)}else console.log('PASS '+s)};
const wrong:[string,Record<string,unknown>][]=[
['how does text cleaning work?',{text:'cleaning'}],['clean my whole computer',{text:'computer'}],['clean this file on disk',{text:'file'}],['clean "hello" and translate it',{text:'hello'}],['clean "hello" and summarize it',{text:'hello'}],['clean "hello" but preserve formatting exactly',{text:'hello'}],['clean the database',{text:'database'}],['what is a text cleaner?',{text:'cleaner'}]
]; // HYPOTHESIS: binder-filled args shown; Director must measure against real brain.
const right:[string,Record<string,unknown>][]=[
['clean "  hello  "',{text:'  hello  '}],['clean "a  b"',{text:'a  b'}],['clean "one\n\ntwo"',{text:'one\n\ntwo'}],['clean "  line  "',{text:'  line  '}],['clean "curly “quote”"',{text:'curly “quote”'}],['clean "a\r\nb"',{text:'a\r\nb'}]
];
for(const [m,a] of wrong) check(textCleanerGuard(a,m)!==null,'HYPOTHESIS wrong yields: '+m);
for(const [m,a] of right) check(textCleanerGuard(a,m)===null,'right passes: '+m);
const a=await TEXT_CLEAN_ACTION.run({text:'  hi  ',trimEachLine:true} as never,{} as never) as any; check(a.text==='hi','hand result 1');
const b=await TEXT_CLEAN_ACTION.run({text:'a  b',collapseRepeatedSpaces:true} as never,{} as never) as any; check(b.text==='a b','hand result 2');
const c=await TEXT_CLEAN_ACTION.run({text:'a\r\nb',normalizeLineEndings:true} as never,{} as never) as any; check(c.text==='a\nb','hand result 3');
let refused=false;try{await TEXT_CLEAN_ACTION.run({text:'x'.repeat(200001)} as never,{} as never)}catch{refused=true}check(refused,'refused oversized input');
const mutantGuard=(args:Record<string,unknown>,message:string):string|null=>{const value=args.text;if(value===undefined||value===null||String(value)==='')return 'missing input';return null;}; check(mutantGuard(wrong[0][1],wrong[0][0])===null && textCleanerGuard(wrong[0][1],wrong[0][0])!==null,'MUTANT CAUGHT');
console.log(`${n} checks, ${failed} failed`);
if(failed)throw new Error('test failed');
