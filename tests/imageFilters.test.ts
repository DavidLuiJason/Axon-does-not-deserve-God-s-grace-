import { applyFilter, FILTERS, isKnownFilterId } from '../src/tools/imageEdit/filters';
let n=0;
function check(ok:boolean,label:string){n++;if(!ok)throw Error(`FAIL ${label}`);}
const same=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const input=new Uint8ClampedArray([20,80,210,0,128,128,128,73,255,30,5,255]);
const copy=new Uint8ClampedArray(input);
check(FILTERS.map(f=>f.id).join(',')==='mono,sepia,vivid,fade,cool,warm,noir','catalog order');
for(const f of FILTERS){
 const zero=applyFilter(input,f.id,0),full=applyFilter(input,f.id,100),half=applyFilter(input,f.id,50);
 check(same(zero,input) && zero!==input,`${f.id} zero copy`);
 check(full.length===input.length && half.length===input.length,`${f.id} length`);
 for(let i=3;i<input.length;i+=4) check(full[i]===input[i] && half[i]===input[i],`${f.id} alpha ${i}`);
 check(same(full,applyFilter(input,f.id,100)),`${f.id} deterministic`);
 check(same(zero,applyFilter(input,f.id,NaN)),`${f.id} NaN`);
 check(same(full,applyFilter(input,f.id,999)),`${f.id} clamp high`);
 check(same(zero,applyFilter(input,f.id,-999)),`${f.id} clamp low`);
 if(f.id==='mono'||f.id==='noir')for(let i=0;i<input.length;i+=4)check(full[i]===full[i+1]&&full[i+1]===full[i+2],`${f.id} grayscale ${i}`);
 if(f.id==='mono')for(let i=0;i<input.length;i+=4)for(let j=0;j<3;j++)check(half[i+j]>=Math.min(input[i+j],full[i+j])&&half[i+j]<=Math.max(input[i+j],full[i+j]),'mono midpoint');
 if(f.id==='sepia')check(full[4]>=full[5]&&full[5]>=full[6],'sepia grey');
}
check(isKnownFilterId('mono')&&!isKnownFilterId('unknown'),'pipeline id guard helper');
check(same(input,copy),'input immutable');
check(applyFilter(new Uint8ClampedArray(),'mono',100).length===0,'empty');
console.log(`=== all imageFilters tests passed (${n} checks) ===`);
