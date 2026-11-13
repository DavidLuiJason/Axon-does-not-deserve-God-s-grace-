/** Shared shapes for the AXON Games logic layer (DT3). Logic only: no screen, no storage, no timers. */
export interface GameEntry {
  id: string;
  category: string;
  name: string;
  description: string;
  engine: string;
}

export type RoundKind = 'memory' | 'choice' | 'input' | 'text' | 'visual' | 'set-memory' | 'strategy' | 'mastermind' | 'imagine';

/** One generated round. The named fields are what every screen can rely on; the rest is per-game data. */
export type Round = {
  kind: RoundKind | (string & {});
  title?: string;
  tier?: number;
  level?: number;
  levelsInTier?: number;
  prompt?: string;
  questionText?: string;
  question?: string;
  answer?: unknown;
  choices?: Array<string | number>;
  accepted?: string[];
  acceptedAnswers?: Array<string | number>;
  rule?: string;
  steps?: string[];
  mode?: string;
  seq?: Array<string | number>;
  sumTarget?: number;
} & Record<string, any>;

export interface GameSettings {
  level?: number;
  difficulty?: number | string;
  loopholeTopic?: string;
  [key: string]: unknown;
}

export interface TierDefinition {
  levels: number;
  mechanics: string;
}
export interface TierProfile {
  tiers: TierDefinition[];
}
export type TierProfiles = Record<string, TierProfile>;
