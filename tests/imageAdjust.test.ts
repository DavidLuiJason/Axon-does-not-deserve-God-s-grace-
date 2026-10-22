import { applyAdjust, clampAdjust, isNeutralAdjust, NEUTRAL_ADJUST } from '../src/tools/imageEdit/adjust';
import { applyOp, undo, redo, reset, emptyHistory } from '../src/tools/imageEdit/history';
let n = 0;
function check(ok: boolean, label: string) { n++; if (!ok) throw Error(`FAIL ${label}`); }
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v,i) => v === b[i]);
const input = new Uint8ClampedArray([0,128,255,0, 60,128,200,77, 255,255,255,231, 128,128,128,255]);
check(same(applyAdjust(input, NEUTRAL_ADJUST), input), 'neutral bytes');
check(applyAdjust(input, {}).buffer !== input.buffer, 'new array');
for (const a of [-100,0,100]) {
 const o = applyAdjust(input, { brightness:a, contrast:a, saturation:a, warmth:a });
 check(o.length === input.length, 'length');
 check(o.every(v=>v>=0 && v<=255), 'bounds');
 for (let i=3;i<input.length;i+=4) check(o[i]===input[i], 'alpha');
}
const grey = applyAdjust(input,{saturation:-100});
for(let i=0;i<grey.length;i+=4) check(grey[i]===grey[i+1] && grey[i+1]===grey[i+2], 'desaturation');
const bright = applyAdjust(input,{brightness:100});
check(bright[12]>128, 'bright grey'); check(bright[8]===255, 'white clipped');
const contrasted = applyAdjust(input,{contrast:100});
check(contrasted[6]>200 && contrasted[4]<60,'contrast');
const warm = applyAdjust(new Uint8ClampedArray([100,100,100,9]),{warmth:100});
check(warm[0]>100 && warm[2]<100, 'warmth');
const clamped=clampAdjust({brightness:Infinity, contrast:-999, saturation:NaN});
check(clamped.brightness===100 && clamped.contrast===-100 && clamped.saturation===0 && clamped.warmth===0,'clamp');
check(isNeutralAdjust(NEUTRAL_ADJUST) && !isNeutralAdjust({ ...NEUTRAL_ADJUST, warmth:1 }), 'neutral predicate');
check(same(applyAdjust(input,{brightness:33}),applyAdjust(input,{brightness:33})), 'determinism');
check(applyAdjust(new Uint8ClampedArray(),{brightness:100}).length===0,'empty');
check(same(input,new Uint8ClampedArray([0,128,255,0,60,128,200,77,255,255,255,231,128,128,128,255])), 'input unchanged');
const adjust = {type:'adjust' as const,brightness:1,contrast:2,saturation:3,warmth:4};
const filter = {type:'filter' as const,id:'mono',strength:50};
const h1=applyOp(emptyHistory(),adjust),h2=applyOp(h1,filter);
check(h2.ops.length===2 && h2.ops[0]===adjust && h2.ops[1]===filter,'history apply');
check(undo(h2).redo[0]===filter,'history undo');
check(redo(undo(h2)).ops[1]===filter,'history redo');
check(reset(h2).ops.length===0 && reset(h2).redo.length===0,'history reset');
console.log(`=== all imageAdjust tests passed (${n} checks) ===`);
