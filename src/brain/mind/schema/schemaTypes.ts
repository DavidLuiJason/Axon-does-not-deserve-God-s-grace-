/**
 * B04A ACTION SCHEMAS: the CONTRACT. Written by the Director (2026-10-27). The builder reads it and never changes it.
 *
 * WHAT AN ACTION SCHEMA IS: every tool (and every chat ability) DECLARES WHAT IT MEANS, so that the brain can find it by
 * MEANING instead of by remembered phrases (FL13). One schema per tool. A schema says:
 *   - MEANING:  `actions` (what the tool DOES, dictionary verbs) and `objects` (what it works ON, dictionary nouns or adjectives),
 *               each written "lemma:pos" with the lemma a real dictionary headword; `names` are the tool's own technical
 *               words that are NOT in the dictionary (json, csv, qr ...), matched exactly, never by meaning.
 *   - ACTS:     which speech acts it accepts: a request ("command") or a question ("ask").
 *   - SLOTS:    the typed arguments it needs (the values stage B03B1 already produces numbers, quantities, dates, times, durations).
 *   - EFFECTS, PRECONDITIONS, COST, UNDO: what running it changes, what must be true first, what it costs on a weak phone,
 *               whether it can be taken back. The Judgment stage (7C) looks ahead with these; nothing can be simulated without them.
 * Example phrases are NOT part of a schema (FL13): they stay in the registry descriptors as documentation.
 * Everything is PURE data and pure lookups: no clock, no storage, no dictionary, no screen, no random.
 *
 * HONESTY (FL15): every COST is an ESTIMATE until measured on the weakest phone; the field `basis` must say so.
 */

/** The closed LABELS of the format (structure, not vocabulary: nothing is matched against what the owner says). One string each. */
export const ACT_LABELS = 'command ask';
export const SLOT_KIND_LABELS = 'text number quantity date time duration file choice yes-no';
export const EFFECT_LABELS = 'shows-result reads-file writes-file stores-note changes-setting uses-camera uses-microphone uses-network sends spends deletes';
export const PRECONDITION_LABELS = 'permission owner-approval network-on device-capable';
export const COST_TIME_LABELS = 'instant quick slow';
export const COST_MEMORY_LABELS = 'low mid high';
export const UNDO_LABELS = 'not-needed by-tool by-removal irreversible';
export const STATUS_LABELS = 'ready built unbuilt left-out';
export const CHAT_STATUS_LABELS = 'available needs-screen needs-permission not-built';
/** Concept parts of speech: a = adjective (including satellite adjectives), n = noun, v = verb. */
export const OBJECT_POS_LABELS = 'n a';

/** Effect groups the checks use (each one string). */
/** PURE = nothing of the owner's changes: the answer is shown, a file is only read, a sensor or the network is only used. */
export const PURE_EFFECTS = 'shows-result reads-file uses-camera uses-microphone uses-network';
export const PERSISTENT_EFFECTS = 'writes-file stores-note changes-setting';
export const APPROVAL_EFFECTS = 'sends spends deletes';
export const PERMISSION_EFFECTS = 'uses-camera uses-microphone uses-network';
export const DEVICE_EFFECTS = 'uses-camera uses-microphone';

export type Act = 'command' | 'ask';
export type SlotKind = 'text' | 'number' | 'quantity' | 'date' | 'time' | 'duration' | 'file' | 'choice' | 'yes-no';
export type Effect =
  | 'shows-result' | 'reads-file' | 'writes-file' | 'stores-note' | 'changes-setting'
  | 'uses-camera' | 'uses-microphone' | 'uses-network' | 'sends' | 'spends' | 'deletes';
export type Precondition = 'permission' | 'owner-approval' | 'network-on' | 'device-capable';
export type CostTime = 'instant' | 'quick' | 'slow';
export type CostMemory = 'low' | 'mid' | 'high';
export type UndoKind = 'not-needed' | 'by-tool' | 'by-removal' | 'irreversible';
export type Status = 'ready' | 'built' | 'unbuilt' | 'left-out';

