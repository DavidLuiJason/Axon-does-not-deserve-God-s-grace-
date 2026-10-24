import { readNumbers } from '../src/brain/mind/meaning/values/numbers';
import type { ScanContext } from '../src/brain/mind/meaning/values/types';
let checks = 0;
function test(s: string) {
 const ctx = {text:s,ranges:[{start:0,end:s.length}],clock:{year:2026,month:10,day:24,hour:10,minute:30},units:{}} as ScanContext;
 const values=readNumbers(ctx,[]);
 for(let i=0;i<values.length;i++) { const v=values[i]; if(v.text!==s.slice(v.start,v.end) || (i>0 && values[i-1].end>v.start)) throw Error('invariant '+s); checks++; }
 return values;
}
for(let n=1;n<=1000;n++) {
 const d=n%100; const suffix=d>=11&&d<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
 const good=test(n+suffix); if(good.length!==1||good[0].value!==n||good[0].error) throw Error('ordinal '+n); checks++;
 for(const wrong of ['st','nd','rd','th']) {if(wrong===suffix)continue;const v=test(n+wrong);if(v.length!==1||v[0].error!=='bad-ordinal'||v[0].value!==undefined)throw Error('bad ordinal '+n+wrong);checks++;}
}
for(const s of ['5-3','-5','1,00','1,0000','1,000,',',5','tennis','often','someone','stone','bone','none','tone','phone','one hundred and twenty','two and a half']) test(s);
let seed=83921;
const alphabet='0123456789-,. twenty five hundred one';
for(let i=0;i<2000;i++){let s='';for(let j=0;j<30;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;s+=alphabet[seed%alphabet.length];}test(s);}
console.log('valuesNumbers.test.ts: '+checks+' checks passed');
