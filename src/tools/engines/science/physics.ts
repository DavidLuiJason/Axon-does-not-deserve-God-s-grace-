import { convert, type UnitCategory } from '../numbers/unitConvert';

export const STANDARD_GRAVITY = 9.80665;
export const PHYSICS_LIMITS = Object.freeze({ maxAbsValue: 1e12, maxInputCount: 16, maxProjectileAngleDegrees: 90 });
export type PhysicsLabel = 'EXACT' | 'ESTIMATE';
export type PhysicsErrorCode = 'invalid-input'|'missing-input'|'invalid-unit'|'unit-mismatch'|'out-of-range'|'no-real-solution'|'inconsistent-input'|'unsupported-units';
export interface Quantity { value: number; unit: string; }
export interface PhysicsSuccess { ok: true; values: Record<string, Quantity | Quantity[]>; label: PhysicsLabel; assumptions: string[]; }
export interface PhysicsFailure { ok: false; error: PhysicsErrorCode; message: string; }
export type PhysicsResult = PhysicsSuccess | PhysicsFailure;
export type MotionKnown = Partial<Record<'u'|'v'|'a'|'t'|'s', Quantity>>;
const fail = (error: PhysicsErrorCode, message: string): PhysicsFailure => ({ ok:false, error, message });
const good = (values: PhysicsSuccess['values'], label: PhysicsLabel='EXACT', assumptions: string[]=[]): PhysicsSuccess => ({ok:true, values, label, assumptions});
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= PHYSICS_LIMITS.maxAbsValue;
const validQ = (q: unknown): q is Quantity => !!q && typeof q === 'object' && finite((q as Quantity).value) && typeof (q as Quantity).unit === 'string' && (q as Quantity).unit.length > 0;
function toSI(q: Quantity, category: UnitCategory, si: string): number | PhysicsFailure {
  if (!validQ(q)) return fail('invalid-input','Each quantity needs a finite value and a unit.');
  const r=convert(q.value,q.unit,si);
  if (r.ok === false) return fail(r.error==='category-mismatch'?'unit-mismatch':'invalid-unit',`Unit “${q.unit}” is not a valid ${category} unit; expected ${si} or a convertible ${category} unit.`);
  if (!finite(r.value)) return fail('out-of-range','The converted value exceeds the supported limit.');
  return r.value;
}
function output(value:number, si:string, requested?:string, category?:UnitCategory): Quantity | PhysicsFailure {
  if(!finite(value)) return fail('out-of-range','The result is non-finite or exceeds 1e12.');
  if(requested && requested!==si && category){const r=convert(value,si,requested);if(r.ok === false)return fail('invalid-unit',`Cannot express this result in “${requested}”.`);return {value:r.value,unit:requested};}
  return {value,unit:si};
}
const units: Record<'u'|'v'|'a'|'t'|'s',{cat:UnitCategory;si:string}>={u:{cat:'speed',si:'m/s'},v:{cat:'speed',si:'m/s'},a:{cat:'length',si:'m'},t:{cat:'time',si:'s'},s:{cat:'length',si:'m'}};
// Acceleration has no category in the shared unit engine: m/s² is accepted as SI only.
function readMotion(known: MotionKnown): {data:Partial<Record<'u'|'v'|'a'|'t'|'s',number>>; requested:MotionKnown}|PhysicsFailure {
  if(!known||typeof known!=='object'||Array.isArray(known))return fail('invalid-input','Provide an object of known motion quantities.');
  const keys=Object.keys(known); if(keys.length<3)return fail('missing-input','Provide any three of u, v, a, t and s.'); if(keys.length>5||keys.some(k=>!['u','v','a','t','s'].includes(k)))return fail('invalid-input','Use only u, v, a, t and s.');
  const data:Partial<Record<'u'|'v'|'a'|'t'|'s',number>>={};
  for(const k of keys as (keyof MotionKnown)[]){const q=known[k];if(!validQ(q))return fail('invalid-input',`Quantity ${k} needs a finite number and unit.`);if(k==='t'&&q.value<0)return fail('invalid-input','Time cannot be negative.');if(k==='a'){if(q.unit!=='m/s²'&&q.unit!=='m/s^2')return fail('invalid-unit','Acceleration must use m/s² or m/s^2 because the shared unit engine has no acceleration category.');data.a=q.value;}else {const spec=units[k!];const n=toSI(q,spec.cat,spec.si);if(typeof n!=='number')return n;data[k!]=n;}}
  return {data,requested:known};
}
function near(a:number,b:number):boolean{return Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));}
export function solveMotion(known: MotionKnown): PhysicsResult {
 const parsed=readMotion(known);if('ok' in parsed)return parsed;const d=parsed.data, req=parsed.requested;
 const keys=Object.keys(d); if(keys.length<3)return fail('missing-input','Provide any three of u, v, a, t and s.');
 const [u,v,a,t,s]=[d.u,d.v,d.a,d.t,d.s]; let sols:Partial<Record<'u'|'v'|'a'|'t'|'s',number>>[]=[];
 const add=(x:Partial<Record<'u'|'v'|'a'|'t'|'s',number>>)=>{if(Object.values(x).every(Number.isFinite))sols.push(x);};
 // Solve the independent kinematic equations; quadratic branches are preserved.
 if(u!==undefined&&v!==undefined&&a!==undefined){if(a===0){if(!near(u,v))return fail('inconsistent-input','With zero acceleration, initial and final velocities must match.');if(t!==undefined)add({t});else if(s!==undefined&&u!==0)add({t:s/u});}else {const tt=(v-u)/a; if(t!==undefined&&!near(tt,t))return fail('inconsistent-input','The supplied values contradict v = u + a·t.');if(s!==undefined&&!near(s,u*tt+.5*a*tt*tt))return fail('inconsistent-input','The supplied values contradict the displacement equation.');add({t:tt,s:u*tt+.5*a*tt*tt});}}
 if(u!==undefined&&a!==undefined&&t!==undefined)add({v:u+a*t,s:u*t+.5*a*t*t});
 if(v!==undefined&&a!==undefined&&t!==undefined)add({u:v-a*t,s:v*t-.5*a*t*t});
 if(u!==undefined&&v!==undefined&&t!==undefined){if(t===0){if(!near(u,v))return fail('inconsistent-input','At zero time, velocity cannot change.');return fail('no-real-solution','Zero time and equal velocities do not determine acceleration or displacement.');}add({a:(v-u)/t,s:(u+v)*t/2});}
 if(u!==undefined&&a!==undefined&&s!==undefined){const disc=u*u+2*a*s;if(disc<0)return fail('no-real-solution','These values give no real final velocity.');const root=Math.sqrt(Math.max(0,disc));const vs=[root,-root].map(vv=>({v:vv,t:a===0?NaN:(vv-u)/a})).filter(x=>Number.isFinite(x.t));for(const x of vs)add({v:x.v,t:x.t});}
 if(v!==undefined&&a!==undefined&&s!==undefined){const disc=v*v-2*a*s;if(disc<0)return fail('no-real-solution','These values give no real initial velocity.');const root=Math.sqrt(Math.max(0,disc));for(const uu of [root,-root]){const tt=a===0?NaN:(v-uu)/a;if(Number.isFinite(tt))add({u:uu,t:tt});}}
 if(u!==undefined&&v!==undefined&&s!==undefined){const den=2*s;if(den===0){if(!near(u*u,v*v))return fail('inconsistent-input','Zero displacement requires equal velocity magnitudes.');return fail('no-real-solution','These values do not determine acceleration and time uniquely.');}const aa=(v*v-u*u)/den;if(near(aa,0)){if(!near(u,v))return fail('inconsistent-input','The supplied values are inconsistent with zero acceleration.');if(u!==0)add({a:0,t:s/u});}else {const tt=(v-u)/aa;if(Number.isFinite(tt))add({a:aa,t:tt});}}
 if(u!==undefined&&t!==undefined&&s!==undefined){if(t===0){if(!near(s,0))return fail('inconsistent-input','At zero time, displacement must be zero.');return fail('no-real-solution','Zero time does not determine final velocity or acceleration.');}const aa=2*(s-u*t)/(t*t);add({a:aa,v:u+aa*t});}
 if(v!==undefined&&t!==undefined&&s!==undefined){if(t===0){if(!near(s,0))return fail('inconsistent-input','At zero time, displacement must be zero.');return fail('no-real-solution','Zero time does not determine initial velocity or acceleration.');}const aa=2*(v*t-s)/(t*t);add({a:aa,u:v-aa*t});}
 if(a!==undefined&&t!==undefined&&s!==undefined){if(t===0){if(!near(s,0))return fail('inconsistent-input','At zero time, displacement must be zero.');return fail('no-real-solution','Zero time does not determine velocity.');}const uu=(s-.5*a*t*t)/t;add({u:uu,v:uu+a*t});}
 if(a!==undefined&&u!==undefined&&s!==undefined&&a===0){if(u===0&&s!==0)return fail('no-real-solution','A stationary object with zero acceleration cannot move.');if(u!==0)add({v:u,t:s/u});}
 if(!sols.length)return fail('no-real-solution','The supplied quantities do not produce a supported real solution.');
 sols=sols.filter(x=>Object.entries(d).every(([k,val])=>x[k as keyof typeof x]===undefined||near(x[k as keyof typeof x]!,val)));
 // Merge solutions that differ only by floating-point noise; retain distinct quadratic roots.
 const uniq=sols.filter((x,i)=>sols.findIndex(y=>Object.keys(x).every(k=>x[k as keyof typeof x]!==undefined&&y[k as keyof typeof y]!==undefined&&near(x[k as keyof typeof x]!,y[k as keyof typeof y]!)))===i);
 const full:Record<string,Quantity|Quantity[]>={};const names=['u','v','a','t','s'] as const;const results:Record<string,Quantity[]>={};
 for(const k of names){if(d[k]!==undefined)continue;const vals=uniq.map(x=>x[k]).filter((x):x is number=>x!==undefined);if(!vals.length)return fail('no-real-solution',`Could not determine ${k}.`);const q=vals.map(n=>output(n,k==='u'||k==='v'?'m/s':k==='a'?'m/s²':k==='t'?'s':'m',req[k]?.unit, k==='u'||k==='v'?'speed':k==='t'?'time':k==='s'?'length':undefined));if(q.some(x=>'ok'in x))return q.find(x=>'ok'in x) as PhysicsFailure;const quantities=q as Quantity[];results[k]=quantities;full[k]=quantities.length===1?quantities[0]:quantities;}
 for(const k of names){if(d[k]!==undefined)full[k]=req[k]!;}
 const assumptions:string[]=[]; if(Object.keys(full).some(k=>Array.isArray(full[k])))assumptions.push('Multiple real branches are returned in order; all real mathematical branches are retained; a negative solved time denotes the branch relative to the chosen time origin.');
 return good(full,'EXACT',assumptions);
}
export type ForceEnergyKnown = { mass?:Quantity; acceleration?:Quantity; velocity?:Quantity; initialVelocity?:Quantity; finalVelocity?:Quantity; height?:Quantity; displacement?:Quantity; force?:Quantity; angleDegrees?:number; time?:Quantity; power?:Quantity };
function readNumber(q:Quantity|undefined,cat:UnitCategory,si:string,name:string,required=true):number|PhysicsFailure|undefined {if(!q){return required?fail('missing-input',`Missing ${name}.`):undefined;}return toSI(q,cat,si);}
function scalar(q:Quantity|undefined,si:string,name:string,required=true):number|PhysicsFailure|undefined {if(!q)return required?fail('missing-input',`Missing ${name}.`):undefined;if(!validQ(q))return fail('invalid-input',`${name} must be finite and include a unit.`);if(q.unit!==si)return fail('invalid-unit',`${name} must use ${si}; the shared unit engine has no compatible category for it.`);return q.value;}
export function forceAndEnergy(known: ForceEnergyKnown): PhysicsResult {
 if(!known||typeof known!=='object')return fail('invalid-input','Provide a force-and-energy input object.');const values:Record<string,Quantity>={};
 const m=readNumber(known.mass,'mass','kg','mass',false);if(m&&typeof m!=='number')return m;if(typeof m==='number'&&m<0)return fail('invalid-input','Mass cannot be negative.');
 const acc=scalar(known.acceleration,'m/s²','acceleration',false);if(acc&&typeof acc!=='number')return acc;
 if(typeof m==='number'&&typeof acc==='number')values.force={value:m*acc,unit:'N'};
 if(typeof m==='number')values.weight={value:m*STANDARD_GRAVITY,unit:'N'};
 const vel=readNumber(known.velocity,'speed','m/s','velocity',false);if(vel&&typeof vel!=='number')return vel;
 if(typeof m==='number'&&typeof vel==='number'){values.momentum={value:m*vel,unit:'kg·m/s'};values.kineticEnergy={value:.5*m*vel*vel,unit:'J'};}
 const h=readNumber(known.height,'length','m','height',false);if(h&&typeof h!=='number')return h;if(typeof m==='number'&&typeof h==='number')values.gravitationalPotentialEnergy={value:m*STANDARD_GRAVITY*h,unit:'J'};
 const f=scalar(known.force,'N','force',false);if(f&&typeof f!=='number')return f;const dist=readNumber(known.displacement,'length','m','displacement',false);if(dist&&typeof dist!=='number')return dist;
 if(typeof f==='number'&&typeof dist==='number'){const angle=known.angleDegrees??0;if(!finite(angle))return fail('invalid-input','Angle must be a finite number.');values.work={value:f*dist*Math.cos(angle*Math.PI/180),unit:'J'};}
 const power=scalar(known.power,'W','power',false);if(power&&typeof power!=='number')return power;const time=readNumber(known.time,'time','s','time',false);if(time&&typeof time!=='number')return time;
 if(typeof f==='number'&&typeof dist==='number'&&typeof time==='number'&&time>0)values.powerFromWork={value:f*dist*Math.cos((known.angleDegrees??0)*Math.PI/180)/time,unit:'W'};
 if(typeof power==='number')values.power={value:power,unit:'W'};
 if(!Object.keys(values).length)return fail('missing-input','Provide mass and acceleration, mass for weight, mass and velocity, mass and height, force and displacement, or power.');
 for(const [k,q] of Object.entries(values))if(!finite(q.value))return fail('out-of-range',`${k} exceeds the supported limit.`);
 return good(values,'EXACT',[]);
}
export interface ProjectileInput { launchSpeed:Quantity; angleDegrees:number; launchHeight:Quantity; }
export function projectile(input: ProjectileInput): PhysicsResult {
 if(!input||typeof input!=='object'||!validQ(input.launchSpeed)||!validQ(input.launchHeight)||!finite(input.angleDegrees))return fail('invalid-input','Provide finite launch speed, angle in degrees, and launch height quantities.');
 const speed=toSI(input.launchSpeed,'speed','m/s');if(typeof speed!=='number')return speed;const height=toSI(input.launchHeight,'length','m');if(typeof height!=='number')return height;
 if(speed<0)return fail('invalid-input','Launch speed cannot be negative.');if(height<0)return fail('invalid-input','Launch height cannot be negative.');if(input.angleDegrees< -PHYSICS_LIMITS.maxProjectileAngleDegrees||input.angleDegrees>PHYSICS_LIMITS.maxProjectileAngleDegrees)return fail('out-of-range','Launch angle must be between -90 and 90 degrees.');
 const rad=input.angleDegrees*Math.PI/180,vx=speed*Math.cos(rad),vy=speed*Math.sin(rad),disc=vy*vy+2*STANDARD_GRAVITY*height;if(disc<0)return fail('no-real-solution','The projectile cannot reach ground under this model.');const flight=(vy+Math.sqrt(disc))/STANDARD_GRAVITY;if(flight<0)return fail('no-real-solution','The projectile has no non-negative time of flight.');const range=vx*flight,maxHeight=height+Math.max(0,vy*vy/(2*STANDARD_GRAVITY)),landing=Math.sqrt(vx*vx+(vy-STANDARD_GRAVITY*flight)**2);
 const vals=[speed,height,flight,range,maxHeight,landing];if(vals.some(n=>!finite(n)))return fail('out-of-range','Projectile result exceeds the supported limit.');
 return good({timeOfFlight:{value:flight,unit:'s'},range:{value:range,unit:'m'},maximumHeight:{value:maxHeight,unit:'m'},landingSpeed:{value:landing,unit:'m/s'}},'ESTIMATE',['No air drag','Constant gravity (g = 9.80665 m/s²)','Flat ground','Point-mass projectile']);
}
