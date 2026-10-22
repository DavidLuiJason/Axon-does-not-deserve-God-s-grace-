export const HTML_TEXT_LIMITS = { maxInputBytes: 1_048_576, maxNestingDepth: 50, maxTokens: 200_000 } as const;
export type HtmlTextResult = {ok:true;text:string}|{ok:false;error:'invalid-input'|'input-too-large'|'nesting-too-deep'|'too-many-tokens';message:string};
export const HTML_TEXT_DESCRIPTOR = {toolId:'converter',displayName:'HTML Text Converter',purpose:'Convert HTML to plain text or Markdown without executing markup.',examples:['Extract text from an HTML page.','Convert headings and links to Markdown.'],inputs:[{name:'html',kind:'text' as const,prompt:'HTML source'}]};
const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',copy:'©',reg:'®',mdash:'—',ndash:'–',hellip:'…',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’'};
function decode(s:string):string{return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);?/gi,(m,k)=>{if(k[0]==='#'){const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):'�';}return named[k.toLowerCase()]??m;});}
type Tok={kind:'text'|'tag';value:string};
function tokenize(s:string):Tok[]{const a:Tok[]=[];let i=0;while(i<s.length){if(s[i]!=='<'){let j=s.indexOf('<',i);if(j<0)j=s.length;a.push({kind:'text',value:s.slice(i,j)});i=j;continue;}if(s.startsWith('<!--',i)){const j=s.indexOf('-->',i+4);i=j<0?s.length:j+3;continue;}let j=i+1,q='';for(;j<s.length;j++){const c=s[j];if(q){if(c===q)q='';}else if(c==='"'||c==="'")q=c;else if(c==='>')break;}if(j>=s.length){a.push({kind:'text',value:s.slice(i)});break;}a.push({kind:'tag',value:s.slice(i+1,j).slice(0,8192)});i=j+1;if(a.length>HTML_TEXT_LIMITS.maxTokens)throw new Error('too-many-tokens');}return a;}
/** Links whose address starts with javascript:, data: or vbscript: (after removing spaces and control characters) are dropped, never converted. */
function safeHref(h:string):string{const t=String(h??'').replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi,(_,x,d)=>String.fromCharCode(parseInt(x||d,x?16:10))).replace(/[\u0000-\u0020\u007f-\u009f]/g,'').toLowerCase();return /^(?:javascript|data|vbscript):/.test(t)?'':h;}
export function htmlToText(html:string):HtmlTextResult{return convert(html,false);}
export function htmlToMarkdown(html:string):HtmlTextResult{return convert(html,true);}
function convert(html:string,md:boolean):HtmlTextResult {
 if(typeof html!=='string')return {ok:false,error:'invalid-input',message:'Input must be text.'};
 if(new TextEncoder().encode(html).length>HTML_TEXT_LIMITS.maxInputBytes)return {ok:false,error:'input-too-large',message:'Input exceeds the 1 MB limit.'};
 let toks:Tok[];try{toks=tokenize(html);}catch{return {ok:false,error:'too-many-tokens',message:'HTML contains too many tokens.'};}
 const out:string[]=[];const stack:string[]=[];const links:string[]=[];let skip:string|null=null,depth=0;
 const block=new Set(['p','div','section','article','header','footer','main','h1','h2','h3','h4','h5','h6','ul','ol','blockquote','pre','table','tr','hr']);
 for(const t of toks){if(t.kind==='text'){if(!skip)out.push(decode(t.value));continue;}
  const raw=t.value.trim(),close=raw.startsWith('/'),self=/\/\s*$/.test(raw),m=raw.match(/^\/?\s*([a-zA-Z][\w:-]*)/);if(!m)continue;const tag=m[1].toLowerCase();
  if(['script','style','head'].includes(tag)){if(!close&&!self)skip=tag;else if(close&&skip===tag)skip=null;continue;}if(skip)continue;
  if(!close&&!self){stack.push(tag);depth=Math.max(depth,stack.length);if(depth>HTML_TEXT_LIMITS.maxNestingDepth)return {ok:false,error:'nesting-too-deep',message:'HTML nesting exceeds 50 levels.'};}
  else if(close){const idx=stack.lastIndexOf(tag);if(idx>=0)stack.splice(idx);}
  const attr=(name:string)=>{const r=raw.match(new RegExp(name + '\\s*=\\s*([^\\s>]+)','i'));return decode((r?.[1]??'').replace(/^['\"]|['\"]$/g,''));};
  if(tag==='br'||tag==='hr')out.push(tag==='hr'?(md?'\n---\n':'\n'):'\n');
  else if(/^h[1-6]$/.test(tag)){if(close)out.push('\n\n');else if(md)out.push('\n\n'+'#'.repeat(Number(tag[1]))+' ');}
  else if(tag==='p'||block.has(tag)){if(close)out.push('\n');else if(tag==='p')out.push('\n');}
  else if(tag==='li'){if(close)out.push('\n');else out.push(md?'- ':'• ');}
  else if(tag==='a'){if(close){const href=links.pop()??'';if(md&&href)out.push(`](${href})`);}else{const href=safeHref(attr('href'));links.push(href);if(md&&href)out.push('[');}}
  else if(tag==='img'){const alt=attr('alt');out.push(md?alt:alt);}
  else if(tag==='strong'||tag==='b'){if(md)out.push(close?'**':'**');}
  else if(tag==='em'||tag==='i'){if(md)out.push('*');}
  else if(tag==='code'){if(md)out.push('`');}
  else if(tag==='pre'){if(md)out.push(close?'\n```\n':'\n```\n');}
  else if(tag==='td'||tag==='th'){if(close)out.push(' | ');}
  else if(tag==='tr'){if(close)out.push('\n');}
  else if(tag==='blockquote'){if(close)out.push('\n');else if(md)out.push('\n> ');}
 }
 let text=out.join('').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+\n/g,'\n\n').replace(/\n{3,}/g,'\n\n').trim();
 if(!md)text=text.replace(/ ?\| ?\n/g,' | \n');
 text=text.replace(/\s*\|\s*$/,'');
 return {ok:true,text};
}
