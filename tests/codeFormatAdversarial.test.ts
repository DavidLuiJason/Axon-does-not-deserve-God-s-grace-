// Director's independent checks for the code formatter (C08): CSS minify must keep meaningful spaces, HTML pre/textarea/script/style exact,
// JSON compared with the platform's JSON (400 random documents x 3 indents), 300 random CSS documents (idempotence and minify(pretty)=minify), typed errors with line numbers.
import { strict as assert } from 'node:assert';
import { formatCode } from '../src/tools/engines/code/codeFormat';
const f = (language: any, mode: any, input: string, indent: any = 2) => formatCode({ language, mode, indent, input } as any) as any;
const out: string[] = []; let bad = 0;
const expect = (name: string, cond: boolean, detail?: any) => { if (!cond) { bad++; out.push('FAIL ' + name + (detail !== undefined ? ' => ' + JSON.stringify(detail) : '')); } };
// ---- CSS minify semantics
const cm = (s: string) => f('css', 'minify', s);
expect('calc spaces kept', /calc\(1px \+ 2px\)/.test(cm('a{width:calc(1px + 2px)}').output), cm('a{width:calc(1px + 2px)}'));
expect('calc minus spaces kept', /calc\(100% - 10px\)/.test(cm('a{width:calc(100% - 10px)}').output), cm('a{width:calc(100% - 10px)}'));
expect('descendant selector kept', /a b\{/.test(cm('a   b { margin : 1px  -2px }').output) && /1px -2px/.test(cm('a   b { margin : 1px  -2px }').output), cm('a   b { margin : 1px  -2px }'));
expect('media and ( kept', /and \(/.test(cm('@media (min-width:1px) and (max-width:2px){a{b:c}}').output), cm('@media (min-width:1px) and (max-width:2px){a{b:c}}'));
expect('string with spaces and braces kept', cm('a::after{content:"a  b; } {"}').output.includes('"a  b; } {"'), cm('a::after{content:"a  b; } {"}'));
expect('escaped quote string', cm('a{content:"\\"  x"}').output.includes('"\\"  x"'), cm('a{content:"\\"  x"}'));
expect('url data kept', cm('a{background:url(data:image/png;base64,AA==)}').output.includes('url(data:image/png;base64,AA==)'), cm('a{background:url(data:image/png;base64,AA==)}'));
expect('url with quotes spaces', cm("a{background:url( 'a b.png' )}").ok);
expect('important', /!important/.test(cm('a{color:red !important}').output));
expect('comment removed in minify', !cm('/* hi */a{b:c}').output.includes('hi'));
expect('comment in string kept', cm('a{content:"/* x */"}').output.includes('/* x */'));
expect(':not(a, b)', /:not\(\.a,\s?\.b\)/.test(cm('a:not(.a , .b){x:y}').output), cm('a:not(.a , .b){x:y}'));
expect('custom property braces', cm('a{--x:{a:b};c:d}').ok, cm('a{--x:{a:b};c:d}'));
expect('pretty idempotent css', (() => { const s = '@media (min-width:1px){a,b>c{margin:0 auto;color:#FFF}}@font-face{font-family:"X Y";src:url(a.woff)}'; const p = f('css', 'pretty', s).output; return f('css', 'pretty', p).output === p; })());
expect('minify(pretty)=minify', (() => { const s = '@media (min-width:1px){a,b>c{margin:0 auto;color:#FFF}} /*c*/ a:hover::before{content:"a;b"}'; return cm(f('css', 'pretty', s).output).output === cm(s).output; })());
expect('unbalanced css error', f('css', 'pretty', 'a{b:c').ok === false && f('css', 'pretty', 'a{b:c').line >= 1, f('css', 'pretty', 'a{b:c'));
expect('extra close error', f('css', 'pretty', 'a{b:c}}').ok === false, f('css', 'pretty', 'a{b:c}}'));
expect('unterminated string error', f('css', 'pretty', 'a{b:"c}').ok === false, f('css', 'pretty', 'a{b:"c}'));
expect('unterminated comment error', f('css', 'pretty', 'a{b:c} /* x').ok === false, f('css', 'pretty', 'a{b:c} /* x'));
// ---- HTML
const hp = (s: string) => f('html', 'pretty', s); const hm = (s: string) => f('html', 'minify', s);
const pre = '<div><pre>  line1\n    line2   </pre><p>hi</p></div>';
expect('pre kept pretty', hp(pre).ok && hp(pre).output.includes('<pre>  line1\n    line2   </pre>'), hp(pre));
expect('pre kept minify', hm(pre).ok && hm(pre).output.includes('<pre>  line1\n    line2   </pre>'), hm(pre));
const ta = '<form><textarea>  a\n b </textarea></form>'; expect('textarea kept', hp(ta).output.includes('<textarea>  a\n b </textarea>') && hm(ta).output.includes('<textarea>  a\n b </textarea>'), [hp(ta), hm(ta)]);
const sc = '<div><script>if (a<b && "</div>") { x() }</script><style>a  {  b : c }</style></div>'; expect('script/style exact', hp(sc).output.includes('<script>if (a<b && "</div>") { x() }</script>') && hp(sc).output.includes('<style>a  {  b : c }</style>'), hp(sc));
expect('script minify exact', hm(sc).output.includes('if (a<b && "</div>") { x() }'), hm(sc));
expect('attr with > kept', hp('<a href="x>y" title=\'a>b\'>t</a>').output.includes('href="x>y"') , hp('<a href="x>y" title=\'a>b\'>t</a>'));
expect('uppercase tag names kept', hp('<DIV><P>x</P></DIV>').output.includes('<DIV>') , hp('<DIV><P>x</P></DIV>'));
expect('void elements', hp('<div><br><img src="a.png"><input type=text><hr></div>').ok, hp('<div><br><img src="a.png"><input type=text><hr></div>'));
expect('comment kept', hp('<div><!-- a > b --><p>x</p></div>').output.includes('<!-- a > b -->'), hp('<div><!-- a > b --><p>x</p></div>'));
expect('inline stays inline', /<p>Hello <b>big<\/b> world<\/p>/.test(hp('<p>Hello <b>big</b> world</p>').output), hp('<p>Hello <b>big</b> world</p>'));
expect('inline space preserved minify', /Hello <b>big<\/b> world/.test(hm('<p>Hello  <b>big</b>   world</p>').output) || /Hello <b>big<\/b> world/.test(hm('<p>Hello <b>big</b> world</p>').output), hm('<p>Hello  <b>big</b>   world</p>'));
expect('doctype', hp('<!DOCTYPE html><html><head><title>t</title></head><body><p>x</p></body></html>').ok, hp('<!DOCTYPE html><html><head><title>t</title></head><body><p>x</p></body></html>'));
expect('idempotent html', (() => { const s = '<!DOCTYPE html><html><head><title>T</title><style>a{b:c}</style></head><body><div class="a"><p>Hello <b>x</b></p><ul><li>1</li><li>2</li></ul><pre>  a</pre></div></body></html>'; const p = hp(s).output; return hp(p).output === p; })(), hp('<div><p>a</p></div>'));
expect('minify(pretty)=minify html', (() => { const s = '<div class="a"><p>Hello <b>x</b></p><ul><li>1</li><li>2</li></ul><pre>  a</pre></div>'; return hm(hp(s).output).output === hm(s).output; })(), [hm(hp('<div class="a"><p>Hello <b>x</b></p><ul><li>1</li><li>2</li></ul></div>').output), hm('<div class="a"><p>Hello <b>x</b></p><ul><li>1</li><li>2</li></ul></div>')]);
expect('unclosed html error or ok typed', typeof hp('<div><p>x</div>').ok === 'boolean');
expect('unterminated comment html', hp('<div><!-- x').ok === false, hp('<div><!-- x'));
// ---- XML
const xp = (s: string) => f('xml', 'pretty', s); const xm = (s: string) => f('xml', 'minify', s);
expect('cdata kept', xp('<a><![CDATA[ x < y ]]></a>').output.includes('<![CDATA[ x < y ]]>'), xp('<a><![CDATA[ x < y ]]></a>'));
expect('mixed content text exact', xp('<p>Hello <b>big</b> world</p>').output.replace(/\s+/g, ' ').includes('Hello') && xm(xp('<p>Hello <b>big</b> world</p>').output).output === xm('<p>Hello <b>big</b> world</p>').output, [xp('<p>Hello <b>big</b> world</p>'), xm('<p>Hello <b>big</b> world</p>')]);
expect('declaration', xp('<?xml version="1.0"?><a><b/></a>').output.startsWith('<?xml version="1.0"?>'), xp('<?xml version="1.0"?><a><b/></a>'));
expect('xml mismatch error', xp('<a><b></a>').ok === false && xp('<a><b></a>').line >= 1, xp('<a><b></a>'));
expect('xml idempotent', (() => { const s = '<?xml version="1.0"?><r a="1"><!--c--><x>t</x><y/><z><![CDATA[q]]></z></r>'; const p = xp(s).output; return xp(p).output === p; })());
expect('xml attr gt', xp('<a b="x>y"/>').ok, xp('<a b="x>y"/>'));
// ---- JSON vs platform JSON
let seed = 4242; const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const gen = (d: number): any => { const r = rand(); if (d > 3 || r < 0.3) return [0, 1, -2.5, 1e21, 'a"b\\c\n\u00e9\ud83d\ude00', true, false, null, ''][Math.floor(rand() * 9)]; if (r < 0.65) return Array.from({ length: Math.floor(rand() * 4) }, () => gen(d + 1)); const o: any = {}; for (let i = 0; i < Math.floor(rand() * 4); i++) o['k' + Math.floor(rand() * 9) + (rand() < .2 ? ' x' : '')] = gen(d + 1); return o; };
let jbad = 0; for (let i = 0; i < 400; i++) { const v = gen(0); const s = JSON.stringify(v, null, rand() < .5 ? 1 : 0); for (const ind of [2, 4, 'tab'] as any[]) { const p = f('json', 'pretty', s, ind); const m = f('json', 'minify', s); if (!p.ok || !m.ok || JSON.stringify(JSON.parse(p.output)) !== JSON.stringify(v) || m.output !== JSON.stringify(v) || f('json', 'pretty', p.output, ind).output !== p.output) jbad++; } }
expect('json 400 random x3', jbad === 0, jbad);
expect('json number text exact', f('json', 'pretty', '{"a":1.0,"b":12345678901234567890,"c":1E5,"a":2}').output.includes('1.0') && f('json', 'pretty', '{"a":1.0,"b":12345678901234567890,"c":1E5,"a":2}').output.includes('12345678901234567890') && f('json', 'pretty', '{"a":1.0,"a":2}').output.split('"a"').length === 3);
expect('json error pos', (() => { const r = f('json', 'pretty', '{\n "a": 1,\n}'); return r.ok === false && r.line === 3; })(), f('json', 'pretty', '{\n "a": 1,\n}'));
expect('js unsupported', f('javascript', 'pretty', 'x').error === 'unsupported-language' && f('typescript', 'pretty', 'x').error === 'unsupported-language', [f('javascript', 'pretty', 'x')]);
expect('empty input typed', f('json', 'pretty', '').ok === false && f('css', 'pretty', '').ok !== undefined, [f('json', 'pretty', ''), f('css', 'pretty', '')]);
expect('too big typed', f('css', 'pretty', 'a{}'.repeat(800000)).ok === false);
expect('never throws on junk', (() => { try { for (const l of ['json', 'css', 'html', 'xml']) for (const s of ['\u0000', '<<<>>>', '{{{{', '}}}}', '"', "'", '/*', '<!--', '<![CDATA[', '\ud800', '😀😀', '<'.repeat(5000), '{'.repeat(5000), '['.repeat(5000)]) { f(l, 'pretty', s); f(l, 'minify', s); } return true; } catch (e) { return false; } })());
// random css idempotence/minify property, random html
const sels = ['a', 'a b', 'a>b', '.x:hover', 'a,b', 'p::before', '#i', '[t="a b"]']; const decls = ['color:red', 'margin:0 auto', 'width:calc(1px + 2px)', 'content:"a;b {"', 'background:url(a.png)', 'font:12px/1.5 "A B",serif', 'color:#FFF!important', '--v: 1 2'];
let cbad = 0, cex: any; for (let i = 0; i < 300; i++) { const rules = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => sels[Math.floor(rand() * sels.length)] + '{' + Array.from({ length: 1 + Math.floor(rand() * 3) }, () => decls[Math.floor(rand() * decls.length)]).join(';') + '}').join(rand() < .5 ? '' : '\n'); const s = rand() < .3 ? '@media (min-width:1px) and (max-width:9px){' + rules + '}' : rules; const p = f('css', 'pretty', s), pp = p.ok && f('css', 'pretty', p.output), m1 = f('css', 'minify', s), m2 = p.ok && f('css', 'minify', p.output); if (!p.ok || !pp.ok || pp.output !== p.output || !m1.ok || !m2.ok || m1.output !== m2.output) { cbad++; cex = cex || [s, p, m1, m2]; } }
expect('css 300 random props', cbad === 0, [cbad, cex]);
assert.equal(bad, 0, out.join('\n'));
console.log('codeFormat (Director adversarial): all checks passed');
