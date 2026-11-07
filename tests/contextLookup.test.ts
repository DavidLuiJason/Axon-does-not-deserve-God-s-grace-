import { lookupContext } from '../src/decision/contextLookup';
import { makeActOrAskInput } from '../src/decision/actOrAskFeed';

let checks = 0;
function assert(condition: unknown, label: string): asserts condition {
  checks += 1;
  if (!condition) throw new Error(`FAIL ${label}`);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), label);
}
function resultError(input: unknown): string | undefined {
  const r = lookupContext(input);
  return r.ok ? undefined : r.error;
}
function errorResult(input: unknown, error: string, label: string): void {
  const r = lookupContext(input);
  assert(!r.ok, `${label}: failure`);
  if (!r.ok) {
    equal(r.error, error, `${label}: code`);
    equal(r.message, 'Context lookup input is invalid.', `${label}: message`);
    assert(Object.isFrozen(r), `${label}: frozen error`);
  }
}
const cases = [{"id":"C1","missing":[],"items":[],"expected":{"contextFills":[],"safeStepFills":[],"trace":[]}},{"id":"C2","missing":[{"slot":"t","kind":"text"}],"items":[],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}},{"id":"C3","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"a1","source":"answer","kind":"text","slot":"t"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R1","itemId":"a1","reason":"ok"}]}},{"id":"C4","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"a1","source":"answer","kind":"number","slot":"t"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}},{"id":"C5","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"a1","source":"answer","kind":"text","slot":"u"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}},{"id":"C6","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"a1","source":"answer","kind":"text","slot":"t"},{"id":"a2","source":"answer","kind":"text","slot":"t"},{"id":"s1","source":"selected","kind":"text"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"R1","itemId":null,"reason":"ambiguous"}]}},{"id":"C7","missing":[{"slot":"c","kind":"choice"}],"items":[{"id":"a1","source":"answer","kind":"choice","slot":"c"}],"expected":{"contextFills":["c"],"safeStepFills":[],"trace":[{"slot":"c","outcome":"context","rule":"R1","itemId":"a1","reason":"ok"}]}},{"id":"C8","missing":[{"slot":"c","kind":"choice"}],"items":[{"id":"s1","source":"selected","kind":"choice"},{"id":"p1","source":"previous-reference","kind":"choice"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"c","outcome":"not-filled","rule":"R0","itemId":null,"reason":"decision-slot"}]}},{"id":"C9","missing":[{"slot":"y","kind":"yes-no"}],"items":[{"id":"s1","source":"selected","kind":"yes-no"},{"id":"a1","source":"answer","kind":"text","slot":"y"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"y","outcome":"not-filled","rule":"R0","itemId":null,"reason":"decision-slot"}]}},{"id":"C10","missing":[{"slot":"c","kind":"choice"}],"items":[{"id":"a1","source":"answer","kind":"choice","slot":"c"},{"id":"a2","source":"answer","kind":"choice","slot":"c"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"c","outcome":"not-filled","rule":"R1","itemId":null,"reason":"ambiguous"}]}},{"id":"C11","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"s1","source":"selected","kind":"text"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R2","itemId":"s1","reason":"ok"}]}},{"id":"C12","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"s1","source":"selected","kind":"text"},{"id":"s2","source":"selected","kind":"text"},{"id":"x1","source":"attached","kind":"text"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"R2","itemId":null,"reason":"ambiguous"}]}},{"id":"C13","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"s1","source":"selected","kind":"number"},{"id":"x1","source":"attached","kind":"text"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R3","itemId":"x1","reason":"ok"}]}},{"id":"C14","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"x1","source":"attached","kind":"text"},{"id":"x2","source":"attached","kind":"text"},{"id":"p1","source":"previous-reference","kind":"text"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"R3","itemId":null,"reason":"ambiguous"}]}},{"id":"C15","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"p1","source":"previous-reference","kind":"text"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R4","itemId":"p1","reason":"ok"}]}},{"id":"C16","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"p1","source":"previous-reference","kind":"text"},{"id":"p2","source":"previous-reference","kind":"text"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"R4","itemId":null,"reason":"ambiguous"}]}},{"id":"C17","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"p1","source":"previous-reference","kind":"text"},{"id":"x1","source":"attached","kind":"text"},{"id":"s1","source":"selected","kind":"text"},{"id":"a1","source":"answer","kind":"text","slot":"t"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R1","itemId":"a1","reason":"ok"}]}},{"id":"C18","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"p1","source":"previous-reference","kind":"text"},{"id":"x1","source":"attached","kind":"text"},{"id":"s1","source":"selected","kind":"text"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R2","itemId":"s1","reason":"ok"}]}},{"id":"C19","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":true}],"expected":{"contextFills":[],"safeStepFills":["t"],"trace":[{"slot":"t","outcome":"safe-step","rule":"R5","itemId":"f1","reason":"ok"}]}},{"id":"C20","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":true},{"id":"f2","source":"attached","kind":"file","readable":true}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"R5","itemId":null,"reason":"ambiguous"}]}},{"id":"C20b","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":false},{"id":"f2","source":"attached","kind":"file","readable":true}],"expected":{"contextFills":[],"safeStepFills":["t"],"trace":[{"slot":"t","outcome":"safe-step","rule":"R5","itemId":"f2","reason":"ok"}]}},{"id":"C21","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":false}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}},{"id":"C22","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":true},{"id":"x1","source":"attached","kind":"text"}],"expected":{"contextFills":["t"],"safeStepFills":[],"trace":[{"slot":"t","outcome":"context","rule":"R3","itemId":"x1","reason":"ok"}]}},{"id":"C23","missing":[{"slot":"n","kind":"number"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":true}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"n","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}},{"id":"C23b","missing":[{"slot":"t","kind":"text"}],"items":[{"id":"s1","source":"selected","kind":"file"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"t","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}},{"id":"C24","missing":[{"slot":"f","kind":"file"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":false}],"expected":{"contextFills":["f"],"safeStepFills":[],"trace":[{"slot":"f","outcome":"context","rule":"R3","itemId":"f1","reason":"ok"}]}},{"id":"C25","missing":[{"slot":"f","kind":"file"}],"items":[{"id":"s1","source":"selected","kind":"file"}],"expected":{"contextFills":["f"],"safeStepFills":[],"trace":[{"slot":"f","outcome":"context","rule":"R2","itemId":"s1","reason":"ok"}]}},{"id":"C26","missing":[{"slot":"n","kind":"number"}],"items":[{"id":"s1","source":"selected","kind":"number"}],"expected":{"contextFills":["n"],"safeStepFills":[],"trace":[{"slot":"n","outcome":"context","rule":"R2","itemId":"s1","reason":"ok"}]}},{"id":"C27a","missing":[{"slot":"q","kind":"duration"}],"items":[{"id":"p1","source":"previous-reference","kind":"duration"}],"expected":{"contextFills":["q"],"safeStepFills":[],"trace":[{"slot":"q","outcome":"context","rule":"R4","itemId":"p1","reason":"ok"}]}},{"id":"C27b","missing":[{"slot":"q","kind":"time"}],"items":[{"id":"p1","source":"previous-reference","kind":"time"}],"expected":{"contextFills":["q"],"safeStepFills":[],"trace":[{"slot":"q","outcome":"context","rule":"R4","itemId":"p1","reason":"ok"}]}},{"id":"C27c","missing":[{"slot":"q","kind":"date"}],"items":[{"id":"p1","source":"previous-reference","kind":"date"}],"expected":{"contextFills":["q"],"safeStepFills":[],"trace":[{"slot":"q","outcome":"context","rule":"R4","itemId":"p1","reason":"ok"}]}},{"id":"C28","missing":[{"slot":"f1","kind":"file"},{"slot":"f2","kind":"file"}],"items":[{"id":"x","source":"attached","kind":"file","readable":true}],"expected":{"contextFills":["f1","f2"],"safeStepFills":[],"trace":[{"slot":"f1","outcome":"context","rule":"R3","itemId":"x","reason":"ok"},{"slot":"f2","outcome":"context","rule":"R3","itemId":"x","reason":"ok"}]}},{"id":"C29","missing":[{"slot":"a","kind":"choice"},{"slot":"b","kind":"text"},{"slot":"c","kind":"text"},{"slot":"d","kind":"number"}],"items":[{"id":"s1","source":"selected","kind":"text"},{"id":"f1","source":"attached","kind":"file","readable":true},{"id":"s2","source":"selected","kind":"number"},{"id":"a1","source":"answer","kind":"choice","slot":"a"}],"expected":{"contextFills":["a","b","c","d"],"safeStepFills":[],"trace":[{"slot":"a","outcome":"context","rule":"R1","itemId":"a1","reason":"ok"},{"slot":"b","outcome":"context","rule":"R2","itemId":"s1","reason":"ok"},{"slot":"c","outcome":"context","rule":"R2","itemId":"s1","reason":"ok"},{"slot":"d","outcome":"context","rule":"R2","itemId":"s2","reason":"ok"}]}},{"id":"C29b","missing":[{"slot":"b","kind":"text"},{"slot":"c","kind":"text"}],"items":[{"id":"f1","source":"attached","kind":"file","readable":true}],"expected":{"contextFills":[],"safeStepFills":["b","c"],"trace":[{"slot":"b","outcome":"safe-step","rule":"R5","itemId":"f1","reason":"ok"},{"slot":"c","outcome":"safe-step","rule":"R5","itemId":"f1","reason":"ok"}]}},{"id":"C30","missing":[{"slot":"z","kind":"text"}],"items":[{"id":"p1","source":"previous-reference","kind":"file"}],"expected":{"contextFills":[],"safeStepFills":[],"trace":[{"slot":"z","outcome":"not-filled","rule":"none","itemId":null,"reason":"no-candidate"}]}}] as Array<{id:string;missing:unknown;items:unknown;expected:unknown}>;
for (const row of cases) {
  const r = lookupContext({ missing: row.missing, items: row.items });
  assert(r.ok, `${row.id}: success`);
  if (r.ok) equal(r.value, row.expected, `${row.id}: exact value and key order`);
}

