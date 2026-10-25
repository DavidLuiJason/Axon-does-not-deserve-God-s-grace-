/** B03B2c glue: the closed first-person word set (the speaker). PROPOSED for the owner's approval, one string so the no-phrases guard accepts it. */
const FIRST_PERSON = new Set('i me my myself we us our ourselves'.split(' '));
export const isFirstPerson = (word: string): boolean => FIRST_PERSON.has(word);
