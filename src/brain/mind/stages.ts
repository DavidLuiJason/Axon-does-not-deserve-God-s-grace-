/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B1 stage implementations. Understanding beyond placeholder structure is deferred.
 */
import type { BrainProvider, BrainRequest } from '../types';
import { maskCodeRegions } from '../symbols/protect';
import { classifySymbolRoles } from '../symbols/symbolRoles';
import type { MindContext, MindStage, Segment, StageId, StageState } from './types';
import { createLegacyExecutor } from './legacy';
import { dictionarySlot } from '../knowledge/dictionarySlot';
import type { KnowledgeSlot } from '../knowledge/slot';
import { createAnalyzer } from './analysis/analyze';
import { buildMeaning } from './meaning';
import { extractValues } from './meaning/values';
import { resolveMessage } from './resolve/clauseInputs';
import type { AdapterInput } from './resolve/clauseInputsTypes';

function withEntry(context: MindContext, stage: StageId, state: StageState, note: string, patch: Partial<MindContext> = {}): MindContext {
  return { ...context, ...patch, entries: [...context.entries, { stage, state, note }] };
}

function utcClock(milliseconds: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const date = new Date(milliseconds);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}

function makeSegments(text: string): { segments: Segment[]; note: string } {
  try {
    const protectedText = maskCodeRegions(text);
    if (protectedText.unsure) return { segments: [{ kind: 'language', text, start: 0, end: text.length }], note: 'code-region protection was unsure; treated as language' };
    const regions: Array<{ start: number; end: number; text: string }> = protectedText.regions.map((region) => ({ start: region.start, end: region.end, text: region.text }));
    const quoteStack: number[] = [];
    for (const mark of classifySymbolRoles(text)) {
      if (mark.role === 'quote_open') quoteStack.push(mark.index);
      else if (mark.role === 'quote_close' && quoteStack.length) {
        const start = quoteStack.pop()!;
        const end = mark.index + mark.symbol.length;
        regions.push({ start, end, text: text.slice(start, end) });
      }
    }
    regions.sort((a, b) => a.start - b.start || a.end - b.end);
    const material: Array<{ start: number; end: number; text: string }> = [];
    for (const region of regions) {
      const previous = material[material.length - 1];
      if (previous && region.start <= previous.end) {
        previous.end = Math.max(previous.end, region.end);
        previous.text = text.slice(previous.start, previous.end);
      } else material.push({ ...region });
    }
    if (!material.length) return { segments: [{ kind: 'language', text, start: 0, end: text.length }], note: 'existing protection found no material region' };
    const segments: Segment[] = [];
    let cursor = 0;
    for (const region of material) {
      if (region.start > cursor) segments.push({ kind: 'language', text: text.slice(cursor, region.start), start: cursor, end: region.start });
      segments.push({ kind: 'material', text: region.text, start: region.start, end: region.end });
      cursor = region.end;
    }
    if (cursor < text.length) segments.push({ kind: 'language', text: text.slice(cursor), start: cursor, end: text.length });
    return { segments, note: 'existing code and quote protection separated material' };
  } catch {
    return { segments: [{ kind: 'language', text, start: 0, end: text.length }], note: 'code-region protection unavailable; treated as language' };
  }
}

