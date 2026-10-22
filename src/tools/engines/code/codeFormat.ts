/**
 * Bounded, loss-aware formatter for JSON, CSS, HTML and XML.
 * This module is pure TypeScript and intentionally does not format JS/TS.
 */
import { pretty as prettyJson, minify as minifyJson, JSON_LIMITS } from '../data/jsonTokens';

export const CODE_FORMAT_LIMITS = { maxBytes: 2 * 1024 * 1024, maxDepth: 200 } as const;
export type CodeLanguage = 'json' | 'css' | 'html' | 'xml';
export type CodeMode = 'pretty' | 'minify';
export type CodeIndent = 2 | 4 | 'tab';
export type CodeFormatErrorCode =
  | 'invalid-input' | 'too-large' | 'too-deep' | 'unsupported-language'
  | 'unterminated-string' | 'unterminated-comment' | 'unbalanced-syntax'
  | 'invalid-markup' | 'invalid-json' | 'invalid-css';
export type CodeFormatFailure = {
  ok: false; error: CodeFormatErrorCode; line: number; column: number; message: string;
};
export type CodeFormatResult = { ok: true; output: string } | CodeFormatFailure;
export type CodeFormatRequest = {
  language: CodeLanguage | string; mode: CodeMode; indent: CodeIndent; input: string;
};
export const CODE_FORMAT_DESCRIPTOR = {
  toolId: 'code-formatter',
  displayName: 'Code Formatter',
  purpose: 'Pretty-print or minify JSON, CSS, HTML and XML while preserving meaningful content.',
  examples: ['Pretty-print nested JSON', 'Minify a CSS stylesheet', 'Indent XML while preserving mixed text'],
  inputs: [
    { name: 'language', kind: 'choice' as const, choices: ['json', 'css', 'html', 'xml'] },
    { name: 'mode', kind: 'choice' as const, choices: ['pretty', 'minify'] },
    { name: 'indent', kind: 'choice' as const, choices: ['2', '4', 'tab'] },
    { name: 'input', kind: 'text' as const }
  ]
};
type Token = { kind: 'space'|'word'|'string'|'comment'|'punct'|'text'|'tag'|'raw'|'special'; text: string; pos: number };
const isWs = (c: string) => c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f';
function failure(error: CodeFormatErrorCode, message: string, input: string, pos: number): CodeFormatFailure {
  let line = 1, column = 1;
  for (let i = 0; i < Math.min(pos, input.length); i++) {
    if (input[i] === '\n') { line++; column = 1; } else column++;
  }
  return { ok: false, error, line, column, message };
}
function byteLength(text: string): number {
  // Avoid requiring TextEncoder in non-browser test runtimes.
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length &&
             text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
    if (bytes > CODE_FORMAT_LIMITS.maxBytes) return bytes;
  }
  return bytes;
}
const wordChar = (c: string) => !!c && /[A-Za-z0-9_\u0080-\uFFFF]/.test(c);
function cssTokens(input: string): { tokens?: Token[]; error?: CodeFormatFailure } {
  const tokens: Token[] = []; let i = 0;
  const push = (kind: Token['kind'], start: number) => tokens.push({ kind, text: input.slice(start, i), pos: start });
  while (i < input.length) {
    const start = i, c = input[i];
    if (isWs(c)) { while (i < input.length && isWs(input[i])) i++; push('space', start); continue; }
    if (c === '/' && input[i + 1] === '*') {
      i += 2; const end = input.indexOf('*/', i);
      if (end < 0) return { error: failure('unterminated-comment', 'Unterminated CSS comment', input, start) };
      i = end + 2; push('comment', start); continue;
    }
    if (c === '"' || c === "'") {
      const quote = c; i++; let closed = false;
      while (i < input.length) {
        if (input[i] === '\\') { i += Math.min(2, input.length - i); continue; }
        if (input[i++] === quote) { closed = true; break; }
      }
      if (!closed) return { error: failure('unterminated-string', 'Unterminated CSS string', input, start) };
      push('string', start); continue;
    }
    if (c === '{' || c === '}' || c === ';' || c === ':' || c === ',' || c === '(' || c === ')' || c === '[' || c === ']') {
      i++; push('punct', start); continue;
    }
    // url(...) is consumed as one opaque token, including quoted and escaped content.
    if (input.slice(i, i + 4).toLowerCase() === 'url(') {
      let j = i + 4, quote = '';
      while (j < input.length) {
        const ch = input[j];
        if (ch === '\\') { j += Math.min(2, input.length - j); continue; }
        if (quote) { if (ch === quote) quote = ''; j++; continue; }
        if (ch === '"' || ch === "'") { quote = ch; j++; continue; }
        if (ch === ')') { j++; break; }
        j++;
      }
      if (j > input.length || input[j - 1] !== ')') return { error: failure('unbalanced-syntax', 'Unclosed url() function', input, start) };
      i = j; push('string', start); continue;
    }
    while (i < input.length && !isWs(input[i]) && !'{};:,()[]'.includes(input[i]) &&
           !(input[i] === '/' && input[i + 1] === '*') && input[i] !== '"' && input[i] !== "'") i++;
    if (i === start) i++;
    push('word', start);
  }
  let braces = 0, parens = 0, brackets = 0;
  for (const t of tokens) if (t.kind === 'punct') {
    if (t.text === '{') braces++;
    if (t.text === '}') braces--;
    if (t.text === '(') parens++;
    if (t.text === ')') parens--;
    if (t.text === '[') brackets++;
    if (t.text === ']') brackets--;
    if (braces < 0 || parens < 0 || brackets < 0) return { error: failure('unbalanced-syntax', 'Unexpected closing delimiter', input, t.pos) };
    if (braces > CODE_FORMAT_LIMITS.maxDepth || parens > CODE_FORMAT_LIMITS.maxDepth || brackets > CODE_FORMAT_LIMITS.maxDepth)
      return { error: failure('too-deep', 'CSS nesting exceeds 200', input, t.pos) };
  }
  if (braces || parens || brackets) return { error: failure('unbalanced-syntax', 'Unclosed CSS delimiter', input, input.length) };
  return { tokens };
}
function minifyCss(tokens: Token[]): string {
  let out = '', previous = '';
  const nextMeaningful: string[] = new Array(tokens.length);
  let nextText = '';
  for (let j = tokens.length - 1; j >= 0; j--) { nextMeaningful[j] = nextText; if (tokens[j].kind !== 'space' && tokens[j].kind !== 'comment') nextText = tokens[j].text; }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]; if (t.kind === 'comment' || t.kind === 'space') {
      const next = nextMeaningful[i] ?? '';
      const prev = previous;
      const need = (wordChar(prev[prev.length - 1] || '') && wordChar(next[0] || '')) ||
        (prev.endsWith('and') && next.startsWith('(')) ||
        (wordChar(prev[prev.length - 1] || '') && next.startsWith('-') && /-\d/.test(next)) ||
        prev === '+' || prev === '-' || next === '+' || next === '-' ||
        (prev.endsWith('!') && next.startsWith('important'));
      if (need && out && !out.endsWith(' ')) out += ' ';
      continue;
    }
    out += t.text; previous = t.text;
  }
  return out.trim();
}
function prettyCss(tokens: Token[], indent: CodeIndent): string {
  const unit = indent === 'tab' ? '\t' : ' '.repeat(indent);
  let out = '', depth = 0, lineStart = true, prev = '', paren = 0;
  const trim = () => { out = out.replace(/[ \t]+$/, ''); };
  const add = (s: string) => { if (lineStart && s) { out += unit.repeat(depth); lineStart = false; } out += s; };
  const newline = () => { trim(); if (out && !out.endsWith('\n')) out += '\n'; lineStart = true; };
  for (const t of tokens) {
    if (t.kind === 'space') { if (!lineStart && !out.endsWith(' ') && !out.endsWith('\n')) add(' '); continue; }
    if (t.kind === 'comment') { if (!lineStart && !out.endsWith(' ')) add(' '); add(t.text); newline(); continue; }
    if (t.text === '(' || t.text === '[') { add(t.text); paren++; continue; }
    if (t.text === ')' || t.text === ']') { add(t.text); paren--; continue; }
    if (paren === 0 && t.text === '{') { trim(); add(' {'); newline(); depth++; prev = t.text; continue; }
    if (paren === 0 && t.text === '}') { depth = Math.max(0, depth - 1); if (!lineStart) newline(); add('}'); newline(); prev = t.text; continue; }
    if (paren === 0 && t.text === ';') { trim(); add(';'); newline(); prev = t.text; continue; }
    if (paren === 0 && t.text === ',') { trim(); add(','); newline(); prev = t.text; continue; }
    if (t.text === ':') { trim(); add(': '); prev = t.text; continue; }
    add(t.text); prev = t.text;
  }
  trim(); return out.trim();
}
const HTML_VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const HTML_BLOCK = new Set(['address','article','aside','blockquote','body','caption','dd','details','dialog','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','head','header','hr','html','li','main','nav','ol','p','pre','section','table','tbody','td','tfoot','th','thead','tr','ul']);
type MarkToken = Token & { name?: string; closing?: boolean; self?: boolean; special?: boolean };
function markupTokens(input: string, language: 'html'|'xml'): { tokens?: MarkToken[]; error?: CodeFormatFailure } {
  const out: MarkToken[] = []; let i = 0;
  const add = (kind: Token['kind'], start: number, end: number, extra: Partial<MarkToken> = {}) => {
    out.push({ kind, text: input.slice(start, end), pos: start, ...extra }); i = end;
  };
  while (i < input.length) {
    const start = i;
    if (input.startsWith('<!--', i)) {
      const e = input.indexOf('-->', i + 4); if (e < 0) return { error: failure('unterminated-comment','Unterminated markup comment',input,i) };
      add('comment', start, e + 3); continue;
    }
    if (language === 'xml' && input.startsWith('<![CDATA[', i)) {
      const e = input.indexOf(']]>', i + 9); if (e < 0) return { error: failure('invalid-markup','Unterminated CDATA section',input,i) };
      add('special', start, e + 3); continue;
    }
    if (input.startsWith('<?', i)) {
      const e = input.indexOf('?>', i + 2); if (e < 0) return { error: failure('invalid-markup','Unterminated processing instruction',input,i) };
      add('special', start, e + 2); continue;
    }
    if (input.startsWith('<!', i)) {
      let j = i + 2, quote = '';
      while (j < input.length) { const c = input[j]; if (quote) { if (c === quote) quote = ''; }
        else if (c === '"' || c === "'") quote = c; else if (c === '>') break; j++; }
      if (j >= input.length) return { error: failure('invalid-markup','Unterminated declaration',input,i) };
      add('special', start, j + 1); continue;
    }
    if (input[i] === '<') {
      let j = i + 1, quote = '';
      while (j < input.length) { const c = input[j]; if (quote) { if (c === quote) quote = ''; }
        else if (c === '"' || c === "'") quote = c; else if (c === '>') break; j++; }
      if (j >= input.length) return { error: failure('invalid-markup','Unterminated tag',input,i) };
      const raw = input.slice(i, j + 1);
      const m = /^<\s*(\/?)\s*([A-Za-z_][\w:.-]*)/.exec(raw);
      if (!m) return { error: failure('invalid-markup','Malformed tag',input,i) };
      const name = m[2], closing = m[1] === '/', self = /\/\s*>$/.test(raw) || (language === 'html' && HTML_VOID.has(name.toLowerCase()));
      if (closing && /\/\s*>$/.test(raw)) return { error: failure('invalid-markup','Closing tag cannot be self-closing',input,i) };
      add('tag', start, j + 1, { name, closing, self });
      if (language === 'html' && !closing && !self && ['script','style','textarea','pre'].includes(name.toLowerCase())) {
        const closeNeedle = '</' + name;
        const lower = input.toLowerCase(), closeAt = lower.indexOf(closeNeedle.toLowerCase(), i);
        if (closeAt < 0) return { error: failure('invalid-markup',`Missing closing ${name} tag`,input,i) };
        if (closeAt > i) { out.push({kind:'raw',text:input.slice(i,closeAt),pos:i}); i = closeAt; }
      }
      continue;
    }
    let j = i + 1; while (j < input.length && input[j] !== '<') j++;
    add('text', start, j); 
  }
  // Validate nesting with an explicit stack.
  const stack: MarkToken[] = [];
  let xmlRoots = 0;
  for (const t of out) {
    if (language === 'xml' && t.kind === 'text' && !stack.length && t.text.trim())
      return { error: failure('invalid-markup','Text is not allowed outside the XML root',input,t.pos) };
    if (t.kind !== 'tag') continue;
    const key = language === 'html' ? t.name!.toLowerCase() : t.name!;
    if (language === 'xml' && !t.closing && stack.length === 0 && ++xmlRoots > 1)
      return { error: failure('invalid-markup','XML must have exactly one root element',input,t.pos) };
    if (t.closing) {
      const top = stack.pop();
      if (!top || (language === 'html' ? top.name!.toLowerCase() : top.name) !== key)
        return { error: failure('invalid-markup',`Mismatched closing tag ${t.name}`,input,t.pos) };
    } else if (!t.self) {
      if (stack.length >= CODE_FORMAT_LIMITS.maxDepth) return { error: failure('too-deep','Markup nesting exceeds 200',input,t.pos) };
      stack.push(t);
    }
  }
  if (language === 'xml' && xmlRoots !== 1) return { error: failure('invalid-markup','XML must have exactly one root element',input,input.length) };
  if (stack.length) return { error: failure('invalid-markup',`Unclosed tag ${stack[stack.length-1].name}`,input,input.length) };
  return { tokens: out };
}
function minifyMarkup(tokens: MarkToken[], language: 'html'|'xml'): string {
  let out = '';
  for (let i=0;i<tokens.length;i++) {
    const t=tokens[i];
    if (t.kind==='text') {
      if (language==='xml' && !t.text.trim() && tokens[i-1]?.kind==='tag' && tokens[i+1]?.kind==='tag') continue;
      if (language==='html') {
        const prev=tokens[i-1], next=tokens[i+1];
        const previousBlock = !!prev && prev.kind==='tag' && HTML_BLOCK.has((prev.name||'').toLowerCase());
        const nextBlock = !!next && next.kind==='tag' && HTML_BLOCK.has((next.name||'').toLowerCase());
        const afterVoidBeforeBlock = !!prev && prev.kind==='tag' && !!prev.self && nextBlock;
        const betweenBlocks = previousBlock && nextBlock;
        out += (betweenBlocks || afterVoidBeforeBlock) ? t.text.replace(/\s+/g,' ').trim() : t.text;
      } else out += t.text;
    } else out += t.text;
  }
  return out;
}
function prettyMarkup(tokens: MarkToken[], language: 'html'|'xml', indent: CodeIndent): string {
  const unit = indent === 'tab' ? '\t' : ' '.repeat(indent);
  const matches = new Map<number, number>(), closeToOpen = new Map<number, number>(), parentAt: number[] = new Array(tokens.length), stack: number[] = [];
  for (let i=0;i<tokens.length;i++) {
    parentAt[i] = stack.length ? stack[stack.length-1] : -1;
    if(tokens[i].kind==='tag') {
      if(tokens[i].closing) { const open=stack.pop(); if(open!==undefined) { matches.set(open,i); closeToOpen.set(i,open); } }
      else if(!tokens[i].self) stack.push(i);
    }
  }
  const mixed = new Set<number>();
  for (const [open,close] of matches) {
    if (language === 'html' && ['pre','textarea','script','style'].includes((tokens[open].name||'').toLowerCase())) mixed.add(open);
    let childDepth = 0;
    for(let k=open+1;k<close;k++) {
      const current=tokens[k];
      if(current.kind==='tag' && !current.closing && !current.self) childDepth++;
      else if(current.kind==='tag' && current.closing) childDepth=Math.max(0,childDepth-1);
      else if(childDepth===0 && ((current.kind==='text' && current.text.trim()) || current.kind==='raw')) { mixed.add(open); break; }
    }
  }
  const unitOnly = (t: MarkToken) => t.kind==='text' && !t.text.trim();
  let out='', depth=0, lineStart=true, preserve=0;
  const trimEnd=()=>{out=out.replace(/[ \t]+$/,'');};
  const indentNow=()=>{if(lineStart){out+=unit.repeat(Math.max(0,depth));lineStart=false;}};
  const nl=()=>{trimEnd();if(out&&!out.endsWith('\n'))out+='\n';lineStart=true;};
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(t.kind==='raw'){indentNow();out+=t.text;continue;}
    if(t.kind==='text'){
      if(preserve>0){indentNow();out+=t.text;continue;}
      if(language==='xml' && t.text.trim()){indentNow();out+=t.text;continue;}
      if(language==='html' && t.text.trim()){indentNow();out+=t.text;continue;}
      // Whitespace between element-only nodes is normalised to one structural newline.
      if(t.text && out && !out.endsWith('\n')) nl();
      continue;
    }
    if(t.kind==='tag'){
      const idx=i;
      if(t.closing){
        const open=closeToOpen.get(idx);
        const isMixed=open!==undefined && mixed.has(open);
        if(!isMixed && out && !out.endsWith('\n')) nl();
        depth=Math.max(0,depth-1);indentNow();out+=t.text;
        if(!isMixed) nl();
        if(language==='html' && ['pre','textarea','script','style'].includes((t.name||'').toLowerCase())) preserve=Math.max(0,preserve-1);
      } else {
        if(!lineStart && !out.endsWith('\n')) {
          const parentOpen=parentAt[i] >= 0 ? parentAt[i] : undefined;
          const parentMixed=parentOpen!==undefined && mixed.has(parentOpen);
          if(language==='xml' ? !parentMixed : HTML_BLOCK.has((t.name||'').toLowerCase())) nl();
        }
        indentNow();out+=t.text;
        if(!t.self){depth++;if(language==='html'&&['pre','textarea','script','style'].includes((t.name||'').toLowerCase()))preserve++;}
        if(t.self && language==='html' && HTML_BLOCK.has((t.name||'').toLowerCase())) nl();
      }
      continue;
    }
    if(t.kind==='comment'||t.kind==='special'){
      if(!lineStart&&!out.endsWith('\n'))nl();indentNow();out+=t.text;nl();continue;
    }
  }
  return out.trim();
}
export function formatCode(request: CodeFormatRequest): CodeFormatResult {
  if (!request || typeof request !== 'object' || typeof request.input !== 'string')
    return { ok:false,error:'invalid-input',line:1,column:1,message:'Expected a request with text input' };
  const input = request.input;
  if (byteLength(input) > CODE_FORMAT_LIMITS.maxBytes)
    return failure('too-large','Input exceeds 2 MB',input,0);
  if (request.mode !== 'pretty' && request.mode !== 'minify')
    return failure('invalid-input','Mode must be pretty or minify',input,0);
  if (request.indent !== 2 && request.indent !== 4 && request.indent !== 'tab')
    return failure('invalid-input','Indent must be 2, 4 or tab',input,0);
  if (!['json','css','html','xml'].includes(request.language))
    return failure('unsupported-language','Only JSON, CSS, HTML and XML are supported',input,0);
  if (request.language === 'json') {
    if (byteLength(input) > JSON_LIMITS.maxBytes) return failure('too-large','JSON exceeds 2 MB',input,0);
    const result = request.mode==='pretty' ? prettyJson(input,{indent:request.indent}) : minifyJson(input);
    if (!result.ok) return failure(result.error==='too-deep'?'too-deep':result.error==='too-large'?'too-large':'invalid-json',result.message,input,Math.max(0,positionForLineColumn(input,result.line,result.column)));
    return {ok:true,output:result.value};
  }
  if (request.language==='css') {
    const scanned=cssTokens(input); if(scanned.error)return scanned.error;
    return {ok:true,output:request.mode==='pretty'?prettyCss(scanned.tokens!,request.indent):minifyCss(scanned.tokens!)};
  }
  const markupLanguage = request.language as 'html'|'xml';
  const scanned=markupTokens(input,markupLanguage); if(scanned.error)return scanned.error;
  return {ok:true,output:request.mode==='pretty'?prettyMarkup(scanned.tokens!,markupLanguage,request.indent):minifyMarkup(scanned.tokens!,markupLanguage)};
}
function positionForLineColumn(input:string,line:number,column:number):number {
  let pos=0, current=1; while(pos<input.length&&current<line){if(input[pos++]==='\n')current++;}
  return Math.min(input.length,pos+Math.max(0,column-1));
}
