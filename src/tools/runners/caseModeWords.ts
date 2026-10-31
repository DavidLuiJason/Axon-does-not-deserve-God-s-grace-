/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LIVE8-2: the CLOSED SET of mode words for Case Converter (FL13: one named file per approved group).
 * OWNER-APPROVED 2026-10-31: the owner said "choose it yourself" for the set proposed in docs/LIVE8_DESIGN.md section 4;
 * the Director chose it as written. "capitals" and "all caps" are NOT in the set (added later, one group at a time).
 * Word on the left (what a person says, lowercase), engine mode on the right (what `caseConvert` takes).
 */
import { CASE_CONVERT_MODES } from '../engines/text/caseConvert';

export const CASE_MODE_WORDS: Readonly<Record<string, (typeof CASE_CONVERT_MODES)[number]>> = Object.freeze({
  upper: 'UPPER', uppercase: 'UPPER',
  lower: 'lower', lowercase: 'lower',
  title: 'Title',
  sentence: 'Sentence',
  camel: 'camelCase', camelcase: 'camelCase',
  pascal: 'PascalCase', pascalcase: 'PascalCase',
  snake: 'snake_case', snake_case: 'snake_case',
  kebab: 'kebab-case', 'kebab-case': 'kebab-case',
  constant: 'CONSTANT_CASE', constant_case: 'CONSTANT_CASE',
});

/** The choice words the binder may fill: the closed set above (the binder compares ignoring capitals). */
export const CASE_MODE_CHOICES: readonly string[] = Object.freeze(Object.keys(CASE_MODE_WORDS));

/** Folds what the binder filled (or what the screen sends) to the engine mode. An engine mode passes through; an unknown word is returned unchanged so the runner refuses it. */
export function foldCaseMode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if ((CASE_CONVERT_MODES as readonly string[]).includes(value)) return value;
  const folded = Object.prototype.hasOwnProperty.call(CASE_MODE_WORDS, value.toLowerCase()) ? CASE_MODE_WORDS[value.toLowerCase()] : undefined;
  return folded ?? value;
}
