/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CONNECT0: THE ADMISSION GATE (Director, 2026-11-07). One pure function that says what a tool still lacks before its live switch may be ON.
 * A tool is admitted to the brain only when ALL parts exist: runner, schema row, task record, registered kernel action, available chat
 * action, lane guard (or a named exemption in the test), and live choices when the schema has a choice slot.
 * PURE: no clock, no randomness, no storage, never throws, never changes its input. It decides nothing by itself: `tests/liveAdmission.test.ts`
 * feeds it the real registries, so a switch turned ON without its parts fails the build (FL10, FL15: loud, never silent).
 */
export interface AdmissionFacts {
  readonly id: string;
  readonly hasRunner: boolean;
  readonly hasSchema: boolean;
  readonly hasTaskEntry: boolean;
  readonly kernelActionRegistered: boolean;
  readonly chatActionAvailable: boolean;
  readonly hasLaneGuard: boolean;
  readonly schemaHasChoiceSlot: boolean;
  readonly hasLiveChoices: boolean;
}

/** The names of the problems, in a fixed order. An empty list means the tool may be ON. */
export function admissionProblems(f: AdmissionFacts): string[] {
  const out: string[] = [];
  if (f === null || typeof f !== 'object' || typeof f.id !== 'string' || f.id === '') return ['bad-facts'];
  if (!f.hasRunner) out.push('no-runner');
  if (!f.hasSchema) out.push('no-schema-row');
  if (!f.hasTaskEntry) out.push('no-task-record');
  if (!f.kernelActionRegistered) out.push('kernel-action-not-registered');
  if (!f.chatActionAvailable) out.push('no-available-chat-action');
  if (!f.hasLaneGuard) out.push('no-lane-guard');
  if (f.schemaHasChoiceSlot && !f.hasLiveChoices) out.push('no-live-choices');
  return out;
}
