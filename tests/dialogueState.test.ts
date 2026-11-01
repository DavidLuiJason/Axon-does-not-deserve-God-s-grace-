/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D0: the dialogue state keeps ONE pending question and the last 8 turns, within hard caps, and never changes its input.
 */
import assert from 'node:assert/strict';
import {
  clearPending, emptyDialogue, lastResultTurn, recordTurn, restoreDialogue, serialiseDialogue, setPending,
} from '../src/brain/mind/dialogue/dialogueState';
import { MAX_ARGS, MAX_ARG_VALUE, MAX_OPTIONS, MAX_RESULT, MAX_TEXT, MAX_TURNS, PENDING_LIFE, type DialogueState, type TurnInput } from '../src/brain/mind/dialogue/dialogueTypes';

let checks = 0;
const ok = (condition: boolean, message: string): void => { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); };
const same = (a: unknown, b: unknown, message: string): void => { checks += 1; assert.deepEqual(a, b, `FAIL: ${message}`); };

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) { Object.freeze(value); for (const k of Object.keys(value)) freeze((value as Record<string, unknown>)[k]); }
  return value;
}
const turn = (n: number, extra: Partial<TurnInput> = {}): TurnInput => ({ id: `t${n}`, at: n, text: `message ${n}`, outcome: 'none', ...extra });
const feed = (state: DialogueState, count: number, from = 1): DialogueState => { let s = state; for (let i = 0; i < count; i += 1) s = recordTurn(s, turn(from + i)); return s; };

// 1. empty
const empty = emptyDialogue();
same([empty.turns.length, empty.pending, empty.topic, empty.turnCount, empty.version], [0, null, null, 0, 1], 'empty state');

// 2. turns: kept in order, capped at MAX_TURNS, total counted
const nine = feed(empty, MAX_TURNS + 1);
ok(nine.turns.length === MAX_TURNS, 'only the last MAX_TURNS turns are kept');
ok(nine.turns[0]?.id === 't2' && nine.turns[MAX_TURNS - 1]?.id === `t${MAX_TURNS + 1}`, 'oldest dropped, order kept');
ok(nine.turnCount === MAX_TURNS + 1, 'the total count is not capped');
ok(MAX_TURNS === 8 && PENDING_LIFE === 3 && MAX_OPTIONS === 4, 'the agreed numbers: 8 turns, 3 turns of life, 4 options');

// 3. clipping
const long = 'x'.repeat(MAX_TEXT + 50);
const clipped = recordTurn(empty, { id: 'a', at: 1, text: `  ${long}  `, outcome: 'answered', tool: 'act.case-converter', result: 'y'.repeat(MAX_RESULT + 9), args: { a: '1', b: 'z'.repeat(MAX_ARG_VALUE + 9), c: '3', d: '4', e: '5', f: '6', g: '7' } });
ok(clipped.turns[0]?.text.length === MAX_TEXT, 'text is trimmed and clipped');
ok(clipped.turns[0]?.result?.length === MAX_RESULT, 'result is clipped');
ok(Object.keys(clipped.turns[0]?.args ?? {}).length === MAX_ARGS, 'args are capped');
ok(clipped.turns[0]?.args.b?.length === MAX_ARG_VALUE, 'an arg value is clipped');

// 4. invalid turns leave the state unchanged
ok(recordTurn(empty, { id: '  ', at: 1, text: 'a', outcome: 'none' }) === empty, 'empty id is refused');
ok(recordTurn(empty, { id: 'a', at: Number.NaN, text: 'a', outcome: 'none' }) === empty, 'NaN time is refused');
ok(recordTurn(empty, { id: 'a', at: 1, text: 'a', outcome: 'bogus' as never }) === empty, 'unknown outcome is refused');

// 5. topic: only an ANSWERED turn with a tool moves it
let t = recordTurn(empty, turn(1, { outcome: 'answered', tool: 'act.text-counter' }));
ok(t.topic === 'act.text-counter', 'an answered turn sets the topic');
t = recordTurn(t, turn(2, { outcome: 'asked', tool: 'act.case-converter' }));
t = recordTurn(t, turn(3, { outcome: 'declined', tool: 'act.case-converter' }));
t = recordTurn(t, turn(4, { outcome: 'none' }));
ok(t.topic === 'act.text-counter', 'asked, declined and none do not change the topic');
t = recordTurn(t, turn(5, { outcome: 'answered', tool: null }));
ok(t.topic === 'act.text-counter', 'an answered turn without a tool does not change the topic');

