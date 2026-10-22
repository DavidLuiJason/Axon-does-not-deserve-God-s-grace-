import { UNITS } from '../engines/numbers/unitConvert';
export interface ConverterUnit { id: string; name: string; short: string; common: boolean }
export interface ConverterKind { id: string; name: string; entry: 'number' | 'text' | 'block' | 'file'; units: ConverterUnit[]; defaultFrom: string; defaultTo: string }
const categories = [
 ['length','Length','km','mi',['km','m','mi','ft','in']],
 ['mass','Weight','kg','lb',['kg','g','lb','oz','t']],
 ['temperature','Temperature','°C','°F',['°C','°F','K']],
 ['volume','Volume','L','gal',['L','mL','gal','cup','m³']],
 ['area','Area','m²','ft²',['m²','km²','ha','ac','ft²']],
 ['speed','Speed','km/h','mph',['km/h','mph','m/s','kn']],
 ['time','Time','h','min',['s','min','h','d','wk']],
 ['data','Data size','GB','GiB',['bit','B','kB','MB','GB','KiB']],
] as const;
export const CONVERTER_KINDS: readonly ConverterKind[] = [
 ...categories.map(([id,name,defaultFrom,defaultTo,common]):ConverterKind=>({
  id,name,entry:'number',defaultFrom,defaultTo,
  units:UNITS[id].map(u=>({id:u.symbol,name:u.name,short:u.symbol,common:(common as readonly string[]).includes(u.symbol)}))
 })),
 {id:'number-base',name:'Number base',entry:'text',defaultFrom:'10',defaultTo:'16',
  units:Array.from({length:35},(_,i)=>{const base=i+2;return {id:String(base),name:`Base ${base}`,short:String(base),common:[2,8,10,16].includes(base)};})},
 {id:'data-formats',name:'Data formats',entry:'block',defaultFrom:'json',defaultTo:'yaml',units:[['json','JSON'],['csv','CSV'],['tsv','TSV'],['yaml','YAML'],['xml','XML']].map(([id,name])=>({id,name,short:id.toUpperCase(),common:true}))},
 {id:'text-formats',name:'Text formats',entry:'block',defaultFrom:'md',defaultTo:'html',units:[['txt','Plain text'],['md','Markdown'],['html','HTML']].map(([id,name])=>({id,name,short:id.toUpperCase(),common:true}))},
 {id:'image',name:'Image',entry:'file',defaultFrom:'png',defaultTo:'webp',units:[['png','PNG'],['jpg','JPG'],['webp','WebP'],['gif','GIF'],['bmp','BMP'],['svg','SVG']].map(([id,name])=>({id,name,short:id.toUpperCase(),common:['png','jpg','webp'].includes(id)}))}
];
