import { validate, pretty } from '../engines/data/jsonTokens';
import { parseCsv, writeCsv, rowsToObjects, objectsToRows } from '../engines/data/csv';
import { parseYaml, stringifyYaml, type PlainValue } from '../engines/data/yaml';
import { parseXml, writeXml, type XmlPlainValue } from '../engines/data/xml';
import { convertTextFormat, type TextFormat } from '../engines/text/textFormats';
import { planImageConversion, type ImageConversionRequest, type ImageConversionPlan } from '../engines/images/convertPlan';

export type BlockFormat = 'json'|'csv'|'tsv'|'yaml'|'xml';
export type BlockOptions = { detectTypes?: boolean; rootName?: string; indent?: 2|4 };
export type BlockOutcome = {ok:true;value:string;example:string;changes:string[]}|{ok:false;error:string;message:string};
const MAX_BLOCK_CHARS=1_000_000;
function fail(error:string,message:string):BlockOutcome{return {ok:false,error,message};}
function plain(v:unknown, depth=0, seen=new Set<object>()):v is PlainValue {
 if(depth>100)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object')return false;if(seen.has(v))return false;seen.add(v);let ok=true;
 if(Array.isArray(v)){for(const x of v)if(!plain(x,depth+1,seen)){ok=false;break;}}else {const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==null)ok=false;else for(const [k,x] of Object.entries(v)){if(k==='__proto__'||!plain(x,depth+1,seen)){ok=false;break;}}}seen.delete(v);return ok;
}
function parse(format:BlockFormat,input:string,options:BlockOptions):{ok:true;value:PlainValue;changes:string[]}|{ok:false;error:string;message:string}{
 if(format==='json'){const valid=validate(input);if(!valid.ok)return {ok:false,error:valid.error,message:valid.message};let value:unknown;try{value=JSON.parse(input);}catch{return {ok:false,error:'invalid-json',message:'JSON could not be parsed after lexical validation.'};}return plain(value)?{ok:true,value,changes:[]}:{ok:false,error:'invalid-value',message:'JSON value is outside the supported plain-value model.'};}
 if(format==='yaml'){const r=parseYaml(input);return r.ok?{ok:true,value:r.value as PlainValue,changes:[]}:{ok:false,error:r.error,message:r.message};}
 if(format==='xml'){const r=parseXml(input);return r.ok?{ok:true,value:r.value as PlainValue,changes:r.notes.map(n=>n.charAt(0).toLowerCase()+n.slice(1))}:{ok:false,error:r.error,message:r.message};}
 const delimiter=format==='csv'?',':'\t';const r=parseCsv(input,{delimiter,header:true,detectTypes:options.detectTypes===true});if(!r.ok)return {ok:false,error:r.error,message:r.message};const o=rowsToObjects(r.rows,true);if(!o.ok)return {ok:false,error:o.error,message:o.message};return {ok:true,value:o.rows as PlainValue,changes:[...(r.warnings.length?['rows with inconsistent column counts were retained']:[]),...(options.detectTypes?[]:['CSV/TSV cell values were kept as text'])]};
}
function flatten(v:unknown,prefix='',out:Record<string,unknown>={}):Record<string,unknown>{
 if(v!==null&&typeof v==='object'&&!Array.isArray(v)){const entries=Object.entries(v as Record<string,unknown>);if(entries.length===0&&prefix)out[prefix]='{}';else for(const [k,x] of entries)flatten(x,prefix?`${prefix}.${k}`:k,out);}
 else out[prefix]=Array.isArray(v)?JSON.stringify(v):v;return out;
}
function jsonToTable(value:PlainValue):{ok:true;rows:unknown[][];changes:string[]}|{ok:false;error:string;message:string}{
 const records=Array.isArray(value)?value:[value];if(!records.length||records.some(v=>v===null||typeof v!=='object'||Array.isArray(v)))return {ok:false,error:'json-table-shape',message:'JSON to CSV/TSV requires an array of objects or a single object.'};
 const flat=records.map(v=>flatten(v));const keys:string[]=[];for(const obj of flat)for(const k of Object.keys(obj))if(!keys.includes(k))keys.push(k);
 if(keys.length>1000)return {ok:false,error:'too-many-columns',message:'Flattened table exceeds 1,000 columns.'};if(records.length>100000)return {ok:false,error:'too-many-rows',message:'Table exceeds 100,000 rows.'};
 const arrays=flat.some(o=>Object.values(o).some(v=>typeof v==='string'&&v.startsWith('[')&&(()=>{try{return Array.isArray(JSON.parse(v));}catch{return false;}})()));
 return {ok:true,rows:[keys,...flat.map(o=>keys.map(k=>Object.prototype.hasOwnProperty.call(o,k)?o[k]:''))],changes:arrays?['arrays inside cells were written as JSON text']:[]};
}
export function convertBlock(args:{from:BlockFormat;to:BlockFormat;input:string;options?:BlockOptions}):BlockOutcome {
 try {
  if(!args||typeof args.input!=='string'||typeof args.from!=='string'||typeof args.to!=='string')return fail('invalid-input','Provide text and supported source and target formats.');
  if(args.input.length>MAX_BLOCK_CHARS)return fail('too-large','Input exceeds 1,000,000 characters.');
  if(!['json','csv','tsv','yaml','xml'].includes(args.from)||!['json','csv','tsv','yaml','xml'].includes(args.to))return fail('unsupported-format','Choose JSON, CSV, TSV, YAML or XML.');
  const options=args.options??{};if(options.detectTypes!==undefined&&typeof options.detectTypes!=='boolean')return fail('invalid-options','detectTypes must be true or false.');
  if(args.from===args.to){if(args.from==='json'){const r=pretty(args.input,{indent:options.indent??2});return r.ok?{ok:true,value:r.value,example:'JSON was reformatted.',changes:[]}:{ok:false,error:r.error,message:r.message};}return {ok:true,value:args.input,example:'Input preserved without reformatting.',changes:[]};}
  const parsed=parse(args.from,args.input,options);if(!parsed.ok)return fail(parsed.error,parsed.message);let value=parsed.value;const changes=[...parsed.changes];
  if(args.to==='csv'||args.to==='tsv'){
   let rows:unknown[][];if(args.from==='json'){const r=jsonToTable(value);if(!r.ok)return fail(r.error,r.message);rows=r.rows;changes.push(...r.changes);}else if(Array.isArray(value)&&value.every(v=>v!==null&&typeof v==='object'&&!Array.isArray(v))){const r=objectsToRows(value as Record<string,unknown>[]);if(!r.ok)return fail(r.error,r.message);rows=r.rows;}else if(value!==null&&typeof value==='object'&&!Array.isArray(value)){const f=flatten(value);const keys=Object.keys(f);rows=[keys,keys.map(k=>f[k])];if(Object.values(f).some(v=>Array.isArray(v)))changes.push('arrays inside cells were written as JSON text');}else return fail('table-shape','Conversion to CSV/TSV requires an object or an array of objects.');
   const r=writeCsv(rows,{delimiter:args.to==='csv'?',':'\t',header:false});if(!r.ok)return fail(r.error,r.message);return {ok:true,value:r.text,example:`Converted ${args.from.toUpperCase()} to ${args.to.toUpperCase()}.`,changes:[...changes,'nested objects were flattened with dot paths']};
  }
  if(args.to==='json'){
   if(args.from==='csv'||args.from==='tsv'){const r=parseCsv(args.input,{delimiter:args.from==='csv'?',':'\t',header:true,detectTypes:options.detectTypes===true});if(!r.ok)return fail(r.error,r.message);const o=rowsToObjects(r.rows,true);if(!o.ok)return fail(o.error,o.message);value=o.rows as PlainValue;}
   const text=JSON.stringify(value,null,options.indent??2);if(text===undefined)return fail('invalid-value','Value cannot be represented as JSON.');return {ok:true,value:text,example:`Converted ${args.from.toUpperCase()} to JSON.`,changes};
  }
  if(args.to==='yaml'){const r=stringifyYaml(value,{indent:options.indent===4?4:2});return r.ok?{ok:true,value:r.value,example:`Converted ${args.from.toUpperCase()} to YAML.`,changes}:{ok:false,error:r.error,message:r.message};}
  if(args.to==='xml'){
   if(args.from==='json'&&(value===null||typeof value!=='object'||Array.isArray(value))&&!options.rootName)return fail('xml-root-required','JSON to XML needs a single root key or the rootName option.');
   const rootName=options.rootName??(args.from==='json'&&value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1?Object.keys(value)[0]:'root');
   let payload:PlainValue=value;if(args.from==='json'&&value!==null&&typeof value==='object'&&!Array.isArray(value)&&!options.rootName&&Object.keys(value).length===1)payload=(value as Record<string,PlainValue>)[rootName];else if(args.from!=='json'&&Array.isArray(value))payload={item:value};
   const r=writeXml(payload as XmlPlainValue,{rootName});return r.ok?{ok:true,value:r.value,example:`Converted ${args.from.toUpperCase()} to XML.`,changes:[...changes,...r.notes]}:{ok:false,error:r.error,message:r.message};
  }
  return fail('unsupported-format','This conversion is not supported.');
 }catch{return fail('conversion-failed','The input could not be converted safely.');}
}
export function convertText(args:{from:TextFormat;to:TextFormat;input:string}):BlockOutcome {const r=convertTextFormat(args);return r.ok?{ok:true,value:r.output,example:`Converted ${r.from.toUpperCase()} to ${r.to.toUpperCase()}.`,changes:r.changes}:{ok:false,error:r.error,message:r.message};}
export function planConversion(request:ImageConversionRequest):ImageConversionPlan|{ok:false;error:string;message:string}{return planImageConversion(request);}
