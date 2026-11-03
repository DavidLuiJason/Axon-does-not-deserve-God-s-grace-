/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE1a: tool-specific safe-guards for the direct lane, declared per tool (FL13), reading the SAME detectors as the old handler (FL14).
 * A guard returns a plain reason to YIELD to the old handler, or null.
 */
import { detectCodeRegions } from '../symbols/codeRegions';
import type { LaneGuard } from './directLane';
import { SORT_MODE_WORDS } from '../../tools/runners/sortModeWords';
import { SORT_OPTION_WORDS, sortWordsOf } from '../../tools/runners/sortOptionWords';

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

/**
 * LIVE9-3, Sort Lines: two measured WRONG answers (LIVE9-2b) are stopped here. The words of the message OUTSIDE the person's own text are read:
 * (1) two mode words that name DIFFERENT engine modes (\"reverse alphabetical\" = reverse + ascending, which would sort A to Z) yield;
 * (2) a word for an option or an order the lane does not do (duplicates, blank lines, ignoring case, z to a, backwards, numerically, naturally) yields;
 * (3) the text must sit inside quote marks, as for Case Converter (measured with the switch ON: \"sort the files in my folder\" sorted \"my folder\" and \"how do I sort a list in python\" sorted \"python\"). Both read the closed sets in the runners folder (FL13), never a phrase list.
 * A yield means no answer from the lane, so the old path or an ask replies: never a wrong sort.
 */
const sortLinesGuard: LaneGuard = (args, message) => {
  const unquoted = caseConverterGuard(args, message);
  if (unquoted !== null) return unquoted;
  const text = typeof args.text === 'string' ? args.text : '';
  const outside = text === '' ? message : message.split(text).join(' ');
  const words = sortWordsOf(outside);
  const modes = new Set<string>();
  for (const word of words) if (Object.prototype.hasOwnProperty.call(SORT_MODE_WORDS, word)) modes.add(SORT_MODE_WORDS[word]!);
  if (modes.size > 1) return 'the message names two different sort orders, so it asks instead of guessing';
  for (const word of words) if (Object.prototype.hasOwnProperty.call(SORT_OPTION_WORDS, word)) return 'the message asks for an option or an order this answer does not do, so it asks instead of ignoring it';
  return null;
};

export const LANE_GUARDS: Readonly<Record<string, LaneGuard>> = Object.freeze({ 'text-counter': textCounterGuard, 'case-converter': caseConverterGuard, 'sort-lines': sortLinesGuard });
