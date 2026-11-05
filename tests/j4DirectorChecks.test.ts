import { capabilityWindowState, approvalWaitState } from '../src/capabilities/capabilityWindow';
// Director checks (J4): an independent table of every worked case on the card, plus edge probes beyond it.
// Written by the Director from the card text, not from the builder's engine or test.
const E: any = { capabilityWindowState, approvalWaitState };
const B: any={kind:"USER",frozen:false,safeMode:false,now:1000};let n=0,bad=0;
function eq(a: unknown, b: unknown, l: string){n++;if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log("FAIL",l,JSON.stringify(a),JSON.stringify(b));}}
const C: any[]=[[{},"ACTIVE","in-window",true],[{startAt:2000},"SLEEPING","before-start",true],[{startAt:1000},"ACTIVE","in-window",true],[{startAt:500,endAt:2000},"ACTIVE","in-window",true],[{endAt:1000},"ENDED","after-end",true],[{startAt:100,endAt:900},"ENDED","after-end",true],[{frozen:true,startAt:2000},"FROZEN","frozen",true],[{safeMode:true},"FROZEN","safe-mode",true],[{kind:"SYSTEM",safeMode:true},"ACTIVE","in-window",false],[{kind:"SYSTEM",frozen:true},"FROZEN","frozen",false],[{frozen:true,startAt:100,endAt:900},"FROZEN","frozen",true],[{frozen:true,safeMode:true},"FROZEN","frozen",true],[{safeMode:true,startAt:2000},"FROZEN","safe-mode",true],[{kind:"SYSTEM",startAt:5000},"SLEEPING","before-start",false],[{now:0,startAt:0},"ACTIVE","in-window",true],[{endAt:1001},"ACTIVE","in-window",true],[{kind:"SYSTEM",endAt:500},"ENDED","after-end",false]];
C.forEach((c: any,i: number)=>{const r=E.capabilityWindowState({...B,...c[0]});eq(r,{ok:true,value:{state:c[1],reason:c[2],canErase:c[3]}},"C"+(i+1));});
const M="Capability window input is invalid.";
const d=(x: unknown,e: string,l: string)=>eq(E.capabilityWindowState(x),{ok:false,error:e,message:M},l);
const wo=(k: string)=>{const o: any={...B};delete o[k];return o;};
d(null,"bad-input","D1");d([],"bad-input","D2");d({...B,extra:1},"unknown-key","D3");d({...B,confidence:0.9},"unknown-key","D4");d({...B,kind:"user"},"bad-kind","D5");d({...B,frozen:"no"},"bad-flag","D6");d(wo("safeMode"),"bad-flag","D7");d({...B,now:-1},"bad-time","D8");d({...B,now:1.5},"bad-time","D9");d(wo("now"),"bad-time","D10");d({...B,startAt:undefined},"bad-time","D11");d({...B,startAt:-1},"bad-time","D12");d({...B,startAt:null},"bad-time","D13");d({...B,endAt:"9"},"bad-time","D14");d({...B,startAt:5,endAt:5},"bad-window","D15");d({...B,startAt:9,endAt:5},"bad-window","D16");
const W=(x: unknown)=>E.approvalWaitState(x);const ok=(w: number,r: number,x: boolean,y: number)=>({ok:true,value:{waitDays:w,readyAt:r,ready:x,remainingMs:y}});
eq(W({requestedAt:0,now:0}),ok(2,172800000,false,172800000),"T1");eq(W({requestedAt:0,now:172799999}),ok(2,172800000,false,1),"T2");eq(W({requestedAt:0,now:172800000}),ok(2,172800000,true,0),"T3");eq(W({requestedAt:1000,now:2592001000,waitDays:30}),ok(30,2592001000,true,0),"T4");eq(W({requestedAt:100,now:999999999,waitDays:1}),ok(1,86400100,true,0),"T5");eq(W({requestedAt:0,now:1}),ok(2,172800000,false,172799999),"T6");eq(W({requestedAt:0,now:216000000,waitDays:5}),ok(5,432000000,false,216000000),"T7");
const AM="Approval wait input is invalid.";const e=(x: unknown,c: string,l: string)=>eq(W(x),{ok:false,error:c,message:AM},l);
e({requestedAt:0,now:5,waitDays:31},"bad-wait-days","E1");e({requestedAt:0,now:5,waitDays:0},"bad-wait-days","E2");e({requestedAt:0,now:5,waitDays:1.5},"bad-wait-days","E3");e({requestedAt:10,now:5},"clock-before-request","E4");e({requestedAt:0,now:1,waitDays:null},"bad-wait-days","E5");e({requestedAt:0,now:1,x:1},"unknown-key","E6");e({requestedAt:-1,now:1},"bad-time","E7");e({requestedAt:0},"bad-time","E8");e([],"bad-input","E9");e({requestedAt:0,now:1,waitDays:"2"},"bad-wait-days","E10");
const sym=Symbol("s");d({...B,[sym]:1},"unknown-key","symbol key");
d(new Map(),"bad-input","Map");d(function(){},"bad-input","function");d("x","bad-input","string");d(5,"bad-input","number");
class K{constructor(){Object.assign(this,B)}}d(new K(),"bad-input","class instance (card says plain object)");
const nul=Object.assign(Object.create(null),B);eq(E.capabilityWindowState(nul).ok,true,"null-proto accepted");
const g: any={...B};Object.defineProperty(g,"now",{enumerable:true,get(): never{throw new Error("x")}});d(g,"bad-input","throwing getter never throws out");
d({...B,now:Number.MAX_SAFE_INTEGER+1},"bad-time","unsafe int");d({...B,now:NaN},"bad-time","NaN");d({...B,now:Infinity},"bad-time","Inf");d({...B,kind:undefined},"bad-kind","kind undefined");d({...B,safeMode:undefined},"bad-flag","safeMode undefined present");
e({requestedAt:0,now:1,waitDays:undefined},"bad-wait-days","waitDays present undefined");e({requestedAt:0,now:1,waitDays:NaN},"bad-wait-days","waitDays NaN");
const f=Object.freeze({...B});eq(E.capabilityWindowState(f).ok,true,"frozen input ok");
eq(Object.isFrozen((W({requestedAt:0,now:0}) as any).value)&&Object.isFrozen(W({requestedAt:0,now:0})),true,"wait frozen");
d({...B,kind:"x",frozen:"y",now:-1,startAt:5,endAt:1,extra:1},"unknown-key","unknown before kind");
d({...B,kind:"x",frozen:"y",now:-1},"bad-kind","kind before flag");d({...B,frozen:"y",now:-1},"bad-flag","flag before time");d({...B,now:-1,startAt:5,endAt:1},"bad-time","time before window");
e({requestedAt:10,now:5,waitDays:99},"bad-wait-days","wait-days before clock");e({requestedAt:-1,now:5,waitDays:99,},"bad-time","time before wait-days");


if (bad > 0) { throw new Error('J4_DIRECTOR_CHECKS FAILED: ' + bad + ' of ' + n); }
console.log('J4_DIRECTOR_CHECKS OK: ' + n + ' checks');
