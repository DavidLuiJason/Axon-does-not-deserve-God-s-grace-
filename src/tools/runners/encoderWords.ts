/**
 * PROPOSED, the owner's yes is WAITING.
 * Closed choice words for Encoder and Decoder; no words are approved until the owner says yes.
 */
import type { Encoding } from '../engines/create/encodeDecode';
export const ENCODER_MODE_WORDS: Readonly<Record<string,'encode'|'decode'>> = Object.freeze({encode:'encode',encoding:'encode',decode:'decode',decoding:'decode'});
export const ENCODER_FORMAT_WORDS: Readonly<Record<string,Encoding>> = Object.freeze({base64:'base64',base64url:'base64url',url:'url',html:'html',hex:'hex',binary:'binary',rot13:'rot13'});
export const ENCODER_MODE_CHOICES: readonly string[] = Object.freeze(Object.keys(ENCODER_MODE_WORDS));
export const ENCODER_FORMAT_CHOICES: readonly string[] = Object.freeze(Object.keys(ENCODER_FORMAT_WORDS));
export function foldEncoderMode(value: unknown): unknown { if(typeof value!=='string')return value; if(value==='encode'||value==='decode')return value; return Object.prototype.hasOwnProperty.call(ENCODER_MODE_WORDS,value.toLowerCase())?ENCODER_MODE_WORDS[value.toLowerCase()]:value; }
export function foldEncoderFormat(value: unknown): unknown { if(typeof value!=='string')return value; if(Object.prototype.hasOwnProperty.call(ENCODER_FORMAT_WORDS,value))return value; return Object.prototype.hasOwnProperty.call(ENCODER_FORMAT_WORDS,value.toLowerCase())?ENCODER_FORMAT_WORDS[value.toLowerCase()]:value; }
