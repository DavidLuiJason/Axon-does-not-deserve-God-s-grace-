import { strict as assert } from 'node:assert';
import { convert, listUnits, UNITS, PHYSICS_UNITS } from '../src/tools/engines/numbers/unitConvert';
let checks=0;
function check(condition:unknown,name:string){assert.ok(condition,name);checks++;console.log(`  OK: ${name}`);}
function sig(value:number):number{return Number(value.toPrecision(12));}
function closeSig(actual:number,expected:number):boolean{return sig(actual)===sig(expected);}
const si:Record<keyof typeof PHYSICS_UNITS,string>={
 acceleration:'m/s²',force:'N',energy:'J',power:'W',momentum:'kg·m/s'
};
const expected:Record<keyof typeof PHYSICS_UNITS,Array<[string,number]>>={
 acceleration:[['m/s²',1],['ft/s²',0.3048],['g₀',9.80665]],
 force:[['N',1],['kN',1000],['kgf',9.80665],['lbf',0.45359237*9.80665]],
 energy:[['J',1],['kJ',1000],['cal',4.184],['kcal',4184],['Wh',3600],['kWh',3600000]],
 power:[['W',1],['mW',0.001],['kW',1000],['MW',1000000],['hp',550*0.3048*(0.45359237*9.80665)]],
 momentum:[['kg·m/s',1],['N·s',1],['g·cm/s',0.00001],['lb·ft/s',0.45359237*0.3048]]
};
for(const category of Object.keys(expected) as Array<keyof typeof PHYSICS_UNITS>){
 for(const [symbol,factor] of expected[category]){
  const result=convert(1,symbol,si[category]);
  check(result.ok&&closeSig(result.value,factor),`${category}/${symbol} independently converts to SI by its derived factor`);
 }
}
const lbf=convert(1,'lbf','N');
check(lbf.ok&&closeSig(lbf.value,4.4482216152605),'derived pound-force check: 1 lbf = 4.4482216152605 N');
const hp=convert(1,'hp','W');
check(hp.ok&&closeSig(hp.value,745.6998715822702),'derived mechanical horsepower check: 1 hp = 745.6998715822702 W');
const kwh=convert(1,'kWh','J');
check(kwh.ok&&closeSig(kwh.value,3600000),'derived kilowatt-hour check: 1 kWh = 3600000 J');
const cal=convert(1,'cal','J');
check(cal.ok&&closeSig(cal.value,4.184),'derived thermochemical calorie check: 1 cal = 4.184 J');
const ft=convert(1,'ft/s²','m/s²');
check(ft.ok&&closeSig(ft.value,0.3048),'derived foot acceleration check: 1 ft/s² = 0.3048 m/s²');
const lbft=convert(1,'lb·ft/s','kg·m/s');
check(lbft.ok&&closeSig(lbft.value,0.13825495437600002),'derived pound-foot momentum check: 1 lb·ft/s = 0.13825495437600002 kg·m/s');
const roundTrips:Array<[string,string,string,string]>=[
 ['acceleration','ft/s²','g₀','ft/s²'],
 ['force','lbf','kgf','lbf'],
 ['energy','kWh','cal','kWh'],
 ['power','hp','kW','hp'],
 ['momentum','lb·ft/s','N·s','lb·ft/s']
];
for(const [category,a,b,back] of roundTrips){
 const first=convert(1,a,b),second=first.ok?convert(first.value,b,back):null;
 check(!!second&&second.ok&&closeSig(second.value,1),`${category} round trip ${a} to ${b} to ${back}`);
}
const mismatch=convert(1,'N','J');
check(!mismatch.ok&&mismatch.error==='category-mismatch','force-to-energy mismatch returns category-mismatch');
const unknown=convert(1,'not-a-unit','N');
check(!unknown.ok&&unknown.error==='unknown-unit','unknown unit returns unknown-unit');
const kiloNewton=convert(1,'kN','N');
check(kiloNewton.ok&&kiloNewton.value===1000,'exact-case kN resolves to kilonewton');
const knot=convert(1,'kn','m/s');
check(knot.ok&&knot.value===0.514444444444,'exact-case kn still resolves to knot');
const alias1=convert(1,'m/s^2','m/s²'),alias2=convert(1,'ft/s^2','ft/s²');
check(alias1.ok&&alias1.value===1&&alias2.ok&&alias2.value===1,'only the two specified caret acceleration aliases resolve');
check(JSON.stringify(Object.keys(UNITS))===JSON.stringify(['length','mass','temperature','volume','area','speed','time','data']),'public UNITS keys remain exactly the original eight categories');
check(!(['acceleration','force','energy','power','momentum'] as string[]).some(k=>Object.prototype.hasOwnProperty.call(UNITS,k)),'none of the five physics-only groups appears in public UNITS');
const originalSymbols:Record<string,string[]>={
 length:['m','km','cm','mm','mi','yd','ft','in'],
 mass:['kg','g','mg','t','lb','oz'],
 temperature:['°C','°F','K'],
 volume:['L','mL','m³','gal','cup','fl oz'],
 area:['m²','km²','ha','ac','ft²'],
 speed:['m/s','km/h','mph','kn'],
 time:['s','ms','min','h','d','wk'],
 data:['bit','B','kbit','kB','Mbit','MB','Gbit','GB','Tbit','TB','Kibit','KiB','Mibit','MiB','Gibit','GiB','Tibit','TiB']
};
for(const [category,symbols] of Object.entries(originalSymbols)){
 const actual=listUnits(category as keyof typeof UNITS).map(u=>u.symbol);
 check(JSON.stringify(actual)===JSON.stringify(symbols),`legacy ${category} list is unchanged`);
}
for(const category of ['acceleration','force','energy','power','momentum'] as const){
 check(listUnits(category).length===expected[category].length,`${category} listUnits returns all ${expected[category].length} physics units`);
}
check(listUnits('length').length>=6,'legacy length list still has at least six units');
check(listUnits('data').some(u=>u.symbol==='MB')&&listUnits('data').some(u=>u.symbol==='MiB'),'legacy data list still includes MB and MiB');
const mw=convert(5,'mW','W');
check(mw.ok&&closeSig(mw.value,0.005),'milliwatt: 5 mW = 0.005 W, never read as megawatt');
const mwLower=convert(5,'mw','W');
check(!mwLower.ok&&mwLower.error==='unknown-unit','ambiguous lowercase mw is refused, not guessed');
const knUpper=convert(1,'KN','N');
check(!knUpper.ok&&knUpper.error==='unknown-unit','ambiguous KN (knot or kilonewton) is refused, not guessed');
const kwLower=convert(1,'kw','W');
check(kwLower.ok&&kwLower.value===1000,'unambiguous lowercase kw still resolves to kilowatt');
console.log(`unitCategories.test.ts: ${checks} checks passed.`);