/** One typed argument. A 'choice' slot carries NO choices here: the registry descriptor owns them. */
export interface SlotSpec { readonly name: string; readonly kind: SlotKind; readonly required: boolean }
/** `time`: instant = under a tenth of a second, quick = under two seconds, slow = longer (needs a progress note). `memory`: working memory on the weakest supported phone. `basis` is always 'estimate' in this job. */
export interface Cost { readonly time: CostTime; readonly memory: CostMemory; readonly basis: 'estimate' }

export interface ActionSchema {
  /** The tool id from `toolFacts.json` (the Tools menu id, or the id of a chat ability). */
  readonly tool: string;
  readonly acts: readonly Act[];
  /** "lemma:v", dictionary verbs, 1 to 4. */
  readonly actions: readonly string[];
  /** "lemma:n" or "lemma:a", dictionary nouns or adjectives, 1 to 6. */
  readonly objects: readonly string[];
  /** Technical words NOT in the dictionary, lowercase letters and digits, 0 to 4. */
  readonly names: readonly string[];
  readonly slots: readonly SlotSpec[];
  readonly effects: readonly Effect[];
  readonly preconditions: readonly Precondition[];
  readonly cost: Cost;
  readonly undo: UndoKind;
}

/** What the Director extracted from the live Tools menu and the registry (tests/fixtures/toolFacts.json). READ ONLY. */
export interface ToolFact {
  readonly kind: 'tool' | 'ability';
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly group: string;
  readonly subgroup?: string;
  /** A screen exists for it (the Tools menu says "available"). */
  readonly screen: boolean;
  /** The status of its chat action in the registry today. */
  readonly chat: 'available' | 'needs-screen' | 'needs-permission' | 'not-built';
  /** The owner left this tool out of the plan; its schema still exists but nothing may route to it. */
  readonly leftOut: boolean;
  /** Registry descriptor facts (absent for tools that have no engine descriptor yet). */
  readonly purposes?: readonly string[];
  readonly inputs?: readonly { readonly name: string; readonly kind: 'text' | 'choice' | 'file' | 'yes-no'; readonly choices?: readonly string[]; readonly prompt?: string }[];
  /** Documentation only. NEVER copy these into a schema. */
  readonly examples?: readonly string[];
}

/** Derived, never declared: left out, else ready (chat works today), else built (a screen exists), else unbuilt. */
export function deriveStatus(fact: ToolFact): Status {
  if (fact.leftOut) return 'left-out';
  if (fact.chat === 'available') return 'ready';
  return fact.screen ? 'built' : 'unbuilt';
}

/** A descriptor input kind and the slot kinds that may carry it. */
export function slotKindsFor(inputKind: 'text' | 'choice' | 'file' | 'yes-no'): string {
  if (inputKind === 'text') return 'text number quantity date time duration';
  return inputKind;
}

/** The module `actionSchemas.ts` exports exactly this (the runner checks every line). */
export interface ActionSchemaApi {
  /** Deeply frozen, one schema per fact, in the order of toolFacts.json. */
  readonly ACTION_SCHEMAS: readonly ActionSchema[];
  /** The schema of a tool id, or null (never throws, never finds '__proto__' or 'constructor'). */
  getSchema(tool: string): ActionSchema | null;
  /** A NEW array each call, same order as ACTION_SCHEMAS. */
  listSchemas(): ActionSchema[];
  /** Tool ids whose actions or objects contain this exact "lemma:pos" string, in ACTION_SCHEMAS order, each once. Unknown or non-string gives []. */
  schemasByConcept(concept: string): string[];
  /** Tool ids whose `names` contain this exact lowercase name, in ACTION_SCHEMAS order. Unknown or non-string gives []. */
  schemasByName(name: string): string[];
}
