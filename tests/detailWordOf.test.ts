import { DETAIL_WORDS } from '../src/brain/mind/meaning/structure/detailWords';
// Owner-approved closed set (FL13): 'of' added 2026-10-31. Any further word needs the owner's yes.
const words = DETAIL_WORDS.split(' ');
const expected = ['for', 'in', 'to', 'by', 'at', 'of'];
if (words.length !== expected.length || expected.some((word) => !words.includes(word))) throw new Error(`DETAIL_WORDS changed: ${DETAIL_WORDS}`);
console.log('detail words test OK: 6 words');
