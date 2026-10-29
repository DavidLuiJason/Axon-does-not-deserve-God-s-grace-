import { strict as assert } from 'node:assert';
import { solveMotion, forceAndEnergy, projectile, STANDARD_GRAVITY } from '../src/tools/engines/science/physics';
let checks=0; const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
const q=(value:number,unit:string)=>({value,unit});
const motion=(known:Record<string,{value:number;unit:string}>)=>solveMotion(known as never);
// Independent reference values are written directly from the textbook equations, not from the engine.
const m1=motion({u:q(0,'m/s'),a:q(9.80665,'m/s²'),s:q(20,'m')});check(m1.ok,'dropped stone solves');if(m1.ok){const t=Math.sqrt(2*20/9.80665);const times=m1.values.t as Array<{value:number}>;const speeds=m1.values.v as Array<{value:number}>;check(Array.isArray(times)&&times.length===2,'dropped stone returns both mathematical time roots');check(Math.abs(times[0].value-t)<1e-8,'dropped stone positive time');check(Array.isArray(speeds)&&Math.abs(speeds[0].value-Math.sqrt(2*9.80665*20))<1e-8,'dropped stone positive speed');}
const brake=motion({u:q(20,'m/s'),v:q(0,'m/s'),a:q(-4,'m/s²')});check(brake.ok,'braking case');if(brake.ok){check(Math.abs((brake.values.t as {value:number}).value-5)<1e-8,'braking time');check(Math.abs((brake.values.s as {value:number}).value-50)<1e-8,'braking distance');}
const triples:Array<[Record<string,{value:number;unit:string}>,string,number]>=[
 [{u:q(2,'m/s'),v:q(8,'m/s'),a:q(3,'m/s²')},'t',2],
 [{u:q(3,'m/s'),a:q(2,'m/s²'),t:q(4,'s')},'s',28],
 [{u:q(3,'m/s'),v:q(11,'m/s'),t:q(4,'s')},'s',28],
 [{v:q(11,'m/s'),a:q(2,'m/s²'),t:q(4,'s')},'u',3],
 [{u:q(3,'m/s'),t:q(4,'s'),s:q(28,'m')},'a',2],
 [{v:q(11,'m/s'),t:q(4,'s'),s:q(28,'m')},'a',2],
 [{a:q(2,'m/s²'),t:q(4,'s'),s:q(28,'m')},'u',3],
 [{u:q(3,'m/s'),v:q(11,'m/s'),s:q(28,'m')},'a',2],
 [{u:q(3,'m/s'),a:q(2,'m/s²'),s:q(28,'m')},'t',4],
 [{v:q(11,'m/s'),a:q(2,'m/s²'),s:q(28,'m')},'t',4],
];
for(const [input,key,expected] of triples){const r=motion(input);check(r.ok,`triple ${Object.keys(input).join(',')} solves`);if(r.ok){const v=r.values[key] as {value:number}|Array<{value:number}>;const actual=Array.isArray(v)?v[0].value:v.value;check(Math.abs(actual-expected)<1e-7,`triple ${key} independently expected ${expected}`);}}
// Unit conversion invariance: 72 km/h = 20 m/s.
for(const unit of ['m/s','km/h','mph']){const speed=unit==='m/s'?20:unit==='km/h'?72:20/0.44704;const r=motion({u:q(speed,unit),a:q(-4,'m/s²'),t:q(2,'s')});check(r.ok,'speed-unit variant accepted');if(r.ok)check(Math.abs((r.values.v as {value:number}).value-(20-8))<1e-7,'speed unit SI result consistent');}
const two=motion({u:q(20,'m/s'),a:q(-9.80665,'m/s²'),s:q(10,'m')});check(two.ok,'two-root ball height case');if(two.ok){check(Array.isArray(two.values.v)&&two.values.v.length===2,'both real velocity roots returned');check(Array.isArray(two.values.t)&&two.values.t.length===2,'both real time roots returned');}
const noRoot=motion({u:q(0,'m/s'),a:q(2,'m/s²'),s:q(-10,'m')});check(!noRoot.ok&&noRoot.error==='no-real-solution','no-real-root typed');
check(!motion({u:q(1,'m/s'),v:q(2,'m/s'),a:q(0,'m/s²')}).ok,'zero acceleration inconsistency');
check(!motion({u:q(1,'m/s'),v:q(2,'m/s'),t:q(-1,'s')}).ok,'negative time rejected or inconsistent');
check(!motion({u:q(NaN,'m/s'),v:q(2,'m/s'),a:q(1,'m/s²')}).ok,'NaN rejected');
check(!motion({u:q(1,'m'),v:q(2,'m/s'),a:q(1,'m/s²')}).ok,'wrong unit rejected');
check(!motion({u:q(1e13,'m/s'),v:q(2,'m/s'),a:q(1,'m/s²')}).ok,'over-limit input rejected');
const energy=forceAndEnergy({mass:q(2,'kg'),acceleration:q(3,'m/s²'),velocity:q(4,'m/s'),height:q(5,'m'),force:q(10,'N'),displacement:q(3,'m'),angleDegrees:60,time:q(2,'s')});check(energy.ok,'force and energy computes');if(energy.ok){check((energy.values.force as {value:number}).value===6,'F=ma');check(Math.abs((energy.values.work as {value:number}).value-15)<1e-9,'work includes cosine');check((energy.values.weight as {value:number}).value===2*STANDARD_GRAVITY,'standard gravity used');check((energy.values.kineticEnergy as {value:number}).value===16,'kinetic energy');}
const wrongWork=forceAndEnergy({force:q(10,'N'),displacement:q(3,'m'),angleDegrees:60});check(wrongWork.ok,'angled work input accepted');if(wrongWork.ok)check(Math.abs((wrongWork.values.work as {value:number}).value-15)<1e-9,'cosine mutation guard');
const p=projectile({launchSpeed:q(20,'m/s'),angleDegrees:45,launchHeight:q(1.5,'m')});check(p.ok,'45-degree projectile');if(p.ok){const vals=p.values;const t=(20*Math.sin(Math.PI/4)+Math.sqrt((20*Math.sin(Math.PI/4))**2+2*STANDARD_GRAVITY*1.5))/STANDARD_GRAVITY;check(Math.abs((vals.timeOfFlight as {value:number}).value-t)<1e-9,'projectile time independent');check(p.label==='ESTIMATE'&&p.assumptions.length===4,'projectile assumptions labelled');const landV=(vals.landingSpeed as {value:number}).value;const launchE=.5*20*20+STANDARD_GRAVITY*1.5;const landE=.5*landV*landV;check(Math.abs(launchE-landE)/launchE<1e-9,'projectile energy conservation');}
const dropped=projectile({launchSpeed:q(0,'m/s'),angleDegrees:0,launchHeight:q(20,'m')});check(dropped.ok,'dropped projectile');if(dropped.ok){const v=(dropped.values.landingSpeed as {value:number}).value;check(Math.abs(v-Math.sqrt(2*STANDARD_GRAVITY*20))<1e-8,'dropped projectile landing speed');}
check(!projectile({launchSpeed:q(-1,'m/s'),angleDegrees:30,launchHeight:q(1,'m')}).ok,'negative launch speed rejected');
check(!projectile({launchSpeed:q(10,'m/s'),angleDegrees:NaN,launchHeight:q(1,'m')}).ok,'NaN angle rejected');
// Director addition (C29 check): every unknown of every triple, plus projectiles away from 45 degrees (values computed separately in Python).
const dirCases=[{"u": 3, "a": 2, "t": 4, "v": 11, "s": 28.0}, {"u": -5.5, "a": 1.25, "t": 6, "v": 2.0, "s": -10.5}, {"u": 12, "a": -3, "t": 2.5, "v": 4.5, "s": 20.625}];
const dirU:Record<string,string>={u:'m/s',v:'m/s',a:'m/s²',t:'s',s:'m'};
const dirTriples=[['u','v','a'],['u','a','t'],['v','a','t'],['u','v','t'],['u','a','s'],['v','a','s'],['u','v','s'],['u','t','s'],['v','t','s'],['a','t','s']];
for(const c of dirCases as Array<Record<string,number>>) for(const tr of dirTriples){
  const input:Record<string,{value:number;unit:string}>={}; for(const k of tr) input[k]=q(c[k]!,dirU[k]!);
  const r=motion(input); check(r.ok,`director triple ${tr.join(',')} solves`);
  if(r.ok) for(const k of ['u','v','a','t','s'].filter(x=>!tr.includes(x))){
    const val=r.values[k]; const list=(Array.isArray(val)?val:[val]).map(z=>z.value);
    check(list.some(x=>Math.abs(x-c[k]!)<=1e-7*Math.max(1,Math.abs(c[k]!))),`director ${tr.join(',')} gives ${k}`);
  }
}
for(const [v,ang,h,t,rng,hm,vl] of [[15, 30, 0, 1.5295743194668923, 19.86975326451935, 2.8679518490004225, 15.0], [30, 60, 10, 5.658988994285558, 84.88483491428339, 44.415422188005074, 33.10789935951842], [5, 89, 2, 1.3269478743217051, 0.11579216811875957, 3.2742570264942, 8.014149986118303]] as number[][]){
  const r=projectile({launchSpeed:q(v!,'m/s'),angleDegrees:ang!,launchHeight:q(h!,'m')}); check(r.ok,'director projectile solves');
  if(r.ok){ const x=(k:string)=>(r.values[k] as {value:number}).value;
    check(Math.abs(x('timeOfFlight')-t!)<1e-9*Math.max(1,t!)&&Math.abs(x('range')-rng!)<1e-9*Math.max(1,rng!)&&Math.abs(x('maximumHeight')-hm!)<1e-9*Math.max(1,hm!)&&Math.abs(x('landingSpeed')-vl!)<1e-9*Math.max(1,vl!),`director projectile ${v} m/s at ${ang} degrees`); }
}
console.log(`C29 physics tests: ${checks} checks passed.`);
