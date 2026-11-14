import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { judgeProposal } from '../src/brain/mind/judgment/judge.ts';
import { reviewProposal } from '../src/brain/mind/judgment/council.ts';

const cases = JSON.parse(readFileSync('tests/fixtures/judgmentCases.json', 'utf8')) as Array<{id:string;input:unknown;expected:unknown}>;
let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
for (const item of cases) {
  let actual: unknown;
  try {
    const result = judgeProposal(item.input as never);
    if (!result.ok) actual = {ok:false,error:result.error};
    else actual = {ok:true,value:{verdict:result.value.verdict,urgent:result.value.urgent,
      flags:result.value.flags.map(flag=>[flag.seat,flag.severity])}};
  } catch { actual = '__THREW__'; }
  let equal=false;
  try { deepStrictEqual(actual,item.expected); equal=true; } catch {}
  check(equal,item.id);
}

// D84 addition: flag details (evidence, resolvable, next) and non-empty text fields, hand-derived from the card's seat rules.
const flagCases = JSON.parse(readFileSync('tests/fixtures/judgmentFlagCases.json', 'utf8')) as Array<{id:string;input:unknown;expected:unknown}>;
for (const item of flagCases) {
  const result = reviewProposal(item.input as never);
  let equal = false;
  if (result.ok) {
    try {
      deepStrictEqual(result.value.map(flag => [flag.seat, flag.severity, flag.evidence, flag.resolvable, flag.next]), item.expected);
      equal = result.value.every(flag => [flag.concern, flag.part, flag.reason, flag.unknown].every(text => typeof text === 'string'));
    } catch {}
  }
  check(equal, item.id);
}
console.log(`judgment: ${n} checks; ${f} failed`);
if (f!==0) process.exitCode=1;
