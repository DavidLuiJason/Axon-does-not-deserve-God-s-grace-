import type { WordRange } from './types';
export interface PartFacts { readonly norm: string; readonly verb: boolean; readonly aux: boolean; readonly noun: boolean; readonly determiner: boolean }
export interface Span { readonly from: number; readonly to: number }
export interface Detail { readonly marker: string; readonly from: number; readonly to: number }
export interface ClauseParts { readonly verb: number | null; readonly copula: boolean; readonly object: Span | null; readonly details: Detail[]; readonly infinitive: number | null; /** RESOLVE-TC part 4: the counted noun phrase after "how many" (from inclusive, to exclusive), or null */ readonly quantity?: Span | null; /** RESOLVE-TC part 5: the noun phrase after "how much" (a possible slip for "how many"), or null */ readonly quantitySecond?: Span | null }
export type ReadClauseParts = (words: readonly PartFacts[], ranges: readonly WordRange[]) => ClauseParts[];
