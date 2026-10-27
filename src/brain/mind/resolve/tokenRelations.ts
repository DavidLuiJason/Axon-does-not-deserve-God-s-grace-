/**
 * B04B3 GLUE (Director, 2026-10-27): turns the sense hints the Analysis stage already put on the message's own words into the
 * `RelationLookup` that `makeRelated` needs. PURE and synchronous: no dictionary access, no clock, no storage.
 *
 * WHAT IT KNOWS: for a word of the message, the synonyms that the dictionary lists for the senses of that word with the asked part of
 * speech (the Analysis stage keeps at most 16 senses per word and at most 5 synonyms per sense: a KNOWN LIMIT, so a synonym that the
 * dictionary lists later is not seen). It says nothing about the tool's own words: `makeRelated` reads both directions, so a tool word
 * that is listed as a synonym of a message word is enough.
 * WHAT IT DOES NOT KNOW: broader and narrower concepts. The dictionary shipped in AXON carries synonyms per sense but no broader or
 * narrower links, so those lists stay empty here (HYPOTHESIS: a later dictionary shelf with those links, under FL6 and FL15).
 */
import type { RelationLookup, Relations } from './optionsTypes';

export interface HintLike { readonly pos?: unknown; readonly synonyms?: unknown }
export interface HintedToken { readonly lemma?: unknown; readonly senseHints?: unknown }

const NONE: Relations = { synonyms: [], broader: [], narrower: [] };

/** The one letter of a hint's part of speech (words or tags), or '' when it is none of noun, verb, adjective. */
function posLetter(pos: unknown): string {
  if (typeof pos !== 'string') return '';
  const p = pos.toLowerCase();
  if (p === 'n' || p === 'noun') return 'n';
  if (p === 'v' || p === 'verb') return 'v';
  if (p === 'a' || p === 's' || p === 'adjective') return 'a';
  return '';
}

export function relationLookupFromTokens(tokens: readonly HintedToken[]): RelationLookup {
  const list: readonly HintedToken[] = Array.isArray(tokens) ? tokens : [];
  return (key: string): Relations | null => {
    if (typeof key !== 'string') return null;
    const cut = key.lastIndexOf(':');
    if (cut <= 0) return null;
    const lemma = key.slice(0, cut).toLowerCase();
    const letter = key.slice(cut + 1);
    const found: string[] = [];
    for (const token of list) {
      if (!token || typeof token.lemma !== 'string' || token.lemma.toLowerCase() !== lemma || !Array.isArray(token.senseHints)) continue;
      for (const hint of token.senseHints as readonly HintLike[]) {
        if (!hint || posLetter(hint.pos) !== letter || !Array.isArray(hint.synonyms)) continue;
        for (const synonym of hint.synonyms) {
          if (typeof synonym !== 'string') continue;
          const word = synonym.toLowerCase();
          if (word === lemma || word.length === 0) continue;
          const entry = `${word}:${letter}`;
          if (!found.includes(entry)) found.push(entry);
        }
      }
    }
    return found.length === 0 ? NONE : { synonyms: found, broader: [], narrower: [] };
  };
}