export function createStages(executor: ReturnType<typeof createLegacyExecutor>, now: () => number, nextId: () => string, slot: KnowledgeSlot = dictionarySlot): MindStage[] {
  function intake(context: MindContext): MindContext {
    const utterance = { id: nextId(), text: context.utterance.text, place: context.utterance.place, at: now() };
    return withEntry(context, 'intake', 'ran', 'request captured', { utterance });
  }
  function reading(context: MindContext): MindContext {
    const read = makeSegments(context.utterance.text);
    return withEntry(context, 'reading', 'ran', read.note, { analysis: { segments: read.segments, tokens: [] } });
  }
  async function analysis(context: MindContext): Promise<MindContext> {
    const analyze = createAnalyzer(slot, { maxLookups: 64, maxPhraseWords: 5 });
    const segments = context.analysis?.segments ?? [{ kind: 'language' as const, text: context.utterance.text, start: 0, end: context.utterance.text.length }];
    const result = await analyze(segments);
    if (!result.ok) return withEntry(context, 'analysis', 'ran', `analysis unavailable: ${result.error}`, { analysis: { segments, tokens: [] } });
    const note = `dictionary analysis; ${result.metrics.lookupCalls} lookups, ${result.metrics.cacheHits} cache hits${result.metrics.budgetExhausted ? ', budget exhausted' : ''}`;
    return withEntry(context, 'analysis', 'ran', note, { analysis: { segments, tokens: result.tokens, metrics: result.metrics } });
  }
  function meaning(context: MindContext): MindContext {
    const unreadable = { act: 'unknown' as const, confidence: 0 };
    if (!context.analysis || !context.analysis.metrics) return withEntry(context, 'meaning', 'not-built', 'meaning not read: the analysis did not complete', { frame: unreadable });
    try {
      const outcome = buildMeaning(context.analysis, context.utterance.text);
      if (!outcome.ok) return withEntry(context, 'meaning', 'not-built', `meaning not read: ${outcome.error}`, { frame: unreadable });
      const clauses = outcome.meaning.clauses;
      const note = clauses.length === 0
        ? (outcome.meaning.onlyMaterial ? '0 clauses: only quoted or code material, nothing is interpreted' : '0 clauses: no words')
        : `${clauses.length} clause${clauses.length === 1 ? '' : 's'}: ${clauses.map((frame) => frame.polarity === 'negative' ? `${frame.act} (negative)` : frame.act).join(', ')}`;
      const first = clauses[0];
      return withEntry(context, 'meaning', 'ran', note, { meaning: outcome.meaning, frame: first ? { act: first.act, confidence: first.confidence } : unreadable });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return withEntry(context, 'meaning', 'not-built', `meaning failed: ${message}`, { frame: unreadable });
    }
  }
  function resolution(context: MindContext): MindContext {
    if (!context.analysis) return withEntry(context, 'resolution', 'not-built', 'not built: analysis is missing');
    if (!context.meaning?.structure) return withEntry(context, 'resolution', 'not-built', 'not built: Meaning structure is missing');
    try {
      const extracted = extractValues(context.utterance.text, context.analysis.segments, utcClock(now()));
      const values = extracted.ok ? extracted.values : [];
      const valueNote = extracted.ok ? '' : `; values unavailable: ${extracted.message}`;
      const structure = context.meaning.structure;
      const adapterInput: AdapterInput = {
        tokens: context.analysis.tokens,
        segments: context.analysis.segments,
        clauses: context.meaning.clauses,
        words: structure.words,
        pieces: structure.pieces,
        values,
      };
      // Deliberately omit options.status and options.related; those belong to later jobs.
      const resolutions = resolveMessage(adapterInput);
      const counts = { match: 0, ask: 0, unavailable: 0, none: 0 };
      for (const item of resolutions) {
        if (item.resolution.kind === 'match') counts.match += 1;
        else if (item.resolution.kind === 'ask') counts.ask += 1;
        else if (item.resolution.kind === 'unavailable') counts.unavailable += 1;
        else if (item.resolution.kind === 'none') counts.none += 1;
      }
      const note = `${structure.pieces.length} pieces; ${counts.match} matches, ${counts.ask} questions, ${counts.unavailable} unavailable, ${counts.none} none${valueNote}`;
      return withEntry(context, 'resolution', 'ran', note, { resolutions });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return withEntry(context, 'resolution', 'not-built', `resolution failed: ${message}`);
    }
  }
  function dialogue(context: MindContext): MindContext {
    return withEntry(context, 'dialogue', 'not-built', 'not built: dialogue state arrives in B5');
  }
  function planning(context: MindContext): MindContext {
    return withEntry(context, 'planning', 'not-built', 'not built: planning arrives in B6');
  }
  async function execution(context: MindContext): Promise<MindContext> {
    const request: BrainRequest = { text: context.utterance.text, place: context.utterance.place };
    const reply = await executor.run(request);
    return withEntry(context, 'execution', 'ran', 'legacy executor preserves current provider order and fallback', { reply });
  }
  function verification(context: MindContext): MindContext {
    return withEntry(context, 'verification', 'not-built', 'not built: verification arrives in B6');
  }
  function response(context: MindContext): MindContext {
    return withEntry(context, 'response', 'passed-through', 'B1 passes the legacy reply through unchanged');
  }
  return [
    { id: 'intake', run: async (context) => intake(context) },
    { id: 'reading', run: async (context) => reading(context) },
    { id: 'analysis', run: async (context) => analysis(context) },
    { id: 'meaning', run: async (context) => meaning(context) },
    { id: 'resolution', run: async (context) => resolution(context) },
    { id: 'dialogue', run: async (context) => dialogue(context) },
    { id: 'planning', run: async (context) => planning(context) },
    { id: 'execution', run: execution },
    { id: 'verification', run: async (context) => verification(context) },
    { id: 'response', run: async (context) => response(context) },
  ];
}
