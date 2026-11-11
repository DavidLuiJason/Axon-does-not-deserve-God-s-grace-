type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const ENCODERDECODER_WORDS: Readonly<Record<string,true>> = Object.freeze({encrypt: true, decrypt: true, compress: true, hash: true, sign: true, decodefile: true, image: true, video: true, translate: true, send: true, save: true, upload: true, email: true, python: true, javascript: true, contact: true, database: true, phone: true, count: true, sort: true, convert: true, spell: true, calculate: true, summarize: true});
const ACTION_WORDS: Readonly<Record<string,true>> = Object.freeze({encode:true,decode:true});
const ENCODER_MODES: Readonly<Record<string,string>> = Object.freeze({encode:'encode',encoding:'encode',decode:'decode',decoding:'decode'});
const ENCODER_FORMATS: Readonly<Record<string,string>> = Object.freeze({base64:'base64',base64url:'base64url',url:'url',html:'html',hex:'hex',binary:'binary',rot13:'rot13'});
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
export const encoderDecoderGuard: LaneGuard = (args,message) => {
 const value=args.input;
 if(typeof value!=='string'||value.trim()==='') return 'the required input is unclear, so the existing path should ask';
 if(value.length>1000) return 'the input is too long for a safe direct-lane reply';
 if(!quoted(value,message)) return 'the supplied input is not clearly quoted, so the existing path should ask';
 const outside=wordsOf(message.split(String(value)).join(' '));
 const modes=new Set<string>(); const formats=new Set<string>();
 for(const word of outside){if(Object.prototype.hasOwnProperty.call(ENCODER_MODES,word))modes.add(ENCODER_MODES[word]!);if(Object.prototype.hasOwnProperty.call(ENCODER_FORMATS,word))formats.add(ENCODER_FORMATS[word]!);if(Object.prototype.hasOwnProperty.call(ENCODERDECODER_WORDS,word))return 'the request includes an unsupported operation or target, so the existing path should decide';}
 if(modes.size>1||formats.size>1)return 'the request names conflicting modes or formats, so the existing path should ask';
 if(!wordsOf(message).some(word=>Object.prototype.hasOwnProperty.call(ACTION_WORDS,word))) return 'the request does not clearly ask to use this tool';
 return null;
};
