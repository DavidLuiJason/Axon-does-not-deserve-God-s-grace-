type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const NUMBERTOWORDS_WORDS: Readonly<Record<string,true>> = Object.freeze({calculate: true, multiply: true, divide: true, percentage: true, currency: true, round: true, convertunits: true, roman: true, dollars: true, naira: true, translate: true, summarize: true, file: true, folder: true, database: true, phone: true, image: true, contact: true, python: true, send: true, count: true, sort: true, replace: true, explain: true, do: true, not: true, never: true});
const ACTION_WORDS: Readonly<Record<string,true>> = Object.freeze({spell:true,write:true,convert:true,say:true});
const ORDINAL_WORDS: Readonly<Record<string,true>> = Object.freeze({ordinal:true,first:true,second:true,third:true,fourth:true,fifth:true,sixth:true,seventh:true,eighth:true,ninth:true,tenth:true});
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
export const numberToWordsGuard: LaneGuard = (args,message) => {
 if(message.length>1000) return 'the request is too long for a safe number conversion';
 const value=args.number;
 if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()==='') return 'the required number is unclear, so the existing path should ask';
 if(!message.includes(String(value))) return 'the supplied number is not present in the request';
 const outside = wordsOf(message.split(String(value)).join(' '));
 for(const word of outside) if(Object.prototype.hasOwnProperty.call(ORDINAL_WORDS,word)) return 'the ordinal option is not bound by the real brain, so the existing path should decide';
 for(const word of outside) if(Object.prototype.hasOwnProperty.call(NUMBERTOWORDS_WORDS,word)) return 'the request includes an unsupported operation or target, so the existing path should decide';
 if(!wordsOf(message).some(word=>Object.prototype.hasOwnProperty.call(ACTION_WORDS,word))) return 'the request does not clearly ask to use this tool';
 return null;
};
