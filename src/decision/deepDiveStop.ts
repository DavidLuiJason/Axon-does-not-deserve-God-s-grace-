type EngineSuccess<T>={readonly ok:true;readonly value:T};
type EngineFailure={readonly ok:false;readonly error:string;readonly message:string};
type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type Cycle={readonly gain:number;readonly cost:number};
export type StopInput={readonly cycles:readonly Cycle[];readonly successMet:boolean;readonly ownerStop:boolean;readonly budget:number;readonly maxCycles?:number};
export type StopVerdict={readonly decision:'CONTINUE'|'STOP';readonly reason:'owner-stop'|'success'|'budget-used'|'no-gain'|'max-cycles'|'continue';readonly spent:number;readonly cyclesRun:number};
const fail=(error:string,message:string):EngineResult<never>=>Object.freeze({ok:false,error,message});
export function nextCycle(input:StopInput):EngineResult<StopVerdict>{
 if(input===null||typeof input!=='object'||typeof input.successMet!=='boolean'||typeof input.ownerStop!=='boolean')return fail('bad-input','Input and its decision flags must be valid.');
 if(!Array.isArray(input.cycles)||input.cycles.length>200)return fail('bad-cycles','Cycles must be an array containing at most 200 valid entries.');
 for(let i=0;i<input.cycles.length;i++){const c=input.cycles[i];if(c===null||typeof c!=='object'||!Number.isInteger(c.gain)||c.gain<0||c.gain>100||!Number.isInteger(c.cost)||c.cost<0||c.cost>1000000)return fail('bad-cycles','A cycle entry is invalid at index '+i+'.');}
 if(!Number.isInteger(input.budget)||input.budget<1||input.budget>10000000)return fail('bad-budget','Budget must be an integer from 1 to 10000000.');
 if(input.maxCycles!==undefined&&(!Number.isInteger(input.maxCycles)||input.maxCycles<1||input.maxCycles>200))return fail('bad-max','Maximum cycles must be an integer from 1 to 200.');
 let spent=0;for(const c of input.cycles)spent+=c.cost;const cyclesRun=input.cycles.length;let reason:StopVerdict['reason']='continue';
 if(input.ownerStop)reason='owner-stop';else if(input.successMet)reason='success';else if(spent>=input.budget)reason='budget-used';else if(cyclesRun>=2&&input.cycles[cyclesRun-1].gain===0&&input.cycles[cyclesRun-2].gain===0)reason='no-gain';else if(cyclesRun>=(input.maxCycles===undefined?10:input.maxCycles))reason='max-cycles';
 const decision=reason==='continue'?'CONTINUE':'STOP';return Object.freeze({ok:true,value:Object.freeze({decision,reason,spent,cyclesRun})});
}
