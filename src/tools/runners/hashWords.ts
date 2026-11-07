/**
 * PROPOSED, the owner's yes is WAITING.
 * Closed choice words for Hash Tool; no words are approved until the owner says yes.
 */
import type { HashAlgorithm } from '../engines/create/hashChecksum';
export const HASH_ALGORITHM_WORDS: Readonly<Record<string,HashAlgorithm>> = Object.freeze({'md5':'MD5','sha1':'SHA-1','sha-1':'SHA-1','sha256':'SHA-256','sha-256':'SHA-256','sha384':'SHA-384','sha-384':'SHA-384','sha512':'SHA-512','sha-512':'SHA-512','crc32':'CRC32'});
export const HASH_ALGORITHM_CHOICES: readonly string[] = Object.freeze(Object.keys(HASH_ALGORITHM_WORDS));
export function foldHashAlgorithm(value: unknown): unknown { if(typeof value!=='string')return value; if(Object.values(HASH_ALGORITHM_WORDS).includes(value as HashAlgorithm))return value; return Object.prototype.hasOwnProperty.call(HASH_ALGORITHM_WORDS,value.toLowerCase())?HASH_ALGORITHM_WORDS[value.toLowerCase()]:value; }