// Caps: exact boundary passes, one over fails; all sources full together passes.
const selected = (n:number) => Array.from({length:n},(_,i)=>({id:`s${i}`,source:'selected',kind:'text'}));
const attached = (n:number) => Array.from({length:n},(_,i)=>({id:`a${i}`,source:'attached',kind:'text'}));
const previous = (n:number) => Array.from({length:n},(_,i)=>({id:`p${i}`,source:'previous-reference',kind:'text'}));
const answers = (n:number) => Array.from({length:n},(_,i)=>({id:`r${i}`,source:'answer',kind:'text',slot:`slot${i}`}));
for (const [label, good, bad] of [
  ['K1',selected(4),selected(5)], ['K2',attached(8),attached(9)],
  ['K3',previous(8),previous(9)], ['K4',answers(8),answers(9)]
] as Array<[string,unknown[],unknown[]]>) {
  assert(lookupContext({missing:[],items:good}).ok, `${label}: cap passes`);
  errorResult({missing:[],items:bad},'too-many-items',`${label}: one over`);
}
assert(lookupContext({missing:[],items:[...selected(4),...attached(8),...previous(8),...answers(8)]}).ok,'K5 all caps');

// Error order and malformed-input coverage from cases section C.
for (const value of [5,null,[],'x']) errorResult(value,'bad-input','C1 non-object');
errorResult({missing:[]},'unknown-key','C2 missing key');
errorResult({missing:[],items:[],extra:true},'unknown-key','C2 extra key');
const sym = Symbol('extra');
const symbolInput = {missing:[],items:[]} as Record<PropertyKey,unknown>;
symbolInput[sym] = true;
errorResult(symbolInput,'unknown-key','C2 symbol key');
const getterExtra = {missing:[],items:[]} as Record<string,unknown>;
Object.defineProperty(getterExtra,'extra',{enumerable:true,get(){return 1;}});
errorResult(getterExtra,'unknown-key','C2 getter key');
errorResult({missing:5,items:5},'bad-missing','C order missing before items');
for (const missing of [5,{},[{slot:'',kind:'text'}],[{slot:'x',kind:'bad'}],
  [{slot:'x',kind:'text',extra:1}],[{slot:'x',kind:'text'},{slot:'x',kind:'number'}],
  [null],[{slot:'x'}]]) {
  errorResult({missing,items:[]},'bad-missing','C3 bad missing');
}
for (const items of [5,[null],[{id:'x',source:'note',kind:'text'}],
  [{id:'x',source:'memory',kind:'text'}],[{id:'x',source:'selected',kind:'bad'}],
  [{id:'',source:'selected',kind:'text'}],
  [{id:'x',source:'selected',kind:'text'},{id:'x',source:'attached',kind:'text'}],
  [{id:'x',source:'answer',kind:'text'}],
  [{id:'x',source:'selected',kind:'text',slot:'t'}],
  [{id:'x',source:'attached',kind:'file'}],
  [{id:'x',source:'attached',kind:'file',readable:'yes'}],
  [{id:'x',source:'attached',kind:'text',readable:true}],
  [{id:'x',source:'previous-reference',kind:'text',slot:'t'}],
  [{id:'x',source:'notes',kind:'text'}], [{id:'x',source:'memory-note',kind:'text'}],
  [{id:'x',source:'previous',kind:'text'}], [{id:'x',source:'Selected',kind:'text'}],
  [{id:'x',source:'',kind:'text'}],
  [{id:'x',source:'answer',kind:'text',slot:''}],
  [{id:'x',source:'attached',kind:'text',slot:'t'}],
  [{id:'x',source:'selected',kind:'text',readable:true}],
  [{id:'x',source:'attached',kind:'file',readable:true,extra:true}],
  [{id:'x',source:'selected',kind:'text',extra:true}]]) {
  errorResult({missing:[],items},'bad-items','C4 bad items');
}
errorResult({missing:[],items:[...attached(9),null]},'bad-items','C4 invalid item before cap');
const throwing = Object.defineProperty({items:[]},'missing',{enumerable:true,get(){throw new Error('boom');}});
errorResult(throwing,'bad-input','throwing missing getter');

