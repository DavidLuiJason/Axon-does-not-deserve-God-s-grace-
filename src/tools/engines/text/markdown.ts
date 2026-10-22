export const MARKDOWN_LIMITS = { maxInputBytes: 1_048_576, maxNestingDepth: 50 } as const;
export type TextEngineError = { ok: false; error: 'invalid-input' | 'input-too-large' | 'nesting-too-deep'; message: string };
export type TextEngineResult<T> = ({ ok: true } & T) | TextEngineError;
export const MARKDOWN_DESCRIPTOR = { toolId: 'converter', displayName: 'Markdown Converter', purpose: 'Convert Markdown to safe HTML or plain text.', examples: ['Convert headings and lists to HTML.', 'Extract plain text from Markdown.'], inputs: [{name:'text',kind:'text' as const,prompt:'Markdown text to convert'}] };
const esc = (s:string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const valid = (s:string): TextEngineError | null => typeof s !== 'string' ? {ok:false,error:'invalid-input',message:'Input must be text.'} : new TextEncoder().encode(s).length > MARKDOWN_LIMITS.maxInputBytes ? {ok:false,error:'input-too-large',message:'Input exceeds the 1 MB limit.'} : null;
function safeUrl(url:string):boolean { const decoded=url.replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi,(_,h,d)=>String.fromCharCode(parseInt(h||d,h?16:10))).replace(/&colon;/gi,':').replace(/&tab;/gi,'\t').replace(/&newline;/gi,'\n'); return !/^[\u0000-\u0020]*(?:j[\t\r\n]*a[\t\r\n]*v[\t\r\n]*a[\t\r\n]*s[\t\r\n]*c[\t\r\n]*r[\t\r\n]*i[\t\r\n]*p[\t\r\n]*t|d[\t\r\n]*a[\t\r\n]*t[\t\r\n]*a|v[\t\r\n]*b[\t\r\n]*s[\t\r\n]*c[\t\r\n]*r[\t\r\n]*i[\t\r\n]*p[\t\r\n]*t):/i.test(decoded); }
function inline(s:string):string {
 const stash:string[]=[]; const hold=(v:string)=>{stash.push(v);return `\u0000${stash.length-1}\u0000`;};
 s=s.replace(/\\([\\`*_{}\[\]()#+.!|>-])/g,(_,c)=>hold(esc(c)));
 s=s.replace(/`([^`\n]+)`/g,(_,c)=>hold(`<code>${esc(c)}</code>`));
 s=s.includes('](')?s.replace(/!\[([^\]]{0,1000})\]\(((?:[^()]|\([^()]*\)){1,2000})\)/g,(_,alt,url)=>hold(safeUrl(url)?`<a href="${esc(url)}">${esc(alt)}</a>`:esc(alt))):s;
 s=s.includes('](')?s.replace(/\[([^\]]{1,1000})\]\(((?:[^()]|\([^()]*\)){1,2000})\)/g,(_,label,url)=>hold(safeUrl(url)?`<a href="${esc(url)}">${inline(label)}</a>`:esc(label))):s;
 s=esc(s);
 s=s.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g,(_,a,b)=>`<strong>${a||b}</strong>`)
 .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g,(_,a,b)=>`<em>${a||b}</em>`);
 return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>stash[Number(i)]);
}
export function markdownToHtml(text:string):TextEngineResult<{html:string}> {
 const err=valid(text); if(err)return err;
 const lines=text.replace(/\r\n?/g,'\n').split('\n'); const out:string[]=[]; let i=0, depth=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  if(/^ {0,3}(```+|~~~+)/.test(line)){const m=line.trim().match(/^(```+|~~~+)/)![1], body:string[]=[];i++;while(i<lines.length){const close=lines[i].match(/^ {0,3}(`+|~+)\s*$/);if(close&&close[1][0]===m[0]&&close[1].length>=m.length)break;body.push(lines[i++]);}if(i<lines.length)i++;out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);continue;}
  if(/^ {4}\S/.test(line)){const body:string[]=[];while(i<lines.length&&(/^ {4}\S/.test(lines[i])||!lines[i].trim()))body.push(lines[i++].replace(/^ {4}/,''));out.push(`<pre><code>${esc(body.join('\n').replace(/\n+$/,''))}</code></pre>`);continue;}
  const h=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/); if(h){out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);i++;continue;}
  if(i+1<lines.length&&/^ {0,3}(=+|-+)\s*$/.test(lines[i+1])&&line.trim()){const n=lines[i+1].trim()[0]==='='?1:2;out.push(`<h${n}>${inline(line.trim())}</h${n}>`);i+=2;continue;}
  if(/^ {0,3}(?:[-*_]\s*){3,}$/.test(line)){out.push('<hr>');i++;continue;}
  if(/^ {0,3}>/.test(line)){const b:string[]=[];while(i<lines.length&&/^ {0,3}>/.test(lines[i]))b.push(lines[i++].replace(/^ {0,3}> ?/,''));out.push(`<blockquote>${b.map(x=>`<p>${inline(x)}</p>`).join('')}</blockquote>`);continue;}
  const list=line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
  if(list){depth=(list[1].length>>1)+1;if(depth>MARKDOWN_LIMITS.maxNestingDepth)return {ok:false,error:'nesting-too-deep',message:'List nesting exceeds 50 levels.'};const ordered=/^\d/.test(list[2]);const tag=ordered?'ol':'ul';const b:string[]=[];while(i<lines.length){const m=lines[i].match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);if(!m||/^\d/.test(m[2])!==ordered)break;b.push(`<li>${inline(m[3])}</li>`);i++;}out.push(`<${tag}>${b.join('')}</${tag}>`);continue;}
  const para=[line.trim()];i++;while(i<lines.length&&lines[i].trim()&&!/^( {0,3}#{1,6}\s| {0,3}>| {0,3}([-+*]|\d+[.)])\s| {0,3}(```|~~~)| {0,3}(?:[-*_]\s*){3,}$)/.test(lines[i]))para.push(lines[i++].trim());
  out.push(`<p>${para.map(inline).join('<br>')}</p>`);
 }
 return {ok:true,html:out.join('\n')};
}
export function markdownToText(text:string):TextEngineResult<{text:string}> {
 const err=valid(text);if(err)return err;
 let s=text.replace(/```[^\n]*\n([\s\S]*?)```/g,'$1').replace(/`([^`]*)`/g,'$1')
 .replace(/!\[([^\]]{0,1000})\]\(([^)]{0,2000})\)/g,'$1').replace(/\[([^\]]{1,1000})\]\(([^)]{0,2000})\)/g,'$1')
 .replace(/^ {0,3}#{1,6}\s+/gm,'').replace(/^ {0,3}(?:=+|-+)\s*$/gm,'')
 .replace(/^ {0,3}>\s?/gm,'').replace(/^ {0,3}(?:[-*_]\s*){3,}$/gm,'')
 .replace(/^ {0,3}(?:[-+*]|\d+[.)])\s+/gm,'• ').replace(/\\([\\`*_{}\[\]()#+.!|>-])/g,'$1')
 .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g,'$1$2').replace(/(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g,'$1$2');
 return {ok:true,text:s};
}