// 6. pending: valid kinds, one only, askedTurn from the count
const base = feed(empty, 2);
const choice = setPending(base, { kind: 'choice', question: 'Which one?', options: ['a', 'b', 'c', 'd', 'e', 'f'], tool: 'x' });
same(choice.pending?.options, ['a', 'b', 'c', 'd'], 'a choice keeps at most 4 options');
ok(choice.pending?.askedTurn === 2, 'askedTurn is the turn count when asked');
const slot = setPending(choice, { kind: 'text-slot', question: 'Which text?', slot: 'text' });
ok(slot.pending?.kind === 'text-slot' && slot.pending.slot === 'text' && slot.pending.options.length === 0, 'a new question REPLACES the old one');
ok(setPending(base, { kind: 'yes-no', question: 'Sure?' }).pending?.kind === 'yes-no', 'yes-no is valid');
ok(setPending(base, { kind: 'confirm', question: 'Delete it?' }).pending?.kind === 'confirm', 'confirm is valid');
ok(setPending(base, { kind: 'choice', question: 'Which?', options: ['only'] }) === base, 'a choice needs two options');
ok(setPending(base, { kind: 'choice', question: 'Which?', options: ['a', '  '] }) === base, 'blank options do not count');
ok(setPending(base, { kind: 'text-slot', question: 'Which text?' }) === base, 'a text-slot needs a slot');
ok(setPending(base, { kind: 'yes-no', question: '   ' }) === base, 'an empty question is refused');
ok(setPending(base, { kind: 'bogus' as never, question: 'q' }) === base, 'an unknown kind is refused');
ok(clearPending(slot).pending === null && clearPending(base) === base, 'clearPending clears, and leaves a state without one unchanged');

// 7. expiry: alive for 2 more turns, gone on the 3rd
let e = setPending(feed(empty, 1), { kind: 'yes-no', question: 'Sure?' });
e = recordTurn(e, turn(2)); ok(e.pending !== null, 'alive after 1 turn');
e = recordTurn(e, turn(3)); ok(e.pending !== null, 'alive after 2 turns');
e = recordTurn(e, turn(4)); ok(e.pending === null, 'gone after 3 turns');

// 8. lastResultTurn
const lr = recordTurn(recordTurn(recordTurn(empty, turn(1, { result: 'r1' })), turn(2, { result: 'r2' })), turn(3));
ok(lastResultTurn(lr)?.id === 't2', 'the latest turn WITH a result');
ok(lastResultTurn(empty) === null, 'none without a result');

// 9. purity: a frozen state is never changed
const frozen = freeze(setPending(feed(empty, 3), { kind: 'choice', question: 'Which?', options: ['a', 'b'] }));
const before = JSON.stringify(frozen);
recordTurn(frozen, turn(9, { outcome: 'answered', tool: 't', args: { a: 'b' } })); setPending(frozen, { kind: 'yes-no', question: 'q' }); clearPending(frozen); lastResultTurn(frozen);
ok(JSON.stringify(frozen) === before, 'no function changes its input');

// 10. serialise and restore
const full = recordTurn(setPending(feed(empty, 4), { kind: 'choice', question: 'Which?', options: ['a', 'b'], tool: 'x' }), turn(5, { outcome: 'answered', tool: 'act.text-counter', result: 'ref', args: { text: 'hi' } }));
same(restoreDialogue(serialiseDialogue(full)), full, 'round trip');
same(restoreDialogue('not json'), empty, 'garbage gives the empty state');
same(restoreDialogue('[]'), empty, 'an array gives the empty state');
same(restoreDialogue(JSON.stringify({ ...full, version: 2 })), empty, 'another version gives the empty state');
same(restoreDialogue(JSON.stringify({ ...full, turns: 'x' })), empty, 'a wrong shape gives the empty state');
const tamperedTurns = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, at: i, text: 'x'.repeat(5000), tool: null, outcome: 'none', args: {}, result: null }));
const tampered = restoreDialogue(JSON.stringify({ version: 1, turns: tamperedTurns, pending: null, topic: null, turnCount: 30 }));
ok(tampered.turns.length === MAX_TURNS && tampered.turns.every((x) => x.text.length === MAX_TEXT), 'a tampered text cannot grow the state');
const stale = restoreDialogue(JSON.stringify({ ...full, turnCount: 99 }));
ok(stale.pending === null, 'a restored pending question that is too old is dropped');
same(restoreDialogue(JSON.stringify({ ...full, pending: { kind: 'choice', question: 'q', options: ['only'], slot: null, tool: null, askedTurn: 4 } })), empty, 'an invalid restored pending gives the empty state');

console.log(`dialogueState: ${checks} checks passed`);
