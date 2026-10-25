import type { WordRange } from './types';
export interface PartFacts { readonly norm: string; readonly verb: boolean; readonly aux: boolean; readonly noun: boolean; readonly determiner: boolean }
export interface Span { readonly from: number; readonly to: number }
export interface Detail { readonly marker: string; readonly from: number; readonly to: number }
export interface ClauseParts { readonly verb: number | null; readonly copula: boolean; readonly object: Span | null; readonly details: Detail[]; readonly infinitive: number | null }
export type ReadClauseParts = (words: readonly PartFacts[], ranges: readonly WordRange[]) => ClauseParts[];
