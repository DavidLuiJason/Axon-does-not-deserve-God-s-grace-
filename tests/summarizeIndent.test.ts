import assert from 'node:assert/strict';
import { summarizeText } from '../src/tools/engines/text/summarize';
const plain='First sentence explains the idea. Second sentence gives another detail. Third sentence adds context. Fourth sentence finishes the point.';
for(const indent of ['    ','\t']){const text=plain.split('. ').map((x,i,a)=>indent+x+(i<a.length-1?'.':'')).join('\n');const a=summarizeText(plain,{sentences:4}),b=summarizeText(text,{sentences:4});assert.equal(a.ok,true);assert.equal(b.ok,true);if(a.ok&&b.ok){assert.deepEqual(b.sentences.map(x=>[x.text,x.score]),a.sentences.map(x=>[x.text,x.score]));assert.ok(b.warnings.includes('Indented lines were read as text, not code. Put code in a fenced block (three backticks) to leave it out.'));}}
for(const code of [
'    const value = fn();\n    return value;',
'\tprint("hello")\n\tprint("world")',
'    int main() { return 0; }\n    int next() { return 1; }',
'    SELECT name FROM users;\n    SELECT age FROM users;',
'    {"a": 1}\n    {"b": 2}',
'    $ echo hello\n    $ echo world',
'    value ~ other\n    value ~ another'
]){const r=summarizeText(code);assert.equal(r.ok,true);if(r.ok){assert.ok(r.codeBlocks>=1);assert.ok(r.warnings.some(x=>x.includes('Code was left out')));}}

const mixedIndentText=['    First sentence explains the idea.','\tSecond sentence gives another detail.','    Third sentence adds context.','\tFourth sentence finishes the point.'].join('\n');const mixedPlain='First sentence explains the idea. Second sentence gives another detail. Third sentence adds context. Fourth sentence finishes the point.';const mi=summarizeText(mixedIndentText,{sentences:4}),mp=summarizeText(mixedPlain,{sentences:4});assert.equal(mi.ok,true);assert.equal(mp.ok,true);if(mi.ok&&mp.ok)assert.deepEqual(mi.sentences.map(x=>[x.text,x.score]),mp.sentences.map(x=>[x.text,x.score]));
const halfCode='    This is ordinary prose.\n    const value = fn();';const half=summarizeText(halfCode);assert.equal(half.ok,true);if(half.ok)assert.ok(half.codeBlocks>=1);
const belowHalf='    const value = fn();\n    This is ordinary prose.\n    Another ordinary line.\n    Yet another ordinary line.';const below=summarizeText(belowHalf);assert.equal(below.ok,true);if(below.ok)assert.equal(below.codeBlocks,0);
const bullet='- A bullet explains the first point.\n    Continuation text adds useful detail.\n    A second continuation line adds context.\n- Another bullet describes the second point.';const br=summarizeText(bullet);assert.equal(br.ok,true);if(br.ok)assert.ok(br.stats.sentencesIn>=3);
const single=summarizeText('    One indented sentence explains a point.');assert.equal(single.ok,true);if(single.ok)assert.equal(single.codeBlocks,0);
const nested=summarizeText('- Parent item\n    - Nested item\n    - Another nested item');assert.equal(nested.ok,true);if(nested.ok)assert.equal(nested.codeBlocks,0);
const tricky='    import os\n    import sys';const tr=summarizeText(tricky);assert.equal(tr.ok,true);if(tr.ok)assert.equal(tr.codeBlocks,0); // Honest limitation: no syntax markers means prose.
console.log('summarize indentation tests passed');
