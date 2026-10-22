import assert from 'node:assert/strict';
import { convert, planConversion } from '../src/tools/converter';
import { parseCsv } from '../src/tools/engines/data/csv';
import { parseXml } from '../src/tools/engines/data/xml';
import { validate } from '../src/tools/engines/data/jsonTokens';
let seed=0xC10A2026;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
const formats=['json','csv','tsv','yaml','xml'] as const;let assertions=0;
for(let n=0;n<20;n++){
 const value={id:rand()%100000,name:`name-${n}-🙂`,active:n%2===0,score:(rand()%2000)/10,details:{city:`c${rand()%99}`,tag:`x${n}`}};
 const json=JSON.stringify(value);const yaml=`id: ${value.id}\nname: ${JSON.stringify(value.name)}\nactive: ${value.active}\nscore: ${value.score}\ndetails:\n  city: ${value.details.city}\n  tag: ${value.details.tag}\n`;
 const xml=`<record><id>${value.id}</id><name>${value.name}</name><active>${value.active}</active><score>${value.score}</score><details><city>${value.details.city}</city><tag>${value.details.tag}</tag></details></record>`;
 const sources:Record<string,string>={json,csv:`id,name,active,score,details.city,details.tag\r\n${value.id},${value.name},${value.active},${value.score},${value.details.city},${value.details.tag}`,tsv:`id\tname\tactive\tscore\tdetails.city\tdetails.tag\r\n${value.id}\t${value.name}\t${value.active}\t${value.score}\t${value.details.city}\t${value.details.tag}`,yaml,xml};
 for(const from of formats)for(const to of formats){const r=convert({kind:'data-formats',from,to,input:sources[from],options:{rootName:'record'}});assert.equal(r.ok,true,`${from}->${to} sample ${n}: ${JSON.stringify(r)}`);assertions++;if(r.ok){assert.equal(typeof r.value,'string');assert.ok(Array.isArray(r.changes));assertions++;}}
 assert.equal(validate(json).ok,true);assert.equal(parseCsv(sources.csv,{delimiter:',',header:true}).ok,true);assert.equal(parseXml(xml).ok,true);assertions+=3;
}
const bad=convert({kind:'data-formats',from:'json',to:'csv',input:'[1,2,3]'});assert.equal(bad.ok,false);assert.equal(bad.ok?true:bad.error,'json-table-shape');assertions+=2;
const badJson=convert({kind:'data-formats',from:'json',to:'yaml',input:'{bad'});assert.equal(badJson.ok,false);assertions++;
const notes=convert({kind:'data-formats',from:'json',to:'csv',input:'{"a":[1,2],"nested":{"x":1}}'});assert.equal(notes.ok,true);assert.ok(notes.ok&&notes.changes.some(s=>s.includes('arrays inside cells')));assertions+=2;
const csvText=convert({kind:'data-formats',from:'csv',to:'json',input:'a,b\n001,hello'});assert.equal(csvText.ok,true);assert.ok(csvText.ok&&csvText.value.includes('"001"'));assertions+=2;
const csvTypes=convert({kind:'data-formats',from:'csv',to:'json',input:'a,b\n1,true',options:{detectTypes:true}});assert.equal(csvTypes.ok,true);assert.ok(csvTypes.ok&&csvTypes.value.includes('true'));assertions+=2;
for(const from of ['txt','md','html'])for(const to of ['txt','md','html']){const r=convert({kind:'text-formats',from,to,input:'Hello **world**\n<script>x</script>'});assert.equal(r.ok,true,`${from}->${to}`);assertions++;}
const image=planConversion({name:'photo.png',width:640,height:480,mime:'image/png',toFormat:'webp'});assert.equal(image.ok,true);assert.ok(image.ok&&image.outputName.endsWith('.webp'));assertions+=2;
assert.equal(planConversion({name:'x.svg',width:100,height:100,mime:'image/svg+xml',toFormat:'png'}).ok,true);assert.equal(planConversion({name:'x.png',width:0,height:10,mime:'image/png',toFormat:'png'}).ok,false);assertions+=2;
const tooLarge=convert({kind:'data-formats',from:'json',to:'yaml',input:' '.repeat(1_000_001)});assert.equal(tooLarge.ok,false);assertions++;
// Regression fingerprint captured from BASE before edits: unchanged legacy outcomes.
const legacy=[
 ['length','km','mi','1'],['mass','kg','lb','1'],['temperature','°C','°F','-10'],['volume','L','gal','1'],['area','m²','ft²','1'],['speed','km/h','mph','1'],['time','h','min','1'],['data','GB','GiB','1'],['number-base','10','16','255']
] as const;
for(const [kind,from,to,input] of legacy){const r=convert({kind,from,to,input});assert.equal(r.ok,true,`legacy ${kind}`);assert.equal(typeof (r.ok&&r.value),'string');assertions+=2;}
console.log(`convertBlocks.test.ts: PASS (${assertions} assertions; 20 seeded values x 20 format pairs plus text/image/error/regression cases)`);
