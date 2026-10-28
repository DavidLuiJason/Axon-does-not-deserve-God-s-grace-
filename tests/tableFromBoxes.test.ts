const assert = { ok(value: unknown, message?: string) { if (!value) throw new Error(message ?? 'assertion failed'); }, deepEqual(a: unknown, b: unknown, message?: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(message ?? `not equal: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); } };
import { boxesToTable, tableToCsv, tableToMarkdown, TABLE_LIMITS, PICTURE_TO_TABLE_DESCRIPTOR } from '../src/tools/engines/images/tableFromBoxes';
import { parseCsv } from '../src/tools/engines/data/csv';
let checks = 0;
function check(condition: unknown, message: string): asserts condition { checks++; assert.ok(condition, message); }
function same(a: unknown, b: unknown, message: string): void { checks++; assert.deepEqual(a, b, message); }
function box(text: string, x: number, y: number, w = Math.max(8, text.length * 7), h = 20, confidence?: number) { return { text, x, y, w, h, ...(confidence === undefined ? {} : { confidence }) }; }
function grid(data: string[][], jitter = 0, seed = 1): any[] {
 let state = seed >>> 0; const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
 const out: any[] = [], cols = data[0].length, rowStep = 100, colStep = 240;
 for (let r = 0; r < data.length; r++) for (let c = 0; c < cols; c++) {
  const text = data[r][c]; if (!text) continue;
  const h = 10 + Math.floor(rand() * 51), w = Math.max(12, text.length * 7);
  const x = c * colStep + (text.match(/^\d/) ? colStep - w - 15 : 10);
  const y = r * rowStep + 20 + (rand() * 2 - 1) * h * jitter;
  out.push(box(text, x, y, w, h));
 }
 return out;
}
// Known answers, derived from explicit coordinates and expected geometric grouping.
{
 const input = [box('Name', 10, 10), box('Age', 210, 10), box('City', 410, 10), box('Ada', 10, 60), box('36', 210, 60), box('Lagos', 410, 60), box('Ben', 10, 110), box('29', 210, 110), box('Abuja', 410, 110)];
 const r = boxesToTable(input); check(r.ok, '3x3 table accepted'); if (r.ok) same(r.rows, [['Name','Age','City'],['Ada','36','Lagos'],['Ben','29','Abuja']], '3x3 exact answer');
 const empty = boxesToTable([box('A',10,10),box('C',410,10),box('D',10,60),box('E',210,60),box('F',410,60)]);
 check(empty.ok, 'empty middle cell table accepted'); if (empty.ok) same(empty.rows[0], ['A','','C'], 'empty middle cell retained');
 const twoWord = boxesToTable([box('Annual',10,10),box('Report',65,10),box('Value',210,10),box('Year',410,10),box('Revenue',10,60),box('12',210,60),box('2026',410,60),box('Cost',10,110),box('5',210,110),box('2025',410,110)]);
 check(twoWord.ok, 'two-word header table accepted'); if (twoWord.ok) check(twoWord.rows[0][0] === 'Annual Report', 'two-word header merged');
 const oneCol = boxesToTable([box('A',10,10),box('B',10,60),box('C',10,110),box('D',10,160)]); check(oneCol.ok === false && oneCol.error === 'not-a-table', 'single column refused');
 const oneLine = boxesToTable([box('A',10,10),box('B',210,10),box('C',410,10),box('D',610,10)]); check(oneLine.ok === false && oneLine.error === 'not-a-table', 'single line refused');
 const tilt = boxesToTable([box('A',10,10),box('B',160,18),box('C',10,70),box('D',160,78),box('E',10,130),box('F',160,138)]); check(tilt.ok && tilt.warnings.some(w => w.includes('tilted')), '3 degree tilt warning');
}
{
 const low = boxesToTable([box('A',10,10,20,20,.2),box('B',210,10),box('C',10,60),box('D',210,60)]);
 check(low.ok && low.uncertain.some(p => p.row === 0 && p.column === 0), 'low confidence marks exact cell and is retained');
}
// Deterministic 300-case synthetic reconstruction. Empty cells are inferred from established columns.
{
 let state = 0xC2602026; const rand = () => { state = (Math.imul(state,1664525)+1013904223) >>> 0; return state / 4294967296; };
 let exact10 = 0, exact15 = 0, exact25 = 0, notTable15 = 0, notTable25 = 0, unexplained15 = 0, unexplained25 = 0;
 for (let k=0;k<300;k++) {
  const nr=2+Math.floor(rand()*29), nc=2+Math.floor(rand()*11), expected: string[][]=[];
  for(let r=0;r<nr;r++){ const row:string[]=[]; for(let c=0;c<nc;c++){ if(rand()<.12) row.push(''); else { const words=1+Math.floor(rand()*4); row.push(Array.from({length:words},()=>`w${Math.floor(rand()*1000)}`).join(' ')); } } expected.push(row); }
  // Ensure each column is represented somewhere, and avoid degenerate all-empty rows.
  for(let c=0;c<nc;c++) if(expected.every(row=>!row[c])) expected[c%nr][c]='seed'+c;
  for(let r=0;r<nr;r++) if(expected[r].every(v=>!v)) expected[r][r%nc]='row'+r;
  const base = grid(expected, .10, k+99), result = boxesToTable(base);
  if(result.ok && JSON.stringify(result.rows)===JSON.stringify(expected)) exact10++;
  const a15=boxesToTable(grid(expected,.15,k+99)); if(a15.ok && JSON.stringify(a15.rows)===JSON.stringify(expected)) exact15++; else if(a15.ok===false&&a15.error==='not-a-table') notTable15++; else if(a15.ok && a15.warnings.length===0) unexplained15++;
  const a25=boxesToTable(grid(expected,.25,k+99)); if(a25.ok && JSON.stringify(a25.rows)===JSON.stringify(expected)) exact25++; else if(a25.ok===false&&a25.error==='not-a-table') notTable25++; else if(a25.ok && a25.warnings.length===0) unexplained25++;
 }
 console.log(`synthetic: 10% exact ${exact10}/300; 15% exact ${exact15}/300 (not-a-table ${notTable15}, inaccurate without warning ${unexplained15}); 25% exact ${exact25}/300 (not-a-table ${notTable25}, inaccurate without warning ${unexplained25})`);
 check(exact10===300, '10% jitter must rebuild every seeded table exactly');
 check(unexplained15===0 && unexplained25===0, 'inaccurate high-jitter reconstructions must warn or refuse');
}
// CSV and Markdown hostile strings; independent round-trip uses repo parseCsv.
{
 let state=0xC26BEEF; const rand=()=>{state=(Math.imul(state,1103515245)+12345)>>>0;return state/4294967296;};
 const hostile=['comma,here','say "hi"','line\nbreak','pipe|here','emoji 🧪','مرحبا','עברית',' leading','trailing ','x'.repeat(500),''];
 for(let k=0;k<200;k++){
  const nr=2+Math.floor(rand()*8), nc=2+Math.floor(rand()*6), rows=Array.from({length:nr},()=>Array.from({length:nc},()=>hostile[Math.floor(rand()*hostile.length)]));
  const csv=tableToCsv(rows); check(csv.ok,`CSV write ${k}`); if(csv.ok){ const parsed=parseCsv(csv.text,{delimiter:',',header:false}); check(parsed.ok,`CSV parse ${k}`); if(parsed.ok) same(parsed.rows,rows,`CSV round trip ${k}`); }
  const md=tableToMarkdown(rows); check(md.ok,`Markdown write ${k}`); if(md.ok){ const lines=md.text.split('\n'); check(lines.every(line=>{ let n=0; for(let i=0;i<line.length;i++) if(line[i]==='|' && (i===0 || line[i-1] !== '\\')) n++; return n===nc+1; }),`Markdown width ${k}`); }
 }
 const ragged=tableToMarkdown([['h1','h2','h3'],['only-one']]); check(ragged.ok, 'ragged Markdown accepted'); if(ragged.ok) check(ragged.text.split('\n').every(line=>{ let n=0; for(let i=0;i<line.length;i++) if(line[i]==='|' && (i===0 || line[i-1] !== '\\')) n++; return n===4; }), 'ragged Markdown rows padded to same width');
 const empty=tableToMarkdown([]); check(!empty.ok, 'empty Markdown typed error');
}
// Validation and bounded failure cases must return errors, never throw.
{
 const good=[box('A',0,0),box('B',200,0),box('C',0,60),box('D',200,60)];
 for(const bad of [null,{},[...good,{...good[0],x:NaN}],[...good,{...good[0],x:Infinity}],[...good,{...good[0],x:'bad'}],[...good,{...good[0],w:0}],[...good,{...good[0],h:-1}],[...good,{...good[0],text:''}],[...good,{...good[0],text:' '.repeat(2)}],[...good,{...good[0],text:'x'.repeat(501)}],[...good,{...good[0],confidence:2}],[...good,42]]){ const r=boxesToTable(bad as any); check(r.ok === false&&r.error==='invalid-input','invalid input typed error'); }
 check((boxesToTable(Array(5001).fill(good[0])) as any).error==='too-many-boxes','box cap');
 check((boxesToTable(good,{cellGapFactor:-1}) as any).error==='invalid-input','negative gap factor');
 check((boxesToTable(good,{rowOverlap:2}) as any).error==='invalid-input','row overlap range');
 check((boxesToTable(good,{minConfidence:2}) as any).error==='invalid-input','confidence range');
 check((boxesToTable([]) as any).error==='too-few-boxes','too few boxes');
 check((tableToCsv([[1]] as any) as any).ok===false,'non-text CSV input refused');
}
// Speed measurement for 5,000 bounded boxes.
{
 const boxes:any[]=[]; for(let r=0;r<100;r++) for(let c=0;c<50;c++) boxes.push(box(`v${r}_${c}`,c*200,r*40,35,20));
 const start=performance.now(); const result=boxesToTable(boxes); const elapsed=performance.now()-start;
 console.log(`speed: 5000 boxes ${elapsed.toFixed(2)} ms; result ${result.ok ? 'ok' : (result as any).error}`);
 check(elapsed<200, '5000 boxes under 200ms');
}
check(TABLE_LIMITS.maxBoxes===5000 && PICTURE_TO_TABLE_DESCRIPTOR.toolId==='picture-to-table','limits and descriptor');
console.log(`tableFromBoxes: PASS (${checks} checks)`);
