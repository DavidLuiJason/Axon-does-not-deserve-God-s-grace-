import { strict as a } from 'node:assert';
import { htmlToText, htmlToMarkdown } from '../src/tools/engines/text/htmlText';
let checks=0;function eq(x:unknown,y:unknown){a.equal(x,y);checks++;}
const cases:[string,string][]=[['<p>Hello</p>','Hello'],['<h1>Title</h1><p>Body</p>','Title\n\nBody'],['a<br>b','a\nb'],['<script>alert(1)</script><p>ok</p>','ok'],['<style>x</style>yes','yes'],['<head>hidden</head><p>shown</p>','shown'],['<b>bold</b>','bold'],['A &amp; B','A & B'],['&#65; &#x1F600;','A 😀'],['<ul><li>a</li><li>b</li></ul>','• a\n• b'],['<img alt="cat" src="x">','cat'],['<table><tr><td>a</td><td>b</td></tr></table>','a | b'],['<blockquote>quote</blockquote>','quote'],['<pre>x &lt; y</pre>','x < y'],['<!--hidden-->ok','ok'],['<p>unclosed','unclosed'],['<p><b>x</p>','x'],['',''],['<hr>',''],['<h2>x</h2>','x'],['<div>a</div><div>b</div>','a\nb'],['<em>x</em>','x'],['<code>x</code>','x'],['<a href="https://x">x</a>','x'],['<input value="a">',''],['<br/>',''],['&nbsp;',''],['<script> <p>hidden</p> </script>ok','ok']];
for(const [s,w] of cases){const r=htmlToText(s);a.equal(r.ok,true,s);if(r.ok)eq(r.text,w);}
const md=htmlToMarkdown('<h1>Title</h1><p><strong>bold</strong></p>');a.equal(md.ok,true);if(md.ok)a.ok(md.text.includes('# Title'));
eq(htmlToText('<'.repeat(30)).ok,true);eq(htmlToText('x'.repeat(1_048_577)).ok,false);
eq(htmlToText('<div>'.repeat(51)+'x'+'</div>'.repeat(51)).ok,false);
for(const s of ['<a title="'+ 'x'.repeat(9000)+'">a</a>','<!--'.repeat(10),'<div><p>x','<script>bad <b> bad</script>safe']){a.equal(typeof htmlToText(s).ok,'boolean');checks++;}
// Director additions: unsafe link addresses are never converted to Markdown.
for(const [h,exp] of [['<a href="javascript:alert(1)">bad</a>','bad'],['<a href="jav&#x61;script:alert(1)">bad</a>','bad'],['<a href=" JaVa\nScRiPt:x">bad</a>','bad'],['<a href="data:text/html,x">bad</a>','bad'],['<a href="http://e.com">ok</a>','[ok](http://e.com)']] as [string,string][]){const r=htmlToMarkdown(h);a.equal(r.ok&&r.text,exp);checks++;}

console.log(`htmlText.test.ts PASS ${checks} checks; expected text independently derived from specified tokenizer rules.`);
