type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const FINDREPLACE_WORDS: Readonly<Record<string,true>> = Object.freeze({file: true, folder: true, database: true, allfiles: true, regexengine: true, undo: true, restore: true, rename: true, translate: true, summarize: true, document: true, doc: true, image: true, phone: true, contact: true, regex: true, regexp: true, case: true, sensitive: true, insensitive: true, whole: true, first: true, once: true, last: true, only: true, everywhere: true, send: true, python: true, code: true});
const ACTION_WORDS: Readonly<Record<string,true>> = Object.freeze({find:true,replace:true,substitute:true});
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
function unquote(value: string, message: string): string {
 let at=message.indexOf(value);
 while(at>=0){const before=at>0?message.charAt(at-1):'';const after=message.charAt(at+value.length);if(before!==''&&after!==''&&QUOTE_MARKS.includes(before)&&QUOTE_MARKS.includes(after))return message.slice(0,at)+' '+message.slice(at+value.length);at=message.indexOf(value,at+1);}
 return message;
}
export const findReplaceGuard: LaneGuard = (args,message) => {
 const value=args.text;
 if(typeof value!=='string'||value.trim()==='') return 'the required input is unclear, so the existing path should ask';
 if(!quoted(value,message)) return 'the supplied input is not clearly quoted, so the existing path should ask';
 const pattern=args.pattern; const replacement=args.replacement;
 if(typeof pattern!=='string'||pattern==='') return 'the text to find is unclear, so the existing path should ask';
 if(typeof replacement!=='string') return 'no replacement was said (that would delete the match), so the existing path should ask';
 if(!quoted(pattern,message)||!quoted(replacement,message)) return 'the text to find and its replacement must be clearly quoted';
 if(Object.keys(args).some(key=>key!=='text'&&key!=='pattern'&&key!=='replacement'&&key!=='replaceAll'&&key!=='caseSensitive')) return 'an option the lane cannot bind was supplied, so the existing path should decide';
 if(String(value).length>1000||pattern.length>1000||replacement.length>1000) return 'the text is too long for the lane, so the existing path should decide';
 const outside=wordsOf(unquote(replacement,unquote(pattern,unquote(String(value),message))));
 for(const word of outside) if(Object.prototype.hasOwnProperty.call(FINDREPLACE_WORDS,word)) return 'the request includes an unsupported operation or target, so the existing path should decide';
 if(!outside.some(word=>Object.prototype.hasOwnProperty.call(ACTION_WORDS,word))) return 'the request does not clearly ask to use this tool';
 return null;
};
