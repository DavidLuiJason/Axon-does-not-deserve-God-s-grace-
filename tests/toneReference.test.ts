/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B03B3c TONE: independent reference test (Director, 2026-10-25). The builder's own runner and contract were not
 * returned, so this file holds a SECOND implementation written from the 18 rules, hand cases, and a seeded comparison.
 * 12 of 12 deliberate breakages of readTone.ts were caught by the comparison.
 */
import { readTone } from '../src/brain/mind/meaning/tone/readTone';
import type { ToneReading, ToneSignal, ToneWordFacts, MaterialRange, ToneSignalKind } from '../src/brain/mind/meaning/tone/toneTypes';
const ORD: ToneSignalKind[] = ['capitals','exclaim','question-run','stretched','repeat-word','urgent-word','anger-word','harsh-word'];
export function refTone(text:any, words:any, mats:any): ToneReading {
  const bad: ToneReading = {urgency:0,frustration:0,emphasis:0,aimedAtAxon:null,answerStyle:'normal',signals:[],doubts:[],changesActions:false};
  if (typeof text!=='string'||!Array.isArray(words)||!Array.isArray(mats)) return bad;
  const inM = new Array<boolean>(text.length).fill(false);
  for (const m of mats as MaterialRange[]) for (let i=Math.max(0,m.start); i<Math.min(text.length,m.end); i++) inM[i]=true;
  const sig: ToneSignal[] = [];
  const isL=(c:string)=>c.toLowerCase()!==c.toUpperCase();
  // text words
  const tw: {s:number;e:number}[] = [];
  for (let i=0;i<text.length;){ if(!inM[i]&&(isL(text[i])||text[i]==="'")){ let j=i; while(j<text.length&&!inM[j]&&(isL(text[j])||text[j]==="'")) j++; tw.push({s:i,e:j}); i=j;} else i++; }
  let loud=0,loudL=0,allL=0,fs=-1,le=-1;
  for (const w of tw){ const ls=[...text.slice(w.s,w.e)].filter(isL); if(ls.length<2) continue; allL+=ls.length; if(ls.every(c=>c===c.toUpperCase())){loud++;loudL+=ls.length; if(fs<0)fs=w.s; le=w.e;} }
  if(loud>=2&&loudL/allL>=0.6) sig.push({kind:'capitals',start:fs,end:le,text:text.slice(fs,le),weight:2});
  for (const ch of ['!','?']) for(let i=0;i<text.length;){ if(text[i]===ch&&!inM[i]){let j=i; while(j<text.length&&text[j]===ch&&!inM[j]) j++; if(j-i>=2) sig.push({kind:ch==='!'?'exclaim':'question-run',start:i,end:j,text:text.slice(i,j),weight:j-i>=3?2:1}); i=j;} else i++; }
  for (const w of tw){ let run=1,st=-1,en=-1; for(let i=w.s+1;i<w.e;i++){ const a=text[i],b=text[i-1]; if(isL(a)&&isL(b)&&a.toLowerCase()===b.toLowerCase()){run++; if(run>=3&&st<0){st=i-2;} if(run>=3) en=i+1;} else run=1; } if(st>=0){ // first stretch only
      let k=st; while(k+1<w.e&&isL(text[k+1])&&text[k+1].toLowerCase()===text[st].toLowerCase()) k++; sig.push({kind:'stretched',start:st,end:k+1,text:text.slice(st,k+1),weight:1}); } }
  const act=(words as ToneWordFacts[]).filter(w=>w&&!w.material);
  for(let i=0;i<act.length;){ let j=i+1; while(j<act.length&&act[j].norm===act[i].norm) j++; if(j-i>=3) sig.push({kind:'repeat-word',start:act[i].start,end:act[j-1].end,text:text.slice(act[i].start,act[j-1].end),weight:2}); i=j; }
  let negated=false,mat=false,aimed=false;
  for(let i=0;i<act.length;i++){ const w=act[i]; if(w.aboutAxon) aimed=true; const neg=[1,2,3].some(k=>i-k>=0&&act[i-k].negation);
    const add=(kind:ToneSignalKind,wt:1|2)=>{ if(neg) negated=true; else sig.push({kind,start:w.start,end:w.end,text:text.slice(w.start,w.end),weight:wt}); };
    if(w.urgent>0) add('urgent-word',w.urgent as 1|2); if(w.anger>0) add('anger-word',w.anger as 1|2); if(w.harsh) add('harsh-word',1); }
  for(const w of words as ToneWordFacts[]) if(w&&w.material&&(w.urgent>0||w.anger>0||w.harsh)) mat=true;
  sig.sort((a,b)=>a.start-b.start||ORD.indexOf(a.kind)-ORD.indexOf(b.kind));
  const E=['capitals','exclaim','question-run','stretched','repeat-word'];
  const emphasis=Math.min(3,sig.filter(s=>E.includes(s.kind)).reduce((a,s)=>a+s.weight,0)) as 0|1|2|3;
  const boost=emphasis>=2?1:0;
  const u=sig.filter(s=>s.kind==='urgent-word'); const f=sig.filter(s=>s.kind==='anger-word'||s.kind==='harsh-word');
  const urgency=(u.length?Math.min(3,Math.max(...u.map(s=>s.weight))+(u.length>=2?1:0)+boost):0) as 0|1|2|3;
  const frustration=(f.length?Math.min(3,Math.max(...f.map(s=>s.weight))+(f.length>=2?1:0)+boost):0) as 0|1|2|3;
  const aimedAtAxon=frustration>0&&aimed?true:null;
  const answerStyle=frustration>=1&&(aimedAtAxon===true||frustration>=2)?'calm':(urgency>=1||emphasis>=2)?'brief':'normal';
  const doubts:any[]=[]; if(negated)doubts.push('negated'); if(mat)doubts.push('material-only'); if(emphasis>=2&&urgency===0&&frustration===0)doubts.push('emphasis-only');
  return {urgency,frustration,emphasis,aimedAtAxon,answerStyle,signals:sig,doubts,changesActions:false} as ToneReading;
}