// Deep freeze on success, including all nested structures; inputs stay unchanged.
const original = {missing:[{slot:'t',kind:'text'}],items:[{id:'f',source:'attached',kind:'file',readable:true}]};
const before = JSON.stringify(original);
const frozen = lookupContext(original);
assert(frozen.ok,'freeze sample success');
if (frozen.ok) {
  assert(Object.isFrozen(frozen),'result frozen');
  assert(Object.isFrozen(frozen.value),'value frozen');
  assert(Object.isFrozen(frozen.value.contextFills),'context list frozen');
  assert(Object.isFrozen(frozen.value.safeStepFills),'safe list frozen');
  assert(Object.isFrozen(frozen.value.trace),'trace frozen');
  assert(Object.isFrozen(frozen.value.trace[0]),'trace entry frozen');
}
equal(JSON.stringify(original),before,'inputs unchanged');

// Four feed-link rows; narrow every result before reading its value.
function feed(missingSlots:readonly string[], contextFills:readonly string[], safeStepFills:readonly string[]) {
  return makeActOrAskInput({
    resolution:{kind:'match',tool:'t1',missingSlots},
    schemas:[{tool:'t1',effects:['shows-result'],preconditions:[],undo:'not-needed',
      slots:[{name:'text1',required:true},{name:'pick',required:true}]}],
    slotDefaults:[],extraReadingTools:[],contextFills,safeStepFills,
    charter:{never:[],ask:[]},costly:false
  });
}
const l1 = lookupContext({missing:[{slot:'text1',kind:'text'},{slot:'pick',kind:'choice'}],
  items:[{id:'s1',source:'selected',kind:'text'},{id:'a1',source:'answer',kind:'choice',slot:'pick'}]});
