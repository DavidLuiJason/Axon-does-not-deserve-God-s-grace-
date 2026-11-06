# CHR2 CASES (Director, 2026-11-06). Part of the CHR2 prompt; do not return this file.

Every row below was worked by hand from the rules in the prompt, then run on a separate reference engine written by the Director (61 checks, all agree). Copy the expected values into your test as your OWN literals; never compute an expected value by calling the engine. Fixture helpers are written by YOU in the test exactly as shown.

## Fixtures (copy into your test)
```ts
const sha = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
// mk: a Charter with the given lanes. lanes = { laneId: { 'laneId.verb': 'allowed'|'ask'|'never' } }; every rule gets reason 'r'; lane name = lane id.
// header: version 1, revision 1, fences { neverTouch: [], maxSpendPerAction: 0, maxSpendPerDay: 0 }, createdAt '', signedAt null, signature null.
// sign(c): d = { ...c, signedAt: '2026-11-06T00:00:00Z' }; return { ...d, signature: `${charterHash(d, sha)}:owner` }.
// ser(c) = serializeCharter(c).text (assert ok first).
const T  = ['sort-lines', 'counter', 'noter', 'voice-cloner', 'calc'];
const A  = sign(mk({ tools: { 'tools.sort-lines': 'never', 'tools.counter': 'ask', 'tools.noter': 'allowed' } }));
const B  = sign(<defaultCharter() plus one extra lane { id:'tools', name:'tools', actions:{ 'tools.calc': { level:'ask', reason:'r' } } }>);
const O  = sign(mk({ a: { 'a.b.c': 'ask' }, 'a.b': { 'a.b.c': 'never' } }));
const bi = loadCharterText({ kind: 'absent' }, sha);            // built-in
const sg = (c) => loadCharterText({ kind: 'text', text: ser(c) }, sha);   // signed load of c
const un = loadCharterText({ kind: 'unreadable' }, sha);        // untrusted
```
NOTE: `defaultCharter()` lanes have a null prototype; never compare a default charter to a parsed one with `deepStrictEqual`. Compare their `ser(...)` texts. Pin: `charterHash(defaultCharter(), sha)` is `'167fb2be'` (one check, so a changed default is noticed).

