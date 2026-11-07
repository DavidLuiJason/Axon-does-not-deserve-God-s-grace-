/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT1-A: the kernel task action for Find and Replace, so a chat run is recorded as a TASK exactly like the existing live actions.
 * It runs the SAME pure engine as the screen and runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an available chat action and the switch must remain OFF until the Director connects all three.
 * Registration, the chat action and the LIVE_TASKS entry arrive together with the switch.
 */
import type { ActionDef } from '../kernel/types';
import { findReplace } from './engines/text/findReplace';
export const TEXT_REPLACE_ACTION: ActionDef = {
 id:'text.replace', capabilityId:'text-tools', label:'Find and replace', executionClass:'instant',
 inputFields:[
 {name:'text',type:'string',required:true,prompt:'What text should I search in? Paste it here.'},
 {name:'pattern',type:'string',required:true,prompt:'What exact text or pattern should I find?'},
 {name:'replacement',type:'string',required:false,prompt:'What should replace the match? Leave blank to remove it.'},
 ...(['caseSensitive','wholeWord','regex','replaceAll'] as const).map(name=>({name,type:'boolean' as const,required:false,prompt:'Should I use '+name+'?'}))
 ],
 outputFields:[{name:'text',type:'string'},{name:'matchCount',type:'number'}],resources:{},cancel:'none',
 evidence:'The find-and-replace engine returned the changed text and match count for the supplied pattern and options.',
 run:async input=>{const options: Record<string,boolean>={}; for(const k of ['caseSensitive','wholeWord','regex','replaceAll']) if(input[k]!==undefined) options[k]=input[k] as boolean; const r=findReplace(String(input.text),String(input.pattern),input.replacement===undefined?'':String(input.replacement),options); if(r.ok===false) throw new Error('Find and Replace refused: '+r.error); return {text:r.text,matchCount:r.matchCount};}
};