assert(l1.ok,'L1 lookup'); 
const f1 = l1.ok ? feed(['text1','pick'],l1.value.contextFills,l1.value.safeStepFills) : undefined;
assert(f1?.ok === true,'L1 feed accepts');
if (f1?.ok) equal(f1.value.missing,'CONTEXT-ANSWERS','L1 missing classification');

const l2 = lookupContext({missing:[{slot:'text1',kind:'text'},{slot:'pick',kind:'choice'}],
  items:[{id:'s1',source:'selected',kind:'text'},{id:'s2',source:'selected',kind:'choice'}]});
assert(l2.ok,'L2 lookup');
const f2 = l2.ok ? feed(['text1','pick'],l2.value.contextFills,l2.value.safeStepFills) : undefined;
assert(f2?.ok === true,'L2 feed accepts');
if (f2?.ok) equal(f2.value.missing,'OWNER-ONLY','L2 missing classification');

const l3 = lookupContext({missing:[{slot:'text1',kind:'text'}],items:[{id:'f1',source:'attached',kind:'file',readable:true}]});
assert(l3.ok,'L3 lookup');
const f3 = l3.ok ? feed(['text1'],l3.value.contextFills,l3.value.safeStepFills) : undefined;
assert(f3?.ok === true,'L3 feed accepts');
if (f3?.ok) equal(f3.value.missing,'SAFE-STEP-ANSWERS','L3 missing classification');

