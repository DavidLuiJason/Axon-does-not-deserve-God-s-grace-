import { UNITS } from '../../../../tools/engines/numbers/unitConvert';
import type { Unit } from '../../../../tools/engines/numbers/unitConvert';
import { isGrammarWord, isCoordinator, isDeterminer } from '../closedSets';
import { HALF_WORD, PERCENT_WORDS } from '../valueWords';
import { isLetter, isSpace } from './charClass';
import type { ExtractedValue, ScanContext, UnitTable } from './types';
export type UnitWord = { ok: true; unit: string; symbol: string; category: string } | { ok: false; error: 'not-a-unit' };
type Match = { unit: Unit; end: number; symbol: boolean };
const all = (table: UnitTable): Unit[] => Object.values(table).flatMap(x => [...x]);
const variants = (name: string): string[] => {
  const out = [name];
  if (name.endsWith('oot')) out.push(name.slice(0,-3) + 'eet');
  if (name.endsWith('tre')) out.push(name.slice(0,-2) + 'er');
  if (name.endsWith('re')) out.push(name.slice(0,-2) + 'er');
  if (name.endsWith('er')) out.push(name.slice(0,-2) + 're');
  return out;
};
function pluralMatch(surface: string, name: string): boolean {
  return variants(name).some(v => surface === v || surface === v + 's' || surface === v + 'es' || (v.endsWith('oot') && surface === v.slice(0,-3) + 'eet'));
}
function matchName(surface: string, name: string): boolean {
  const a = surface.toLowerCase().split(' '), b = name.toLowerCase().split(' ');
  return a.length === b.length && a.every((w,i) => pluralMatch(w,b[i]!));
}
export function lookupUnitWord(word: string, units: UnitTable = UNITS): UnitWord {
  const u = all(units).find(x => matchName(word,x.name) || x.symbol === word);
  return u ? {ok:true,unit:u.name,symbol:u.symbol,category:u.category} : {ok:false,error:'not-a-unit'};
}
let cachedUnits: UnitTable | null = null;
let cachedList: Unit[] = [];
let indexedUnits = new Map<string, Unit[]>();
function indexUnits(units: Unit[]): Map<string, Unit[]> {
  const index = new Map<string, Unit[]>();
  for (const unit of units) {
    const initials = new Set([...variants(unit.name.toLowerCase()).map(v => v[0]), unit.symbol[0]?.toLowerCase()]);
    for (const initial of initials) if (initial) {
      const bucket = index.get(initial) ?? []; bucket.push(unit); index.set(initial, bucket);
    }
  }
  return index;
}
let initialsFor: UnitTable | null = null;
let initialsSet = new Set<string>();
function symbolInitials(units: UnitTable): Set<string> {
  if (initialsFor !== units) { initialsFor = units; initialsSet = new Set(Object.values(units).flatMap(group => group.map(u => u.symbol[0]).filter((c): c is string => !!c))); }
  return initialsSet;
}
function findAt(text: string, pos: number, limit: number, units: UnitTable, attached: boolean): Match | null {
  let best: Match | null = null;
  const first = text[pos];
  if (!first || (!isLetter(first) && !symbolInitials(units).has(first))) return null;
  const table = cachedUnits === units ? (indexedUnits.get(first.toLowerCase()) ?? []) : (indexUnits(all(units)).get(first.toLowerCase()) ?? []);
  for (const u of table) {
    for (const symbol of [false,true]) {
      if (symbol && !attached && u.symbol.length === 1) continue;
      const candidate = symbol ? u.symbol : u.name;
      if (pos + candidate.length > limit) continue;
      let end = pos + candidate.length;
      if (symbol) { if (text.slice(pos,end) !== candidate) continue; }
      else {
        let part = text.slice(pos,end);
        if (!matchName(part,candidate) || isLetter(text[end]??'')) {
          const tail = text.slice(pos, Math.min(limit,pos+candidate.length+3));
          let found = false;
          for (let n = candidate.length; n <= tail.length; n++) if (matchName(tail.slice(0,n),candidate) && (!isLetter(text[pos+n]??''))) { end=pos+n;found=true;break; }
          if (!found) continue;
        }
      }
      if (isLetter(text[end]??'')) continue;
      if (!best || end > best.end) best = {unit:u,end,symbol};
    }
  }
  if (best) return best;
  let end=pos; while(end<limit && isLetter(text[end]??'')) end++;
  const word=text.slice(pos,end).toLowerCase();
  if (!word) return null;
  const matches=table.filter(u => { const last=u.name.toLowerCase().split(' ').at(-1)!; return pluralMatch(word,last); });
  return matches.length===1 ? {unit:matches[0]!,end,symbol:false} : null;
}
export function readQuantities(ctx: ScanContext, found: ExtractedValue[]): ExtractedValue[] {
  cachedUnits=ctx.units;cachedList=all(ctx.units);indexedUnits=indexUnits(cachedList);
  const sorted=[...found].sort((a,b)=>a.start-b.start), out:ExtractedValue[]=[];
  const second=all(ctx.units).find(u=>u.category==='time' && u.factor===1);
  const milli=all(ctx.units).find(u=>u.category==='time' && u.factor!==undefined && u.factor<1);
  const scale=second && milli && milli.factor ? second.factor! * Math.pow(milli.factor,-1) : 0;
  const rangeEnd=(p:number)=>ctx.ranges.find(r=>p>=r.start&&p<r.end)?.end ?? -1;
  const make=(num:ExtractedValue,m:Match,end:number):ExtractedValue=>{
    const v:ExtractedValue={kind:m.unit.category==='time'?'duration':'quantity',text:ctx.text.slice(num.start,end),start:num.start,end,confidence:.9,reason:'number followed by a unit in the shared unit table',computed:true,value:num.value,unit:m.unit.name,unitSymbol:m.unit.symbol,category:m.unit.category,parts:[num]};
    if(v.kind==='duration') v.ms=(num.value??0)*(m.unit.factor??0)*scale;
    return v;
  };
  for(let i=0;i<sorted.length;i++) {
    const n=sorted[i]!;
    if(n.kind!=='number'||n.value===undefined||n.form==='ordinal') {out.push(n);continue;}
    const limit=rangeEnd(n.start); if(limit<0){out.push(n);continue;}
    let p=n.end;while(p<limit&&isSpace(ctx.text[p]!))p++;
    const attached=p===n.end;
    if(ctx.text[p]==='%') {out.push({kind:'percent',text:ctx.text.slice(n.start,p+1),start:n.start,end:p+1,confidence:.9,reason:'number followed by percent sign',computed:true,value:n.value,parts:[n]});continue;}
    const tail=ctx.text.slice(p,Math.min(limit,p+16)).toLowerCase();
    let percentEnd=0;
    if(PERCENT_WORDS.has(tail.split(' ')[0]!)) {
      if(tail.startsWith('percent')&&!isLetter(tail[7]??''))percentEnd=p+7;
      else if(tail.startsWith('per cent')&&!isLetter(tail[8]??''))percentEnd=p+8;
    }
    if(percentEnd){out.push({kind:'percent',text:ctx.text.slice(n.start,percentEnd),start:n.start,end:percentEnd,confidence:.9,reason:'number followed by percent words',computed:true,value:n.value,parts:[n]});continue;}
    let m=findAt(ctx.text,p,limit,ctx.units,attached);
    if(m && m.unit.category!=='time' && attached && out.length && out[out.length-1]!.kind==='duration' && out[out.length-1]!.end===n.start){const t=all(ctx.units).find(u=>u.category==='time' && u.symbol===ctx.text.slice(p,m!.end));if(t)m={unit:t,end:m.end,symbol:true};}
    if(!m){out.push(n);continue;}
    if(!attached && isGrammarWord(ctx.text.slice(p,m.end).toLowerCase())) {out.push({...n,alternatives:[...(n.alternatives??[]),{kind:'quantity',note:'unit reading is possible but this is a grammar word'}]});continue;}
    let v=make(n,m,m.end);
    if(v.kind==='duration'){
      const pieces=[v];let end=v.end;let j=i+1;
      while(j<sorted.length){const next=sorted[j]!;const between=ctx.text.slice(end,next.start).trim().toLowerCase();if(between && !(isCoordinator(between)&&between==='and'))break;
        if(next.start<end||next.start>=limit||next.kind!=='number'||next.value===undefined||next.form==='ordinal')break;
        let q=next.end;while(q<limit&&isSpace(ctx.text[q]!))q++;
        let mm=findAt(ctx.text,q,limit,ctx.units,q===next.end);if(mm && mm.unit.category!=='time' && q===next.end){const t=cachedList.find(u=>u.category==='time'&&u.symbol===ctx.text.slice(q,mm!.end));if(t)mm={unit:t,end:mm.end,symbol:true};}if(mm && mm.unit.category!=='time' && q===next.end && end===next.start) {
          const candidates=cachedList.filter(u=>u.category==='time' && u.name.toLowerCase().startsWith(ctx.text[q]!.toLowerCase()) && (u.factor??0)<(pieces[pieces.length-1]!.ms??0)/((pieces[pieces.length-1]!.value??1)*scale));
          candidates.sort((a,b)=>(b.factor??0)-(a.factor??0));
          if(candidates.length) mm={unit:candidates[0]!,end:q+1,symbol:true};
        }
        if(!mm||mm.unit.category!=='time')break;
        const part=make(next,mm,mm.end);pieces.push(part);end=part.end;j++;
      }
      if(pieces.length>1){v={kind:'duration',text:ctx.text.slice(n.start,end),start:n.start,end,confidence:.9,reason:'joined time-unit quantities',computed:true,ms:pieces.reduce((s,x)=>s+(x.ms??0),0),parts:pieces};i=j-1;}
    }
    out.push(v);
  }
  const timeUnits=all(ctx.units).filter(u=>u.category==='time');
  const extra:ExtractedValue[]=[];
  for(const r of ctx.ranges){
    for(let p=r.start;p<r.end;p++){
      if(p>r.start && isLetter(ctx.text[p-1]!))continue;
      const tail=ctx.text.slice(p,Math.min(r.end,p+32)).toLowerCase();
      const halfPrefix=HALF_WORD+' an ';
      const article=tail.startsWith('an ')?3:tail.startsWith('a ')?2:0;
      const half=tail.startsWith(halfPrefix);
      if(!article&&!half)continue;
      const startUnit=p+(half?halfPrefix.length:article);
      const m=findAt(ctx.text,startUnit,r.end,ctx.units,false);
      if(!m||m.unit.category!=='time'||m.symbol)continue;
      const factor=(m.unit.factor??0)*scale;
      const value=half?.5:1;
      let end=m.end,ms=value*factor;
      const suffix=' and a '+HALF_WORD;
      if(!half && ctx.text.slice(end,end+suffix.length).toLowerCase()===suffix){end+=suffix.length;ms+=factor*.5;}
      const special=m.unit.name===timeUnits.find(u=>u.factor===1)?.name && !half && end===m.end;
      const v:ExtractedValue={kind:'duration',text:ctx.text.slice(p,end),start:p,end,confidence:special?.4:.7,reason:'article or half followed by a full time unit name',computed:true,ms,parts:[]};
      if(special)v.alternatives=[{kind:'number',note:'the ordinal second'}];
      extra.push(v);p=end-1;
    }
  }
  const combined=[...out,...extra].sort((a,b)=>a.start-b.start||b.end-a.end);
  return combined.filter((v,i)=>!combined.some((other,j)=>i!==j&&other.start<=v.start&&other.end>=v.end&&(other.end-other.start>v.end-v.start)));
}
