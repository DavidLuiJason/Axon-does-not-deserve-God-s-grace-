type EngineSuccess<T>={readonly ok:true;readonly value:T};
type EngineFailure={readonly ok:false;readonly error:string;readonly message:string};
type EngineResult<T>=EngineSuccess<T>|EngineFailure;
export type UiElement={readonly id:string;readonly role:'button'|'text-field'|'password-field'|'link'|'switch'|'other';readonly label?:string;readonly secure?:boolean};
export type UiAction={readonly type:'tap'|'type'|'scroll'|'read';readonly targetId?:string;readonly text?:string};export type VetoRules={readonly categories:Readonly<Record<string,readonly string[]>>};
export type ActionVerdict={readonly decision:'ALLOWED'|'ASK'|'VETO';readonly category:string|null;readonly reason:string};
const roles=['button','text-field','password-field','link','switch','other'];const fail=<T>(error:string,message:string):EngineResult<T>=>Object.freeze({ok:false,error,message});
export function checkAction(action:UiAction,screen:readonly UiElement[],rules:VetoRules):EngineResult<ActionVerdict>{
 if(!rules||typeof rules!=='object'||!rules.categories||typeof rules.categories!=='object'||Array.isArray(rules.categories)||Object.getPrototypeOf(rules.categories)!==Object.prototype||Object.entries(rules.categories).some(([k,v])=>!k||!Array.isArray(v)||Array.from(v).some(x=>typeof x!=='string'||!x||!/^[a-z0-9]+$/.test(x))))return fail('bad-rules','Veto rules are invalid.');
 if(!Array.isArray(screen)||Array.from(screen).some(e=>!e||typeof e!=='object'||typeof e.id!=='string'||!e.id||!roles.includes(e.role))||new Set(screen.map(e=>e.id)).size!==screen.length)return fail('bad-screen','Screen elements are invalid.');
 if(!action||typeof action!=='object'||!['tap','type','scroll','read'].includes(action.type)||('text'in action&&typeof action.text!=='string'))return fail('bad-action','Action is invalid.');
 let target:UiElement|undefined;if(action.type==='tap'||action.type==='type'){target=screen.find(e=>e.id===action.targetId);if(!action.targetId||!target)return fail('unknown-target','Action target is missing or unknown.');}
 if(action.type==='read'||action.type==='scroll')return Object.freeze({ok:true,value:Object.freeze({decision:'ALLOWED',category:null,reason:'no-target-needed'})});
 if(target!.role==='password-field'||target!.secure===true)return Object.freeze({ok:true,value:Object.freeze({decision:'VETO',category:'secret',reason:'secure-field'})});
 if(typeof target!.label==='string'){const words=target!.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);for(const [category,list] of Object.entries(rules.categories)){for(const word of words){if(list.includes(word))return Object.freeze({ok:true,value:Object.freeze({decision:'VETO',category,reason:`label-word:${word}`})});}}}
 return Object.freeze({ok:true,value:Object.freeze({decision:'ASK',category:null,reason:'every-action-asks'})});
}
