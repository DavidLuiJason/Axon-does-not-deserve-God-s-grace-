import { parseYaml, stringifyYaml, YAML_LIMITS, type PlainValue } from '../src/tools/engines/data/yaml.ts';
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function equal(a: unknown,b: unknown): boolean { return JSON.stringify(a)===JSON.stringify(b); }
function seeded(seed:number):()=>number { let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/0x100000000;}; }
const rand=seeded(0xC03A71);const strings=['plain','yes','no','on','off','null','~','true','false','001','-3','1.5','a: b','hash # mark','hello &world','*literal','!literal',' leading','trailing ','','🙂','עברית','中文','line\nbreak','quote " and \\'];
function value(depth=0):PlainValue { const r=rand();if(depth>3||r<.42){const k=Math.floor(rand()*5);if(k===0)return null;if(k===1)return rand()<.5;if(k===2)return Math.floor(rand()*2001)-1000;if(k===3)return Math.round((rand()*2000-1000)*100)/100;return strings[Math.floor(rand()*strings.length)];}if(r<.68){const a:PlainValue[]=[];for(let n=Math.floor(rand()*5);n>0;n--)a.push(value(depth+1));return a;}const o:Record<string,PlainValue>={};for(let n=Math.floor(rand()*5);n>0;n--){const k=['name','count','yes','colon:key','emoji🙂',' leading','plain'][Math.floor(rand()*7)]+(n>1?String(n):'');o[k]=value(depth+1);}return o;}
let roundTrips=0;for(let i=0;i<350;i++){const v=value();const written=stringifyYaml(v,{indent:i%2?2:4});assert(written.ok,`writer failed seeded value ${i}: ${written.ok?'':written.message}`);const parsed=parseYaml(written.value);assert(parsed.ok,`parser failed seeded value ${i} ${JSON.stringify(v)} YAML=${written.value}: ${parsed.ok?'':parsed.message}`);assert(equal(parsed.value,v),`round-trip mismatch ${i}: ${JSON.stringify(v)} -> ${written.value} -> ${JSON.stringify(parsed.value)}`);roundTrips++;}
const docs:[string,PlainValue][]=[['name: Ada\nage: 37\nactive: true\n', {name:'Ada',age:37,active:true}],['items:\n  - one\n  - two\n', {items:['one','two']}],['people:\n  - name: Ada\n    age: 37\n  - name: Lin\n    age: 41\n',{people:[{name:'Ada',age:37},{name:'Lin',age:41}]}],['flow: [1, true, null, "x"]\nmap: {a: 1, b: false}\n',{flow:[1,true,null,'x'],map:{a:1,b:false}}],['literal: |\n  first\n  second\nfolded: >-\n  one\n  two\n',{literal:'first\nsecond\n',folded:'one two'}],[`---\nmessage: "hello\\nworld"\nquote: "it's fine"\n`,{message:'hello\nworld',quote:"it's fine"}],['unicode: "🙂 עברית 中文"\r\n',{unicode:'🙂 עברית 中文'}],['literal: "hello &world *literal !literal"\n',{literal:'hello &world *literal !literal'}],['keep: |+\n  retained\n',{keep:'retained\n'}]];
for(const [doc,expected] of docs){const got=parseYaml(doc);assert(got.ok,`hand YAML failed: ${got.ok?'':got.message}`);assert(equal(got.value,expected),`hand YAML mismatch: ${doc}`);}
// Expected block-scalar values below were independently obtained with Python PyYAML 6.0.3 yaml.safe_load.
const blockScalarCases:[string,string,PlainValue][]=[
 ['literal blank lines','t: |\n  a\n\n  c\n',{t:'a\n\nc\n'}],
 ['folded blank lines','t: >\n  a\n  b\n\n  c\n',{t:'a b\nc\n'}],
 ['two blank lines in folded scalar','t: >\n  a\n  b\n\n\n  c\n',{t:'a b\n\nc\n'}],
 ['hash inside a line','t: |\n  echo hi # x\n  b\n',{t:'echo hi # x\nb\n'}],
 ['hash-only content line','t: |\n  a\n  # keep\n  b\n',{t:'a\n# keep\nb\n'}],
 ['keep trailing blank lines','t: |+\n  a\n\n\n',{t:'a\n\n\n'}],
 ['strip trailing blank lines','t: |-\n  a\n\n',{t:'a'}],
 ['folded strip with blank line','t: >-\n  a\n  b\n\n  c\n',{t:'a b\nc'}],
 ['block scalar before another key','t: |\n  a\nnext: 2\n',{t:'a\n',next:2}],
 ['block scalar in sequence','items:\n  - |\n    a\n\n    # keep\n    b\n  - end\n',{items:['a\n\n# keep\nb\n','end']}],
 ['block scalar in sequence mapping','items:\n  - command: |\n      echo hi # x\n      b\n  - end: 1\n',{items:[{command:'echo hi # x\nb\n'},{end:1}]}],
 ['comments outside and inside scalar','# before\nt: |\n  # inside\n  x\n# after\nnext: 2\n',{t:'# inside\nx\n',next:2}],
 ['less-indented comment ends scalar','t: |\n  a\n  b\n# outside comment\nnext: 2\n',{t:'a\nb\n',next:2}],
 ['block scalar at EOF without final newline','t: |\n  a',{t:'a'}],
];
for(const [name,doc,expected] of blockScalarCases){const got=parseYaml(doc);assert(got.ok,`${name}: parser failed: ${got.ok?'':got.message}`);assert(equal(got.value,expected),`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got.value)}`);}
const emptyInput=parseYaml('');assert(emptyInput.ok&&emptyInput.value===null,'empty input must parse as null');
assert(!parseYaml(null).ok,'non-string input accepted');
const boundaries=parseYaml('zero: 0\nnegative: -1\nemoji: "🙂"\nrtl: "עברית"\nodd: "x # y\\\\z"\n');
assert(boundaries.ok&&equal(boundaries.value,{zero:0,negative:-1,emoji:'🙂',rtl:'עברית',odd:'x # y\\z'}),'zero, negative, emoji, RTL or odd characters changed');
const compactNested=parseYaml('items:\n  - - 7\n');
assert(!compactNested.ok&&compactNested.message.includes('Compact nested sequences are unsupported'),'compact nested sequence should remain unsupported with an honest message');
for(const hostile of ['a: &x 1\nb: *x','a: &a [*a, *a]\nb: &b [*a, *a]','a: !tag x','---\na: 1\n---\nb: 2','a:\n\tbad: 1','<<: {a: 1}','a: [1, 2','a: 1\na: 2','x: .nan','a: '+ '['.repeat(120)+'0'+']'.repeat(120)]){const r=parseYaml(hostile);assert(!r.ok,`hostile YAML accepted: ${hostile}`);}
assert(!parseYaml('x'.repeat(YAML_LIMITS.maxInputCharacters+1)).ok,'oversize input accepted');assert(!stringifyYaml({n:NaN}).ok,'NaN accepted');assert(!parseYaml('a: 1\n  b: 2').ok,'bad indentation accepted');assert(parseYaml('text: \"🙂 עברית 中文\"\r\n').ok,'CRLF or odd Unicode rejected');assert(parseYaml('long: '+ 'x'.repeat(200_000)).ok,'valid long line rejected');
console.log(`yaml.test.ts PASS: ${roundTrips} seeded round trips, ${docs.length} hand documents, ${blockScalarCases.length} PyYAML-derived block-scalar cases, 10 hostile cases, 9 boundary/edge checks`);
