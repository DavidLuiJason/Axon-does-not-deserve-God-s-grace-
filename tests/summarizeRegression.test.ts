import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeText } from '../src/tools/engines/text/summarize';
const cases=JSON.parse(readFileSync('tests/fixtures/summarizeReference.json','utf8')) as {text:string;n:number;ref:{n_in:number;idx:number[];scores:number[];kw:string[]}}[];
for(let i=0;i<cases.length;i++){const c=cases[i],r=summarizeText(c.text,{sentences:c.n});assert.equal(r.ok,true,`case ${i} failed`);if(!r.ok)continue;assert.deepEqual(r.sentences.map(s=>s.index),c.ref.idx,`indexes case ${i}`);assert.equal(r.sentences.length,c.ref.idx.length);assert.equal(r.stats.sentencesIn,c.ref.n_in);for(let j=0;j<c.ref.scores.length;j++)assert.ok(Math.abs(r.sentences[j].score-c.ref.scores[j])<=1e-7,`score case ${i}/${j}`);assert.deepEqual(r.keywords,c.ref.kw,`keywords case ${i}`);}
console.log(`summarize regression passed: ${cases.length} cases`);
