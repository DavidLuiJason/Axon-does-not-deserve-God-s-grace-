/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT1-A: the kernel task action for Text Cleaner, so a chat run is recorded as a TASK exactly like the existing live actions.
 * It runs the SAME pure engine as the screen and runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an available chat action and the switch must remain OFF until the Director connects all three.
 * Registration, the chat action and the LIVE_TASKS entry arrive together with the switch.
 */
import type { ActionDef } from '../kernel/types';
import { textCleaner } from './engines/text/textCleaner';
export const TEXT_CLEAN_ACTION: ActionDef = {
 id:'text.clean', capabilityId:'text-tools', label:'Clean text', executionClass:'instant',
 inputFields:[
  {name:'text',type:'string',required:true,prompt:'What text should I clean? Paste it here.'},
  ...(['trimEachLine','collapseRepeatedSpaces','removeBlankLines','collapseBlankLines','straightenQuotesAndDashes','removeZeroWidth','normalizeLineEndings'] as const).map(name=>({name,type:'boolean' as const,required:false,prompt:'Should I apply '+name+'?'}))
 ],
 outputFields:[{name:'text',type:'string'},{name:'counts',type:'string'}], resources:{}, cancel:'none',
 evidence:'The text cleaner engine returned the cleaned text and its change counts for the supplied options.',
 run:async input=>{const options: Record<string,boolean>={}; for(const k of ['trimEachLine','collapseRepeatedSpaces','removeBlankLines','collapseBlankLines','straightenQuotesAndDashes','removeZeroWidth','normalizeLineEndings']) if(input[k]!==undefined) options[k]=input[k] as boolean; const r=textCleaner(String(input.text),options); if(r.ok===false) throw new Error('Text Cleaner refused: '+r.error); return {text:r.text,counts:JSON.stringify(r.counts)};}
};
