/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT1-A: the kernel task action for Hash Tool, so a chat run is recorded as a TASK exactly like the existing live actions.
 * It runs the SAME pure engine as the screen and runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an available chat action and the switch must remain OFF until the Director connects all three.
 * Registration, the chat action and the LIVE_TASKS entry arrive together with the switch.
 */
import type { ActionDef } from '../kernel/types';
import { hashChecksum, type HashAlgorithm } from './engines/create/hashChecksum';
export const HASH_ACTION: ActionDef = {
 id:'create.hash', capabilityId:'creation-tools', // DIRECTOR TO CONFIRM: this belongs to creation-tools, not text-tools.
 label:'Calculate hash', executionClass:'instant',
 inputFields:[{name:'input',type:'string',required:true,prompt:'What text should I hash?'},{name:'algorithm',type:'string',required:true,prompt:'Which hash algorithm or checksum should I use?'}],
 outputFields:[{name:'hex',type:'string'}],resources:{},cancel:'none',
 evidence:'The hash engine returned the digest or checksum for the supplied text and algorithm.',
 run:async input=>{const algorithm=String(input.algorithm) as HashAlgorithm; const r=await hashChecksum(String(input.input),algorithm); if(r.ok===false) throw new Error('Hash Tool refused: '+r.error); return {hex:r.hex};}
};
