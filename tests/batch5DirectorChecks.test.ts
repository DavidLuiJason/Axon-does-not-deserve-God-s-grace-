import {runTraps} from '../src/testkit/trapRunner';
import {redactSecrets,gateRequest} from '../src/web/outsideAiGate';
import {makeSheet,checkText} from '../src/story/characterSheet';
declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
// Director checks: boundaries the builders' own tests left open (found by Director mutants).
const answer=(_i:string)=>({kind:'answer' as const});
const two=[{id:'a',input:'x',expect:'answer' as const},{id:'b',input:'y',expect:'answer' as const}];
const atMin=runTraps(two,answer,{minTraps:2});
check(atMin.ok&&atMin.value.gate==='SAFE'&&atMin.value.gateReason==='all-passed','exactly the minimum number of traps, all passed, is SAFE');
const underMin=runTraps(two,answer,{minTraps:3});
check(underMin.ok&&underMin.value.gate==='NOT-SAFE'&&underMin.value.gateReason==='too-few-traps','fewer traps than the minimum is NOT-SAFE');
const seven='abcdefg',eight='abcdefgh';
const r7=redactSecrets('x '+seven,[seven]);check(!r7.ok&&r7.error==='secret-too-short','a 7-character secret is refused by redactSecrets');
const r8=redactSecrets('x '+eight,[eight]);check(r8.ok&&r8.value.text==='x [REDACTED]'&&r8.value.redactions===1,'an 8-character secret is accepted and redacted');
const pol=(s:string)=>({maxPromptChars:100,maxAttachments:1,maxTurns:3,secrets:[s]});
const req={provider:'p',prompt:'hello',attachments:0,turn:1};
const g7=gateRequest(req,pol(seven));check(!g7.ok&&g7.error==='bad-policy','a 7-character secret makes the gate policy invalid');
const g8=gateRequest(req,pol(eight));check(g8.ok,'an 8-character secret makes a valid gate policy');
const sheet=makeSheet({id:'mara',names:['Mara'],traits:[{key:'eyes',value:'green',domain:['green','blue']}]});
if(!sheet.ok)throw new Error('FAIL: sheet should build');
const last=checkText(sheet.value,'The one with blue eyes was Mara.');
check(last.ok&&last.value.mentions===1&&last.value.findings.length===1&&last.value.findings[0].found==='blue','a name that is the last word of its sentence is still checked');
const fine=checkText(sheet.value,'Mara had green eyes.');
check(fine.ok&&fine.value.findings.length===0,'a correct trait gives no finding');
console.log('BATCH5_DIRECTOR_CHECKS OK: '+checks+' checks');
