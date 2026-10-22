import { markdownToHtml, markdownToText, MARKDOWN_LIMITS } from './markdown';
import { htmlToMarkdown, htmlToText, HTML_TEXT_LIMITS } from './htmlText';
export type TextFormat='txt'|'md'|'html';
export const TEXT_FORMATS=[{id:'txt' as const,displayName:'Plain text'},{id:'md' as const,displayName:'Markdown'},{id:'html' as const,displayName:'HTML'}] as const;
export const TEXT_FORMAT_LIMITS={maxInputBytes:Math.min(MARKDOWN_LIMITS.maxInputBytes,HTML_TEXT_LIMITS.maxInputBytes)} as const;
export const TEXT_FORMATS_DESCRIPTOR={toolId:'converter',displayName:'Text Format Converter',purpose:'Convert TXT, Markdown and HTML with notes about changes.',examples:['Convert Markdown to HTML.','Convert HTML to plain text.'],inputs:[{name:'from',kind:'choice' as const,choices:['txt','md','html']},{name:'to',kind:'choice' as const,choices:['txt','md','html']},{name:'input',kind:'text' as const,prompt:'Text to convert'}]};
export type TextFormatResult={ok:true,from:TextFormat,to:TextFormat,output:string,changes:string[]}|{ok:false,error:'invalid-input'|'input-too-large'|'conversion-failed',message:string};
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function convertTextFormat(args:{from:TextFormat;to:TextFormat;input:string}):TextFormatResult {
 if(!args||!['txt','md','html'].includes(args.from)||!['txt','md','html'].includes(args.to)||typeof args.input!=='string')return {ok:false,error:'invalid-input',message:'Provide from and to as txt, md or html, and input as text.'};
 if(new TextEncoder().encode(args.input).length>TEXT_FORMAT_LIMITS.maxInputBytes)return {ok:false,error:'input-too-large',message:'Input exceeds the 1 MB limit.'};
 if(args.from===args.to)return {ok:true,from:args.from,to:args.to,output:args.input,changes:[]};
 const changes:string[]=[];let output='';
 try{
 if(args.from==='txt'&&args.to==='html'){output=args.input.split(/\n{2,}/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('\n');}
 else if(args.from==='txt'&&args.to==='md'){output=args.input.split('\n').map(l=>l.replace(/([\\`*_{}\[\]#+.!|>])/g,'\\$1')).join('\n');}
 else if(args.from==='md'&&args.to==='html'){const r=markdownToHtml(args.input);if('error' in r)return {ok:false,error:r.error==='input-too-large'?'input-too-large':'conversion-failed',message:r.message};output=r.html;if(/<[^>]+>/.test(args.input))changes.push('Raw HTML was escaped.');if(/!\[[^\]]*\]\(/.test(args.input))changes.push('Images became links with alt text.');}
 else if(args.from==='md'&&args.to==='txt'){const r=markdownToText(args.input);if('error' in r)return {ok:false,error:r.error==='input-too-large'?'input-too-large':'conversion-failed',message:r.message};output=r.text;if(/!\[[^\]]*\]\(/.test(args.input))changes.push('Image URLs were removed; alt text was kept.');}
 else if(args.from==='html'&&args.to==='md'){const r=htmlToMarkdown(args.input);if('error' in r)return {ok:false,error:r.error==='input-too-large'?'input-too-large':'conversion-failed',message:r.message};output=r.text;changes.push('HTML structure was mapped to supported Markdown.');if(/<img\b/i.test(args.input))changes.push('Image URLs were discarded; alt text was kept.');if(/<(script|style|head)\b/i.test(args.input))changes.push('Script, style and head content was removed.');}
 else if(args.from==='html'&&args.to==='txt'){const r=htmlToText(args.input);if('error' in r)return {ok:false,error:r.error==='input-too-large'?'input-too-large':'conversion-failed',message:r.message};output=r.text;if(/<(script|style|head)\b/i.test(args.input))changes.push('Script, style and head content was removed.');if(/<img\b/i.test(args.input))changes.push('Images were represented by alt text only.');}
 return {ok:true,from:args.from,to:args.to,output,changes};
 }catch{return {ok:false,error:'conversion-failed',message:'The input could not be converted safely.'};}
}
