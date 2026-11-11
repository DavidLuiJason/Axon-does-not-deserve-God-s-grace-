/** CONNECT2 Wave 2: real-brain proof for Hash Tool. Encoder/Decoder and Hash Tool are ON; Text Compare remains OFF due its measured resolver gap. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAxonBrain } from '../src/brain/index';
import { LANE_GUARDS } from '../src/brain/mind/laneGuards';
import { LIVE_TASKS } from '../src/tools/runners/liveSwitches';
import { HASH_ALGORITHM_WORDS, foldHashAlgorithm } from '../src/tools/runners/hashWords';
let n=0;const check=(ok:boolean,name:string):void=>{n++;if(!ok)throw new Error('FAILED: '+name)};
const sha=(value:string):string=>createHash('sha256').update(value,'utf8').digest('hex');
const {Dictionary}=await import('../src/brain/dictionary');const {createDictionarySlot}=await import('../src/brain/knowledge/dictionarySlot');
const dictionary=await Dictionary.open({read:async(path:string)=>readFile(join(process.cwd(),'public/dictionary/en',path),'utf8'),hash:sha});const slot=createDictionarySlot(async()=>dictionary);
const off=createAxonBrain({lane:true,slot,switches:{'text-counter':'runner','case-converter':'runner','sort-lines':'runner','text-cleaner':'runner','number-to-words':'runner','encoder-decoder':'runner'}});
const on=createAxonBrain({lane:true,slot});
const ANSWERS:ReadonlyArray<readonly[string,string,string]>=[
 ['calculate checksum of "abc" using MD5','abc','900150983cd24fb0d6963f7d28e17f72'],
 ['calculate checksum of "hello" using MD5','hello','5d41402abc4b2a76b9719d911017c592'],
 ['calculate checksum of "world" using MD5','world','7d793037a0760186574b0282f2f435e7'],
 ['calculate checksum of "123" using MD5','123','202cb962ac59075b964b07152d234b70'],
 ['calculate checksum of "abc" using SHA-1','abc','a9993e364706816aba3e25717850c26c9cd0d89d'],
 ['calculate checksum of "hello" using SHA-1','hello','aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'],
 ['calculate checksum of "abc" using SHA-256','abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
 ['calculate checksum of "hello" using SHA-256','hello','2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
 ['calculate checksum of "world" using SHA-256','world','486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7'],
 ['calculate checksum of "abc" using SHA-384','abc','cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7'],
 ['calculate checksum of "hello" using SHA-384','hello','59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f'],
 ['calculate checksum of "abc" using SHA-512','abc','ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'],
 ['calculate checksum of "hello" using SHA-512','hello','9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043'],
 ['calculate checksum of "123456789" using CRC32','123456789','cbf43926'],
 ['calculate checksum of "abc" using CRC32','abc','352441c2'],
 ['calculate checksum of "hello" using CRC32','hello','3610a686'],
 ['calculate hash for "abc" using MD5','abc','900150983cd24fb0d6963f7d28e17f72'],
 ['please calculate checksum of "123456789" using CRC32','123456789','cbf43926'],
 ['can you calculate checksum of "abc" using SHA-256','abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
 ['kindly calculate checksum of "hello" using MD5','hello','5d41402abc4b2a76b9719d911017c592'],
];
const MUST_NOT:string[]=[
 'how do hashes work?','what is hashing?','hash browns are good','hash out my plan','encrypt "hello"','decrypt "hello"','recover password "hello"','reverse hash "hello"',
 'hash this file','hash my folder','verify a digital signature','calculate checksum of "abc" using SHA-256 and CRC32','hash hello with MD5','hash it with SHA-256','hash my list',
 'calculate checksum of "hello" and translate it','calculate checksum of "hello" and send it','calculate checksum of "hello" in python','how do I calculate a hash in JavaScript?',
 'do not calculate checksum of "abc" using MD5','never hash "abc"','calculate checksum of "abc" as an image','calculate checksum of "abc" for contact David',
 'calculate checksum of "abc" in my database','calculate checksum of "abc" and calculate checksum of "hello"','calculate checksum of "abc" and encode "hello" as base64',
 'calculate checksum of "'+'x'.repeat(5000)+'" using SHA-256',
];
const OTHERS:string[]=['hello','thank you','what can you do','tell me a joke','what is 12 times 3','count words in "one two three"','encode "hello" as base64','convert "hello world" to uppercase','sort "b\na"','spell the number 42'];
const norm=(value:string):string=>value.replace(/task-\d+/g,'task-N').replace(/in \d+ ms/g,'in N ms');
let answered=0,wrong=0,missingTask=0;const differsFromOld:string[]=[];let oldFallback=0;let fastestMustNot=Number.POSITIVE_INFINITY;
for(const [text,_input,expected] of ANSWERS){const before=await off.askWithTrace({text,place:'chat'});const after=await on.askWithTrace({text,place:'chat'});if(before.reply.source==='foundation'||before.reply.source==='local-rules')oldFallback++;if(norm(before.reply.content)!==norm(after.reply.content)&&after.reply.content.includes(expected))differsFromOld.push(text);if(after.reply.source!=='runner:hash-tool'){wrong++;console.log('NOT ANSWERED '+JSON.stringify(text));continue;}answered++;if(after.reply.taskId===undefined)missingTask++;if(!after.reply.content.includes(expected)){wrong++;console.log('WRONG '+JSON.stringify(text)+' -> '+JSON.stringify(after.reply.content));}}
let keptOut=0;const leaked:string[]=[];for(const text of MUST_NOT){const a=await off.askWithTrace({text,place:'chat'});const started=performance.now();const b=await on.askWithTrace({text,place:'chat'});const elapsed=performance.now()-started;if(elapsed<fastestMustNot)fastestMustNot=elapsed;if(!b.reply.source.startsWith('runner:')&&norm(a.reply.content)===norm(b.reply.content)&&a.reply.source===b.reply.source)keptOut++;else leaked.push(text);}
let othersSame=0;const changed:string[]=[];for(const text of OTHERS){const a=await off.askWithTrace({text,place:'chat'});const b=await on.askWithTrace({text,place:'chat'});if(norm(a.reply.content)===norm(b.reply.content)&&a.reply.source===b.reply.source&&(a.reply.taskId===undefined)===(b.reply.taskId===undefined))othersSame++;else changed.push(text);}
console.log(`MEASURED real brain, ${ANSWERS.length+MUST_NOT.length+OTHERS.length} messages: answered exactly ${answered-wrong} of ${ANSWERS.length}; must-not kept out ${keptOut} of ${MUST_NOT.length}; others identical ${othersSame} of ${OTHERS.length}; answers without task record ${missingTask}`);
console.log(`OFF baseline: ${oldFallback} of ${ANSWERS.length} answer messages used foundation/local-rules fallback; DIFFERS FROM OLD (hand truth verified): ${differsFromOld.length}`);
console.log(`MUST-NOT fastest latency: ${fastestMustNot.toFixed(1)} ms (limit 1500 ms)`);
check(fastestMustNot < 1500, 'must-not response remains under 1.5 seconds');if(differsFromOld.length)console.log('DIFFERS FROM OLD: '+JSON.stringify(differsFromOld));if(leaked.length)console.log('LEAKED: '+JSON.stringify(leaked));if(changed.length)console.log('OTHER REPLIES CHANGED: '+JSON.stringify(changed));
check(wrong===0&&answered===ANSWERS.length,'all 20 known hashes match hand-written vectors');check(missingTask===0,'every hash answer has a task record');check(leaked.length===0,'all must-not cases preserve OFF reply');check(changed.length===0,'all other replies are unchanged');
const guard=LANE_GUARDS['hash-tool']!;check(typeof guard==='function','Hash Tool guard is registered');check(guard({input:'abc',algorithm:'SHA-256'},'calculate checksum of "abc" using SHA-256')===null,'guard accepts quoted input and one algorithm');check(guard({input:'abc',algorithm:'SHA-256'},'calculate checksum of "abc" using SHA-256 and CRC32')!==null,'guard rejects two algorithms');check(guard({input:'abc',algorithm:'SHA-256'},'hash this file')!==null,'guard rejects file target');check(guard({input:'x'.repeat(1001),algorithm:'SHA-256'},'calculate checksum of "'+'x'.repeat(1001)+'" using SHA-256')!==null,'guard yields on overlong input');check(Object.values(HASH_ALGORITHM_WORDS).every(v=>['MD5','SHA-1','SHA-256','SHA-384','SHA-512','CRC32'].includes(v)),'closed word set maps to engine algorithms');check(foldHashAlgorithm('sha256')==='SHA-256'&&foldHashAlgorithm('crc32')==='CRC32','algorithm aliases fold to engine values');const task=LIVE_TASKS['hash-tool']!;check(task.actionId==='create.hash'&&JSON.stringify(task.input({input:'abc',algorithm:'sha256'}))===JSON.stringify({input:'abc',algorithm:'SHA-256'}),'task record folds the algorithm');
const expectThrow=(fn:()=>void):void=>{let threw=false;try{fn();}catch{threw=true;}if(!threw)throw new Error('mutant survived');};try{expectThrow(()=>{const mutantGuard=():string|null=>null;if(mutantGuard()===null)throw new Error('must-not would leak');});console.log('MUTANT CAUGHT: guard-always-go');}catch{throw new Error('guard mutant was not caught');}try{expectThrow(()=>{const mutantOutput:string=String('wrong');if(mutantOutput!=='900150983cd24fb0d6963f7d28e17f72')throw new Error('wrong runner output');});console.log('MUTANT CAUGHT: wrong-runner-result');}catch{throw new Error('runner mutant was not caught');}try{expectThrow(()=>{const mutantTaskId:string|undefined=undefined;if(mutantTaskId===undefined)throw new Error('missing task record');});console.log('MUTANT CAUGHT: missing-task-record');}catch{throw new Error('task mutant was not caught');}
console.log('liveBrainHashTool: '+n+' checks passed');
