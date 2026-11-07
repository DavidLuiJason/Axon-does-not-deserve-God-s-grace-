/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT1-A: the kernel task action for Number to Words, so a chat run is recorded as a TASK exactly like the existing live actions.
 * It runs the SAME pure engine as the screen and runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an available chat action and the switch must remain OFF until the Director connects all three.
 * Registration, the chat action and the LIVE_TASKS entry arrive together with the switch.
 */
import type { ActionDef } from '../kernel/types';
import { numberToWords } from './engines/numbers/numberToWords';
export const NUMBER_WORDS_ACTION: ActionDef = {
 id:'number.words', capabilityId:'number-tools', // DIRECTOR TO CONFIRM: this belongs to the number-tools capability, not text-tools.
 label:'Number to words', executionClass:'instant',
 inputFields:[{name:'number',type:'number',required:true,prompt:'Which number should I write in words?'},{name:'ordinal',type:'boolean',required:false,prompt:'Should I use ordinal wording, such as first or second?'}],
 outputFields:[{name:'words',type:'string'}],resources:{},cancel:'none',
 evidence:'The number-to-words engine converted the supplied number and ordinal setting into words.',
 run:async input=>{let engineInput: string | bigint;
 if(typeof input.number==='number'&&Number.isSafeInteger(input.number)) engineInput=BigInt(input.number);
 else if(typeof input.number==='string'&&input.number.length>0&&[...input.number].every(ch=>ch>='0'&&ch<='9')) engineInput=input.number;
 else throw new Error('Number to Words refused: invalid-input');
 const r=numberToWords(engineInput,{ordinal:input.ordinal===true}); if(r.ok===false) throw new Error('Number to Words refused: '+r.error); return {words:r.words};}
};
