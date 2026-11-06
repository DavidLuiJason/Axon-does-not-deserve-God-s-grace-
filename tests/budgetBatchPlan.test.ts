import { builderVector, packBatch } from '../src/budget/batchPlan';
import { BUILDER_LOG_ROWS } from './fixtures/builderLogRows';
import { newBudget } from '../src/budget/budgetBroker';
import { budgetView } from '../src/budget/budgetView';

let checks = 0;
function check(condition: unknown, label: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  check(JSON.stringify(actual) === JSON.stringify(expected), `${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
function errorOf<T>(result: { ok: true; value: T } | { ok: false; error: string }): string | undefined {
  return result.ok ? undefined : result.error;
}
function bv(input: unknown) { const r = builderVector(input); check(r.ok, 'builderVector success'); return r.ok ? r.value : undefined; }
function pb(input: unknown) { const r = packBatch(input); check(r.ok, 'packBatch success'); return r.ok ? r.value : undefined; }
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id:'r1', date:'2026-11-06', builder:'T', mode:'A', cards:1, accepted:1,
    promptChars:null, miniBaseFiles:null, filesReturned:5, directorCommands:null, directorTurns:null,
    outcome:'OK', source:'MEASURED', ...overrides };
}
const real = bv({ rows: BUILDER_LOG_ROWS, builder:'ChatGPT' });
check(real !== undefined, 'real ChatGPT vector exists');
equal(real?.runs, 18, 'real ChatGPT runs');
equal(real?.figures.promptChars, { figure:16000, reason:'ok', okRows:3, badRows:2, basis:'ESTIMATE' }, 'real prompt figure');
equal(real?.figures.miniBaseFiles, { figure:10, reason:'ok', okRows:3, badRows:0, basis:'ESTIMATE' }, 'real mini-base figure');
equal(real?.figures.filesReturned, { figure:22, reason:'ok', okRows:12, badRows:0, basis:'OBSERVED' }, 'real files figure');
equal(real?.figures.directorCommands, { figure:null, reason:'no-ok-rows', okRows:0, badRows:0, basis:null }, 'real commands figure');
equal(real?.capacity, { repoFiles:22 }, 'real capacity');
equal(real?.unknown, [
  {resource:'builderMemoryMb',reason:'no-log-field'}, {resource:'archiveExpandMb',reason:'no-log-field'},
  {resource:'testMinutes',reason:'no-log-field'}, {resource:'reviewCommands',reason:'no-ok-rows'}
], 'real unknown list');
const claude = bv({rows:BUILDER_LOG_ROWS,builder:'Claude'});
equal(claude?.runs,11,'Claude runs'); equal(claude?.capacity,{},'Claude empty capacity');
equal(claude?.figures.directorCommands,{figure:null,reason:'conflict',okRows:9,badRows:1,basis:null},'Claude commands conflict');
equal(claude?.unknown.map(x=>x.resource),['builderMemoryMb','archiveExpandMb','repoFiles','testMinutes','reviewCommands'],'Claude unknown order');
equal([claude?.figures.promptChars.reason,claude?.figures.miniBaseFiles.reason,claude?.figures.filesReturned.reason],
['no-ok-rows','no-ok-rows','no-ok-rows'],'Claude other figures');
equal(claude?.unknown.map(x=>x.reason),['no-log-field','no-log-field','no-ok-rows','no-log-field','conflict'],'Claude unknown reasons');
const grok = bv({rows:BUILDER_LOG_ROWS,builder:'Grok'});
equal(grok?.runs,1,'Grok runs');
equal(grok?.unknown.map(x=>x.reason),['no-log-field','no-log-field','no-ok-rows','no-log-field','no-ok-rows'],'Grok unknown reasons'); equal(grok?.figures.promptChars,{figure:null,reason:'no-ok-rows',okRows:0,badRows:1,basis:null},'Grok prompt');
const vibe = bv({rows:BUILDER_LOG_ROWS,builder:'Vibe'});
equal(vibe?.runs,0,'Vibe runs');
equal([vibe?.figures.promptChars.reason,vibe?.figures.miniBaseFiles.reason,vibe?.figures.filesReturned.reason,vibe?.figures.directorCommands.reason],['no-ok-rows','no-ok-rows','no-ok-rows','no-ok-rows'],'Vibe no-OK figures'); equal(vibe?.unknown.length,5,'Vibe all unknown');

// Builder vector validation: first failure wins and all row checks precede duplicate detection.
equal(errorOf(builderVector(5)),'bad-input','vector bad input');
equal(errorOf(builderVector({rows:[],builder:'T',extra:true})),'unknown-key','vector unknown key');
equal(errorOf(builderVector(Object.assign({rows:[],builder:'T'},{[Symbol('extra')]:1}))),'unknown-key','vector symbol key');
equal(errorOf(builderVector({rows:[]})),'unknown-key','vector missing key');
equal(errorOf(builderVector({rows:[],builder:''})),'bad-builder','vector bad builder');
equal(errorOf(builderVector({rows:'x',builder:'T'})),'bad-rows','vector bad rows');
equal(errorOf(builderVector({rows:[5],builder:'T'})),'bad-row','vector bad row');
for (const date of ['2026-1-05','2026/01/05','2026-01x05','2026x01-05','2026-01-0a']) {
  equal(errorOf(builderVector({rows:[row({date})],builder:'T'})),'bad-row',`bad date ${date}`);
}
for (const invalid of [
  row({outcome:'OK',accepted:0}), row({outcome:'FAILED',accepted:1}),
  row({outcome:'PARTIAL',accepted:1,cards:1}), row({cards:0}), {...row(),[Symbol('extra')]:1},
  {...row(), extra:1}
]) equal(errorOf(builderVector({rows:[invalid],builder:'T'})),'bad-row','invalid row consistency/shape');
equal(errorOf(builderVector({rows:[row(),row()],builder:'T'})),'duplicate-row-id','duplicate id');
equal(errorOf(builderVector({rows:[row(),row(),5],builder:'T'})),'bad-row','row validation before duplicate');
equal(errorOf(builderVector({rows:5,builder:'T'})),'bad-rows','rows non-array');
equal(errorOf(builderVector({rows:[row({accepted:2,cards:1})],builder:'T'})),'bad-row','accepted exceeds cards');
equal(errorOf(builderVector({rows:[row({accepted:-1})],builder:'T'})),'bad-row','accepted negative');
equal(errorOf(builderVector({rows:[row({promptChars:0})],builder:'T'})),'bad-row','zero nullable positive field');
equal(errorOf(builderVector({rows:[row({directorTurns:1.5})],builder:'T'})),'bad-row','fraction nullable positive field');
equal(errorOf(builderVector({rows:[row({mode:'X'})],builder:'T'})),'bad-row','invalid mode');
equal(errorOf(builderVector({rows:[row({source:'UNKNOWN'})],builder:'T'})),'bad-row','invalid source');
equal(bv({rows:[],builder:'T'})?.runs,0,'empty rows valid');
const four = Array.from({length:4},(_,i)=>row({id:`f${i}`,filesReturned:5}));
equal(bv({rows:four,builder:'T'})?.figures.filesReturned.basis,'ESTIMATE','four samples estimate');
const five = [...four,row({id:'f4',filesReturned:5})];
equal(bv({rows:five,builder:'T'})?.figures.filesReturned.basis,'OBSERVED','five samples observed');
equal(bv({rows:[row({id:'ok',promptChars:10000}),row({id:'bad',promptChars:10000,outcome:'FAILED',accepted:0})],builder:'T'})?.figures.promptChars.reason,'conflict','equal failure conflicts');
equal(bv({rows:[row({id:'ok',promptChars:10000}),row({id:'bad',promptChars:10001,outcome:'FAILED',accepted:0})],builder:'T'})?.figures.promptChars.figure,10000,'failure above safe does not conflict');

// P1-P12 and additional packing boundaries.
const cards=(n:number,chars=1000)=>Array.from({length:n},(_,i)=>({id:`c${i+1}`,chars}));
const p1=pb({cards:Array.from('ABCDEFG',id=>({id,chars:3000})),overheadChars:4000,history:[]});
equal([p1?.target,p1?.targetReason,p1?.inMaster,p1?.inMiniBase,p1?.outcome,p1?.usedChars],
[6,'start',['A','B','C','D'],[{id:'E',reason:'no-room'},{id:'F',reason:'no-room'},{id:'G',reason:'no-room'}],'PACKED',12000],'P1');
const p2=pb({cards:cards(8),overheadChars:4000,history:[]});
equal([p2?.inMaster,p2?.inMiniBase.map(x=>x.reason)],[['c1','c2','c3','c4','c5','c6'],['target-reached','target-reached']],'P2');
equal([pb({cards:cards(8),overheadChars:0,history:[{cards:6,accepted:6,directorTurns:null}]})?.target,pb({cards:cards(8),overheadChars:0,history:[{cards:6,accepted:6,directorTurns:null}]})?.targetReason],[6,'turns-unknown'],'P3');
const p4=pb({cards:cards(10),overheadChars:0,history:[{cards:6,accepted:6,directorTurns:2}]});
equal([p4?.target,p4?.targetReason,p4?.inMaster.length,p4?.usedChars],[8,'raise',8,8000],'P4');
const p5=pb({cards:cards(10),overheadChars:0,history:[{cards:6,accepted:5,directorTurns:2}]});
equal([p5?.target,p5?.targetReason,p5?.inMaster.length],[5,'shrink',5],'P5');
const p6=pb({cards:cards(10),overheadChars:0,history:[{cards:6,accepted:6,directorTurns:3}]});
equal([p6?.target,p6?.targetReason,p6?.inMaster.length],[5,'shrink',5],'P6');
const p7=pb({cards:cards(10),overheadChars:0,history:[{cards:10,accepted:10,directorTurns:1}]});
equal([p7?.target,p7?.targetReason,p7?.inMaster.length],[10,'raise',10],'P7 ceiling');
const p8=pb({cards:cards(10),overheadChars:0,history:[{cards:3,accepted:2,directorTurns:1}]});
equal([p8?.target,p8?.targetReason,p8?.inMaster.length],[3,'shrink',3],'P8 floor');
const p9=pb({cards:[{id:'big',chars:20000},{id:'s1',chars:1000},{id:'s2',chars:1000}],overheadChars:4000,history:[]});
equal([p9?.inMaster,p9?.inMiniBase,p9?.outcome,p9?.usedChars],[['s1','s2'],[{id:'big',reason:'over-limit'}],'TOO-FEW',2000],'P9');
equal([pb({cards:cards(3),overheadChars:16000,history:[]})?.outcome,pb({cards:cards(3),overheadChars:16000,history:[]})?.inMiniBase.map(x=>x.reason)],['NOTHING',['no-room','no-room','no-room']],'P10');
equal(pb({cards:[{id:'one',chars:1}],overheadChars:20000,history:[]})?.outcome,'NOTHING','P11');
equal(pb({cards:cards(10),overheadChars:0,history:[{cards:6,accepted:3,directorTurns:null}]})?.target,5,'P12');
equal(pb({cards:cards(10),overheadChars:0,history:[{cards:12,accepted:12,directorTurns:null}]})?.target,10,'unknown turns ceiling clamp');
equal(pb({cards:cards(10),overheadChars:0,history:[{cards:6,accepted:1,directorTurns:9},{cards:6,accepted:6,directorTurns:2}]})?.target,8,'only last history entry');
equal(pb({cards:cards(3),overheadChars:4000,history:[]})?.outcome,'PACKED','exactly three cards');
equal(pb({cards:[{id:'exact',chars:12000}],overheadChars:4000,history:[]})?.inMaster,['exact'],'exact usable fits');
equal(pb({cards:[{id:'over',chars:12001}],overheadChars:4000,history:[]})?.inMiniBase,[{id:'over',reason:'over-limit'}],'one over usable');
const skip=pb({cards:[{id:'a',chars:7000},{id:'b',chars:5001},{id:'c',chars:5000}],overheadChars:4000,history:[]});
equal([skip?.inMaster,skip?.inMiniBase],[['a','c'],[{id:'b',reason:'no-room'}]],'skip too-large remaining card and continue');

// Packing validation and precedence.
equal(errorOf(packBatch({cards:[Object.assign({id:'x',chars:1},{[Symbol('extra')]:1})],overheadChars:0,history:[]})),'bad-cards','card symbol key');

equal(errorOf(packBatch(5)),'bad-input','pack bad input');
equal(errorOf(packBatch({cards:[]})),'unknown-key','pack missing keys');
equal(errorOf(packBatch({cards:[],overheadChars:-1,history:'x'})),'bad-cards','pack first failure');
equal(errorOf(packBatch({cards:[],overheadChars:0,history:[]})),'bad-cards','empty cards');
for (const badCards of [[{id:'x',chars:1},{id:'x',chars:2}],[{id:'x',chars:0}],[{id:'x',chars:1.5}],[{id:'x',chars:1,extra:2}]]) {
  equal(errorOf(packBatch({cards:badCards,overheadChars:0,history:[]})),'bad-cards','bad card shape/value/id');
}
equal(errorOf(packBatch({cards:[{id:'x',chars:1}],overheadChars:-1,history:[]})),'bad-overhead','negative overhead');
equal(errorOf(packBatch({cards:[{id:'x',chars:1}],overheadChars:1.5,history:[]})),'bad-overhead','fraction overhead');
equal(errorOf(packBatch({cards:[{id:'x',chars:1}],overheadChars:0,history:'x'})),'bad-history','history not array');
equal(errorOf(packBatch({cards:[{id:'x',chars:1}],overheadChars:0,history:[{cards:1,accepted:2,directorTurns:null}]})),'bad-history','history accepted above cards');
equal(errorOf(packBatch({cards:[{id:'x',chars:1}],overheadChars:0,history:[{cards:1,accepted:1}]})),'bad-history','history missing key');

// Frozen output and no input mutation.
const failedFrozen=builderVector(7);
check(!failedFrozen.ok && Object.isFrozen(failedFrozen),'failure result frozen');
const mutableRows=[row()]; const rowsBefore=JSON.stringify(mutableRows);
const frozenVector=builderVector({rows:mutableRows,builder:'T'});
check(frozenVector.ok && Object.isFrozen(frozenVector) && Object.isFrozen(frozenVector.value) &&
  Object.isFrozen(frozenVector.value.figures) && Object.isFrozen(frozenVector.value.unknown) &&
  Object.isFrozen(frozenVector.value.unknown[0]),'vector deep frozen');
equal(JSON.stringify(mutableRows),rowsBefore,'vector input unchanged');
const mutableCards=cards(3); const cardsBefore=JSON.stringify(mutableCards);
const frozenBatch=packBatch({cards:mutableCards,overheadChars:0,history:[]});
check(frozenBatch.ok && Object.isFrozen(frozenBatch) && Object.isFrozen(frozenBatch.value) &&
  Object.isFrozen(frozenBatch.value.inMaster) && Object.isFrozen(frozenBatch.value.inMiniBase),'batch deep frozen');
equal(JSON.stringify(mutableCards),cardsBefore,'batch input unchanged');

// Existing broker integration: capacity is accepted and interpreted by budgetView.
const budget = newBudget(real?.capacity ?? {});
check(budget.ok,'newBudget accepts ChatGPT capacity');
if (budget.ok) {
  const blocked=budgetView({domain:'BUILDER',state:budget.value,request:{repoFiles:30}});
  const unknown=budgetView({domain:'BUILDER',state:budget.value,request:{repoFiles:10}});
  const available=budgetView({domain:'BUILDER',state:budget.value,request:{repoFiles:2}});
  const noFigure=budgetView({domain:'BUILDER',state:budget.value,request:{testMinutes:5}});
  check(blocked.ok && blocked.value.outcome==='BLOCKED','broker repoFiles 30 blocked');
  equal(blocked.ok ? blocked.value.reasons.map(x=>x.code) : [],['over-budget','estimate-only'],'broker 30 reasons');
  check(unknown.ok && unknown.value.outcome==='UNKNOWN','broker repoFiles 10 unknown');
  check(available.ok && available.value.outcome==='AVAILABLE','broker repoFiles 2 available');
  check(noFigure.ok && noFigure.value.outcome==='UNKNOWN','broker testMinutes unknown');
}
const emptyClaude=newBudget(claude?.capacity ?? {});
equal(errorOf(emptyClaude),'bad-capacity','newBudget refuses empty Claude capacity');

// Deterministic 2,000-case packing sweep.
let seed=0x5eed1234;
function random(max:number):number { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed%max; }
for (let run=0;run<2000;run+=1) {
  const count=1+random(15);
  const sweepCards=Array.from({length:count},(_,i)=>({id:`${run}-${i}`,chars:1+random(22000)}));
  const overhead=random(20001);
  const result=packBatch({cards:sweepCards,overheadChars:overhead,history:[]});
  check(result.ok,`sweep ${run} success`);
  if (!result.ok) continue;
  const masterSet=new Set(result.value.inMaster);
  const miniIds=result.value.inMiniBase.map(x=>x.id);
  const allIds=[...result.value.inMaster,...miniIds];
  equal([...allIds].sort(),sweepCards.map(x=>x.id).sort(),`sweep ${run} exact partition`);
  check(allIds.length===sweepCards.length && new Set(allIds).size===allIds.length,`sweep ${run} no duplicates`);
  const orderedMaster=sweepCards.filter(x=>masterSet.has(x.id)).map(x=>x.id);
  const orderedMini=sweepCards.filter(x=>!masterSet.has(x.id)).map(x=>x.id);
  equal(result.value.inMaster,orderedMaster,`sweep ${run} master order`);
  equal(miniIds,orderedMini,`sweep ${run} mini order`);
  const usable=16000-overhead;
  check(result.value.usedChars<=Math.max(0,usable),`sweep ${run} usable bound`);
  check(result.value.inMaster.length<=result.value.target,`sweep ${run} target bound`);
  for (const id of result.value.inMaster) {
    const card=sweepCards.find(x=>x.id===id);
    check(card !== undefined && card.chars<=usable,`sweep ${run} card limit`);
  }
}
console.log(`BATCH_PLAN OK: ${checks} checks`);
