/**
 * B03B2 GLUE: joins B03B2a (linked clauses), B03B2b (clause parts) and B03B2c (pointers and relays) to the Meaning stage.
 * Pure. Takes the word units and the part-A clause ranges; adds nothing the three jobs do not already decide, only the
 * dictionary facts they need. Nothing here acts on the result yet: execution still goes through the legacy handlers.
 */
import type { Lex } from '../lexical';
import { readClauseParts } from './clauseParts';
import { linkClauses } from './links';
import { readReferences } from './references';
import type { MeaningStructure, StructurePiece } from './glueTypes';
import type { PartFacts, ClauseParts } from './partsTypes';
import type { RefFacts } from './refTypes';
import type { Gap, WordFacts, WordRange } from './types';

const hasVerb = (unit: Lex): boolean => (unit.pos.has('v') && !unit.digits) || unit.aux;

/**
 * "tell Tom to call me": the dictionary lists call as a noun AND a verb, which hides the infinitive. Only for a clause whose
 * main verb is a telling or asking verb, the verb-capable word right after the first "to" that follows the addressee is read as a verb.
 */
function relayFix(units: Lex[], facts: PartFacts[], range: WordRange, parts: ClauseParts): ClauseParts {
  const verb = parts.verb;
  if (verb === null || parts.copula || parts.infinitive !== null || !units[verb]!.speech) return parts;
  for (let p = verb + 2; p + 1 < range.to; p += 1) {
    if (units[p]!.norm !== 'to') continue;
    const target = units[p + 1]!;
    if (!hasVerb(target) || !target.pos.has('n')) return parts;
    const changed = facts.slice();
    changed[p + 1] = { ...facts[p + 1]!, noun: false };
    return readClauseParts(changed, [range])[0] ?? parts;
  }
  return parts;
}

export function buildStructure(units: Lex[], ranges: WordRange[], gapBefore: (k: number) => Gap, asks: boolean[]): MeaningStructure | undefined {
  if (units.length === 0 || ranges.length === 0) return undefined;
  const wordFacts: WordFacts[] = units.map((unit, k) => ({ norm: unit.norm, verb: hasVerb(unit), subject: unit.subject, gapBefore: k === 0 ? 'none' : gapBefore(k) }));
  const linked = linkClauses(wordFacts, ranges, asks);
  const pieces = linked.ranges;
  if (pieces.length === 0) return undefined;
  const partFacts: PartFacts[] = units.map((unit) => ({ norm: unit.norm, verb: hasVerb(unit), aux: unit.aux, noun: unit.pos.has('n'), determiner: unit.determiner }));
  const parts = readClauseParts(partFacts, pieces).map((value, i) => relayFix(units, partFacts, pieces[i]!, value));
  const refFacts: RefFacts[] = units.map((unit) => ({ norm: unit.norm, verb: hasVerb(unit), noun: unit.pos.has('n'), determiner: unit.determiner, subject: unit.subject, first: unit.speaker, speech: unit.speech }));
  const refs = readReferences(refFacts, pieces, parts);
  let clause = 0;
  const out: StructurePiece[] = pieces.map((piece, i) => {
    while (clause + 1 < ranges.length && piece.from >= ranges[clause + 1]!.from) clause += 1;
    return { from: piece.from, to: piece.to, clause, mayRunAlone: linked.mayRunAlone[i] ?? true, parts: parts[i]!, refs: refs[i]! };
  });
  return { words: units.map((unit) => ({ norm: unit.norm, start: unit.start, end: unit.end })), pieces: out, links: linked.links };
}
