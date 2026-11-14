import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { repairMessage } from '../src/brain/mind/repair/repair.ts';

const cases = JSON.parse(readFileSync('tests/fixtures/repairCases.json', 'utf8')) as Array<{id:string; input:unknown; expected:unknown}>;
let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
for (const item of cases) {
  let actual: unknown;
  try { actual = repairMessage(item.input as { readonly text: string }); }
  catch (error) { actual = { thrown: String(error) }; }
  let equal = false;
  try {
    if ((item.expected as {ok?:boolean}).ok === false) {
      const got = actual as {ok?:boolean; error?:string; message?:string};
      deepStrictEqual({ok:got.ok, error:got.error}, item.expected);
      equal = typeof got.message === 'string' && got.message.length > 0;
    } else {
      deepStrictEqual(actual, item.expected);
      equal = true;
    }
  } catch { equal = false; }
  check(equal, item.id);
}
console.log(`repair: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