let failures = 0;
const check = (ok: boolean, name: string) => { if (!ok) { failures += 1; console.log('FAIL', name); } };
const hand = (t: string) => readTone(t, [], []);
check(hand('SET A TIMER').emphasis === 2 && hand('SET A TIMER').signals[0]?.kind === 'capitals', 'SET A TIMER is loud');
check(hand('convert PDF to PNG').emphasis === 0, 'convert PDF to PNG is not loud');
check(hand('I am OK').signals.length === 0, 'lone I and OK never loud');
check(hand('SET A TIMER!!!').urgency === 0 && hand('SET A TIMER!!!').answerStyle === 'brief', 'loud alone is not urgent, answer brief');
check(hand('hi!').signals.length === 0, 'single ! gives nothing');
check(hand('pleeease').signals[0]?.kind === 'stretched', 'stretched letters');
check(readTone(5 as unknown as string, [], []).answerStyle === 'normal', 'bad input');
check(hand('x').changesActions === false, 'changesActions false');
let seed=12345; const r=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const pick=<T,>(a:T[])=>a[Math.floor(r()*a.length)];
const alphabet=['a','b','A','B','E','e','!','?',' ',"'",'.','1','é','É','o','O','P','S'];
let bad=0, n=5000;
for(let tt=0;tt<n;tt++){
  const len=Math.floor(r()*40); let text=''; for(let i=0;i<len;i++) text+=pick(alphabet);
  const words:any[]=[]; for(let i=0;i<Math.floor(r()*6);i++){ const s=Math.floor(r()*(len+1)); const e=Math.min(len,s+1+Math.floor(r()*4)); words.push({start:s,end:e,norm:pick(['a','b','c']),urgent:pick([0,0,1,2]),anger:pick([0,0,1,2]),harsh:r()<0.2,negation:r()<0.2,aboutAxon:r()<0.2,material:r()<0.2}); }
  words.sort((a:any,b:any)=>a.start-b.start);
  const mats:any[]=[]; if(r()<0.4){const s=Math.floor(r()*(len+1)); mats.push({start:s,end:Math.min(len,s+Math.floor(r()*8))});}
  const a=JSON.stringify(readTone(text,words,mats)), b=JSON.stringify(refTone(text,words,mats));
  if(a!==b){bad++; if(bad<=5) console.log('DIFF',JSON.stringify(text),JSON.stringify(words),JSON.stringify(mats),'\n impl',a,'\n ref ',b);}
}
check(bad === 0, 'random comparison: ' + bad + ' differences in ' + n + ' cases');
// bad input + speed
check(JSON.stringify(readTone(5 as any,[],[]))===JSON.stringify(refTone(5,[],[])),'bad input equals reference');
const big='a'.repeat(100000)+'!'.repeat(100000); let t0=Date.now(); readTone(big,[],[]); check(Date.now()-t0 < 800, 'speed 200000 chars');
t0=Date.now(); readTone('SET A TIMER '.repeat(16000),[],[]); check(Date.now()-t0 < 800, 'speed repeated text');

if (failures > 0) { console.log('TONE REFERENCE FAILED:', failures); throw new Error('tone reference failed'); }
console.log('TONE REFERENCE OK');
