import { strict as a } from 'node:assert';
import { convertTextFormat, TEXT_FORMATS, TEXT_FORMAT_LIMITS } from '../src/tools/engines/text/textFormats';
let checks=0;const ok=(v:boolean)=>{a.equal(v,true);checks++};
ok(TEXT_FORMATS.length===3);ok(TEXT_FORMAT_LIMITS.maxInputBytes===1048576);
const pairs:any[]=[['txt','html','<p>&lt;x&gt;</p>','<x>'],['txt','md','\\*x\\*','*x*'],['md','html','<h1>x</h1>','# x'],['md','txt','x','**x**'],['html','txt','x','<p>x</p>'],['html','md','x','<p>x</p>']];
for(const [from,to,out,input] of pairs){const r=convertTextFormat({from,to,input});ok(r.ok);if(r.ok){a.equal(r.output,out);checks++;}}
const same=convertTextFormat({from:'html',to:'html',input:'<script>x</script>'});ok(same.ok);if(same.ok)a.equal(same.output,'<script>x</script>');
ok(convertTextFormat({from:'md',to:'html',input:'x'.repeat(1048577)}).ok===false);
ok(convertTextFormat({from:'xml' as any,to:'txt',input:'x'}).ok===false);
const r=convertTextFormat({from:'html',to:'txt',input:'<script>secret</script><p>visible</p>'});ok(r.ok);if(r.ok){a.equal(r.output,'visible');ok(r.changes.length>0);}
console.log(`textFormats.test.ts PASS ${checks} checks; exact expectations independently specified.`);
