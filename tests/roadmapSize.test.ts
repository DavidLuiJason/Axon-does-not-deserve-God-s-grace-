/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The roadmap size law (owner, 2026-11-02): docs/ROADMAP.md never exceeds 63,000 characters
 * (target 58,000, warning 50,000; owner 2026-11-03). Compression must never drop a law, a rule, an EXAMPLE or the
 * Standard Prompt Preamble (which lives in section 5.3a of the roadmap itself; the annex is stale).
 * Earlier caps: 40,000 (2026-10-16), 45,000 (2026-11-01), 50,000 and 58,000 (2026-11-02).
 */
import { readFileSync, existsSync } from 'node:fs';

const CAP = 63000;
const TARGET = 58000;
const WARN = 50000;
const text = readFileSync('docs/ROADMAP.md', 'utf8');
let checks = 0;

function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}

assert(text.length <= CAP, `the roadmap holds ${text.length} characters; the cap is ${CAP}`);
if (text.length > WARN) console.log(`NOTE: the roadmap is above ${WARN} characters (${text.length}); measure before every edit, compress before adding.`);
if (text.length > TARGET) console.log(`NOTE: the roadmap is above the ${TARGET} target (${text.length}).`);
assert(!text.includes('\r'), 'the roadmap uses LF line endings');
assert(text.includes('hard cap 63,000'), 'section 0 states the same cap as this test (63,000)');

for (let n = 1; n <= 15; n += 1) {
  assert(text.includes(`**FL${n} `), `Foundation Law FL${n} is present`);
}
for (let n = 1; n <= 13; n += 1) {
  assert(text.includes(`${n}. **`), `Building Rule ${n} is present`);
}
const required = [
  // old required list
  'Two-Strike Rule', 'Foundation Check', 'Top-View Check', 'LAW CHECK', 'SIZE LAW', 'V15_1',
  'Image | Video | Audio', 'a From picker, a To picker',
  // laws and ownership
  'ARCHITECT LAW', 'PLACEMENT LAW', 'FIRST RESULT LAW', 'NO-LOSS LAW', 'VALUE TEST', 'NEW-ACCOUNT TEST',
  'ROADMAP OWNERSHIP LAW', 'ROADMAP UPDATE LAW', 'DIRECTOR CARE LAW', 'NOW TAG', 'VERDICT WORDS',
  'NOTHING IS LEFT OUT', 'INDEPENDENT EVIDENCE', 'SOURCE IS UNTOUCHABLE', 'N2 TRUTH', 'NOT-FOR-AXON RULE',
  'the architect', 'TRIM BY ARITHMETIC', 'Build for every Android phone, prove on the owner',
  // owner quotes, numbers, names
  'Intelligence in Motion', 'RUN_AT 0.8', 'ASK_AT 0.5', '66,615,632', '984,184 kB', 'Odeberg 1928',
  'Brier score', 'Iocaine Powder', 'COURSE CHECK', 'DEEP DIVE', 'SAFE MODE', 'WAIT TIMER',
  // items restored since v20.7
  'W5 Circuits', 'W6 Knowledge archives', 'W13 Colours', 'Director capacity record',
  'Simulations must flag every place without a rule', '79-message golden transcript', 'cannot judge facts',
  // EXAMPLES of real mistakes
  '**EXAMPLE (owner):**', 'I made that work', '**EXAMPLE, size to the carrier:**', '**EXAMPLE, no structure:**',
  '**EXAMPLE, unmeasured base:**', '**EXAMPLE, display limit is not data limit:**', '**EXAMPLE, proof:**',
  '**EXAMPLE, stacked wishes:**',
  // v21.1 additions
  'VERSION NAMES', 'STALE-ROADMAP RULE', 'PLAN A / PLAN B', 'FLEXIBLE SPEECH', 'ROUTER DEFAULTS', 'KNOWLEDGE DRIVE',
  'DERIVED KNOWLEDGE', 'BACKGROUND WORK', '**EXAMPLE, wrong version name', '**EXAMPLE, one message contradicts itself',
];
for (const phrase of required) assert(text.includes(phrase), `the roadmap still contains: ${phrase}`);
// The Standard Prompt Preamble lives in 5.3a of the roadmap itself and must never be dropped.
for (const phrase of ['Before you do anything: read the AXON roadmap (all of it, not a part)', 'Never add a fixed phrase list to the brain (FL13).']) {
  assert(text.includes(phrase), `the roadmap (5.3a) still contains the preamble: ${phrase}`);
}
assert(existsSync('docs/archive/AXON_ROADMAP_V15_1.md'), 'the archive of the full v15.1 roadmap exists');

console.log(`=== roadmap size tests passed: ${checks} checks (${text.length} of ${CAP} characters) ===`);
