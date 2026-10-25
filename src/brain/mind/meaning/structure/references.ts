import { REF_WORDS } from './refWords';
import type { ClauseRefs, Pointer, RefFacts, Relay, ReadReferences } from './refTypes';
import type { ClauseParts } from './partsTypes';
import type { WordRange } from './types';

const THING_WORDS = new Set(REF_WORDS.thing.split(' '));
const AGAIN_WORDS = new Set(REF_WORDS.again.split(' '));
const EARLIER_WORDS = new Set(REF_WORDS.earlier.split(' '));
const ONE_WORDS = new Set(REF_WORDS.one.split(' '));

function emptyEntry(): ClauseRefs {
  return { pointers: [], relay: null, needsPrevious: false };
}

function validWord(value: unknown): value is RefFacts {
  if (value === null || typeof value !== 'object') return false;
  const word = value as Partial<RefFacts>;
  return typeof word.norm === 'string'
    && typeof word.verb === 'boolean'
    && typeof word.noun === 'boolean'
    && typeof word.determiner === 'boolean'
    && typeof word.subject === 'boolean'
    && typeof word.first === 'boolean'
    && typeof word.speech === 'boolean';
}

function validRange(value: unknown, count: number): value is WordRange {
  if (value === null || typeof value !== 'object') return false;
  const range = value as Partial<WordRange>;
  return Number.isInteger(range.from)
    && Number.isInteger(range.to)
    && (range.from as number) >= 0
    && (range.from as number) < (range.to as number)
    && (range.to as number) <= count;
}

function validParts(value: unknown): value is ClauseParts {
  if (value === null || typeof value !== 'object') return false;
  const parts = value as Partial<ClauseParts>;
  return (parts.verb === null || Number.isInteger(parts.verb))
    && typeof parts.copula === 'boolean'
    && (parts.infinitive === null || Number.isInteger(parts.infinitive))
    && (parts.object === null || (typeof parts.object === 'object'
      && parts.object !== null && Number.isInteger(parts.object.from) && Number.isInteger(parts.object.to)))
    && Array.isArray(parts.details);
}

export const readReferences: ReadReferences = (words, ranges, parts) => {
  try {
    if (!Array.isArray(words) || !Array.isArray(ranges) || !Array.isArray(parts)) return [];
    const output: ClauseRefs[] = [];

    for (let ri = 0; ri < ranges.length; ri += 1) {
      const rangeValue: unknown = ranges[ri];
      const partsValue: unknown = parts[ri];
      if (!validRange(rangeValue, words.length) || !validParts(partsValue)) {
        output.push(emptyEntry());
        continue;
      }

      const from = rangeValue.from;
      const to = rangeValue.to;
      let factsOkay = true;
      for (let i = from; i < to; i += 1) {
        if (!validWord(words[i])) {
          factsOkay = false;
          break;
        }
      }
      if (!factsOkay) {
        output.push(emptyEntry());
        continue;
      }

      const verb = partsValue.verb === null ? -1 : partsValue.verb;
      const infinitive = partsValue.infinitive;
      const pointers: Pointer[] = [];

      for (let i = from; i < to; i += 1) {
        const word = words[i]!;
        const previous = i > from ? words[i - 1]! : null;
        const next = i + 1 < to ? words[i + 1]! : null;

        if (AGAIN_WORDS.has(word.norm)) {
          pointers.push({ kind: 'again', at: i });
          continue;
        }

        if (i > verb || verb === -1) {
          if (THING_WORDS.has(word.norm)
            && (next === null || ONE_WORDS.has(next.norm)
              || (!next.noun && !next.subject && !next.verb && !next.determiner))) {
            pointers.push({ kind: 'thing', at: i });
            continue;
          }

          if (EARLIER_WORDS.has(word.norm)
            && previous !== null && previous.determiner
            && (next === null || ONE_WORDS.has(next.norm))) {
            pointers.push({ kind: 'earlier', at: i });
          }
        }
      }

      let relay: Relay | null = null;
      if (verb >= from && verb < to && !partsValue.copula
        && words[verb]!.speech && infinitive !== null
        && infinitive > verb + 1 && infinitive >= from && infinitive < to) {
        const addressee = { from: verb + 1, to: infinitive };
        const isOneFirstPerson = addressee.to === addressee.from + 1
          && words[addressee.from]!.first;
        relay = {
          verb,
          addressee,
          content: { from: infinitive, to },
          addresseeIsSpeaker: isOneFirstPerson,
        };
      }

      output.push({ pointers, relay, needsPrevious: verb === -1 && pointers.length > 0 });
    }
    return output;
  } catch {
    if (!Array.isArray(ranges)) return [];
    return ranges.map(() => emptyEntry());
  }
};
