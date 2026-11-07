import { composeReply } from '../src/decision/composeReply';

let checks = 0;
function assert(condition: unknown, label: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), label);
}
function errorResult(input: unknown, expected: string, label: string): void {
  const r = composeReply(input);
  assert(!r.ok, `${label}: must fail`);
  if (!r.ok) {
    equal(r.error, expected, `${label}: error`);
    equal(r.message, 'Reply composer input is invalid.', `${label}: message`);
    assert(Object.isFrozen(r), `${label}: frozen error result`);
  }
}
function valueResult(input: unknown, expected: unknown, label: string): void {
  const r = composeReply(input);
  assert(r.ok, `${label}: must succeed`);
  if (r.ok) {
    equal(r.value, expected, `${label}: value and key order`);
    equal(Object.keys(r.value), ['text','answered','pending','held','waiting','failed'], `${label}: value key order`);
  }
}

const A: Array<{ name: string; pieces: unknown[]; expected: unknown }> = [
  { name:'M1', pieces:[{kind:'answered',own:'count words in "a b c"',text:'3 words'}], expected:{text:'3 words',answered:[0],pending:null,held:[],waiting:[],failed:[]} },
  { name:'M2', pieces:[{kind:'asks',own:'convert',question:'Which format?',holdLine:'later'}], expected:{text:'Which format?',answered:[],pending:0,held:[],waiting:[],failed:[]} },
  { name:'M3', pieces:[{kind:'waits',own:'plan a trip',line:'This needs deeper thought.'}], expected:{text:'This needs deeper thought.',answered:[],pending:null,held:[],waiting:[0],failed:[]} },
  { name:'M4', pieces:[{kind:'failed',own:'sort x',line:'The sort tool refused: empty text.',reason:'tool refused'}], expected:{text:'The sort tool refused: empty text.',answered:[],pending:null,held:[],waiting:[],failed:[0]} },
  { name:'M5', pieces:[{kind:'answered',own:'count words',text:'3 words'},{kind:'answered',own:'count lines',text:'1 line'}], expected:{text:'count words: 3 words\n\ncount lines: 1 line',answered:[0,1],pending:null,held:[],waiting:[],failed:[]} },
  { name:'M6', pieces:[{kind:'asks',own:'convert hi',question:'To which case?',holdLine:'I will ask about the case next.'},{kind:'answered',own:'count words',text:'3 words'}], expected:{text:'count words: 3 words\n\nconvert hi: To which case?',answered:[1],pending:0,held:[],waiting:[],failed:[]} },
  { name:'M7', pieces:[{kind:'answered',own:'a',text:'1'},{kind:'waits',own:'b',line:'waits'},{kind:'failed',own:'c',line:'failed line',reason:'tool refused'}], expected:{text:'a: 1\n\nb: waits\n\nc: failed line',answered:[0],pending:null,held:[],waiting:[1],failed:[2]} },
  { name:'M8', pieces:[{kind:'waits',own:'b',line:'waits'},{kind:'answered',own:'a',text:'1'}], expected:{text:'a: 1\n\nb: waits',answered:[1],pending:null,held:[],waiting:[0],failed:[]} },
  { name:'M9', pieces:[{kind:'asks',own:'p',question:'Q-p?',holdLine:'H-p'},{kind:'asks',own:'q',question:'Q-q?',holdLine:'H-q'}], expected:{text:'p: Q-p?\n\nq: H-q',answered:[],pending:0,held:[1],waiting:[],failed:[]} },
  { name:'M10', pieces:[{kind:'answered',own:'a',text:'1'},{kind:'asks',own:'p',question:'Q-p?',holdLine:'H-p'},{kind:'waits',own:'w',line:'W-w'},{kind:'asks',own:'q',question:'Q-q?',holdLine:'H-q'},{kind:'failed',own:'x',line:'X-x',reason:'tool refused'}], expected:{text:'a: 1\n\np: Q-p?\n\nq: H-q\n\nw: W-w\n\nx: X-x',answered:[0],pending:1,held:[3],waiting:[2],failed:[4]} },
  { name:'M11', pieces:[{kind:'waits',own:'w1',line:'L1'},{kind:'waits',own:'w2',line:'L2'},{kind:'waits',own:'w3',line:'L3'}], expected:{text:'w1: L1\n\nw2: L2\n\nw3: L3',answered:[],pending:null,held:[],waiting:[0,1,2],failed:[]} },
  { name:'M12', pieces:[{kind:'answered',own:'a',text:'x'},{kind:'answered',own:'b',text:'y'},{kind:'answered',own:'c',text:'z'}], expected:{text:'a: x\n\nb: y\n\nc: z',answered:[0,1,2],pending:null,held:[],waiting:[],failed:[]} },
  { name:'M13', pieces:[{kind:'answered',own:'one',text:'multi\nline answer'},{kind:'answered',own:'two',text:'2'}], expected:{text:'one: multi\nline answer\n\ntwo: 2',answered:[0,1],pending:null,held:[],waiting:[],failed:[]} },
  { name:'M14', pieces:[{kind:'failed',own:'a',line:'F',reason:'r1'},{kind:'failed',own:'b',line:'G',reason:'r2'}], expected:{text:'a: F\n\nb: G',answered:[],pending:null,held:[],waiting:[],failed:[0,1]} }
];
for (const row of A) valueResult({pieces:row.pieces}, row.expected, row.name);

