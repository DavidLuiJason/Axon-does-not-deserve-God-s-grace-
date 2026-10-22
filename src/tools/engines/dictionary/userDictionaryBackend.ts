import type { KnowledgeBackend, KnowledgeCredits, KnowledgeSense, KnowledgeSlotStatus } from '../../../brain/knowledge/slot.ts';
import type { UserDictionaryEntry } from './userDictionary.ts';
export interface UserDictionaryReader { get(key:unknown):{ok:true;entries:UserDictionaryEntry[]}|{ok:false;error:string;message:string}; }
/** Adapter only: it is not wired into AXON's brain or combined with the core source. */
export function createUserDictionaryBackend(dictionary:UserDictionaryReader):KnowledgeBackend {
 const metadata:KnowledgeSlotStatus={ready:true,source:'Your dictionary',version:'user-v1',note:'Owner-maintained entries; separate from the English dictionary.'};
 return {
  status:()=>({...metadata}),
  async lookup(word:string):Promise<{status:'found';word:string;senses:KnowledgeSense[]}|{status:'not-found';word:string}>{
   if(typeof word!=='string')throw new Error('Invalid dictionary lookup.');
   const key=word.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,' ');
   const result=dictionary.get(key);if(!result.ok)throw new Error('User dictionary storage is unavailable.');
   if(!result.entries.length)return {status:'not-found',word:key};
   return {status:'found',word:result.entries[0].word,senses:result.entries.map(e=>({partOfSpeech:e.partOfSpeech,meaning:e.meaning,...(e.example?{example:e.example}:{}),...(e.synonyms?{synonyms:[...e.synonyms]}:{})}))};
  },
  credits():KnowledgeCredits{return {source:'Your dictionary',version:'user-v1',license:'Your own words'};},
 };
}
