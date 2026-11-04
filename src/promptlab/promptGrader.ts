type EngineSuccess<T>={readonly ok:true;readonly value:T}; type EngineFailure={readonly ok:false;readonly error:string;readonly message:string}; type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type Check={id:string;weight?:number}&({kind:'min-chars'|'max-chars';value:number}|{kind:'contains-all'|'contains-none';values:readonly string[]}|{kind:'min-lines-starting';prefix:string;value:number});
export type GradeResult={score:number;maxScore:number;passed:boolean;failedIds:readonly string[];results:readonly {id:string;passed:boolean}[]};
export type GradeCase={id:string;text:string;expectPass:boolean};
export type GradeSetResult={positivesOk:number;positivesTotal:number;negativesOk:number;negativesTotal:number;misgraded:readonly string[]};
const pgFail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
const pgOk=<T>(value:T):EngineResult<T>=>Object.freeze({ok:true,value});
function validateRubric(rubric:readonly Check[]):EngineFailure|null{
 if(!Array.isArray(rubric)||rubric.length===0)return {ok:false,error:'empty-rubric',message:'rubric must not be empty'};
 const ids=new Set<string>();
 for(let i=0;i<rubric.length;i++){
  const c=rubric[i] as Check;
  if(!c||typeof c!=='object'||typeof c.id!=='string'||c.id.trim()==='')return {ok:false,error:'bad-check',message:`invalid check at ${i}`};
  if(ids.has(c.id))return {ok:false,error:'duplicate-id',message:`duplicate check id: ${c.id}`}; ids.add(c.id);
  if(c.weight!==undefined&&(!Number.isInteger(c.weight)||c.weight<=0))return {ok:false,error:'bad-weight',message:`invalid weight for ${c.id}`};
  if(c.kind==='min-chars'||c.kind==='max-chars'){
   if(!Number.isInteger(c.value)||c.value<0)return {ok:false,error:'bad-check',message:`invalid value for ${c.id}`};
  }else if(c.kind==='contains-all'||c.kind==='contains-none'){
   if(!Array.isArray(c.values)||!c.values.every(v=>typeof v==='string')||(c.kind==='contains-all'&&c.values.length===0))
    return {ok:false,error:'bad-check',message:`invalid values for ${c.id}`};
  }else if(c.kind==='min-lines-starting'){
   if(typeof c.prefix!=='string'||!Number.isInteger(c.value)||c.value<0)return {ok:false,error:'bad-check',message:`invalid line check ${c.id}`};
  }else return {ok:false,error:'bad-check',message:`unknown kind for ${c.id}`};
 }
 return null;
}
export function gradePrompt(text:string,rubric:readonly Check[]):EngineResult<GradeResult>{
 if(typeof text!=='string')return pgFail('bad-check','text must be a string');
 const invalid=validateRubric(rubric);if(invalid)return invalid;
 let score=0,maxScore=0;const failedIds:string[]=[],results:{id:string;passed:boolean}[]=[];
 const lower=text.toLowerCase(),lines=text.split(/\r\n|\n|\r/);
 for(const c of rubric){
  const weight=c.weight===undefined?1:c.weight;maxScore+=weight;
  let passed=false;
  if(c.kind==='min-chars')passed=text.length>=c.value;
  else if(c.kind==='max-chars')passed=text.length<=c.value;
  else if(c.kind==='contains-all')passed=c.values.every(v=>lower.includes(v.toLowerCase()));
  else if(c.kind==='contains-none')passed=c.values.every(v=>!lower.includes(v.toLowerCase()));
  else if(c.kind==='min-lines-starting')passed=lines.filter(line=>line.replace(/^ +/,'').startsWith(c.prefix)).length>=c.value;
  if(passed)score+=weight;else failedIds.push(c.id);
  results.push(Object.freeze({id:c.id,passed}));
 }
 return pgOk(Object.freeze({score,maxScore,passed:score===maxScore,failedIds:Object.freeze(failedIds),results:Object.freeze(results)}));
}
export function gradeSet(cases:readonly GradeCase[],rubric:readonly Check[]):EngineResult<GradeSetResult>{
 const invalid=validateRubric(rubric);if(invalid)return invalid;
 if(!Array.isArray(cases))return pgFail('bad-check','cases must be an array');
 const ids=new Set<string>();let positivesOk=0,positivesTotal=0,negativesOk=0,negativesTotal=0;const misgraded:string[]=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i];
  if(!c||typeof c.id!=='string'||c.id.trim()===''||typeof c.text!=='string'||typeof c.expectPass!=='boolean')return pgFail('bad-check',`invalid case at ${i}`);
  if(ids.has(c.id))return pgFail('duplicate-id',`duplicate case id: ${c.id}`);ids.add(c.id);
  const g=gradePrompt(c.text,rubric);if(!g.ok)return g;
  if(c.expectPass){positivesTotal++;if(g.value.passed)positivesOk++;}
  else{negativesTotal++;if(!g.value.passed)negativesOk++;}
  if(g.value.passed!==c.expectPass)misgraded.push(c.id);
 }
 return pgOk(Object.freeze({positivesOk,positivesTotal,negativesOk,negativesTotal,misgraded:Object.freeze(misgraded)}));
}
