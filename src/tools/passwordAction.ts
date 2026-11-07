/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT1-A: the kernel task action for Password Generator, so a chat run is recorded as a TASK exactly like the existing live actions.
 * It runs the SAME pure engine as the screen and runner (FL14). It is NOT registered in `axonEngine.ts` yet: a registered kernel action
 * needs an available chat action and the switch must remain OFF until the Director connects all three.
 * Registration, the chat action and the LIVE_TASKS entry arrive together with the switch.
 */
import type { ActionDef } from '../kernel/types';
import { passwordGenerator, cryptoRandomBelow } from './engines/create/passwordGenerator';
export const PASSWORD_ACTION: ActionDef = {
 id:'create.password', capabilityId:'creation-tools', // DIRECTOR TO CONFIRM: this belongs to creation-tools, not text-tools.
 label:'Generate password', executionClass:'instant',
 inputFields:[{name:'length',type:'number',required:true,prompt:'How many characters should the password have?'},{name:'options',type:'string',required:true,prompt:'Which character groups should it include? Give a JSON object with lower, upper, digits, symbols or excludeLookAlikes.'},{name:'random',type:'string',required:false,prompt:'Optional random-source note; normal runs use the built-in random source.'}],
 outputFields:[{name:'password',type:'string'},{name:'entropyBits',type:'number'}],resources:{},cancel:'none',
 evidence:'The password generator produced a password using the requested length and character options.',
 run:async input=>{let opts: unknown=input.options; if(typeof opts==='string'){try{opts=JSON.parse(opts) as unknown;}catch{throw new Error('Password Generator refused: invalid-options');}} if(!opts||typeof opts!=='object'||Array.isArray(opts)) throw new Error('Password Generator refused: invalid-options'); const allowed: Readonly<Record<string,true>>=Object.freeze({lower:true,upper:true,digits:true,symbols:true,excludeLookAlikes:true}); const record=opts as Record<string,unknown>; if(Object.keys(record).some(key=>!Object.prototype.hasOwnProperty.call(allowed,key))||Object.values(record).some(value=>typeof value!=='boolean')) throw new Error('Password Generator refused: invalid-options'); const r=passwordGenerator({length:Number(input.length),...(record as {lower?:boolean;upper?:boolean;digits?:boolean;symbols?:boolean;excludeLookAlikes?:boolean})}, cryptoRandomBelow); if(r.ok===false) throw new Error('Password Generator refused: '+r.error); return {password:r.password,entropyBits:r.entropyBits};}
};
