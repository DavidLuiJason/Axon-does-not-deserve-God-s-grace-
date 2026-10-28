import { ACTION_SCHEMAS } from '../schema/actionSchemas';
import { VALUE_KIND_LABELS } from '../schema/schemaTypes';
import type { ActionSchema, SlotKind, Status, ValueKind } from '../schema/schemaTypes';
import { ASK_MARGIN, MAX_CANDIDATES, VALUE_WEIGHT } from './resolveTypes';
import type { Candidate, Resolution, ResolveInput, ResolveOptions } from './resolveTypes';

const schemaKeys = new Map<ActionSchema, readonly string[]>();
const keyCounts = new Map<string, number>();
for (const schema of ACTION_SCHEMAS) {
  const keys = [...new Set([
    ...schema.actions.map((value) => `a|${value}`),
    ...schema.objects.map((value) => `o|${value}`),
    ...schema.names.map((value) => `n|name:${value}`),
    ...(schema.values ?? []).map((value) => `v|${value}`)
  ])];
  schemaKeys.set(schema, keys);
  for (const key of keys) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
}

const empty = (kind: 'none' | 'not-a-request', reason: string): Resolution => ({
  kind, confidence: 0, reason, candidates: []
});
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const stringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((part) => typeof part === 'string');

function validInput(value: unknown): value is ResolveInput {
  if (!isRecord(value)) return false;
  if (typeof value.act !== 'string' || typeof value.polarity !== 'string') return false;
  if (!stringArray(value.verbs) || !stringArray(value.objects) || !stringArray(value.names) || !Array.isArray(value.provided)) return false;
  return value.provided.every((slot) => isRecord(slot) && typeof slot.kind === 'string');
}
function round2(value: number): number { return Math.round(value * 100) / 100; }
function conceptKeys(input: ResolveInput): { all: Set<string>; actions: Set<string>; objects: Set<string>; names: Set<string>; values: Set<string> } {
  const actions = new Set(input.verbs.filter((v) => v.length > 0).map((v) => `a|${v}`));
  const objects = new Set(input.objects.filter((v) => v.length > 0).map((v) => `o|${v}`));
  const names = new Set(input.names.filter((v) => v.length > 0).map((v) => `n|name:${v}`));
  const labels = VALUE_KIND_LABELS.split(' ');
  const values = new Set(input.provided.flatMap((slot) => {
    const value: unknown = slot && typeof slot === 'object' ? slot.value : undefined;
    return typeof value === 'string' && labels.includes(value) ? [`v|${value as ValueKind}`] : [];
  }));
  return { all: new Set([...actions, ...objects, ...names, ...values]), actions, objects, names, values };
}
function similarity(inputKey: string, schemaKey: string, group: string, related: ResolveOptions['related']): number {
  if (inputKey === schemaKey) return 1;
  if (group === 'n' || typeof related !== 'function') return 0;
  let value: number;
  try { value = related(inputKey.slice(2), schemaKey.slice(2)); } catch { return 0; }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}
function reasonFor(matched: readonly string[], kind: Resolution['kind']): string {
  const concepts = matched.map((key) => key.startsWith('n|name:') ? key.slice(7) : key.slice(2)).filter(Boolean);
  if (kind === 'none') return 'No schema shares a recognised concept with this clause.';
  if (kind === 'not-a-request') return 'The clause is not a tool request or question.';
  if (kind === 'ask') return `The clause shares ${concepts.join(', ')} with multiple plausible tools, so clarification is needed.`;
  if (kind === 'unavailable') return `The clause matches the concepts ${concepts.join(', ')}, but the selected tool is unavailable.`;
  if (kind === 'negated') return concepts.length ? `The clause matches the concepts ${concepts.join(', ')}, but its polarity is negative.` : 'The clause is negative and no matching tool was found.';
  return `The clause matches the concepts ${concepts.join(', ')}.`;
}

