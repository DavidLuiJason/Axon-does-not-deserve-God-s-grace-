import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyRound15Handover } from '../src/verification/round15HandoverVerifier.mjs';
import { compileRealModuleMutant } from './helpers/r14-mutant.mjs';

async function documents() {
  return {
    handover: await readFile('docs/ROUND15_HANDOVER.md', 'utf8'),
    checklist: await readFile('docs/DEVICE_PROOF_CHECKLIST.md', 'utf8'),
    registry: JSON.parse(await readFile('docs/CAPABILITY_REGISTRY.json', 'utf8')),
  };
}

test('Q8 handover verifier reports exact capability registry counts', async () => {
  const result = verifyRound15Handover(await documents());
  assert.equal(result.valid, true);
  assert.equal(result.capabilityCount, result.counts.TESTED + result.counts.BUILT + result.counts.BLOCKED + result.counts['NOT IMPLEMENTED'] + result.counts['NOT RUN']);
  const input = await documents();
  assert.throws(() => verifyRound15Handover({ ...input, handover: input.handover.replace('**77 capabilities**', '**76 capabilities**') }), /HANDOVER_REGISTRY_COUNT_MISMATCH/);
});

test('Q8 checklist must contain PASS and FAIL recording fields and all competitor names', async () => {
  const input = await documents();
  assert.throws(() => verifyRound15Handover({ ...input, checklist: 'no results here' }), /CHECKLIST_PASS_FAIL_FIELDS_MISSING/);
  assert.throws(() => verifyRound15Handover({ ...input, checklist: input.checklist.replaceAll('Pydroid 3', 'Python tool') }), /COMPETITOR_CHECKLIST_MISSING:Pydroid 3/);
});

test('Q8 handover refuses missing device evidence and unsupported competitor superiority claims', async () => {
  const input = await documents();
  assert.throws(() => verifyRound15Handover({ ...input, handover: input.handover.replace('Android device / Android 11 execution: **NOT RUN**.', 'Android device / Android 11 execution: PASS.') }), /ANDROID_DEVICE_STATUS_MUST_BE_NOT_RUN/);
  assert.throws(() => verifyRound15Handover({ ...input, handover: `${input.handover}\nAXON Code beats Termux.` }), /UNSUPPORTED_COMPETITOR_SUPERIORITY_CLAIM/);
});

test('Q8 real compiled verifier mutant removing Android NOT RUN guard is caught', async () => {
  const needle = 'if (!/Android device[^\\n]*NOT RUN/i.test(handover)) throw new Error("ANDROID_DEVICE_STATUS_MUST_BE_NOT_RUN");';
  const mutant = await compileRealModuleMutant('src/verification/round15HandoverVerifier.mjs', needle, 'if (false)');
  try {
    const input = await documents();
    input.handover = input.handover.replace('Android device / Android 11 execution: **NOT RUN**.', 'Android device / Android 11 execution: PASS.');
    let detected = false;
    try { assert.throws(() => mutant.module.verifyRound15Handover(input), /ANDROID_DEVICE_STATUS_MUST_BE_NOT_RUN/); }
    catch { detected = true; }
    assert.equal(detected, true, 'the normal device-status assertion must fail against the mutant');
  } finally { await mutant.cleanup(); }
});
