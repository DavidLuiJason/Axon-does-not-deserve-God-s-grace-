/** Lossless, bounded JSON lexical validation and formatting. */
export const JSON_LIMITS = { maxBytes: 2 * 1024 * 1024, maxDepth: 200 } as const;
export type JsonErrorCode = 'too-large'|'too-deep'|'empty-input'|'unexpected-character'|'unterminated-string'|'bad-escape'|'bad-number'|'trailing-comma'|'text-after-value';
export type JsonError = {ok:false;error:JsonErrorCode;message:string;line:number;column:number};
export type JsonSuccess<T> = {ok:true;value:T};
export type JsonResult<T> = JsonSuccess<T>|JsonError;
export type JsonToken = {type:'string'|'number'|'literal'|'punctuation';text:string;start:number;end:number};
export const JSON_TOKENS_DESCRIPTOR = {toolId:'json-viewer',displayName:'JSON Reformatter',purpose:'Validate, indent or minify JSON without changing number literals or duplicate keys.',examples:['{"a":1.0}','[1e5,true]'],inputs:[{name:'text',kind:'text' as const},{name:'indent',kind:'choice' as const,choices:['2','4','tab']}]} as const;
const ws=(c:string)=>c===' '||c==='\t'||c==='\r'||c==='\n';
const digit=(c:string)=>c>='0'&&c<='9';
function scan(text:string):JsonResult<JsonToken[]> {
 if(typeof text!=='string')return {ok:false,error:'unexpected-character',message:'Expected text',line:1,column:1};
 const fail=(error:JsonErrorCode,message:string,pos:number):JsonError=>{let line=1,column=1;for(let j=0;j<pos;j++){if(text[j]==='\n'){line++;column=1;}else column++;}return {ok:false,error,message,line,column};};
 if(new TextEncoder().encode(text).length>JSON_LIMITS.maxBytes)return fail('too-large','JSON exceeds 2 MB',0);
 let i=0;const tokens:JsonToken[]=[];const stack:{kind:'array'|'object';state:number}[]=[];let rootDone=false;
 const skip=()=>{while(i<text.length&&ws(text[i]))i++;};
 const read=():JsonResult<JsonToken>=>{
  const start=i,c=text[i];let type:JsonToken['type'];
  if(c==='"'){
   type='string';i++;let closed=false;
   while(i<text.length){const ch=text[i++];if(ch==='"'){closed=true;break;}if(ch<' ')return fail('unexpected-character','Control character in string',i-1);if(ch==='\\'){if(i>=text.length)return fail('unterminated-string','Unterminated string',start);const e=text[i++];if('"\\/bfnrt'.includes(e))continue;if(e==='u'){for(let k=0;k<4;k++){if(i>=text.length||!((text[i]>='0'&&text[i]<='9')||(text[i]>='a'&&text[i]<='f')||(text[i]>='A'&&text[i]<='F')))return fail('bad-escape','Invalid unicode escape',i);i++;}}else return fail('bad-escape','Invalid string escape',i-1);}}
   if(!closed)return fail('unterminated-string','Unterminated string',start);
  }else if(c==='-'||digit(c)){
   type='number';if(c==='-')i++;if(text[i]==='0')i++;else if(text[i]>='1'&&text[i]<='9'){while(digit(text[i]))i++;}else return fail('bad-number','Invalid number',start);
   if(text[i]==='.'){i++;if(!digit(text[i]))return fail('bad-number','Invalid fraction',i);while(digit(text[i]))i++;}
   if(text[i]==='e'||text[i]==='E'){i++;if(text[i]==='+'||text[i]==='-')i++;if(!digit(text[i]))return fail('bad-number','Invalid exponent',i);while(digit(text[i]))i++;}
   if(i<text.length&&!ws(text[i])&&!']},'.includes(text[i]))return fail('bad-number','Invalid number',i);
  }else if(c==='t'||c==='f'||c==='n'){
   type='literal';const word=c==='t'?'true':c==='f'?'false':'null';if(text.slice(i,i+word.length)!==word)return fail('unexpected-character','Invalid literal',i);i+=word.length;
  }else if('{}[],:'.includes(c||'\0')){type='punctuation';i++;}else return fail('unexpected-character','Unexpected character',i);
  return {ok:true,value:{type,text:text.slice(start,i),start,end:i}};
 };
 const next=():JsonResult<JsonToken>=>{skip();if(i>=text.length)return fail('unexpected-character','Expected value',i);const r=read();if(r.ok)tokens.push(r.value);return r;};
 const value=():JsonError|undefined=>{const r=next();if(!r.ok)return r as JsonError;const t=r.value;if(t.text==='{'||t.text==='['){if(stack.length>=JSON_LIMITS.maxDepth)return fail('too-deep','JSON nesting exceeds 200',t.start);stack.push({kind:t.text==='{'?'object':'array',state:0});}else if(t.type==='punctuation')return fail('unexpected-character','Expected value',t.start);return undefined;};
 skip();if(i===text.length)return fail('empty-input','Empty JSON input',i);
 let error=value();if(error)return error;
 while(stack.length){const top=stack[stack.length-1];skip();if(i===text.length)return fail('unexpected-character','Unclosed container',i);const c=text[i];
  if(top.kind==='array'){
   if(top.state===0||top.state===2){if(c===']'){if(top.state===2)return fail('trailing-comma','Trailing comma',i);const r=next();if(!r.ok)return r as JsonError;stack.pop();continue;}top.state=1;error=value();if(error)return error;continue;}
   if(c===','){const r=next();if(!r.ok)return r as JsonError;top.state=2;continue;}if(c===']'){const r=next();if(!r.ok)return r as JsonError;stack.pop();continue;}return fail('unexpected-character','Expected comma or closing bracket',i);
  }
  if(top.state===0||top.state===4){if(c==='}'){if(top.state===4)return fail('trailing-comma','Trailing comma',i);const r=next();if(!r.ok)return r as JsonError;stack.pop();continue;}const r=next();if(!r.ok)return r as JsonError;if(r.value.type!=='string')return fail('unexpected-character','Expected object key',r.value.start);top.state=1;continue;}
  if(top.state===1){if(c!==':')return fail('unexpected-character','Expected colon',i);const r=next();if(!r.ok)return r as JsonError;top.state=2;continue;}
  if(top.state===2){top.state=3;error=value();if(error)return error;continue;}
  if(c===','){const r=next();if(!r.ok)return r as JsonError;top.state=4;continue;}if(c==='}'){const r=next();if(!r.ok)return r as JsonError;stack.pop();continue;}return fail('unexpected-character','Expected comma or closing brace',i);
 }
 skip();if(i!==text.length)return fail('text-after-value','Text after JSON value',i);
 return {ok:true,value:tokens};
}
export function tokenize(text:string):JsonResult<JsonToken[]>{return scan(text);}
export function validate(text:string):JsonResult<true>{const r=scan(text);return r.ok?{ok:true,value:true}:r as JsonError;}
export function minify(text:string):JsonResult<string>{const r=scan(text);return r.ok?{ok:true,value:r.value.map(t=>t.text).join('')}:r as JsonError;}
export function pretty(text:string,options:{indent:2|4|'tab';sortKeys?:boolean}):JsonResult<string>{
 const r=scan(text);if(!r.ok)return r as JsonError;
 if(!options||![2,4,'tab'].includes(options.indent))return {ok:false,error:'unexpected-character',message:'Invalid indentation',line:1,column:1};
 if(options.sortKeys)return {ok:false,error:'unexpected-character',message:'Key sorting is not supported without changing duplicate-key ordering',line:1,column:1};
 const unit=options.indent==='tab'?'\t':' '.repeat(options.indent);let depth=0,out='';const tokens=r.value;
 for(let i=0;i<tokens.length;i++){const t=tokens[i].text,prev=tokens[i-1]?.text,next=tokens[i+1]?.text;
  if(t==='{'||t==='['){out+=t;if(next!=='}'&&next!==']'){depth++;out+='\n'+unit.repeat(depth);}continue;}
  if(t==='}'||t===']'){if(prev!=='{'&&prev!=='['){depth--;out+='\n'+unit.repeat(depth);}out+=t;continue;}
  if(t===','){out+=',\n'+unit.repeat(depth);continue;}if(t===':'){out+=': ';continue;}out+=t;
 }
 return {ok:true,value:out};
}