export function resolveClause(input: ResolveInput, options: ResolveOptions = {}): Resolution {
  if (!validInput(input)) return empty('none', 'The input is incomplete or malformed, so no safe match can be made.');
  if (input.act === 'greet' || input.act === 'thanks' || input.act === 'chat' || input.act === 'unknown') {
    return empty('not-a-request', 'The clause is not a tool request or question.');
  }
  if (input.act !== 'command' && input.act !== 'ask') return empty('none', 'The clause has no recognised speech act.');
  const keys = conceptKeys(input);
  const eligible = ACTION_SCHEMAS.filter((schema) => schema.acts.includes(input.act as 'command' | 'ask'));
  const scored: { schema: ActionSchema; score: number; matched: string[] }[] = [];
  for (const schema of eligible) {
    const matched: string[] = [];
    let score = 0;
    for (const schemaKey of schemaKeys.get(schema) ?? []) {
      const group = schemaKey.slice(0, 1);
      let best = 0;
      const groupInputs = group === 'a' ? keys.actions : group === 'o' ? keys.objects : group === 'n' ? keys.names : keys.values;
      for (const inputKey of groupInputs) {
        const matchedSimilarity = group === 'v' ? (inputKey === schemaKey ? 1 : 0) : similarity(inputKey, schemaKey, group, options.related);
        best = Math.max(best, matchedSimilarity);
      }
      if (best > 0) {
        score += (best / (keyCounts.get(schemaKey) ?? 1)) * (group === 'v' ? VALUE_WEIGHT : 1);
        matched.push(schemaKey);
      }
    }
    if (score > 0) scored.push({ schema, score, matched });
  }
  scored.sort((a, b) => b.score - a.score || (a.schema.tool < b.schema.tool ? -1 : a.schema.tool > b.schema.tool ? 1 : 0));
  if (scored.length === 0) return empty('none', 'No schema shares a recognised concept with this clause.');
  const top = scored[0]!;
  const second = scored[1]?.score ?? 0;
  const candidates: Candidate[] = scored.slice(0, MAX_CANDIDATES).map(({ schema, score, matched }) => ({ tool: schema.tool, score, matched: [...matched] }));
  const confidence = round2(top.score / (top.score + second + 0.25));
  const hasValue = top.matched.some((key) => key.startsWith('v|'));
  const hasConcept = top.matched.some((key) => !key.startsWith('v|'));
  const evidence: 'concept' | 'value' | 'both' = hasValue && hasConcept ? 'both' : hasValue ? 'value' : 'concept';
  if (input.polarity === 'negative') {
    return { kind: 'negated', tool: top.schema.tool, confidence, reason: reasonFor(top.matched, 'negated'), candidates, evidence };
  }
  if (scored.length > 1 && top.score - second < ASK_MARGIN) {
    const choices = candidates.map((candidate) => candidate.tool);
    return { kind: 'ask', choices, confidence, reason: reasonFor([...new Set(scored.slice(0, choices.length).flatMap((item) => item.matched))], 'ask'), candidates, evidence };
  }
  const status = options.status?.[top.schema.tool];
  if (status === 'unbuilt' || status === 'left-out') {
    return { kind: 'unavailable', tool: top.schema.tool, status: status as Status, confidence, reason: reasonFor(top.matched, 'unavailable'), candidates, evidence };
  }
  const remaining = new Map<SlotKind, number>();
  for (const slot of input.provided) {
    if (slot && typeof slot.kind === 'string') remaining.set(slot.kind as SlotKind, (remaining.get(slot.kind as SlotKind) ?? 0) + 1);
  }
  const missingSlots: string[] = [];
  for (const slot of top.schema.slots) {
    if (!slot.required) continue;
    const count = remaining.get(slot.kind) ?? 0;
    if (count > 0) remaining.set(slot.kind, count - 1);
    else missingSlots.push(slot.name);
  }
  return { kind: 'match', tool: top.schema.tool, missingSlots, confidence, reason: reasonFor(top.matched, 'match'), candidates, evidence };
}
