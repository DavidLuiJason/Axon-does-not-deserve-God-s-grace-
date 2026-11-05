type EngineSuccess<T>={readonly ok:true;readonly value:T};
type EngineFailure={readonly ok:false;readonly error:string;readonly message:string};
type EngineResult<T>=EngineSuccess<T>|EngineFailure;

export type DecisionInput={readonly route:string;readonly depth:string;readonly depthSource?:string;readonly ask?:{readonly kind:string;readonly question:string}|null;readonly permission:string;readonly stepsLeft:number;readonly reasonCodes:readonly string[]};
export type DecisionRecord={readonly route:'FAST'|'DEEP';readonly depth:'DIRECT'|'STRUCTURED'|'ADVANCED'|'DEEP-DIVE';readonly depthSource:'AUTO'|'OWNER';readonly ask:null|{readonly kind:'CLARIFICATION'|'MISSING-INPUT'|'APPROVAL';readonly question:string};readonly permission:'ALLOW'|'ASK'|'NEVER';readonly stepsLeft:number;readonly reasonCodes:readonly string[]};

const ERROR_MESSAGE='Decision record input is invalid.';

function failure<T>(error:string):EngineResult<T>{
  return Object.freeze({ok:false as const,error,message:ERROR_MESSAGE});
}

export function makeDecisionRecord(input:DecisionInput):EngineResult<DecisionRecord>{
  if(input===null||typeof input!=='object'||Array.isArray(input))return failure('bad-input');
  const raw=input as unknown as Record<PropertyKey,unknown>;
  const ownKeys=Reflect.ownKeys(raw);
  if(Object.prototype.hasOwnProperty.call(raw,'confidence'))return failure('confidence-not-allowed');
  const allowed=['route','depth','depthSource','ask','permission','stepsLeft','reasonCodes'];
  for(const key of ownKeys){if(typeof key!=='string'||!allowed.includes(key))return failure('unknown-key');}
  if(raw.route!=='FAST'&&raw.route!=='DEEP')return failure('bad-route');
  if(raw.depth!=='DIRECT'&&raw.depth!=='STRUCTURED'&&raw.depth!=='ADVANCED'&&raw.depth!=='DEEP-DIVE')return failure('bad-depth');
  const hasDepthSource=Object.prototype.hasOwnProperty.call(raw,'depthSource');
  const depthSource=hasDepthSource?raw.depthSource:'AUTO';
  if(depthSource!=='AUTO'&&depthSource!=='OWNER')return failure('bad-depth-source');
  let ask:null|{readonly kind:'CLARIFICATION'|'MISSING-INPUT'|'APPROVAL';readonly question:string}=null;
  if(Object.prototype.hasOwnProperty.call(raw,'ask')&&raw.ask!==null){
    if(typeof raw.ask!=='object'||Array.isArray(raw.ask))return failure('bad-ask');
    const candidate=raw.ask as Record<PropertyKey,unknown>;
    const askKeys=Reflect.ownKeys(candidate);
    if(askKeys.length!==2||!Object.prototype.hasOwnProperty.call(candidate,'kind')||!Object.prototype.hasOwnProperty.call(candidate,'question'))return failure('bad-ask');
    if((candidate.kind!=='CLARIFICATION'&&candidate.kind!=='MISSING-INPUT'&&candidate.kind!=='APPROVAL')||typeof candidate.question!=='string')return failure('bad-ask');
    const question=candidate.question.trim();
    if(question.length<1||question.length>200)return failure('bad-ask');
    if((question.split('?').length-1)>1)return failure('more-than-one-question');
    ask=Object.freeze({kind:candidate.kind,question});
  }
  if(raw.permission!=='ALLOW'&&raw.permission!=='ASK'&&raw.permission!=='NEVER')return failure('bad-permission');
  if(typeof raw.stepsLeft!=='number'||!Number.isInteger(raw.stepsLeft)||raw.stepsLeft<0||raw.stepsLeft>1000)return failure('bad-steps');
  if(!Array.isArray(raw.reasonCodes)||raw.reasonCodes.length<1||raw.reasonCodes.length>10)return failure('bad-reasons');
  const reasonCodes: string[]=[];
  for(const code of raw.reasonCodes){
    if(typeof code!=='string'||!/^[a-z0-9-]{1,30}$/.test(code)||reasonCodes.includes(code))return failure('bad-reasons');
    reasonCodes.push(code);
  }
  if((raw.permission==='ASK'&&(ask===null||ask.kind!=='APPROVAL'))||(ask!==null&&ask.kind==='APPROVAL'&&raw.permission!=='ASK'))return failure('permission-ask-mismatch');
  if(raw.permission==='NEVER'&&ask!==null)return failure('blocked-with-question');
  const frozenReasons=Object.freeze(reasonCodes.slice());
  return Object.freeze({ok:true as const,value:Object.freeze({route:raw.route,depth:raw.depth,depthSource,ask,permission:raw.permission,stepsLeft:raw.stepsLeft,reasonCodes:frozenReasons})});
}
