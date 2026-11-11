type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const TEXTCLEANER_WORDS: Readonly<Record<string,true>> = Object.freeze({format: true, summarize: true, translate: true, proofread: true, spellcheck: true, grammar: true, delete: true, compress: true, preserve: true, trim: true, trimming: true, trimmed: true, collapse: true, collapsing: true, repeated: true, spaces: true, blank: true, blanks: true, lines: true, remove: true, straighten: true, quotes: true, dashes: true, normalize: true, normalise: true, zero: true, width: true, lineendings: true, file: true, folder: true, database: true, phone: true, image: true, contact: true, send: true, python: true, count: true, sort: true, replace: true, do: true, not: true, never: true, and: true});
const ACTION_WORDS: Readonly<Record<string,true>> = Object.freeze({clean:true,cleaner:true});
function wordsOf(value: string): string[] {
 const out: string[]=[]; let word='';
 for (const ch of value.toLowerCase()) {
  const c=ch.charCodeAt(0);
  if ((c>=97&&c<=122)||(c>=48&&c<=57)) word+=ch;
  else if(word){out.push(word);word='';}
 }
 if(word)out.push(word);
 return out;
}
function quoted(value: string, message: string): boolean {
 let at=message.indexOf(value);
 while(at>=0){const before=at>0?message.charAt(at-1):'';const after=message.charAt(at+value.length);if(before!==''&&after!==''&&QUOTE_MARKS.includes(before)&&QUOTE_MARKS.includes(after))return true;at=message.indexOf(value,at+1);}
 return false;
}
export const textCleanerGuard: LaneGuard = (args,message) => {
 if(message.length>1000) return 'the supplied text is too large for a safe chat clean';
 const value=args.text;
 if(typeof value!=='string'||value.trim()==='') return 'the required input is unclear, so the existing path should ask';
 if(!quoted(value,message)) return 'the supplied input is not clearly quoted, so the existing path should ask';
 for(const word of wordsOf(message.split(String(value)).join(' '))) if(Object.prototype.hasOwnProperty.call(TEXTCLEANER_WORDS,word)) return 'the request includes an unsupported operation or target, so the existing path should decide';
 if(!wordsOf(message).some(word=>Object.prototype.hasOwnProperty.call(ACTION_WORDS,word))) return 'the request does not clearly ask to use this tool';
 return null;
};
