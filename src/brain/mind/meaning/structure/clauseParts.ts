import { DETAIL_WORDS } from './detailWords';
import type { ClauseParts, Detail, PartFacts, ReadClauseParts, Span } from './partsTypes';
import type { WordRange } from './types';
import { isPoliteness, isQuantityPair, isSecondQuantityPair } from '../closedSets';

const EMPTY_PARTS: ClauseParts = {
  verb: null,
  copula: false,
  object: null,
  details: [],
  infinitive: null,
  quantity: null,
  quantitySecond: null,
};

const MARKERS = new Set(DETAIL_WORDS.split(' '));

function validFacts(value: unknown): value is PartFacts {
  if (value === null || typeof value !== 'object') return false;
  const facts = value as Partial<PartFacts>;
  return typeof facts.norm === 'string'
    && typeof facts.verb === 'boolean'
    && typeof facts.aux === 'boolean'
    && typeof facts.noun === 'boolean'
    && typeof facts.determiner === 'boolean';
}

function validRange(value: unknown, wordCount: number): value is WordRange {
  if (value === null || typeof value !== 'object') return false;
  const range = value as Partial<WordRange>;
  return Number.isInteger(range.from)
    && Number.isInteger(range.to)
    && (range.from as number) >= 0
    && (range.to as number) > (range.from as number)
    && (range.to as number) <= wordCount;
}

function emptyParts(): ClauseParts {
  return { ...EMPTY_PARTS, details: [] };
}

export const readClauseParts: ReadClauseParts = (words, ranges) => {
  try {
    if (!Array.isArray(words) || !Array.isArray(ranges)) return [];
    const output: ClauseParts[] = [];

    for (let ri = 0; ri < ranges.length; ri += 1) {
      const range: unknown = ranges[ri];
      if (!validRange(range, words.length)) {
        output.push(emptyParts());
        continue;
      }

      const from = range.from;
      const to = range.to;
      let factsOkay = true;
      for (let i = from; i < to; i += 1) {
        if (!validFacts(words[i])) {
          factsOkay = false;
          break;
        }
      }
      if (!factsOkay) {
        output.push(emptyParts());
        continue;
      }

      // RESOLVE-TC part 4 (owner-approved closed set): after "how many" the next words are the COUNTED NOUN, never the verb.
      let quantity: Span | null = null;
      for (let q = from; q + 2 < to; q += 1) {
        if (!isQuantityPair(words[q]!.norm, words[q + 1]!.norm)) continue;
        let end = q + 2;
        while (end < to && !words[end]!.aux && !MARKERS.has(words[end]!.norm)) end += 1;
        if (end > q + 2) quantity = { from: q + 2, to: end };
        break;
      }

      // RESOLVE-TC part 5: "how much <noun phrase>" keeps the noun phrase as a SECOND reading only; the verb search is NOT changed.
      let quantitySecond: Span | null = null;
      if (quantity === null) {
        for (let q = from; q + 2 < to; q += 1) {
          if (!isSecondQuantityPair(words[q]!.norm, words[q + 1]!.norm)) continue;
          let end = q + 2;
          while (end < to && !words[end]!.aux && !MARKERS.has(words[end]!.norm)) end += 1;
          if (end > q + 2) quantitySecond = { from: q + 2, to: end };
          break;
        }
      }

      let firstAux: number | null = null;
      let mainVerb: number | null = null;
      for (let i = from; i < to; i += 1) {
        const word = words[i]!;
        if (isPoliteness(word.norm)) continue; // RESOLVE-TC part 4 (owner-approved closed set): "please" and "kindly" never carry the verb
        if (quantity !== null && i >= quantity.from && i < quantity.to) continue;
        // PARTS-TEXT part 3: once the clause has its auxiliary, a marker word (except the infinitive "to") opens the detail; a verb-capable word inside it ("in the quick brown fox") is never the main verb.
        if (firstAux !== null && word.norm !== 'to' && MARKERS.has(word.norm)) break;
        if (word.aux && firstAux === null) firstAux = i;
        if (word.verb && !word.aux && (i === from || !words[i - 1]!.determiner)) {
          mainVerb = i;
          break;
        }
      }

      let copula = false;
      if (mainVerb === null && firstAux !== null) {
        mainVerb = firstAux;
        copula = true;
      }

      let infinitive: number | null = null;
      const markers: Detail[] = [];
      let pending: { marker: string; from: number } | null = null;
      let firstDetail: number | null = null;
      const markerScanStart = mainVerb === null ? from : mainVerb + 1;

      for (let i = markerScanStart; i < to; i += 1) {
        const word = words[i]!;
        if (!MARKERS.has(word.norm)) continue;
        if (i + 1 >= to) continue;

        if (word.norm === 'to' && words[i + 1]!.verb && !words[i + 1]!.noun) {
          if (infinitive === null) infinitive = i;
          continue;
        }

        if (pending !== null) {
          markers.push({ marker: pending.marker, from: pending.from, to: i });
        } else if (firstDetail === null) {
          firstDetail = i;
        }
        pending = { marker: word.norm, from: i };
      }
      if (pending !== null) markers.push({ marker: pending.marker, from: pending.from, to });

      let object: Span | null = null;
      if (mainVerb !== null && !copula) {
        const objectTo = firstDetail === null ? to : firstDetail;
        if (mainVerb + 1 < objectTo) object = { from: mainVerb + 1, to: objectTo };
      }

      output.push({ verb: mainVerb, copula, object, details: markers, infinitive, quantity, quantitySecond });
    }
    return output;
  } catch {
    if (!Array.isArray(ranges)) return [];
    return ranges.map(() => emptyParts());
  }
};
