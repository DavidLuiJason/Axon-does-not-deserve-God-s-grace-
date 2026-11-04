import {gradePrompt, gradeSet, type Check, type GradeResult} from '../src/promptlab/promptGrader';
type EngineFailure={ok:false;error:string;message:string};
declare const console:{log:(s:string)=>void};
let checks=0;function check(v:boolean,n:string):void{if(!v)throw new Error('FAIL: '+n);checks++;}
const rubric:Check[]=[
 {id:'goal',kind:'contains-all',values:['goal'],weight:2},
 {id:'short',kind:'max-chars',value:60},
 {id:'steps',kind:'min-lines-starting',prefix:'- ',value:2},
 {id:'nofluff',kind:'contains-none',values:['please']}
];
const first='GOAL: sort\n- one\n- two',second='Please do it';
const a=gradePrompt(first,rubric),b=gradePrompt(second,rubric);
check(a.ok&&a.value.score===5&&a.value.maxScore===5&&a.value.passed,'hand first prompt 5/5');
check(b.ok&&b.value.score===1&&b.value.maxScore===5&&!b.value.passed,'hand second score');
check(b.ok&&JSON.stringify(b.value.failedIds)===JSON.stringify(['goal','steps','nofluff']),'hand failed ids order');
const gs=gradeSet([{id:'p1',text:first,expectPass:true},{id:'p2',text:second,expectPass:false}],rubric);
check(gs.ok&&gs.value.positivesOk===1&&gs.value.positivesTotal===1&&gs.value.negativesOk===1&&gs.value.negativesTotal===1&&gs.value.misgraded.length===0,'hand grade set');
const badSet=gradeSet([{id:'p2',text:second,expectPass:true}],rubric);
check(badSet.ok&&JSON.stringify(badSet.value.misgraded)===JSON.stringify(['p2']),'hand misgraded');
check(gradePrompt('',[{id:'min',kind:'min-chars',value:0}]).ok,'minimum zero boundary');
const defaultWeight=gradePrompt('x',[{id:'min',kind:'min-chars',value:1}]);
check(defaultWeight.ok&&defaultWeight.value.score===1&&defaultWeight.value.maxScore===1,'default weight is one');
check(gradePrompt('x',[{id:'min',kind:'min-chars',value:1}]).ok&&((gradePrompt('x',[{id:'min',kind:'min-chars',value:1}]) as {ok:true;value:GradeResult}).value.passed),'minimum exact boundary');
check(gradePrompt('abc',[{id:'max',kind:'max-chars',value:3}]).ok&&((gradePrompt('abc',[{id:'max',kind:'max-chars',value:3}]) as {ok:true;value:GradeResult}).value.passed),'maximum exact boundary');
check(gradePrompt('  - item\n- next',[{id:'lines',kind:'min-lines-starting',prefix:'- ',value:2}]).ok&&((gradePrompt('  - item\n- next',[{id:'lines',kind:'min-lines-starting',prefix:'- ',value:2}]) as {ok:true;value:GradeResult}).value.passed),'leading spaces ignored');
check(gradePrompt('GOAL',[{id:'c',kind:'contains-all',values:['goal']}]).ok&&((gradePrompt('GOAL',[{id:'c',kind:'contains-all',values:['goal']}]) as {ok:true;value:GradeResult}).value.passed),'case insensitive contains');
check(gradePrompt('hello',[{id:'n',kind:'contains-none',values:[]}]).ok,'empty contains-none passes');
check((gradePrompt('x',[]) as EngineFailure).error==='empty-rubric','empty rubric rejected');
check((gradePrompt('x',[{id:'a',kind:'max-chars',value:1},{id:'a',kind:'max-chars',value:2}]) as EngineFailure).error==='duplicate-id','duplicate rubric id');
check((gradePrompt('x',[{id:'a',kind:'max-chars',value:-1}]) as EngineFailure).error==='bad-check','negative threshold');
check((gradePrompt('x',[{id:'a',kind:'contains-all',values:[]}]) as EngineFailure).error==='bad-check','empty contains-all rejected');
check((gradePrompt('x',[{id:'a',kind:'max-chars',value:2,weight:0}]) as EngineFailure).error==='bad-weight','zero weight rejected');
check((gradePrompt('x',[{id:'a',kind:'max-chars',value:2,weight:1.5}]) as EngineFailure).error==='bad-weight','fractional weight rejected');
check((gradePrompt('x',[{id:'a',kind:'mystery' as 'max-chars',value:2}]) as EngineFailure).error==='bad-check','unknown check kind rejected');
check((gradeSet([{id:'x',text:'a',expectPass:true},{id:'x',text:'b',expectPass:false}],rubric) as EngineFailure).error==='duplicate-id','duplicate case id');
check(Object.isFrozen(a)&&a.ok&&Object.isFrozen(a.value.results),'frozen grade result');
// DIRECTOR EXTRAS (Batch 4 verification, 2026-11-04): gaps found by hand-made breakages
const xg=(t:string,r:Check[])=>{const g=gradePrompt(t,r);return g.ok?g.value.passed:null;};
check(xg('alpha only',[{id:'a',kind:'contains-all',values:['alpha','beta']}])===false,'contains-all needs EVERY value');
check(xg('a foo',[{id:'n',kind:'contains-none',values:['foo','bar']}])===false,'contains-none fails if ANY value is present');
check(xg('goal here',[{id:'a',kind:'contains-all',values:['GOAL']}])===true&&xg('Please',[{id:'n',kind:'contains-none',values:['PLEASE']}])===false,'rubric values match case-insensitively');
check(xg('A GOAL',[{id:'a',kind:'contains-all',values:['goal']}])===true,'text matches case-insensitively');
check(xg('- a\r- b',[{id:'l',kind:'min-lines-starting',prefix:'- ',value:2}])===true&&xg('- a\r\n- b',[{id:'l',kind:'min-lines-starting',prefix:'- ',value:2}])===true,'carriage returns split lines');
const xs=gradeSet([{id:'p',text:'nothing',expectPass:true}],[{id:'a',kind:'contains-all',values:['zzz']}]);
check(xs.ok&&xs.value.positivesOk===0&&xs.value.positivesTotal===1&&xs.value.misgraded.join()==='p','a failing positive is not counted ok');
console.log('PROMPT_GRADER OK: '+checks+' checks');
