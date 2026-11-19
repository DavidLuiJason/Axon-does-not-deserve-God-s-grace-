type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const PASSWORDGENERATOR_WORDS: Readonly<Record<string,true>> = Object.freeze({recover: true, reveal: true, crack: true, decrypt: true, retrieve: true, existing: true, account: true, wifi: true, without: true, only: true, symbols: true, symbol: true, special: true, digits: true, numbers: true, letters: true, uppercase: true, lowercase: true, ambiguous: true, memorable: true, pronounceable: true, passphrase: true, words: true, pin: true, hex: true, alphanumeric: true, include: true, exclude: true, avoid: true, check: true, test: true, store: true, save: true, manager: true, my: true, your: true, our: true, his: true, her: true, their: true, how: true, what: true, why: true, should: true, hash: true, encrypt: true, decode: true, encode: true, qr: true, email: true, bank: true, python: true, code: true, script: true, function: true, javascript: true, passwords: true, another: true, several: true, multiple: true, many: true, two: true, three: true, five: true, ten: true, few: true, list: true, batch: true, bulk: true, reuse: true, change: true, reset: true, forgot: true, hint: true, question: true, policy: true, rules: true, forget: true});
const ACTION_WORDS: Readonly<Record<string,true>> = Object.freeze({generate:true,create:true,make:true});
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
export const passwordGeneratorGuard: LaneGuard = (args,message) => {
 const value=args.options;
 if((typeof value!=='string'&&(!value||typeof value!=='object'))||(typeof value==='string'&&value.trim()==='')) return 'the password options are unclear, so the existing path should ask';
 for(const word of wordsOf(message.split(String(value)).join(' '))) if(Object.prototype.hasOwnProperty.call(PASSWORDGENERATOR_WORDS,word)) return 'the request includes an unsupported operation or target, so the existing path should decide';
 if(message.length>300) return 'the message is too long for the lane, so the existing path should decide';
 const length=args.length; if(typeof length!=='number'||!Number.isInteger(length)||length<4||length>128) return 'the password length is outside what the lane may answer, so the existing path should decide';
 if(!wordsOf(message).some(word=>Object.prototype.hasOwnProperty.call(ACTION_WORDS,word))) return 'the request does not clearly ask to use this tool';
 return null;
};
