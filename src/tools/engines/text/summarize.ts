export const SUMMARIZE_LIMITS = { maxCharacters: 300_000, maxSentences: 5_000, maxChosen: 20 } as const;
export type SummarizeErrorCode = 'invalid-input' | 'empty-input' | 'too-long' | 'too-many-sentences' | 'invalid-options';
export type SummarizeError = { ok: false; error: SummarizeErrorCode; message: string };
export type SummarySentence = { index: number; text: string; score: number; paragraph?: number; codeBlock?: boolean };
export type SummarizeOptions = { sentences?: number; keywords?: number; ratio?: number; code?: 'skip' | 'keep' };
export type SummarizeResult = { ok: true; sentences: SummarySentence[]; keywords: string[]; keywordCoverage: number; codeBlocks: number; text: string; stats: { sentencesIn: number; sentencesOut: number; wordsIn: number; wordsOut: number; keptPercent: number; charactersIn: number; charactersOut: number }; warnings: string[]; label: 'Extractive: sentences are copied from your text, never rewritten.' } | SummarizeError;
export const SUMMARIZER_DESCRIPTOR = { toolId: 'summarizer', displayName: 'Summarizer', purpose: 'Selects important original sentences without rewriting them.', examples: ['Summarize this article in five sentences.', 'Extract the key sentences from these notes.'], inputs: [{ name: 'text', kind: 'text' as const, prompt: 'Text to summarize' }, { name: 'sentences', kind: 'text' as const, prompt: 'Number of sentences to keep' }] } as const;
const STOP = new Set(('a an the and or but if while because as until of at by for with about against between into through during before after above below to from up down in out on off over under again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very can will just should now i me my we our you your he him his she her it its they them their what which who whom this that these those am is are was were be been being have has had do does did having doing would could ought shall may might must').split(' '));
const wordRe = /[\p{L}\p{N}]+(?:['’\-‐‑‒–—][\p{L}\p{N}]+)*/gu;
const cjkTokenRe = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const cjkTokenLikeRe = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\u30FC\u3005]/u;
const cjkMarkRe = /[\u30FC\u3005]/u;
function tokenize(s: string): { tokens: string[]; cjkCodePoints: number; cjkTokens: number } {
 const normalized=s.normalize('NFKC').toLowerCase(), tokens:string[]=[];
 let ordinaryStart=0, run:string[]=[], cjkCodePoints=0, cjkTokens=0, i=0;
 const flushOrdinary=(end:number)=>{if(end>ordinaryStart){const found=normalized.slice(ordinaryStart,end).match(wordRe)??[];for(const token of found)tokens.push(token);}};
 const flushRun=()=>{if(!run.length)return;cjkCodePoints+=run.length;if(run.length===1){tokens.push(run[0]);cjkTokens++;}else {for(let j=0;j<run.length-1;j++)tokens.push(run[j]+run[j+1]);cjkTokens+=run.length-1;}run=[];};
 while(i<normalized.length){const cp=normalized.codePointAt(i)!;const ch=String.fromCodePoint(cp),size=ch.length;
  if(cjkTokenRe.test(ch)||(run.length>0&&cjkMarkRe.test(ch))){if(!run.length){flushOrdinary(i);ordinaryStart=i+size;}run.push(ch);}
  else {if(run.length){flushRun();ordinaryStart=i; } }
  i+=size;
 }
 if(run.length){flushRun();ordinaryStart=normalized.length;}flushOrdinary(normalized.length);return {tokens,cjkCodePoints,cjkTokens};
}
function words(s: string): string[] { return tokenize(s).tokens; }
// For unspaced scripts, stats count one unit per code point in each run, not per overlapping pair.
function wordUnits(s:string):number { const t=tokenize(s);return t.tokens.length-t.cjkTokens+t.cjkCodePoints; }
type Unit = { text: string; paragraph: number; codeBlock?: boolean };
// Honest limit: indented code with none of these syntax signs (for example only `import os` lines) is read as text.
function isCodeLikeLine(line:string):boolean {
 if(/[{}\[\];=<>\\|$^~#]/u.test(line)||/\/\/|\/\*|\*\/|->|=>|::/u.test(line))return true;
 if(/[\p{L}\p{N}_]\(/u.test(line)||/[\p{L}\p{N}]_[\p{L}\p{N}]/u.test(line))return true;
 return false;
}
function codeRegions(input: string): { units: Unit[]; codeBlocks: number; indentedAsText: boolean } {
 const lines=input.replace(/\r\n?/g,'\n').split('\n'), units:Unit[]=[]; let prose:string[]=[], paragraph=0, codeBlocks=0, fence:string|null=null, fenceOpen='', code:string[]=[], indentedAsText=false;
 const flush=()=>{if(!prose.length)return;const raw=prose.join('\n');const parts=splitProse(raw,paragraph);units.push(...parts);prose=[];paragraph=parts.length?Math.max(paragraph,...parts.map(x=>x.paragraph))+1:paragraph+1;};
 for(let i=0;i<lines.length;i++){const line=lines[i], fm=line.match(/^\s{0,3}(```+|~~~+)/);if(fence){if(fm&&fm[1][0]===fence[0]&&fm[1].length>=fence.length){const before=paragraph;flush();paragraph=before;codeBlocks++;units.push({text:[fenceOpen,...code,line].join('\n'),paragraph,codeBlock:true});code=[];fence=null;}else code.push(line);continue;}
 if(fm){const before=paragraph;flush();paragraph=before;fence=fm[1];fenceOpen=line;code=[];continue;}
 if(/^(?: {4,}|\t)\S/.test(line)){const indented=[line];while(i+1<lines.length&&/^(?: {4,}|\t)\S/.test(lines[i+1]))indented.push(lines[++i]);if(indented.length>=2){const codeLike=indented.filter(isCodeLikeLine).length;
 if(codeLike>=Math.ceil(indented.length/2)){const before=paragraph;flush();paragraph=before;codeBlocks++;units.push({text:indented.join('\n'),paragraph,codeBlock:true});}
 else {indentedAsText=true;prose.push(...indented.map(x=>x.replace(/^(?: {4,}|\t)+/,'')));}
 }else prose.push(line);continue;}
 if(!line.trim()){flush();paragraph++;continue;}prose.push(line);
 }
 if(fence){const before=paragraph;flush();paragraph=before;codeBlocks++;units.push({text:[fenceOpen,...code].join('\n'),paragraph,codeBlock:true});}else flush();
 return {units,codeBlocks,indentedAsText};
}
function splitProse(input:string, initialParagraph:number):Unit[]{
 const lines=input.split('\n'),out:Unit[]=[];let paragraph=initialParagraph,paraLines:string[]=[];
 const flush=()=>{if(!paraLines.length)return;const joined=paraLines.join('\n'),parts:string[]=[];let start=0,inTicks=false,lastHttp=-1,lastAt=-1;
 let pairedTicks:Set<number>|null=null;if(joined.indexOf('`')>=0){const tickPositions:number[]=[];for(let z=0;z<joined.length;z++)if(joined[z]==='`')tickPositions.push(z);pairedTicks=new Set<number>();for(let z=0;z+1<tickPositions.length;z+=2){pairedTicks.add(tickPositions[z]);pairedTicks.add(tickPositions[z+1]);}}
 let tokenStart=0;
 for(let i=0;i<joined.length;i++){if(/\s/u.test(joined[i])){tokenStart=i+1;lastHttp=-1;lastAt=-1;}else{if(joined[i]==='@')lastAt=i;if((joined[i]==='p'||joined[i]==='P')&&i>=3&&(joined[i-3]==='h'||joined[i-3]==='H')&&(joined[i-2]==='t'||joined[i-2]==='T')&&(joined[i-1]==='t'||joined[i-1]==='T'))lastHttp=i-3;}if(joined[i]==='`'){if(pairedTicks?.has(i))inTicks=!inTicks;continue;}if(inTicks)continue;const c=joined[i];if(!'.!?…。！？؟।'.includes(c))continue;
 let j=i+1;while(j<joined.length&&"\\\"'”’)]}】」』》〉".includes(joined[j]))j++;let k=j;while(k<joined.length&&/\s/u.test(joined[k]))k++;const next=joined[k]??'';const prefix=joined.slice(Math.max(start,i-18),i+1);
 const abbrev=c==='.'&&(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Inc|Ltd|Co|vs|etc|e\.g|i\.e|approx)\.$/.test(prefix)||(/\b(?:No|Fig)\.$/.test(prefix)&&/\d/.test(joined.slice(k,k+1)))||/\b[A-Z]\.$/.test(prefix));
 const recentStart=Math.max(tokenStart,i-255);let url=false;if(c==='.'&&lastHttp>=recentStart){const token=joined.slice(recentStart,i+1);if(token.toLowerCase().indexOf('http')>=0)url=/https?:\/\/[^\s]*$/i.test(token);}if(c==='.'&&!url&&lastAt>=recentStart){const token=joined.slice(recentStart,i+1);if(token.indexOf('@')>=0)url=/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(token);}
 const decimal=c==='.'&&/\d\.\d/.test(joined.slice(Math.max(0,i-1),Math.min(joined.length,i+2)));
 const cjk='。！？'.includes(c), boundary=k>=joined.length||/[\p{Lu}\p{Lo}\p{N}"'“‘([{「『【（]/u.test(next);
 if(!abbrev&&!url&&!decimal&&(cjk||boundary)){parts.push(joined.slice(start,j));start=k;i=k-1;tokenStart=k;}
 }
 if(start<joined.length)parts.push(joined.slice(start));for(const p of parts){const t=p.trim();if(t)out.push({text:t,paragraph});}paraLines=[];paragraph++;};
 for(const line of lines){if(!line.trim()){flush();paragraph++;continue;}if(/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)){flush();const t=line.trim().replace(/^\s*(?:[-+*]|\d+[.)])\s+/,'').trim();if(t)out.push({text:t,paragraph:paragraph++});}else paraLines.push(line);}flush();return out;
}
function cpLength(s:string):number{return Array.from(s).length;}
export function summarizeText(text: string, options: SummarizeOptions = {}): SummarizeResult {
 if(typeof text!=='string')return {ok:false,error:'invalid-input',message:'Input must be text.'};if(!text.trim())return {ok:false,error:'empty-input',message:'Enter text to summarize.'};if(text.length>SUMMARIZE_LIMITS.maxCharacters)return {ok:false,error:'too-long',message:'Text exceeds the 300,000 character limit.'};
 if(options===null||typeof options!=='object'||(options.sentences!==undefined&&(!Number.isFinite(options.sentences)||!Number.isInteger(options.sentences)||options.sentences<1))||(options.keywords!==undefined&&(!Number.isFinite(options.keywords)||!Number.isInteger(options.keywords)||options.keywords<0))||(options.ratio!==undefined&&(!Number.isFinite(options.ratio)||options.ratio<0.05||options.ratio>0.5))||(options.ratio!==undefined&&options.sentences!==undefined)||(options.code!==undefined&&options.code!=='skip'&&options.code!=='keep'))return {ok:false,error:'invalid-options',message:'Choose either a valid sentence count or a ratio from 0.05 to 0.5, with valid keyword and code options.'};
 const parsed=codeRegions(text), units=parsed.units, prose=units.filter(x=>!x.codeBlock);const s=prose;if(s.length>SUMMARIZE_LIMITS.maxSentences)return {ok:false,error:'too-many-sentences',message:'Text exceeds the 5,000 sentence limit.'};const tokenized=s.map(x=>tokenize(x.text));const allWords=tokenized.map(x=>x.tokens);const content=allWords.map((a,i)=>a.filter(w=>cjkTokenLikeRe.test(w)|| (w.length>=3&&!STOP.has(w))));const tf=new Map<string,number>();for(const arr of content)for(const w of arr)tf.set(w,(tf.get(w)??0)+1);let maxTf=0;for(const n of tf.values())maxTf=Math.max(maxTf,n);
 const firstByParagraph=new Set<number>();for(let i=0;i<s.length;i++)if(i===0||s[i].paragraph!==s[i-1].paragraph)firstByParagraph.add(i);
 const base=content.map((a,i)=>{const distinct=new Set(a);let sum=0;for(const w of distinct)sum+=(tf.get(w)??0)/(maxTf||1);const score=a.length?sum/Math.sqrt(1+a.length):0;return score*(i===0?1.25:firstByParagraph.has(i)?1.15:1);});
 const requested=options.ratio!==undefined?Math.ceil(s.length*options.ratio):options.sentences??5;const n=Math.max(1,Math.min(SUMMARIZE_LIMITS.maxChosen,s.length,requested));const chosen=new Set<number>();const adj=(i:number)=>{let maxJ=0;for(const j of chosen){const a=new Set(content[i]),b=new Set(content[j]);let inter=0;for(const w of a)if(b.has(w))inter++;const union=a.size+b.size-inter;maxJ=Math.max(maxJ,union?inter/union:0);}return base[i]*(1-maxJ);};
 if(s.length<3)for(let i=0;i<s.length;i++)chosen.add(i);else while(chosen.size<n){let best=-1,bestScore=0;for(let i=0;i<s.length;i++){if(chosen.has(i))continue;const score=adj(i);if(score>bestScore){bestScore=score;best=i;}}if(best<0)break;chosen.add(best);}
 const chosenIdx=[...chosen].sort((a,b)=>a-b);const picked:SummarySentence[]=chosenIdx.map(i=>({index:i,text:s[i].text,score:Number(base[i].toFixed(8)),paragraph:s[i].paragraph}));if(options.code==='keep'){let proseBefore=0;for(const u of units){if(u.codeBlock)picked.push({index:proseBefore,text:u.text,score:0,paragraph:u.paragraph,codeBlock:true});else proseBefore++;}}picked.sort((a,b)=>a.index-b.index||Number(Boolean(b.codeBlock))-Number(Boolean(a.codeBlock)));
 const keywordTop=[...tf.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10);const den=keywordTop.reduce((n,x)=>n+x[1],0);const pickedTokenSets=picked.filter(x=>!x.codeBlock).map(x=>new Set(words(x.text)));const covered=keywordTop.reduce((n,[w,tfv])=>n+(pickedTokenSets.some(set=>set.has(w))?tfv:0),0);const keywordCoverage=den?covered/den:1;
 const allWordsCount=allWords.flat().length,stopCount=allWords.flat().filter(w=>STOP.has(w)).length;const warnings:string[]=[];if(s.length>0&&s.length<3)warnings.push('The text is very short, so all of it is shown.');const cjkTokenCount=tokenized.reduce((n,x)=>n+x.cjkTokens,0);const hasCjkMajority=allWordsCount>0&&cjkTokenCount/allWordsCount>=0.5;if(allWordsCount>=50&&stopCount/allWordsCount<0.08&&!hasCjkMajority)warnings.push('This text does not look like English, so the result may be poor.');if(hasCjkMajority)warnings.push('Sentence choice for this script is approximate: it is based on repeated character pairs.');if(parsed.indentedAsText)warnings.push('Indented lines were read as text, not code. Put code in a fenced block (three backticks) to leave it out.');if(parsed.codeBlocks&&options.code!=='keep')warnings.push('Code was left out of the summary, because copying sentences cannot summarise code.');if(keywordCoverage<0.4&&s.length>=8)warnings.push('These sentences cover only part of the main topics; a longer summary may help.');
 const keywords=[...tf.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,Math.max(0,Math.min(100,options.keywords??8))).map(([w])=>w);const wordCount=(x:string)=>wordUnits(x);const joined:string[]=[];let lastPara:number|undefined,lastWasCode=false;for(const x of picked){if(lastPara!==undefined)joined.push(x.codeBlock||lastWasCode||x.paragraph!==lastPara?'\n':' ');joined.push(x.text);lastPara=x.paragraph;lastWasCode=Boolean(x.codeBlock);}const outputText=joined.join('');const wordsIn=wordCount(units.filter(x=>!x.codeBlock).map(x=>x.text).join(' ')),wordsOut=picked.filter(x=>!x.codeBlock).reduce((n,x)=>n+wordCount(x.text),0);
 return {ok:true,sentences:picked,keywords,keywordCoverage,codeBlocks:parsed.codeBlocks,text:outputText,stats:{sentencesIn:s.length,sentencesOut:picked.filter(x=>!x.codeBlock).length,wordsIn,wordsOut,keptPercent:wordsIn?Number((wordsOut/wordsIn*100).toFixed(2)):0,charactersIn:cpLength(text),charactersOut:cpLength(outputText)},warnings,label:'Extractive: sentences are copied from your text, never rewritten.'};
}
