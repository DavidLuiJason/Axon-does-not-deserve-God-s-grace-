/**
 * C1 PART 3: TEXT-COUNTER PILOT RUNNER (Director, 2026-10-31).
 *
 * A thin PURE runner over the existing count engine (`src/kernel/textCount.ts`, the same engine the Text Counter screen and the
 * chat use, FL14). Slots (schema): `text` (required), `unit` (optional choice: words, characters, letters, lines, all).
 * The reply copies the legacy chat reply (headline + four count lines) EXACTLY. The legacy extras, the code-part note and the
 * chat's "say cancel" hint, belong to the chat dialogue, not to the tool, and stay with the legacy handler.
 * Its switch starts OFF: legacy keeps answering until the owner decides.
 */
import { countText } from '../../kernel/textCount';
import { getSchema } from './runnerSchema';
import { runnerFail, shortenReply, type RunnerArgs, type RunnerDeps, type RunnerOutcome, type ToolRunner } from './runnerTypes';

/** The unit words the binder may fill (the same closed set the old chat handler reads); the runner folds them to five units. */
export const TEXT_COUNTER_UNITS: readonly string[] = Object.freeze(['words', 'word', 'characters', 'character', 'chars', 'char', 'letters', 'letter', 'lines', 'line', 'all']);

function foldUnit(u: string): 'words' | 'characters' | 'letters' | 'lines' | 'all' {
  if (u.startsWith('word')) return 'words';
  if (u.startsWith('char')) return 'characters';
  if (u.startsWith('letter')) return 'letters';
  if (u.startsWith('line')) return 'lines';
  return 'all';
}
const TOOL = 'text-counter';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function run(args: RunnerArgs, _deps: RunnerDeps): Promise<RunnerOutcome> {
  try {
    if (!getSchema(TOOL)) return runnerFail(TOOL, 'invalid-input', 'This action is not available.');
    if (args === null || typeof args !== 'object') return runnerFail(TOOL, 'invalid-input', 'I could not read what to count.');
    for (const key of Object.keys(args)) {
      if (key !== 'text' && key !== 'unit') return runnerFail(TOOL, 'invalid-input', `I do not use "${key}" for counting.`, key);
    }
    const text = args.text;
    if (text === undefined) return runnerFail(TOOL, 'missing-input', 'What text should I count?', 'text');
    if (typeof text !== 'string') return runnerFail(TOOL, 'invalid-input', 'The text to count must be text.', 'text');
    const unitArg = args.unit;
    if (unitArg !== undefined && (typeof unitArg !== 'string' || !TEXT_COUNTER_UNITS.includes(unitArg))) {
      return runnerFail(TOOL, 'invalid-input', 'I can count words, characters, letters or lines.', 'unit');
    }
    const unit = unitArg === undefined ? 'all' : foldUnit(unitArg);
    const c = countText(text);
    let headline: string;
    switch (unit) {
      case 'words': headline = `That text has ${plural(c.words, 'word', 'words')}.`; break;
      case 'characters': headline = `That text has ${plural(c.characters, 'character', 'characters')} (${c.charactersNoSpaces} without spaces).`; break;
      case 'letters': headline = `That text has ${plural(c.letters, 'letter', 'letters')}.`; break;
      case 'lines': headline = `That text has ${plural(c.lines, 'line', 'lines')}.`; break;
      default: headline = 'Here are the counts for that text:';
    }
    const details = `Words: ${c.words}\nCharacters: ${c.characters} (${c.charactersNoSpaces} without spaces)\nLetters: ${c.letters}\nLines: ${c.lines}`;
    return { ok: true, toolId: TOOL, result: c, reply: shortenReply(`${headline}\n\n${details}`) };
  } catch {
    return runnerFail(TOOL, 'invalid-input', 'I could not count that.');
  }
}

export const TEXT_COUNTER_RUNNER: ToolRunner = Object.freeze({ toolId: TOOL, run });
