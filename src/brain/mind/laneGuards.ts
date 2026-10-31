/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE1a: tool-specific safe-guards for the direct lane, declared per tool (FL13), reading the SAME detectors as the old handler (FL14).
 * A guard returns a plain reason to YIELD to the old handler, or null.
 */
import { detectCodeRegions } from '../symbols/codeRegions';
import type { LaneGuard } from './directLane';

/** Text Counter: the old handler adds a note when the text holds code (or may); the runner does not, so the lane yields. */
const textCounterGuard: LaneGuard = (args, message) => {
  const text = typeof args.text === 'string' ? args.text : '';
  const inText = detectCodeRegions(text);
  if (inText.regions.length > 0 || inText.unsure) return 'the text may hold code, and the old handler adds a note about it';
  const inMessage = detectCodeRegions(message);
  if (inMessage.regions.length > 0 || inMessage.unsure) return 'the message may hold code, and the old handler adds a note about it';
  return null;
};

export const LANE_GUARDS: Readonly<Record<string, LaneGuard>> = Object.freeze({ 'text-counter': textCounterGuard });
