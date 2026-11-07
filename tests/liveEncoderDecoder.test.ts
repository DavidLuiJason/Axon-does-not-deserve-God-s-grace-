import { ENCODE_ACTION } from '../src/tools/encodeAction';
import { encoderDecoderGuard } from '../src/tools/runners/guards/encoderDecoderGuard';
import { ENCODER_MODE_WORDS,ENCODER_FORMAT_WORDS,ENCODER_MODE_CHOICES,ENCODER_FORMAT_CHOICES,foldEncoderMode,foldEncoderFormat } from '../src/tools/runners/encoderWords';
let n=0,f=0;const check=(v:boolean,s:string)=>{n++;if(!v){f++;console.log('FAIL '+s)}else console.log('PASS '+s)};
const wrong:[string,Record<string,unknown>][]=[
['how does encoding work?',{input:'data'}],['encrypt "hello"',{input:'hello'}],['hash "hello"',{input:'hello'}],['compress "hello"',{input:'hello'}],['decode a file',{input:'file'}],['encode "hello" as an image',{input:'hello'}],['sign "hello" digitally',{input:'hello'}],['reverse encryption for "hello"',{input:'hello'}],['encode and decode "hello"',{input:'hello'}],['encode "hello" as base64 and url',{input:'hello'}]
]; // HYPOTHESIS cases.
const right:[string,Record<string,unknown>][]=[
['encode "hello"',{input:'hello'}],['decode "aGVsbG8="',{input:'aGVsbG8='}],['encode "abc"',{input:'abc'}],['decode "6869"',{input:'6869'}],['encode "hello world"',{input:'hello world'}],['decode "uryyb"',{input:'uryyb'}]
];
for(const [m,a] of wrong)check(encoderDecoderGuard(a,m)!==null,'HYPOTHESIS wrong yields: '+m);
for(const [m,a] of right)check(encoderDecoderGuard(a,m)===null,'right passes: '+m);
const a=await ENCODE_ACTION.run({mode:'encode',format:'base64',input:'hi'} as never,{} as never) as any;check(a.value==='aGk=','hand result 1');
const b=await ENCODE_ACTION.run({mode:'encode',format:'url',input:'a b'} as never,{} as never) as any;check(b.value==='a%20b','hand result 2');
const c=await ENCODE_ACTION.run({mode:'decode',format:'rot13',input:'uryyb'} as never,{} as never) as any;check(c.value==='hello','hand result 3');
let refused=false;try{await ENCODE_ACTION.run({mode:'decode',format:'hex',input:'x'} as never,{} as never)}catch{refused=true}check(refused,'refused invalid hex');
check(Object.values(ENCODER_MODE_WORDS).every(v=>v==='encode'||v==='decode'),'mode words map to engine values');
check(Object.values(ENCODER_FORMAT_WORDS).every(v=>['base64','base64url','url','html','hex','binary','rot13'].includes(v)),'format words map to engine values');
check(foldEncoderMode('ENCODE')==='encode'&&foldEncoderFormat('HEX')==='hex','fold known words');
check(foldEncoderMode('sideways')==='sideways'&&foldEncoderFormat('unknown')==='unknown','unknown words unchanged');
check(new Set(Object.keys(ENCODER_MODE_WORDS)).size===ENCODER_MODE_CHOICES.length&&new Set(Object.keys(ENCODER_FORMAT_WORDS)).size===ENCODER_FORMAT_CHOICES.length,'no duplicate choice keys');
const mutant=()=>null;check(mutant()===null&&encoderDecoderGuard(wrong[0][1],wrong[0][0])!==null,'MUTANT CAUGHT');
console.log(`${n} checks, ${f} failed`);if(f)throw new Error('test failed');
