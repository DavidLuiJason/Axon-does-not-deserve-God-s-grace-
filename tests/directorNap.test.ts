import { readFile } from 'node:fs/promises';

let checks = 0;
function check(condition: unknown, label: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}

const nap = await readFile('./DIRECTOR_NAP.txt', 'utf8');
const now = await readFile('./NOW.txt', 'utf8');
check(nap.length > 0 && nap.length <= 5000, `DIRECTOR_NAP.txt is 1 to 5,000 characters (it is ${nap.length})`);
check(nap.includes('LAWS OF THIS FILE'), 'the laws block is present');
check(nap.includes('Maximum 5,000 characters'), 'the size law is written in the file');
check(nap.includes('short, plain and explains itself'), 'the plain-notes law is written in the file');
check(nap.includes('NOTES:'), 'the notes block is present');
check(!nap.includes('\r'), 'LF line endings only');
check(now.includes('DIRECTOR_NAP.txt'), 'NOW.txt points the Director to DIRECTOR_NAP.txt');
console.log(`DIRECTOR NAP OK: ${checks} checks`);
