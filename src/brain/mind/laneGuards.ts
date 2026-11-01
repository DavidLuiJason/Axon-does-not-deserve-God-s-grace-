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

/** Quote marks that may open or close text the person handed over (one string of characters, not a phrase list). */
const QUOTE_MARKS = '"\'\u201C\u201D\u2018\u2019';

/**
 * LIVE8-2b part 1c, Case Converter: the lane answers only when its text sits INSIDE quote marks in the message.
 * Measured reason: with `kebab-case` read as `kebab` + `case`, the binder took the leftover words of ordinary requests as the text
 * ("convert the kebab-case image to png" answered "png", "explain kebab-case to me" answered "me"). Unquoted text was never read by the lane
 * (the binder asks), so this keeps today's behaviour. Plain string checks only (no pattern, no phrase list).
 */
const caseConverterGuard: LaneGuard = (args, message) => {
  const text = typeof args.text === 'string' ? args.text : '';
  if (text === '') return null;
  let from = message.indexOf(text);
  while (from >= 0) {
    const before = from > 0 ? message.charAt(from - 1) : '';
    const after = message.charAt(from + text.length);
    if (before !== '' && after !== '' && QUOTE_MARKS.includes(before) && QUOTE_MARKS.includes(after)) return null;
    from = message.indexOf(text, from + 1);
  }
  return 'the text is not inside quote marks, so the old handler decides';
};

export const LANE_GUARDS: Readonly<Record<string, LaneGuard>> = Object.freeze({ 'text-counter': textCounterGuard, 'case-converter': caseConverterGuard });
