/** B03B4 SENSE BY CONTEXT: shapes. A reading only: nothing acts on it until the resolution stage (B04B) chooses with the real tools in view. */
export interface SenseChoice {
  synset: string;
  /** The dictionary gloss of this sense (short). */
  gloss: string;
  /** Ordinal, NOT calibrated: higher is better supported by the words around. */
  score: number;
  /** Stems that the words around share with this sense's gloss, synonyms and example. */
  evidence: string[];
}
export interface SenseReading {
  start: number;
  end: number;
  norm: string;
  /** The ranked senses (best first, at most four). */
  choices: SenseChoice[];
  /** The best sense when the context decides, otherwise null (AXON may then ask with choices). */
  best: string | null;
  /** 0 to 1, ordinal and NOT calibrated. */
  confidence: number;
  decided: boolean;
  reason: string;
}
