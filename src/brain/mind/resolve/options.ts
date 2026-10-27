import { MAX_LIST_ENTRIES, ONE_STEP_SIMILARITY, SYNONYM_SIMILARITY, TWO_STEP_SIMILARITY } from './optionsTypes';
import type { RelationLookup, Relations } from './optionsTypes';
import { deriveStatus } from '../schema/schemaTypes';
import type { Status, ToolFact } from '../schema/schemaTypes';

function conceptPos(key: string): string | null {
  const separator = key.lastIndexOf(':');
  if (separator <= 0 || separator !== key.length - 2) return null;
  const pos = key.slice(separator + 1);
  return pos === 'v' || pos === 'n' || pos === 'a' ? pos : null;
}

function list(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const entry of value.slice(0, MAX_LIST_ENTRIES)) {
    if (typeof entry === 'string') result.push(entry);
  }
  return result;
}

function makeRelations(value: unknown): Relations {
  if (value === null || typeof value !== 'object') {
    return { synonyms: [], broader: [], narrower: [] };
  }
  const record = value as Record<string, unknown>;
  return {
    synonyms: list(record.synonyms),
    broader: list(record.broader),
    narrower: list(record.narrower)
  };
}

export function makeRelated(lookup: RelationLookup): (inputKey: string, schemaKey: string) => number {
  return (inputKey: string, schemaKey: string): number => {
    if (typeof inputKey !== 'string' || typeof schemaKey !== 'string' || inputKey.length === 0 || schemaKey.length === 0) return 0;
    if (inputKey === schemaKey) return 1;
    const inputPos = conceptPos(inputKey);
    if (inputPos === null || inputPos !== conceptPos(schemaKey)) return 0;

    const cache = new Map<string, Relations>();
    const read = (key: string): Relations => {
      const known = cache.get(key);
      if (known !== undefined) return known;
      let result: Relations = { synonyms: [], broader: [], narrower: [] };
      try {
        result = makeRelations(lookup(key));
      } catch {
        result = { synonyms: [], broader: [], narrower: [] };
      }
      cache.set(key, result);
      return result;
    };

    const input = read(inputKey);
    const schema = read(schemaKey);
    if (input.synonyms.includes(schemaKey) || schema.synonyms.includes(inputKey)) return SYNONYM_SIMILARITY;
    if (input.broader.includes(schemaKey) || input.narrower.includes(schemaKey) ||
        schema.broader.includes(inputKey) || schema.narrower.includes(inputKey)) return ONE_STEP_SIMILARITY;

    const hasTwoSteps = (startKey: string, endKey: string, direction: 'broader' | 'narrower'): boolean => {
      const first = read(startKey)[direction];
      for (const middleKey of first) {
        if (middleKey === endKey) continue;
        if (read(middleKey)[direction].includes(endKey)) return true;
      }
      return false;
    };
    if (hasTwoSteps(inputKey, schemaKey, 'broader') ||
        hasTwoSteps(inputKey, schemaKey, 'narrower') ||
        hasTwoSteps(schemaKey, inputKey, 'broader') ||
        hasTwoSteps(schemaKey, inputKey, 'narrower')) return TWO_STEP_SIMILARITY;
    return 0;
  };
}

export function statusMapFrom(facts: readonly ToolFact[]): Readonly<Record<string, Status>> {
  const result = Object.create(null) as Record<string, Status>;
  if (Array.isArray(facts)) {
    for (const fact of facts as readonly unknown[]) {
      if (fact === null || typeof fact !== 'object') continue;
      const id = (fact as { id?: unknown }).id;
      if (typeof id !== 'string' || id.length === 0 || id === '__proto__') continue;
      if (Object.prototype.hasOwnProperty.call(result, id)) continue;
      result[id] = deriveStatus(fact as ToolFact);
    }
  }
  return Object.freeze(result);
}
