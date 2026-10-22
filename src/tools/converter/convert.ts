import { convert as unitConvert } from '../engines/numbers/unitConvert';
import { convertBase } from '../engines/numbers/baseConvert';
import { CONVERTER_KINDS } from './kinds';
import { convertBlock, convertText, planConversion, type BlockFormat, type BlockOptions } from './blocks';
import type { ImageConversionRequest, ImageConversionPlan } from '../engines/images/convertPlan';
export type ConvertOutcome = {ok:true;value:string;example:string;changes?:string[]}|{ok:false;error:'empty'|'not-a-number'|'out-of-range'|'invalid-digit'|'unknown-kind'|'unknown-unit'|string;message?:string};
export { planConversion };
export type { ImageConversionRequest, ImageConversionPlan };
function format(n:number):string {
 if(Object.is(n,-0)||n===0)return '0';
 const rounded=Number(n.toPrecision(10));
 if(!Number.isFinite(rounded))return String(n);
 const a=Math.abs(rounded);
 if(a>=1e-7&&a<1e15)return rounded.toLocaleString('en-US',{useGrouping:false,maximumSignificantDigits:10});
 return rounded.toExponential(9).replace(/\.?0+e/,'e').replace('e+','e');
}
export function convert(request:{kind:string;from:string;to:string;input:string;options?:BlockOptions;imageRequest?:ImageConversionRequest}):ConvertOutcome {
 try {
  const kind=CONVERTER_KINDS.find(k=>k.id===request?.kind);
  if(!kind)return {ok:false,error:'unknown-kind'};
  const from=kind.units.find(u=>u.id===request.from),to=kind.units.find(u=>u.id===request.to);
  if(kind.id==='image'){if(from&&to&&from.id===to.id&&typeof request.input==='string'&&request.input.trim())return {ok:true,value:request.input,example:'Input preserved without conversion.'};return {ok:false,error:'image-plan-required',message:'Image conversion requires image metadata; call planConversion(request) to obtain a pure plan.'};}
  if(kind.id==='data-formats'){if(!from||!to)return {ok:false,error:'unknown-unit'};const r=convertBlock({from:from.id as BlockFormat,to:to.id as BlockFormat,input:request.input,options:request.options});return r.ok?{ok:true,value:r.value,example:r.example,changes:r.changes}:{ok:false,error:r.error,message:r.message};}
  if(kind.id==='text-formats'){if(!from||!to)return {ok:false,error:'unknown-unit'};const r=convertText({from:from.id as 'txt'|'md'|'html',to:to.id as 'txt'|'md'|'html',input:request.input});return r.ok?{ok:true,value:r.value,example:r.example,changes:r.changes}:{ok:false,error:r.error,message:r.message};}
  if(!from||!to)return {ok:false,error:'unknown-unit'};
  if(typeof request.input!=='string')return {ok:false,error:'not-a-number'};
  const raw=request.input.trim();if(!raw)return {ok:false,error:'empty'};
  if(kind.entry==='text'){
   const result=convertBase(raw,Number(from.id),Number(to.id));
   if(!result.ok)return {ok:false,error:result.error==='digit-out-of-range'||result.error==='invalid-input'?'invalid-digit':'out-of-range'};
   const value=from.id===to.id?raw:result.value.toLowerCase();
   return {ok:true,value,example:`${raw} (base ${from.id}) = ${value} (base ${to.id})`};
  }
  // A single comma is decimal only when it cannot be a thousands separator: "1,000" and "12,345" are ambiguous and rejected; "0,500", "1,5" and "12,34" are decimals.
  if(raw.includes(',')&&(raw.includes('.')||raw.indexOf(',')!==raw.lastIndexOf(',')||/^[+-]?[1-9]\d{0,2},\d{3}(?:[eE][+-]?\d+)?$/.test(raw)))return {ok:false,error:'not-a-number'};
  const normalized=raw.replace(',','.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized))return {ok:false,error:'not-a-number'};
  const n=Number(normalized);if(!Number.isFinite(n))return {ok:false,error:'out-of-range'};
  const result=unitConvert(n,from.id,to.id);
  if(!result.ok)return {ok:false,error:result.error==='unknown-unit'||result.error==='category-mismatch'?'unknown-unit':'out-of-range'};
  const value=from.id===to.id?raw:format(result.value);
  const proof=unitConvert(1,from.id,to.id);
  const example=from.id===to.id?`1 ${from.short} = 1 ${to.short}`:proof.ok?`1 ${from.short} = ${format(proof.value)} ${to.short}`:`${raw} ${from.short} = ${value} ${to.short}`;
  return {ok:true,value,example};
 }catch{return {ok:false,error:'not-a-number'};}
}
