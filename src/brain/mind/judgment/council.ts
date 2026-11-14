export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;
export type EvidenceLabel = 'OBSERVED' | 'REPORTED' | 'INFERRED' | 'VERIFIED' | 'DISPUTED' | 'UNKNOWN';
export type Permission = 'ALLOW' | 'ASK' | 'NEVER';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKING';
export type Seat = 'PURPOSE' | 'METHOD' | 'ADVOCATE' | 'CRITIC' | 'GAPS' | 'OUTSIDER' | 'TIME' | 'FAILURE';

export type ActionKind = 'READ' | 'WRITE' | 'DELETE' | 'SEND' | 'SPEND' | 'RUN';
export type Proposal = {
  readonly id: string;
  readonly actionKind: ActionKind;
  readonly reversible: boolean;
  readonly affectsOthers: boolean;
  readonly interpretation: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly evidence: EvidenceLabel;
  readonly permission: Permission;
  readonly departsFromStatedGoal: boolean;
  readonly missingInputs: readonly string[];
  readonly undefinedTerms: readonly string[];
  readonly dependenciesMet: boolean;
  readonly costOfDoingNothing: 'NONE' | 'LOW' | 'HIGH';
};
export type Flag = {
  readonly seat: Seat;
  readonly concern: string;
  readonly part: string;
  readonly reason: string;
  readonly severity: Severity;
  readonly evidence: EvidenceLabel;
  readonly unknown: string;
  readonly resolvable: boolean;
  readonly next: 'PROCEED' | 'ASK' | 'STOP' | 'RECHECK';
};

// Closed enumerations of this module's own contract, written as lookup tables (not word lists).
const actionKinds: Record<ActionKind, true> = { READ: true, WRITE: true, DELETE: true, SEND: true, SPEND: true, RUN: true };
const evidenceLabels: Record<EvidenceLabel, true> = { OBSERVED: true, REPORTED: true, INFERRED: true, VERIFIED: true, DISPUTED: true, UNKNOWN: true };
const permissions: Record<Permission, true> = { ALLOW: true, ASK: true, NEVER: true };
const interpretations: Record<Proposal['interpretation'], true> = { HIGH: true, MEDIUM: true, LOW: true };
const costs: Record<Proposal['costOfDoingNothing'], true> = { NONE: true, LOW: true, HIGH: true };
const changesThings: Partial<Record<ActionKind, true>> = { WRITE: true, DELETE: true, SEND: true, SPEND: true };
const hardToUndo: Partial<Record<ActionKind, true>> = { DELETE: true, SEND: true, SPEND: true };
const known = (table: object, value: string): boolean => Object.prototype.hasOwnProperty.call(table, value);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const bad = (): EngineResult<readonly Flag[]> => ({
  ok: false, error: 'bad-input', message: 'Proposal must match the judgment contract.'
});

const seatRank: Record<Seat, number> = { PURPOSE: 0, METHOD: 1, ADVOCATE: 2, CRITIC: 3, GAPS: 4, OUTSIDER: 5, TIME: 6, FAILURE: 7 };
const severityRank: Record<Severity, number> = { BLOCKING: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function validProposal(p: unknown): p is Proposal {
  if (!isRecord(p)) return false;
  return typeof p.id === 'string' &&
    typeof p.actionKind === 'string' && known(actionKinds, p.actionKind) &&
    typeof p.reversible === 'boolean' &&
    typeof p.affectsOthers === 'boolean' &&
    typeof p.interpretation === 'string' && known(interpretations, p.interpretation) &&
    typeof p.evidence === 'string' && known(evidenceLabels, p.evidence) &&
    typeof p.permission === 'string' && known(permissions, p.permission) &&
    typeof p.departsFromStatedGoal === 'boolean' &&
    Array.isArray(p.missingInputs) && p.missingInputs.every(x => typeof x === 'string') &&
    Array.isArray(p.undefinedTerms) && p.undefinedTerms.every(x => typeof x === 'string') &&
    typeof p.dependenciesMet === 'boolean' &&
    typeof p.costOfDoingNothing === 'string' && known(costs, p.costOfDoingNothing);
}

export function reviewProposal(p: Proposal): EngineResult<readonly Flag[]> {
  if (!validProposal(p)) return bad();
  const flags: Flag[] = [];
  const add = (seat: Seat, severity: Severity, next: Flag['next'],
    resolvable: boolean, concern: string, part: string, reason: string,
    unknown = '') => {
    flags.push({ seat, concern, part, reason, severity,
      evidence: seat === 'CRITIC' && part === 'evidence' ? p.evidence : 'INFERRED',
      unknown, resolvable, next });
  };

  if (p.interpretation === 'LOW')
    add('PURPOSE','HIGH','ASK',true,'The request is not yet understood.','interpretation','Interpretation confidence is low.','The intended meaning is unclear.');
  else if (p.interpretation === 'MEDIUM')
    add('PURPOSE','LOW','RECHECK',true,'The request may need another reading.','interpretation','Interpretation confidence is medium.','Some meaning remains uncertain.');

  if (!p.dependenciesMet)
    add('METHOD','MEDIUM','RECHECK',true,'A required dependency is not met.','dependencies','The planned method has an unmet dependency.','The dependency state needs checking.');

  if (p.departsFromStatedGoal)
    add('ADVOCATE','HIGH','ASK',true,'The proposal departs from the stated goal.','stated-goal','The proposed action changes the owner’s stated goal.','The goal alignment needs clarification.');

  if (p.evidence === 'DISPUTED')
    add('CRITIC','HIGH','RECHECK',true,'The evidence is disputed.','evidence','Available evidence conflicts.','The evidence needs another check.');
  else if (p.actionKind !== 'READ' && p.evidence === 'UNKNOWN')
    add('CRITIC','HIGH','ASK',true,'Evidence is unknown for this action.','evidence','No reliable evidence is supplied.','The evidence is unknown.');
  else if (p.actionKind !== 'READ' && (p.evidence === 'INFERRED' || p.evidence === 'REPORTED'))
    add('CRITIC','MEDIUM','RECHECK',true,'The evidence is not independently established.','evidence','The evidence is inferred or reported.','The evidence needs verification.');

  if (p.affectsOthers)
    add('CRITIC','MEDIUM','ASK',true,'The action affects other people.','other-people','Other people may be affected.','The effects on others need consideration.');

  if (p.missingInputs.length > 0)
    add('GAPS','HIGH','ASK',true,'Required input is missing.','missing-inputs','The proposal has missing inputs.',p.missingInputs.join(', '));

  if (p.undefinedTerms.length > 0)
    add('OUTSIDER','LOW','RECHECK',true,'A term may not be clear to an outside reader.','undefined-terms','The proposal contains undefined terms.',p.undefinedTerms.join(', '));

  if (!p.reversible && known(changesThings, p.actionKind))
    add('TIME','MEDIUM','RECHECK',false,'This action may not be reversible.','reversibility','The action cannot readily be undone.','The action is not reversible.');

  if (!p.reversible && known(hardToUndo, p.actionKind)) {
    if (p.affectsOthers)
      add('FAILURE','BLOCKING','ASK',true,'A hard-to-reverse action could harm others.','failure-risk','The action is irreversible and affects others.','The possible harm to others needs review.');
    else
      add('FAILURE','HIGH','ASK',true,'A hard-to-reverse action carries serious risk.','failure-risk','The action is irreversible.','The possible failure needs review.');
  }

  flags.sort((a,b) => severityRank[a.severity]-severityRank[b.severity] ||
    seatRank[a.seat]-seatRank[b.seat]);
  return { ok: true, value: flags };
}
