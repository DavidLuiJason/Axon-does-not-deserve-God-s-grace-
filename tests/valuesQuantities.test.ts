import { extractValues } from '../src/brain/mind/meaning/values/index';
import { lookupUnitWord } from '../src/brain/mind/meaning/values/quantities';
import { UNITS } from '../src/tools/engines/numbers/unitConvert';
let checks=0;
for(const units of Object.values(UNITS))for(const u of units){const r=lookupUnitWord(u.name);if(!r.ok||r.unit!==u.name)throw Error('unit lookup failed');checks++;}
for(const [text,kind] of [['5 miles','quantity'],['15%','percent'],['2 hours','duration'],['5m','quantity'],['5 m','number']] as const){const r=extractValues(text,[{kind:'language',text,start:0,end:text.length}],{year:2026,month:10,day:24,hour:10,minute:30});if(!r.ok||r.values[0]?.kind!==kind)throw Error(text);checks++;}
console.log('valuesQuantities: '+checks+' checks passed');
