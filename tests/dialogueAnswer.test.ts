/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B05 part D1: scripted transcripts (tests/fixtures/dialogueCorpus.json) must be read exactly as written.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { livePending, readAnswer } from '../src/brain/mind/dialogue/dialogueAnswer';
import { emptyDialogue, recordTurn, setPending } from '../src/brain/mind/dialogue/dialogueState';
import { MAX_TEXT, type DialogueState, type PendingInput } from '../src/brain/mind/dialogue/dialogueTypes';

interface Case { id: string; group: string; pending: PendingInput | null; message: string; newRequest: boolean; gap: number; expect: unknown }
const corpus = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/dialogueCorpus.json'), 'utf8')) as { cases: Case[] };
let checks = 0;
const groups = new Map<string, number>();

for (const c of corpus.cases) {
  let state: DialogueState = recordTurn(emptyDialogue(), { id: 'first', at: 1, text: 'earlier message', outcome: 'asked' });
  if (c.pending !== null) state = setPending(state, c.pending);
  for (let i = 0; i < c.gap; i += 1) state = recordTurn(state, { id: `gap${i}`, at: 2 + i, text: 'unrelated', outcome: 'none' });
  const got = readAnswer(state, c.message, { newRequest: c.newRequest });
  checks += 1;
  assert.deepEqual(got, c.expect, `FAIL: ${c.id} (${c.group}) message ${JSON.stringify(c.message)}`);
  groups.set(c.group, (groups.get(c.group) ?? 0) + 1);
}
assert.ok(corpus.cases.length >= 60, 'FAIL: the corpus has at least 60 transcripts');

// not covered by the corpus: a long text is clipped, an expired pending is not live, input is never changed
const slotState = setPending(recordTurn(emptyDialogue(), { id: 'a', at: 1, text: 't', outcome: 'asked' }), { kind: 'text-slot', question: 'Which text?', slot: 'text' });
const long = readAnswer(slotState, 'x'.repeat(MAX_TEXT + 80));
checks += 1; assert.ok(long.kind === 'answers' && typeof long.value === 'string' && long.value.length === MAX_TEXT, 'FAIL: a long text answer is clipped');
checks += 1; assert.ok(livePending(slotState) !== null, 'FAIL: a fresh pending question is live');
const aged: DialogueState = { ...slotState, turnCount: slotState.turnCount + 3 };
checks += 1; assert.ok(livePending(aged) === null && readAnswer(aged, 'hello').kind === 'none', 'FAIL: an expired pending question is not live, even when the state still holds it');
const frozenText = JSON.stringify(slotState); readAnswer(slotState, 'hello');
checks += 1; assert.equal(JSON.stringify(slotState), frozenText, 'FAIL: readAnswer does not change the state');

console.log(`dialogueAnswer: ${checks} checks passed (${[...groups.entries()].map(([g, n]) => `${g} ${n}`).join(', ')})`);
