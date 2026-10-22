import { formatCode, CODE_FORMAT_LIMITS, CODE_FORMAT_DESCRIPTOR } from '../src/tools/engines/code/codeFormat';
import { parseXml } from '../src/tools/engines/data/xml';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}\nExpected: ${String(expected)}\nActual:   ${String(actual)}`);
}
function ok(language: string, mode: 'pretty'|'minify', input: string): string {
  const r = formatCode({language,mode,indent:2,input});
  assert(r.ok, `${language}/${mode} failed: ${r.ok ? '' : r.message}`);
  return r.output;
}
function bad(language: string, input: string, error?: string): void {
  const r = formatCode({language,mode:'pretty',indent:2,input});
  assert(!r.ok, `${language} should reject invalid input: ${input}`);
  assert(r.line >= 1 && r.column >= 1, 'errors carry 1-based location');
  if (error) equal(r.error,error,`wrong error for ${input}`);
}
equal(CODE_FORMAT_DESCRIPTOR.toolId,'code-formatter','descriptor catalog id');
equal(CODE_FORMAT_LIMITS.maxBytes,2097152,'2 MiB limit');
equal(ok('json','pretty','{"a":1.0,"a":2,"b":[true,null]}'),'{\n  "a": 1.0,\n  "a": 2,\n  "b": [\n    true,\n    null\n  ]\n}','JSON exact literals and duplicate keys');
equal(ok('json','minify',' { "x" : 1e+03, "s":"😀" } '),'{"x":1e+03,"s":"😀"}','JSON minify exact number and unicode');
bad('json','{"x":}');
bad('json','{"x":"unterminated}');
bad('typescript','const x=1','unsupported-language');
bad('javascript','alert(1)','unsupported-language');
bad('css','a{color:red','unbalanced-syntax');
bad('css','a{content:"bad}','unterminated-string');
bad('css','a{/* bad','unterminated-comment');
bad('css','{'.repeat(201)+'x'+ '}'.repeat(201),'too-deep');
bad('html','<div><span>x</div>','invalid-markup');
bad('xml','<a><b/></a><x>','invalid-markup');
bad('xml','<a/><b/>','invalid-markup');
bad('xml','outside<a/>','invalid-markup');
bad('xml','<root><![CDATA[no end</root>','invalid-markup');
equal(ok('css','minify','a,  b { color : red ; margin: 1px -2px !important; }'),'a,b{color:red;margin:1px -2px!important;}','CSS safe minification');
equal(ok('css','minify','@media screen and (max-width: 2px) { a b { --x: url("a b"); } }'),'@media screen and (max-width:2px){a b{--x:url("a b");}}','CSS selector and url preservation');
equal(ok('css','minify','a{width:calc(100% - 2px);height:calc(1px + 2px)}'),'a{width:calc(100% - 2px);height:calc(1px + 2px)}','CSS calc operator spaces preserved');
assert(ok('css','pretty','@media screen and (min-width: 4px){a{color:red}}').includes('@media screen and (min-width: 4px) {'), 'nested @media pretty output');
assert(ok('css','pretty','/* keep */ a{color:red}').includes('/* keep */'), 'CSS comments retained in pretty mode');
equal(ok('html','pretty','<DiV DATA-X="A&amp;B"><IMG src="x" alt="y"><span>x</span></DiV>'),'<DiV DATA-X="A&amp;B"><IMG src="x" alt="y"><span>x</span>\n</DiV>','HTML tag case and attributes preserved');
equal(ok('html','pretty','<script>if (a < b) { x = "<x>"; }</script>'),'<script>if (a < b) { x = "<x>"; }</script>','script content is exact');
equal(ok('html','pretty','<style>.x { color: red; }</style>'),'<style>.x { color: red; }</style>','style content is exact');
equal(ok('xml','pretty','<?xml version="1.0"?><root><![CDATA[a < b]]><!--keep--><x>y</x></root>'), '<?xml version="1.0"?>\n<root>\n  <![CDATA[a < b]]>\n  <!--keep-->\n  <x>y</x>\n</root>', 'XML declaration, CDATA and comments retained');
const html = '<!doctype html><div class="x"><span>Hello</span><br><p>World</p></div>';
const htmlPretty = ok('html','pretty',html);
assert(htmlPretty.includes('\n  <span>') || htmlPretty.includes('<span>'), 'HTML pretty handles inline content');
equal(ok('html','pretty',htmlPretty),htmlPretty,'HTML pretty idempotence');
equal(ok('html','pretty','<pre>  a\n b </pre>'),'<pre>  a\n b </pre>','pre content is exact');
equal(ok('html','pretty','<textarea> a  b </textarea>'),'<textarea> a  b </textarea>','textarea content is exact');
equal(ok('xml','pretty','<root><item id="1">x</item><item>y</item></root>'),'<root>\n  <item id="1">x</item>\n  <item>y</item>\n</root>','XML element-only formatting');
equal(ok('xml','pretty','<p>Keep <b>all</b> spaces</p>'),'<p>Keep <b>all</b> spaces</p>','XML mixed content preserved');
equal(ok('xml','minify','<root>\n  <a />\n  <b />\n</root>'),'<root><a /><b /></root>','XML structural whitespace removed');

const seeded = (seed:number) => () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed; };
const pick = (r:()=>number,n:number) => r()%n;
const rand=seeded(0xC08A11);
let checks=0;
for(let i=0;i<300;i++){
  const n=pick(rand,20), json = JSON.stringify({n,values:[pick(rand,100),true,null,'x😀א'],nested:{ok:i%2===0}}).replace('"n":','"n":');
  const pretty=ok('json','pretty',json), min=ok('json','minify',json);
  equal(ok('json','pretty',pretty),pretty,`JSON idempotence ${i}`);
  equal(ok('json','minify',pretty),min,`JSON minify property ${i}`);
  equal(JSON.stringify(JSON.parse(pretty)),JSON.stringify(JSON.parse(json)),`independent JSON parse equality ${i}`); checks+=3;
}
for(let i=0;i<300;i++){
  const r=pick(rand,100), css=`.c${i}, .d${r} { color: rgb(${r}, ${r%255}, 0); margin: ${r}px -2px; --emoji: "😀 ${i}"; }`;
  const pretty=ok('css','pretty',css), min=ok('css','minify',css);
  equal(ok('css','pretty',pretty),pretty,`CSS idempotence ${i}`);
  equal(ok('css','minify',pretty),min,`CSS minify property ${i}`); checks+=2;
}
for(let i=0;i<300;i++){
  const html=`<div id="n${i}"><span>word ${i} 😀</span><br><p>item ${pick(rand,50)}</p></div>`;
  const pretty=ok('html','pretty',html), min=ok('html','minify',html);
  equal(ok('html','pretty',pretty),pretty,`HTML idempotence ${i}`);
  equal(ok('html','minify',pretty),min,`HTML minify property ${i}`); checks+=2;
}
for(let i=0;i<300;i++){
  const xml=`<root>before ${i} <item id="${i}">value ${pick(rand,100)} 😀</item> after</root>`;
  const pretty=ok('xml','pretty',xml), min=ok('xml','minify',xml);
  equal(ok('xml','pretty',pretty),pretty,`XML idempotence ${i}`);
  equal(ok('xml','minify',pretty),min,`XML minify property ${i}`);
  const before=parseXml(xml), after=parseXml(pretty);
  assert(before.ok && after.ok, `independent XML parse accepts sample ${i}`);
  equal(JSON.stringify(after.value),JSON.stringify(before.value),`independent XML parse equality ${i}`); checks+=3;
}
const huge='x'.repeat(CODE_FORMAT_LIMITS.maxBytes+1);
bad('css',huge,'too-large');
bad('html','<x>'.repeat(201)+'</x>'.repeat(201),'too-deep');
bad('xml','<x>'.repeat(201)+'</x>'.repeat(201),'too-deep');
const rtl='a{content:"שלום 👩🏽‍💻";}';
equal(ok('css','minify',rtl),'a{content:"שלום 👩🏽‍💻";}','CSS RTL and emoji');
const wrongIndent = formatCode({language:'json',mode:'pretty',indent:3 as 2,input:'{}'});
assert(!wrongIndent.ok && wrongIndent.error==='invalid-input','invalid indent rejected');
const wrongMode = formatCode({language:'json',mode:'compact' as 'pretty',indent:2,input:'{}'});
assert(!wrongMode.ok && wrongMode.error==='invalid-input','invalid mode rejected');
console.log(`C08 PASS: ${checks} seeded property checks plus hand-made, malformed, limit, Unicode and descriptor cases.`);
