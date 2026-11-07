/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT1-A: the kernel task action for Encoder and Decoder, so a chat run is recorded as a TASK exactly like the existing live actions.
 * It runs the SAME pure engine as the screen and runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an available chat action and the switch must remain OFF until the Director connects all three.
 * Registration, the chat action and the LIVE_TASKS entry arrive together with the switch.
 */
import type { ActionDef } from '../kernel/types';
import { encodeDecode, type Encoding } from './engines/create/encodeDecode';
export const ENCODE_ACTION: ActionDef = {
 id:'create.encode', capabilityId:'creation-tools', // DIRECTOR TO CONFIRM: this belongs to creation-tools, not text-tools.
 label:'Encode or decode', executionClass:'instant',
 inputFields:[{name:'mode',type:'string',required:true,prompt:'Should I encode or decode?'},{name:'format',type:'string',required:true,prompt:'Which format should I use, such as base64, URL, HTML, hex, binary or ROT13?'},{name:'input',type:'string',required:true,prompt:'What text should I process?'}],
 outputFields:[{name:'value',type:'string'}],resources:{},cancel:'none',
 evidence:'The encoder and decoder engine returned the converted value for the requested mode and format.',
 run:async input=>{const r=encodeDecode(String(input.mode) as 'encode'|'decode',String(input.format) as Encoding,String(input.input)); if(r.ok===false) throw new Error('Encoder and Decoder refused: '+r.error); return {value:r.value};}
};
