/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RAND1: the real random source for the direct lane. Until now the lane was given `randomBelow: () => 0` and `random01: () => 0`,
 * so a password, a pick or a shuffle run in chat would always have come out the same. This file is pure apart from the one
 * injectable `fill` (default: the platform's secure random, `crypto.getRandomValues`). If no secure source exists it THROWS when asked,
 * and the lane's own catch makes it yield to the old path: it never falls back to Math.random and never to a constant.
 */
export type FillRandom = (words: Uint32Array) => void;

export type LaneRandom = { readonly randomBelow: (maxExclusive: number) => number; readonly random01: () => number };

const TWO_32 = 4294967296;

function platformFill(words: Uint32Array): void {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('No secure random source is available.');
  c.getRandomValues(words);
}

export function createLaneRandom(fill: FillRandom = platformFill): LaneRandom {
  const one = new Uint32Array(1);
  const two = new Uint32Array(2);
  return {
    /** An unbiased whole number from 0 up to (not including) maxExclusive, by rejection sampling. */
    randomBelow: (maxExclusive: number): number => {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > TWO_32) throw new RangeError('randomBelow needs a whole number from 1 to 4294967296.');
      if (maxExclusive === 1) return 0;
      const limit = TWO_32 - (TWO_32 % maxExclusive);
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        fill(one);
        const x = one[0] as number;
        if (x < limit) return x % maxExclusive;
      }
      throw new Error('The random source kept returning unusable values.');
    },
    /** A number from 0 up to (not including) 1 with 53 random bits. */
    random01: (): number => {
      fill(two);
      const hi = (two[0] as number) >>> 5;
      const lo = (two[1] as number) >>> 6;
      return (hi * 67108864 + lo) / 9007199254740992;
    },
  };
}
