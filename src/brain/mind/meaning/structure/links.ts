import { LINK_WORDS } from './linkWords';
import type { ClauseLink, LinkClauses, LinkKind, StructureResult, WordFacts, WordRange } from './types';

const EMPTY: StructureResult = { ranges: [], links: [], mayRunAlone: [] };

/** Connects clauses introduced by the closed structural link-word set. */
export const linkClauses: LinkClauses = (words, ranges, asks) => {
  try {
    if (!Array.isArray(words) || !Array.isArray(ranges) || !Array.isArray(asks) || asks.length < ranges.length) return EMPTY;
    for (const word of words) {
      if (!word || typeof word.norm !== 'string' || typeof word.verb !== 'boolean' || typeof word.subject !== 'boolean' || (word.gapBefore !== 'none' && word.gapBefore !== 'weak' && word.gapBefore !== 'strong')) return EMPTY;
    }
    let previousTo = -1;
    for (const range of ranges) {
      if (!range || !Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 0 || range.to <= range.from || range.to > words.length || range.from < previousTo) return EMPTY;
      previousTo = range.to;
    }
    if (words.length === 0) return ranges.length === 0 ? { ranges: [], links: [], mayRunAlone: [] } : EMPTY;
    if (ranges.length === 0) return EMPTY;
    for (let i = 0; i < ranges.length; i += 1) if (typeof asks[i] !== 'boolean') return EMPTY;

    const kinds = new Map<string, LinkKind>();
    for (const kind of Object.keys(LINK_WORDS) as LinkKind[]) {
      for (const marker of LINK_WORDS[kind].split(' ')) kinds.set(marker, kind);
    }

    const output: WordRange[] = [];
    const outputInside: boolean[] = [];
    const outputKind: Array<LinkKind | null> = [];
    const outputMarker: Array<string | null> = [];

    for (let ri = 0; ri < ranges.length; ri += 1) {
      const input = ranges[ri]!;
      const start = output.length;
      if (asks[ri]) {
        output.push({ from: input.from, to: input.to });
        outputInside.push(false); outputKind.push(null); outputMarker.push(null);
        continue;
      }
      const candidates: number[] = [];
      for (let p = input.from; p < input.to; p += 1) if (kinds.has(words[p]!.norm)) candidates.push(p);
      const real: number[] = [];
      for (let ci = 0; ci < candidates.length; ci += 1) {
        const p = candidates[ci]!;
        const stop = ci + 1 < candidates.length ? candidates[ci + 1]! : input.to;
        let valid = p + 1 < input.to && words[p + 1]!.subject;
        for (let q = p + 1; !valid && q < stop; q += 1) if (words[q]!.verb) valid = true;
        if (valid) real.push(p);
      }
      const realSet = new Set(real);
      const boundaries = [input.from, ...real];
      for (let bi = 0; bi < boundaries.length; bi += 1) {
        const from = boundaries[bi]!;
        const to = bi + 1 < boundaries.length ? boundaries[bi + 1]! : input.to;
        if (to <= from) continue;
        const dependent = realSet.has(from);
        output.push({ from, to });
        outputInside.push(dependent && from !== input.from);
        outputKind.push(dependent ? kinds.get(words[from]!.norm)! : null);
        outputMarker.push(dependent ? words[from]!.norm : null);
      }
    }

    const sentence: number[] = [];
    let sentenceId = 0;
    for (let i = 0; i < output.length; i += 1) {
      if (i > 0 && words[output[i]!.from]!.gapBefore === 'strong') sentenceId += 1;
      sentence.push(sentenceId);
    }

    const previousMain: Array<number | null> = [];
    const nextMain: Array<number | null> = new Array(output.length).fill(null);
    let lastMain: number | null = null;
    for (let i = 0; i < output.length; i += 1) {
      if (i > 0 && sentence[i] !== sentence[i - 1]) lastMain = null;
      previousMain[i] = lastMain;
      if (outputKind[i] === null) lastMain = i;
    }
    let followingMain: number | null = null;
    for (let i = output.length - 1; i >= 0; i -= 1) {
      if (i + 1 < output.length && sentence[i] !== sentence[i + 1]) followingMain = null;
      nextMain[i] = followingMain;
      if (outputKind[i] === null) followingMain = i;
    }

    const links: ClauseLink[] = [];
    const alone = output.map(() => true);
    for (let i = 0; i < output.length; i += 1) {
      const kind = outputKind[i];
      if (kind === null) continue;
      const main = outputInside[i] ? (previousMain[i] ?? nextMain[i]) : (nextMain[i] ?? previousMain[i]);
      links.push({ kind, marker: outputMarker[i]!, dependent: i, main });
      alone[i] = false;
      if (main !== null && kind !== 'reason') alone[main] = false;
    }
    return { ranges: output, links, mayRunAlone: alone };
  } catch {
    return EMPTY;
  }
};