## V rows: charterToFeedView({ load, toolIds, links }) => { never, ask, status, notice } (every row returns ok true)
```
V01 | bi, T, []                                  => never [], ask [], status 'built-in', notice ''
V02 | bi, [], []                                 => never [], ask [], built-in, ''
V03 | sg(A), T, []                               => never ['sort-lines'], ask ['counter'], 'signed', ''
V04 | sg(A), T reversed, []                      => never ['sort-lines'], ask ['counter'], signed   (order follows toolIds; here one in each list)
V05 | sg(A), T, [{tool:'noter',actions:['email.send']}]    => never ['sort-lines'], ask ['counter','noter'], signed   (A has no email lane: an unknown declared action goes UP to ask)
V06 | bi, T, [{tool:'noter',actions:['email.send']}]       => never [], ask ['noter'], built-in
V07 | bi, T, [{tool:'calc',actions:['money.pay']}]         => never ['calc'], ask [], built-in
V08 | bi, T, [{tool:'counter',actions:['email.read']}]     => never [], ask [], built-in   (an allowed action changes nothing)
V09 | bi, T, [{tool:'noter',actions:['email.send','money.pay']}]  => never ['noter'], ask [], built-in   (strictest wins)
V10 | bi, T, [{tool:'noter',actions:['nope.verb']}]        => never [], ask ['noter'], built-in
V11 | sg(B), T, []                               => never [], ask ['calc'], signed
V12 | sg(B), T, [{tool:'calc',actions:['money.pay']}]     => never ['calc'], ask [], signed   (never beats the tools.calc ask; a tool is in ONE list)
V13 | sg(A), ['sort-lines'], [{tool:'sort-lines',actions:['email.read']}]  => never ['sort-lines'], ask [], signed   (an allowed link cannot loosen)
V14 | sg(O), T, [{tool:'counter',actions:['a.b.c']}]      => never ['counter'], ask [], signed   (two lanes hold the id: strictest across lanes)
V15 | un, T, []                                  => never [], ask T (same order), 'charter-untrusted', notice 'Your Charter could not be checked, so I ask before every action.'
V16 | un, [], []                                 => never [], ask [], 'charter-untrusted', same notice
V17 | un, T, [{tool:'calc',actions:['money.pay']}]         => same as V15 (links are ignored)
V18 | load { status:'signed', reason:'trusted', charter: <a charter whose rule level is 'maybe'> }, T, []   => same as V15 (fail closed, NOT an error)
V19 | load { status:'built-in', reason:'no-stored-charter', charter: 42 }, T, []                          => same as V15
V20 | sg(mk({tools:{'tools.a.b':'never'}}) signed), ['a.b','a'], []   => never ['a.b'], ask [], signed   (tool ids may hold dots; 'a' has no rule)
V21 | sg(mk({tools:{'tools.counter':'allowed','tools.calc':'allowed'}}) signed), T, []  => never [], ask [], signed
```
## L rows: loadCharterText(stored, sha) => [status, reason, charter?]
```
L01 | {kind:'absent'}                         => 'built-in', 'no-stored-charter', charter equals defaultCharter() (compare ser texts)
L02 | {kind:'unreadable'}                      => 'untrusted', 'unreadable', charter null
L03 | {kind:'text', text: ser(A)}              => 'signed', 'trusted', charter equals A
L04 | text of an UNSIGNED valid charter        => 'untrusted', 'unsigned', null
L05 | A with tools.counter changed to never AFTER signing, as JSON text => 'untrusted', 'signature-mismatch', null
L06 | text ''                                  => 'untrusted', 'not-json', null
L07 | text '{'                                 => 'untrusted', 'not-json', null
L08 | text 'null'                               => 'untrusted', 'invalid-charter', null
L09 | A with a rule level 'maybe', as JSON text => 'untrusted', 'unknown-level', null
L10 | text 'x' repeated 1,000,001 times         => 'untrusted', 'input-too-large', null   (checked BEFORE parsing)
L11 | text '{' + 999,998 spaces + '}' (exactly 1,000,000 characters) => 'untrusted', 'invalid-charter', null   (not too large)
L12 | {kind:'text'} (no text) ; {kind:'text', text:5} ; {kind:'absent', extra:1} ; {kind:'other'} ; null ; a symbol key on a valid stored object  => each 'untrusted', 'unreadable', null
L13 | {kind:'absent'} with sha256 = 'nope' (not a function)   => 'untrusted', 'unreadable', null
L14 | {kind:'text', text: ser(A)} with a sha256 that THROWS  => 'untrusted', 'signature-mismatch', null (never throws)
L15 | A with its lane id changed to 'other' (JSON text)       => 'untrusted', 'lane-id-mismatch', null
L16 | {kind:'text', text: ser(A)} with a sha256 that returns sha(s)+'x' => 'untrusted', 'signature-mismatch', null
L17 | results of L02 and L01 are frozen (Object.isFrozen)
```
## S rows: serializeCharter(c) (keys sorted by plain sort at every depth; no spaces; no newline)
```
S01 | mk({}) (no lanes)  => { ok:true, text: '{"createdAt":"","fences":{"maxSpendPerAction":0,"maxSpendPerDay":0,"neverTouch":[]},"lanes":{},"revision":1,"signature":null,"signedAt":null,"version":1}' }
S02 | mk({tools:{'tools.x':'ask'}}) => '{"createdAt":"","fences":{"maxSpendPerAction":0,"maxSpendPerDay":0,"neverTouch":[]},"lanes":{"tools":{"actions":{"tools.x":{"level":"ask","reason":"r"}},"id":"tools","name":"tools"}},"revision":1,"signature":null,"signedAt":null,"version":1}'
S03 | 42                                   => { ok:false, error:'invalid-charter', message:'Charter must be a plain object.' }
S04 | a charter with a self-reference (c.self = c)  => ok false, error 'circular-input'
S05 | A with level 'maybe'                  => ok false, error 'unknown-level'
S06 | A with its lanes listed in reverse order => the SAME text as A
S07 | ser(defaultCharter()) loaded           => 'untrusted', 'unsigned'; and ser(JSON.parse(ser(d))) equals ser(d)
S08 | round trip: for A, B, O: loadCharterText({kind:'text', text: ser(c)}) is 'signed' and its charter text equals ser(c)
```
## E rows: charterToFeedView errors (exact code AND message 'Charter view input is invalid.'; ok = { load: bi, toolIds: ['a','b'], links: [] })
```
E01 null | E02 [] | E03 7                                        => 'bad-input'
E04 ok plus key x | E05 ok plus a symbol key | E06 ok without links => 'unknown-key'
E07 load.status 'x' | E08 untrusted load with charter not null | E09 signed with reason 'x' | E10 built-in without a charter key | E11 untrusted with reason ''  => 'bad-load'
E12 toolIds ['a','a'] | E13 [''] | E14 'a' | E15 [1]               => 'bad-tool-ids'
E16 links entry with an extra key | E17 same tool twice | E18 actions with a duplicate | E19 links {} | E20 actions ['']  => 'bad-links'
E21 links [{tool:'zz',actions:[]}]                                 => 'unknown-link-tool'
ORDER: E22 bad load + duplicate toolIds + links 7 => 'bad-load'; E23 duplicate toolIds + links 7 => 'bad-tool-ids'; E24 links [{tool:'zz',actions:[1]}] => 'bad-links' (shape before unknown tool); E25 untrusted load + links [{tool:'zz',actions:[]}] => 'unknown-link-tool' (links are still checked); E26 args frozen error result (Object.isFrozen).
```
Also: results of a good call are frozen (result, value, never, ask); the input (load, toolIds, links) is unchanged (compare JSON before and after).
