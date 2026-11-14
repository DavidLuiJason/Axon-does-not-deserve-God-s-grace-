import { reviewProposal, type Proposal, type Flag, type EngineResult } from './council.ts';

export type Judgment = {
  readonly verdict: 'PROCEED' | 'PROCEED_WITH_WARNING' | 'ASK' | 'STOP';
  readonly urgent: boolean;
  readonly flags: readonly Flag[];
};

export function judgeProposal(p: Proposal): EngineResult<Judgment> {
  const reviewed = reviewProposal(p);
  if (!reviewed.ok) return reviewed;
  const flags = reviewed.value;
  let verdict: Judgment['verdict'];
  if (p.permission === 'NEVER') verdict = 'STOP';
  else if (flags.some(f => f.severity === 'BLOCKING')) verdict = 'ASK';
  else if (p.permission === 'ASK') verdict = 'ASK';
  else if (flags.some(f => f.severity === 'HIGH')) verdict = 'ASK';
  else if (flags.some(f => f.severity === 'MEDIUM')) verdict = 'PROCEED_WITH_WARNING';
  else verdict = 'PROCEED';
  return { ok: true, value: {
    verdict, urgent: verdict === 'ASK' && p.costOfDoingNothing === 'HIGH', flags
  }};
}
