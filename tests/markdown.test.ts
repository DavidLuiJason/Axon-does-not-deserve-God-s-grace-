import { strict as a } from 'node:assert';
import { markdownToHtml, markdownToText } from '../src/tools/engines/text/markdown';
let checks=0; const eq=(x:unknown,y:unknown)=>{a.equal(x,y);checks++;};
const cases:[string,string][]=[
['# Hi','<h1>Hi</h1>'],['## Two','<h2>Two</h2>'],['A & B','<p>A &amp; B</p>'],['<script>alert(1)</script>','<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'],
['**bold**','<p><strong>bold</strong></p>'],['*ital*','<p><em>ital</em></p>'],['`x<y`','<p><code>x&lt;y</code></p>'],['> quote','<blockquote><p>quote</p></blockquote>'],
['- a\n- b','<ul><li>a</li><li>b</li></ul>'],['1. a\n2. b','<ol><li>a</li><li>b</li></ol>'],['---','<hr>'],['a\nb','<p>a<br>b</p>'],['[x](javascript:alert(1))','<p>x</p>'],
['![cat](https://x.test/c.png)','<p><a href="https://x.test/c.png">cat</a></p>'],['a\\*b','<p>a*b</p>'],['Title\n===','<h1>Title</h1>'],['```\na<b\n```','<pre><code>a&lt;b</code></pre>'],['    x<y','<pre><code>x&lt;y</code></pre>'],
['',''],['   ',''],['### x','<h3>x</h3>'],['#### x','<h4>x</h4>'],['##### x','<h5>x</h5>'],['###### x','<h6>x</h6>'],['__b__','<p><strong>b</strong></p>'],['_i_','<p><em>i</em></p>'],
['[x](data:text/html,x)','<p>x</p>'],['[x](vbscript:evil)','<p>x</p>'],['<b>x</b>','<p>&lt;b&gt;x&lt;/b&gt;</p>'],['- one','<ul><li>one</li></ul>'],['+ one','<ul><li>one</li></ul>'],['* one','<ul><li>one</li></ul>'],['2) two','<ol><li>two</li></ol>'],
['a  ','<p>a</p>'],['a\n\nb','<p>a</p>\n<p>b</p>'],['a & "b"','<p>a &amp; &quot;b&quot;</p>'],['[x](https://a.test)','<p><a href="https://a.test">x</a></p>']
];
cases.push(['plain','<p>plain</p>'],['two words','<p>two words</p>'],['a &amp; b','<p>a &amp;amp; b</p>'],['line\nbreak','<p>line<br>break</p>'],['**x** and **y**','<p><strong>x</strong> and <strong>y</strong></p>'],['*x* and *y*','<p><em>x</em> and <em>y</em></p>'],['[a](https://a.test)','<p><a href=\"https://a.test\">a</a></p>'],['![a](https://a.test/a.png)','<p><a href=\"https://a.test/a.png\">a</a></p>'],['> a\n> b','<blockquote><p>a</p><p>b</p></blockquote>'],['- x\n- y\n- z','<ul><li>x</li><li>y</li><li>z</li></ul>'],['3. c\n4. d','<ol><li>c</li><li>d</li></ol>'],['~~~\nx\n~~~','<pre><code>x</code></pre>'],['####### x','<p>####### x</p>'],['#','<p>#</p>'],['a\\b','<p>a\\b</p>'],['(x)','<p>(x)</p>'],['emoji 😀','<p>emoji 😀</p>'],['שלום','<p>שלום</p>'],['مرحبا','<p>مرحبا</p>'],['one\n\ntwo\n\nthree','<p>one</p>\n<p>two</p>\n<p>three</p>'],['- a\n- b\n','<ul><li>a</li><li>b</li></ul>'],['a\n','<p>a</p>'],['> **bold**','<blockquote><p><strong>bold</strong></p></blockquote>'],['[unsafe](JaVaScRiPt:evil)','<p>unsafe</p>'],['[unsafe](data:text/plain,x)','<p>unsafe</p>'],['[unsafe](vbscript:evil)','<p>unsafe</p>'],['`<script>`','<p><code>&lt;script&gt;</code></p>'],['<img src=x>','<p>&lt;img src=x&gt;</p>'],['---\n','<hr>'],['### heading ###','<h3>heading</h3>']);
for(const [s,w] of cases){const r=markdownToHtml(s);a.equal(r.ok,true,s);if(r.ok)eq(r.html,w);}
for(let i=0;i<40;i++){const s=`# Heading ${i}\n\n**bold ${i}** and _italic_`;const r=markdownToHtml(s);a.equal(r.ok,true);if(r.ok){a.ok(!/<script/i.test(r.html));checks++;}}
const bad=markdownToHtml('x'.repeat(1_048_577));eq(bad.ok,false);
const text=markdownToText('# Hi\n\n**there**');eq(text.ok,true);if(text.ok)eq(text.text,'Hi\n\nthere');
let seed=123456789;for(let i=0;i<300;i++){let s='';for(let j=0,n=(seed=(seed*1664525+1013904223)>>>0)%200;j<n;j++){seed=(seed*1664525+1013904223)>>>0;s+=String.fromCharCode(seed%65536);}const r=markdownToHtml(s);a.equal(typeof r.ok,'boolean');if(r.ok)a.ok(!/<script(?!&)/i.test(r.html));checks++;}
// Director additions: unmatched brackets once took 11 s at 100,000 characters (quadratic scan); now bounded.
{const t=Date.now();const r=markdownToHtml('['.repeat(100000));a.equal(r.ok,true);a.ok(Date.now()-t<2000);checks+=2;const t2=Date.now();const r2=markdownToHtml('!['.repeat(50000));a.equal(r2.ok,true);a.ok(Date.now()-t2<2000);checks+=2;const t3=Date.now();markdownToText('['.repeat(200000));a.ok(Date.now()-t3<2000);checks++;}
{const r=markdownToHtml('['+'a'.repeat(900)+'](http://e.com)');a.equal(r.ok&&r.html.includes('<a href="http://e.com">'),true);checks++;}

console.log(`markdown.test.ts PASS ${checks} checks; expected HTML hand-derived by direct rule application (no external Markdown oracle).`);
