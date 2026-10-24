/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Mind B1: typed structure for the staged brain pipeline.
 */
import type { BrainReply, Place } from '../types';

export type StageId = 'intake' | 'reading' | 'analysis' | 'meaning' | 'resolution' | 'dialogue' | 'planning' | 'execution' | 'verification' | 'response';
export type StageState = 'ran' | 'passed-through' | 'not-built';
export interface Utterance { id: string; text: string; place: Place; at: number }
export interface Segment { kind: 'language' | 'material'; text: string; start: number; end: number }
export interface Token {
  surface: string;
  lemma: string;
  alternativeLemmas?: string[];
  start: number;
  end: number;
  knowledge?: 'known' | 'unknown' | 'not-checked';
  partsOfSpeech?: string[];
  synsetIds?: string[];
  morphology?: { via: 'irregular' | 'rule'; rule: string };
  entry?: { surface: string; start: number; end: number };
}
export interface Analysis {
  segments: Segment[];
  tokens: Token[];
  metrics?: { lookupCalls: number; cacheHits: number; budget: number; budgetExhausted: boolean; budgetUnits?: number };
}
/** B03A: what a clause is. Teach and correct arrive in part B. */
export type SpeechAct = 'ask' | 'command' | 'greet' | 'thanks' | 'chat' | 'unknown';
export interface Frame { act: SpeechAct; confidence: number }
/** B03A: one instruction-sized piece of a message. `tokenRange` is [from, to) over `Analysis.tokens`; `materialIds` index `Analysis.segments`. */
export interface Clause { span: { start: number; end: number }; tokenRange: { from: number; to: number }; materialIds: number[] }
export interface ActReading { act: SpeechAct; confidence: number; reason: string }
export interface ClauseFrame { clause: Clause; act: SpeechAct; polarity: 'positive' | 'negative'; confidence: number; reason: string; alternatives: ActReading[] }
export interface Meaning { clauses: ClauseFrame[]; onlyMaterial: boolean }
export interface TraceEntry { stage: StageId; state: StageState; note: string }
export interface MindTrace { utterance: Utterance; entries: TraceEntry[] }
export interface MindContext { utterance: Utterance; analysis?: Analysis; frame?: Frame; meaning?: Meaning; reply?: BrainReply; entries: TraceEntry[] }
export interface MindStage { id: StageId; run(context: MindContext): Promise<MindContext> }