const l4 = lookupContext({missing:[{slot:'text1',kind:'text'}],items:[]});
assert(l4.ok,'L4 lookup');
const f4 = l4.ok ? feed(['text1'],l4.value.contextFills,l4.value.safeStepFills) : undefined;
assert(f4?.ok === true,'L4 feed accepts');
if (f4?.ok) equal(f4.value.missing,'OWNER-ONLY','L4 missing classification');

// 2,000 deterministic generated cases, with the contract invariants checked each time.
let seed = 0x51A7C0DE;
function rand(max:number):number { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed % max; }
const kinds = ['text','choice','file','number','yes-no','duration','time','date'] as const;
const sources = ['selected','attached','previous-reference','answer'] as const;
for (let run=0; run<2000; run++) {
  const missingCount=rand(6), missing:{slot:string;kind:string}[]=[];
  for(let i=0;i<missingCount;i++) missing.push({slot:`slot${i}`,kind:kinds[rand(kinds.length)]});
  const items: Array<Record<string,unknown>>=[];
  const used={selected:0,attached:0,'previous-reference':0,answer:0};
  const itemCount=rand(29);
  for(let i=0;i<itemCount;i++) {
    const available=sources.filter(s=>used[s] < (s==='selected'?4:8));
    if(!available.length) break;
    const source=available[rand(available.length)]; used[source]++;
    const kind=kinds[rand(kinds.length)];
    const item:Record<string,unknown>={id:`r${run}i${i}`,source,kind};
    if(source==='answer') item.slot=`slot${rand(Math.max(1,missingCount+2))}`;
    if(source==='attached' && kind==='file') item.readable=rand(2)===1;
    items.push(item);
  }
  const r=lookupContext({missing,items});
  assert(r.ok,`sweep ${run} accepted`);
  if(!r.ok) continue;
  const v=r.value;
  equal(v.trace.map(t=>t.slot),missing.map(m=>m.slot),`sweep ${run} trace order`);
  assert(new Set(v.trace.map(t=>t.slot)).size===missing.length,`sweep ${run} unique trace`);
  assert(v.contextFills.every(s=>!v.safeStepFills.includes(s)),`sweep ${run} no double list`);
  equal(v.contextFills,v.trace.filter(t=>t.outcome==='context').map(t=>t.slot),`sweep ${run} context list`);
  equal(v.safeStepFills,v.trace.filter(t=>t.outcome==='safe-step').map(t=>t.slot),`sweep ${run} safe list`);
  for(const t of v.trace) {
    const m=missing.find(x=>x.slot===t.slot)!;
    if(t.outcome==='context') {
      const item=items.find(x=>x.id===t.itemId)!;
      assert(item.kind===m.kind,`sweep ${run} context kind`);
      if(m.kind==='choice'||m.kind==='yes-no') assert(t.rule==='R1',`sweep ${run} decision only R1`);
    }
    if(t.outcome==='safe-step') {
      const item=items.find(x=>x.id===t.itemId)!;
      assert(m.kind==='text' && item.source==='attached' && item.kind==='file' && item.readable===true,`sweep ${run} safe step source`);
    }
    if(t.outcome==='not-filled') assert(t.itemId===null,`sweep ${run} null unfilled id`);
  }
}
console.log(`CONTEXT_LOOKUP OK: ${checks} checks`);
