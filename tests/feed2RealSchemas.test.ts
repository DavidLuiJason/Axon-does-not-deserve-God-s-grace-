declare const console: { log: (value: string) => void };
import { ACTION_SCHEMAS, getSchema } from '../src/brain/mind/schema/actionSchemas';
import { routePiece } from '../src/brain/mind/router/routerShadow';
import { makeActOrAskInput } from '../src/decision/actOrAskFeed';
import type { FeedSchema } from '../src/decision/actOrAskFeed';
import { decideActOrAsk } from '../src/decision/actOrAsk';
// FEED2 (Director): the Act-or-Ask feed against the REAL tool schemas and the REAL Router (R3, R5, R6). Written by the Director, not the builder.
let checks = 0;
function check(condition: boolean, label: string): void { if (!condition) throw new Error('FAIL: ' + label); checks++; }
// Assigning the real schemas to FeedSchema WITHOUT a cast is itself a compile-time proof that the real types fit the feed's types.
const schemas: readonly FeedSchema[] = ACTION_SCHEMAS.map((s) => ({ tool: s.tool, effects: [...s.effects], preconditions: [...s.preconditions], undo: s.undo, slots: s.slots.map((x) => ({ name: x.name, required: x.required })) }));
check(schemas.length > 0, 'the real schema list is not empty');
const APPROVAL = ['sends', 'spends', 'deletes'];
const PURE = ['shows-result', 'reads-file', 'uses-camera', 'uses-microphone', 'uses-network'];
// 1. The undo x effects table: a row kind the feed was not designed for fails loudly so the Director reviews the mapping.
const KNOWN = ['not-needed x pure', 'by-removal x persistent', 'by-tool x persistent', 'by-tool x approval'];
for (const s of schemas) {
  const kind = s.undo + ' x ' + (s.effects.some((e) => APPROVAL.includes(e)) ? 'approval' : s.effects.every((e) => PURE.includes(e)) ? 'pure' : 'persistent');
  check(KNOWN.includes(kind), 'new schema row kind needs a Director review: ' + s.tool + ' is ' + kind);
}
type Out = { outcome: string; askKind: string | null; sayReading: boolean; reasons: string };
function run(resolution: unknown, extra: Record<string, unknown> = {}): Out {
  const feed = makeActOrAskInput({ resolution, schemas, slotDefaults: [], extraReadingTools: [], contextFills: [], safeStepFills: [], charter: { never: [], ask: [] }, costly: false, ...extra } as never);
  check(feed.ok === true, 'the feed accepts ' + JSON.stringify(resolution));
  if (!feed.ok) throw new Error('unreachable');
  const j = decideActOrAsk(feed.value);
  check(j.ok === true, 'J6 accepts the feed output for ' + JSON.stringify(resolution));
  if (!j.ok) throw new Error('unreachable');
  return { outcome: j.value.outcome, askKind: j.value.askKind, sayReading: j.value.sayReading, reasons: j.value.reasonCodes.join(',') };
}
function subsets(names: string[]): string[][] { return names.reduce((acc: string[][], x) => acc.concat(acc.map((y) => [...y, x])), [[]]); }
function r3(tool: string): boolean { const r = routePiece({ piece: 0, clause: 0, mayRunAlone: true, resolution: { kind: 'match', tool, missingSlots: [] } } as never, 'command', getSchema); return r.rule === 'R3'; }
const r3Tools = schemas.filter((s) => r3(s.tool)).map((s) => s.tool);
// 2. Every real tool as a match: every missing-slot subset, three evidence values, no fills and all fills.
for (const s of schemas) {
  const required = s.slots.filter((x) => x.required).map((x) => x.name);
  for (const ms of subsets(required)) for (const ev of [undefined, 'value', 'concept'] as const) for (const fills of [[], required]) {
    const res = { kind: 'match', tool: s.tool, missingSlots: ms, ...(ev ? { evidence: ev } : {}) };
    const out = run(res, { contextFills: fills });
    // 3. R3 safety: a tool the real Router sends DEEP by R3 never gets ACT from J6, whatever else is true.
    if (r3Tools.includes(s.tool)) check(out.outcome !== 'ACT', 'R3 tool ' + s.tool + ' must never ACT');
    // 4. A match found only by the value the message carries is never acted on silently: ASK, or ACT that says the reading aloud.
    if (ev === 'value') check(out.outcome === 'ASK' || (out.outcome === 'ACT' && out.sayReading === true), 'value-only match of ' + s.tool + ' is never silent');
  }
}
// 5. Router R6 (fast) versus J6: since ROUTER-R3 (the owner-approval precondition sends a tool deep), every tool the Router calls fast gets ACT from J6, and every R3 tool gets an approval ask.
for (const s of schemas) {
  const res = { kind: 'match', tool: s.tool, missingSlots: [] };
  const route = routePiece({ piece: 0, clause: 0, mayRunAlone: true, resolution: res } as never, 'command', getSchema);
  const out = run(res);
  if (route.rule === 'R6') check(out.outcome === 'ACT', 'fast tool ' + s.tool + ' must get ACT from J6');
  if (route.rule === 'R3') check(out.outcome === 'ASK' && out.askKind === 'APPROVAL', 'R3 tool ' + s.tool + ' asks approval');
}
// 6. Every ordered pair of different real tools as an ask, and every window of four: accepted by the feed and by J6; a pair holding an R3 tool never ACTs.
for (const a of schemas) for (const b of schemas) {
  if (a.tool === b.tool) continue;
  const out = run({ kind: 'ask', choices: [a.tool, b.tool] });
  if (r3Tools.includes(a.tool) || r3Tools.includes(b.tool)) check(out.outcome !== 'ACT', 'a pair with an R3 tool never ACTs: ' + a.tool + ' ' + b.tool);
}
for (let i = 0; i + 3 < schemas.length; i++) run({ kind: 'ask', choices: [schemas[i].tool, schemas[i + 1].tool, schemas[i + 2].tool, schemas[i + 3].tool] });
// 7. Real tools as extra readings beside a real match.
for (const a of schemas) for (const b of schemas) { if (a.tool !== b.tool) run({ kind: 'match', tool: a.tool, missingSlots: [] }, { extraReadingTools: [b.tool] }); }
// 8. Resolution `none` with the real schemas.
check(run({ kind: 'none' }).askKind === 'CLARIFICATION', 'none asks a clarification');
console.log('FEED2 REAL SCHEMAS OK: ' + checks + ' checks');