const one = {kind:'answered',own:'a',text:'b'};
errorResult(null,'bad-input','C1 null');
errorResult(undefined,'bad-input','C1 undefined');
errorResult([],'bad-input','C1 array');
errorResult('x','bad-input','C1 primitive');
errorResult({},'unknown-key','C2 missing pieces');
errorResult({pieces:[],extra:true},'unknown-key','C2 extra key');
const symbolRoot = {pieces:[]}; Object.defineProperty(symbolRoot, Symbol('extra'), {value:1});
errorResult(symbolRoot,'unknown-key','C2 symbol key');
errorResult({pieces:null},'bad-pieces','C3 non-array pieces');
errorResult({pieces:[]},'bad-pieces','C3 empty pieces');
errorResult({pieces:[{kind:'unknown',own:'a'}]},'bad-pieces','C3 unknown kind');
errorResult({pieces:[null]},'bad-pieces','C3 null piece');
errorResult({pieces:['x']},'bad-pieces','C3 primitive piece');
errorResult({pieces:[{kind:'answered',own:'a',text:'b',extra:1}]},'bad-pieces','C3 extra piece key');
errorResult({pieces:[{kind:'answered',own:'a'}]},'bad-pieces','C3 missing piece key');
errorResult({pieces:[{kind:'answered',own:'a',text:3}]},'bad-pieces','C3 non-string');
errorResult({pieces:[{kind:'answered',own:'a',text:''}]},'bad-pieces','C3 empty string');
errorResult({pieces:[{kind:'answered',own:' a',text:'b'}]},'bad-pieces','C3 leading space');
errorResult({pieces:[{kind:'answered',own:'a ',text:'b'}]},'bad-pieces','C3 trailing space');
errorResult({pieces:[{kind:'answered',own:'a\n',text:'b'}]},'bad-pieces','C3 trailing newline');
errorResult({pieces:[{kind:'waits',own:'a',line:'b',reason:'extra'}]},'bad-pieces','C3 waits reason key');
errorResult({pieces:[{kind:'asks',own:'a',question:'q'}]},'bad-pieces','C3 asks missing holdLine');
const seven = Array.from({length:7},(_,i)=>({kind:'answered',own:`o${i}`,text:`t${i}`}));
errorResult({pieces:seven},'too-many-pieces','C4 seven valid');
const sevenBad = seven.slice(); sevenBad[3] = {kind:'answered',own:'',text:'t3'};
errorResult({pieces:sevenBad},'bad-pieces','C3 invalid beats cap');
const six = seven.slice(0,6);
const sixResult = composeReply({pieces:six});
assert(sixResult.ok,'C4 six valid accepted');
const throwing: Record<string, unknown> = {};
Object.defineProperty(throwing,'pieces',{enumerable:true, configurable:true, get(){throw new Error('getter');}});
errorResult(throwing,'bad-input','C1 throwing pieces getter');
const throwingPiece = {kind:'answered',own:'a',get text(){throw new Error('getter');}};
errorResult({pieces:[throwingPiece]},'bad-input','C1 throwing piece getter');
const symbolPiece: Record<PropertyKey, unknown> = {kind:'waits',own:'a',line:'b'};
symbolPiece[Symbol('x')] = 1;
errorResult({pieces:[symbolPiece]},'bad-pieces','C3 piece symbol key');
errorResult({pieces:[{kind:'failed',own:'a',line:'b',reason:' r'}]},'bad-pieces','C3 whitespace edge');
errorResult({pieces:[{kind:'answered',own:'a\t',text:'b'}]},'bad-pieces','C3 tab edge');

