type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;
const QUOTE_MARKS = "\"'\u201C\u201D\u2018\u2019";
const HASHTOOL_WORDS: Readonly<Record<string,true>> = Object.freeze({encrypt: true, decrypt: true, password: true, reverse: true, recover: true, file: true, folder: true, verify: true, translate: true, send: true, save: true, upload: true, email: true, python: true, javascript: true, contact: true, database: true, phone: true, image: true, video: true, count: true, encode: true, decode: true, sort: true, convert: true, summarize: true});
const ACTION_WORDS: Readonly<Record<string,true>> = Object.freeze({hash:true,checksum:true,calculate:true});
const HASH_ALGORITHM_WORDS: Readonly<Record<string,string>> = Object.freeze({md5:'MD5',sha1:'SHA-1','sha-1':'SHA-1',sha256:'SHA-256','sha-256':'SHA-256',sha384:'SHA-384','sha-384':'SHA-384',sha512:'SHA-512','sha-512':'SHA-512',crc32:'CRC32'});
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
export const hashToolGuard: LaneGuard = (args,message) => {
 const value=args.input;
 if(typeof value==='string'&&value.length>1000) return 'the input is too long for a safe direct-lane reply';
 if(typeof value!=='string'||value.trim()==='') return 'the required input is unclear, so the existing path should ask';
 if(!quoted(value,message)) return 'the supplied input is not clearly quoted, so the existing path should ask';
 const outsideText=message.split(String(value)).join(' ').toLowerCase(); const outside=wordsOf(outsideText); const algorithms=new Set<string>();
 for(const word of outside){if(Object.prototype.hasOwnProperty.call(HASH_ALGORITHM_WORDS,word))algorithms.add(HASH_ALGORITHM_WORDS[word]!);if(Object.prototype.hasOwnProperty.call(HASHTOOL_WORDS,word))return 'the request includes an unsupported operation or target, so the existing path should decide';}
 for(const key of Object.keys(HASH_ALGORITHM_WORDS)){if(key.includes('-')&&outsideText.includes(key))algorithms.add(HASH_ALGORITHM_WORDS[key]!);}
 if(algorithms.size>1)return 'the request names two different algorithms, so the existing path should ask';
 if(!wordsOf(message).some(word=>Object.prototype.hasOwnProperty.call(ACTION_WORDS,word))) return 'the request does not clearly ask to use this tool';
 return null;
};
