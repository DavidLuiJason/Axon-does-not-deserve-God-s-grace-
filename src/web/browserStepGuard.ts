type EngineSuccess<T>={readonly ok:true;readonly value:T};
type EngineFailure={readonly ok:false;readonly error:string;readonly message:string};
type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type StepKind='open-url'|'read'|'scroll'|'find-on-page'|'click-link'|'click-control'|'type-text'|'submit-form'|'sign-in'|'send-message'|'download'|'payment';
export type BrowserStep={readonly kind:StepKind;readonly url?:string;readonly containsCredentials?:boolean};
export type Decision='ALLOWED'|'ASK'|'REFUSED';
export type StepVerdict={readonly index:number;readonly kind:StepKind;readonly decision:Decision;readonly reason:string};
export type RunPlan={readonly verdicts:readonly StepVerdict[];readonly allowedCount:number;readonly askCount:number;readonly refusedCount:number;readonly stoppedAtBudget:boolean;readonly stopIndex:number|null};
const kinds:readonly string[]=['open-url','read','scroll','find-on-page','click-link','click-control','type-text','submit-form','sign-in','send-message','download','payment'];
const fail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
export function classifyStep(step:BrowserStep,index=0):EngineResult<StepVerdict>{
 if(!step||typeof step!=='object'||!kinds.includes((step as BrowserStep).kind)||('url'in step&&typeof step.url!=='string')||('containsCredentials'in step&&typeof step.containsCredentials!=='boolean'))return fail('bad-step','Step has an invalid shape.');
 const s=step as BrowserStep;let decision:Decision='ASK',reason='unknown-effect';
 const good=typeof s.url==='string'&&/^https?:\/\//i.test(s.url)&&!s.url.slice(s.url.indexOf('//')+2).split('/')[0].includes('@');
 const credential=typeof s.url==='string'&&/^https?:\/\//i.test(s.url)&&s.url.slice(s.url.indexOf('//')+2).split('/')[0].includes('@');
 if(s.kind==='open-url'){decision=good?'ALLOWED':'REFUSED';reason=good?'read-only':credential?'credentials-in-url':'bad-url';}
 else if(s.kind==='click-link'){if(s.url===undefined){decision='ASK';reason='target-unknown';}else{decision=good?'ALLOWED':'REFUSED';reason=good?'read-only':credential?'credentials-in-url':'bad-url';}}
 else if(s.kind==='read'||s.kind==='scroll'||s.kind==='find-on-page'){decision='ALLOWED';reason='read-only';}
 else if(s.kind==='type-text'&&s.containsCredentials===true){decision='REFUSED';reason='credentials-never-typed';}
 else if(s.kind==='type-text')reason='typing-into-page';
 else if(s.kind==='submit-form')reason='form-submit';else if(s.kind==='sign-in')reason='sign-in';else if(s.kind==='send-message')reason='sending';else if(s.kind==='download')reason='download';else if(s.kind==='payment')reason='money';
 return Object.freeze({ok:true,value:Object.freeze({index,kind:s.kind,decision,reason})});
}
export function checkPlan(steps:readonly BrowserStep[],budget:{maxSteps:number;maxAsks?:number}):EngineResult<RunPlan>{
 if(!budget||!Number.isInteger(budget.maxSteps)||budget.maxSteps<1||budget.maxSteps>200||('maxAsks'in budget&&(!Number.isInteger(budget.maxAsks)||budget.maxAsks!<0||budget.maxAsks!>50)))return fail('bad-budget','Budget limits are invalid.');
 if(!Array.isArray(steps))return fail('bad-plan','Steps must be an array.');if(steps.length>1000)return fail('too-many-steps','Plan exceeds 1000 steps.');
 const maxAsks=budget.maxAsks??10,verdicts:StepVerdict[]=[];let allowedCount=0,askCount=0,refusedCount=0,stoppedAtBudget=false,stopIndex:number|null=null;
 for(let i=0;i<steps.length;i++){if(i===budget.maxSteps){stoppedAtBudget=true;stopIndex=i;break;}const v=classifyStep(steps[i],i);if(!v.ok)return fail('bad-step',`Step ${i} is invalid.`);if(v.value.decision==='ASK'&&askCount===maxAsks){stoppedAtBudget=true;stopIndex=i;break;}verdicts.push(v.value);if(v.value.decision==='ALLOWED')allowedCount++;else if(v.value.decision==='ASK')askCount++;else refusedCount++;}
 return Object.freeze({ok:true,value:Object.freeze({verdicts:Object.freeze(verdicts),allowedCount,askCount,refusedCount,stoppedAtBudget,stopIndex})});
}
