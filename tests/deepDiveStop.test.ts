declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
const base=(cycles:StopInput['cycles']=[],x:Partial<StopInput>={}):StopInput=>({cycles,successMet:false,ownerStop:false,budget:100,...x});
import {nextCycle,type StopInput} from '../src/decision/deepDiveStop';
function ok(i:StopInput,reason:string,spent:number,n:number):void{const copy=JSON.stringify(i),r=nextCycle(i);check(r.ok,'success '+reason);if(r.ok){check(r.value.reason===reason,'reason '+reason);check(r.value.spent===spent,'spent '+reason);check(r.value.cyclesRun===n,'count '+reason);check(r.value.decision===(reason==='continue'?'CONTINUE':'STOP'),'decision '+reason);check(Object.isFrozen(r)&&Object.isFrozen(r.value),'frozen '+reason);}check(JSON.stringify(i)===copy,'unchanged '+reason);}
function err(i:unknown,code:string):void{const r=nextCycle(i as StopInput);check(!r.ok,'error '+code);if(!r.ok){check(r.error===code,'error code '+code);check(typeof r.message==='string'&&r.message.length>0,'error message '+code);check(Object.isFrozen(r),'frozen error '+code);}}
ok(base(),'continue',0,0);
ok(base([{gain:5,cost:40},{gain:0,cost:40}]),'continue',80,2);
ok(base([{gain:0,cost:10},{gain:0,cost:10}]),'no-gain',20,2);
ok(base([{gain:0,cost:10},{gain:3,cost:10},{gain:0,cost:10}]),'continue',30,3);
ok(base([{gain:9,cost:50},{gain:9,cost:50}]),'budget-used',100,2);
ok(base([{gain:9,cost:50},{gain:9,cost:49}]),'continue',99,2);
ok(base([{gain:0,cost:10},{gain:0,cost:10}],{ownerStop:true,successMet:true}),'owner-stop',20,2);
ok(base([],{successMet:true,budget:1}),'success',0,0);
ok(base([{gain:0,cost:50},{gain:0,cost:50}]),'budget-used',100,2);
ok(base([{gain:0,cost:1},{gain:0,cost:1}],{maxCycles:2}),'no-gain',2,2);
ok(base([{gain:1,cost:1},{gain:1,cost:1},{gain:1,cost:1}],{maxCycles:3}),'max-cycles',3,3);
ok(base([{gain:1,cost:1},{gain:1,cost:1}],{maxCycles:3}),'continue',2,2);
ok(base(Array.from({length:10},()=>({gain:1,cost:1})),{budget:1000}),'max-cycles',10,10);
ok(base(Array.from({length:9},()=>({gain:1,cost:1})),{budget:1000}),'continue',9,9);
err(base([{gain:101,cost:0}]),'bad-cycles');err(base([{gain:1.5,cost:0}]),'bad-cycles');err(base([{gain:1,cost:-1}]),'bad-cycles');err(base([null as never]),'bad-cycles');
check(nextCycle(base(Array.from({length:200},()=>({gain:1,cost:0})))).ok,'200 cycles valid');err(base(Array.from({length:201},()=>({gain:1,cost:0}))), 'bad-cycles');
err(base([],{budget:0}),'bad-budget');err(base([],{budget:10000001}),'bad-budget');check(nextCycle(base([],{budget:1})).ok,'budget minimum');check(nextCycle(base([],{budget:10000000})).ok,'budget maximum');
err({...base(),successMet:'yes' as never},'bad-input');err({...base([{gain:101,cost:0}]),ownerStop:'yes' as never},'bad-input');err(base([],{maxCycles:0}),'bad-max');err(base([],{maxCycles:201}),'bad-max');check(nextCycle(base([],{maxCycles:1})).ok,'max minimum');check(nextCycle(base([],{maxCycles:200})).ok,'max maximum');
const badFirst={cycles:[{gain:101,cost:0}],successMet:'x',ownerStop:false,budget:0} as unknown as StopInput;err(badFirst,'bad-input');
check(!nextCycle(null as never).ok,'null input');check(nextCycle(base([{gain:0,cost:0},{gain:0,cost:0}],{budget:1})).ok,'zero cost and no-gain ordering');
console.log('DEEP_DIVE_STOP OK: '+checks+' checks');
