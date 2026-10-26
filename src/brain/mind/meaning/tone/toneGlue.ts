/**
 * B03B3c-GLUE: builds the word facts the tone reading needs from the Meaning stage's word units, and runs the reading.
 * Pure. The tone only changes how AXON WORDS an answer (changesActions is always false); nothing here decides or runs anything.
 */
import type { Lex } from '../lexical';
import { readTone } from './readTone';
import type { MaterialRange, ToneReading, ToneWordFacts } from './toneTypes';

/** Closed set (grammar, not vocabulary): the words that make a message about the reader: second person and the product's own name. */
const ABOUT_AXON = new Set('you your yours yourself yourselves axon'.split(' '));
export const isAboutAxon = (word: string): boolean => ABOUT_AXON.has(word);

export function buildToneFacts(units: readonly Lex[], materials: readonly MaterialRange[]): ToneWordFacts[] {
  return units.map((unit) => {
    const material = materials.some((m) => unit.start >= m.start && unit.end <= m.end);
    return {
      start: unit.start, end: unit.end, norm: unit.norm,
      urgent: unit.urgent, anger: unit.anger, harsh: unit.harsh,
      negation: unit.neg, aboutAxon: unit.addressee, material,
    };
  });
}

export function readMessageTone(text: string, units: readonly Lex[], materials: readonly MaterialRange[]): ToneReading {
  const ranges: MaterialRange[] = materials.map((m) => ({ start: m.start, end: m.end }));
  return readTone(text, buildToneFacts(units, ranges), ranges);
}
