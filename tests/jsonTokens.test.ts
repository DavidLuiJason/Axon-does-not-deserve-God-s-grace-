import {strict as assert} from 'node:assert';
import {tokenize,pretty,minify,validate,JSON_LIMITS} from '../src/tools/engines/data/jsonTokens.ts';
let count=0;const check=(x:string)=>{const p=pretty(x,{indent:2});assert(p.ok);if(!p.ok)return;const m=minify(x),round=minify(p.value),twice=pretty(p.value,{indent:2});assert(m.ok&&round.ok&&twice.ok);if(m.ok&&round.ok&&twice.ok){assert.equal(round.value,m.value);assert.equal(twice.value,p.value);assert.deepEqual(JSON.parse(p.value),JSON.parse(x));}count++;};
for(const x of ['{}','[]','{"a":1.0,"a":1e5,"n":12345678901234567890}','["\\uD800","😀","\\r\\n"]','{"x":[],"y":{}}'])check(x);
let seed=123456789;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const atoms=['null','true','false','0','-12.5e+3','"emoji😀"','"line\\nnext"','"\\uD800"'];
for(let i=0;i<350;i++){const n=Math.floor(rnd()*8),a=Array.from({length:n},()=>atoms[Math.floor(rnd()*atoms.length)]);check(rnd()<0.5?'['+a.join(',')+']':'{'+a.map((v,j)=>JSON.stringify('key'+j)+':'+v).join(',')+'}');}
for(const [s,code] of [['','empty-input'],['[1,]','trailing-comma'],['{"a":1,}','trailing-comma'],['"abc','unterminated-string'],['"\\x"','bad-escape'],['01','bad-number'],['1e','bad-number'],['1 2','text-after-value'],['\ufeff{}','unexpected-character'],['/*hi*/{}','unexpected-character']]){const r=validate(s);assert(!r.ok);if(!r.ok)assert.equal(r.error,code);count++;}
assert(!validate('['.repeat(201)+'0'+']'.repeat(201)).ok);count++;
assert(!validate('"'+'x'.repeat(JSON_LIMITS.maxBytes)+'"').ok);count++;
assert(tokenize('{"a":1.0}').ok);count++;
// Exact-output checks: reference text is JSON.stringify(JSON.parse(x),null,n) from the platform JSON, independent of this engine (plain numbers only).
for(const x of ['{"x":[],"y":{}}','{"a":[1,{"b":2}]}','[[],{},[1,[2,[3]]]]','{"k":{"j":{"i":[true,null,"s"]}}}']){for(const n of [2,4] as const){const r=pretty(x,{indent:n});assert(r.ok);if(r.ok)assert.equal(r.value,JSON.stringify(JSON.parse(x),null,n));count++;}const t=pretty(x,{indent:'tab'});assert(t.ok);if(t.ok)assert.equal(t.value,JSON.stringify(JSON.parse(x),null,'\t'));count++;}
console.log(`jsonTokens: ${count} checks passed`);