const inputSnapshot = JSON.stringify({pieces:[{kind:'answered',own:'keep',text:'same'},{kind:'failed',own:'also',line:'line',reason:'secret'}]});
const unchangedInput = {pieces:[{kind:'answered',own:'keep',text:'same'},{kind:'failed',own:'also',line:'line',reason:'secret'}]};
const before = JSON.stringify(unchangedInput);
const frozenResult = composeReply(unchangedInput);
assert(frozenResult.ok,'freeze success result');
if (frozenResult.ok) {
  assert(Object.isFrozen(frozenResult),'success result frozen');
  assert(Object.isFrozen(frozenResult.value),'value frozen');
  assert(Object.isFrozen(frozenResult.value.answered),'answered frozen');
  assert(Object.isFrozen(frozenResult.value.held),'held frozen');
  assert(Object.isFrozen(frozenResult.value.waiting),'waiting frozen');
  assert(Object.isFrozen(frozenResult.value.failed),'failed frozen');
}
equal(JSON.stringify(unchangedInput),before,'input unchanged');
equal(JSON.stringify({pieces:[{kind:'answered',own:'keep',text:'same'},{kind:'failed',own:'also',line:'line',reason:'secret'}]}),inputSnapshot,'input snapshot stable');

let seed = 0x51a7c0de;
function random(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
const kinds = ['answered','asks','waits','failed'] as const;
for (let sample = 0; sample < 2000; sample += 1) {
  const count = 1 + Math.floor(random() * 6);
  const pieces: Array<Record<string,string>> = [];
  for (let i = 0; i < count; i += 1) {
    const kind = kinds[Math.floor(random() * kinds.length)];
    const own = `own_${sample}_${i}`;
    if (kind === 'answered') pieces.push({kind,own,text:`text_${sample}_${i}`});
    else if (kind === 'asks') pieces.push({kind,own,question:`question_${sample}_${i}`,holdLine:`hold_${sample}_${i}`});
    else if (kind === 'waits') pieces.push({kind,own,line:`wait_${sample}_${i}`});
    else pieces.push({kind,own,line:`fail_${sample}_${i}`,reason:`reason_${sample}_${i}`});
  }
  const r = composeReply({pieces});
  assert(r.ok,`sweep ${sample}: valid`);
  if (!r.ok) continue;
  const v = r.value;
  const expAnswered = pieces.flatMap((p,i)=>p.kind==='answered'?[i]:[]);
  const expAsks = pieces.flatMap((p,i)=>p.kind==='asks'?[i]:[]);
  const expHeld = expAsks.slice(1);
  const expWaiting = pieces.flatMap((p,i)=>p.kind==='waits'?[i]:[]);
  const expFailed = pieces.flatMap((p,i)=>p.kind==='failed'?[i]:[]);
  equal(v.answered,expAnswered,`sweep ${sample}: answered positions`);
  equal(v.pending,expAsks.length ? expAsks[0] : null,`sweep ${sample}: pending`);
  equal(v.held,expHeld,`sweep ${sample}: held positions`);
  equal(v.waiting,expWaiting,`sweep ${sample}: waiting positions`);
  equal(v.failed,expFailed,`sweep ${sample}: failed positions`);
  const memberships = new Array(count).fill(0);
  for (const i of v.answered) memberships[i] += 1;
  if (v.pending !== null) memberships[v.pending] += 1;
  for (const i of v.held) memberships[i] += 1;
  for (const i of v.waiting) memberships[i] += 1;
  for (const i of v.failed) memberships[i] += 1;
  assert(memberships.every(n=>n===1),`sweep ${sample}: every part exactly once`);
  let residue = v.text;
  for (const p of pieces) {
    residue = residue.split(p.own).join('');
    for (const [key,val] of Object.entries(p)) if (key !== 'kind' && key !== 'own' && key !== 'reason') residue = residue.split(val).join('');
    if (count >= 2) assert(v.text.includes(p.own),`sweep ${sample}: own echoed`);
  }
  assert(Array.from(residue).every(ch=>ch===':' || ch===' ' || ch==='\n'),`sweep ${sample}: no added words`);
  const firstQuestion = expAsks.length ? `question_${sample}_${expAsks[0]}` : null;
  const firstWait = [...expWaiting,...expFailed].sort((a,b)=>a-b)[0];
  if (expAnswered.length && firstQuestion) assert(v.text.indexOf(`text_${sample}_${expAnswered[0]}`) < v.text.indexOf(firstQuestion),`sweep ${sample}: answer before question`);
  if (firstQuestion !== null && firstWait !== undefined) assert(v.text.indexOf(firstQuestion) < v.text.indexOf(pieces[firstWait].line),`sweep ${sample}: question before waiting/failed`);
}
console.log(`COMPOSE_REPLY OK: ${checks} checks`);
