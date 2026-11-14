export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;
export type EvidenceLabel = 'OBSERVED' | 'REPORTED' | 'INFERRED' | 'VERIFIED' | 'DISPUTED' | 'UNKNOWN';
export type Permission = 'ALLOW' | 'ASK' | 'NEVER';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKING';
export type Seat = 'PURPOSE' | 'METHOD' | 'ADVOCATE' | 'CRITIC' | 'GAPS' | 'OUTSIDER' | 'TIME' | 'FAILURE';

export type ClauseSpec = { readonly id: string; readonly required: boolean };
export type StepCheck =
  | null
  | { readonly kind: 'RECOMPUTE'; readonly value: string }
  | { readonly kind: 'KNOWN_ANSWER'; readonly value: string }
  | { readonly kind: 'STATE'; readonly observed: string; readonly expected: string };
export type Step = {
  readonly clauseId: string;
  readonly toolId: string;
  readonly assumption: string;
  readonly reported: 'success' | 'failure';
  readonly output: string;
  readonly check: StepCheck;
};
export type VerifyInput = {
  readonly clauses: readonly ClauseSpec[];
  readonly steps: readonly Step[];
  readonly priorFailedAssumptions: readonly string[];
};
export type ClauseStatus = 'VERIFIED' | 'UNVERIFIED' | 'MISMATCH' | 'FAILED' | 'MISSING';
export type ClauseReport = { readonly id: string; readonly status: ClauseStatus; readonly evidence: EvidenceLabel };
export type VerifyReport = {
  readonly overall: 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'UNCLEAR';
  readonly mayClaimSuccess: boolean;
  readonly nextAction: 'CONTINUE' | 'RECOVER' | 'ABSTAIN' | 'REDESIGN';
  readonly clauses: readonly ClauseReport[];
};

const bad = (): EngineResult<VerifyReport> => ({
  ok: false, error: 'bad-input', message: 'Input must match the verification contract.'
});
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function verifyOutcome(input: VerifyInput): EngineResult<VerifyReport> {
  if (!isRecord(input) ||
      !Array.isArray(input.clauses) || input.clauses.length === 0 ||
      !Array.isArray(input.steps) ||
      !Array.isArray(input.priorFailedAssumptions)) return bad();

  const ids = new Set<string>();
  for (const clause of input.clauses as unknown[]) {
    if (!isRecord(clause) || typeof clause.id !== 'string' ||
        typeof clause.required !== 'boolean' || ids.has(clause.id)) return bad();
    ids.add(clause.id);
  }
  for (const assumption of input.priorFailedAssumptions as unknown[]) {
    if (typeof assumption !== 'string') return bad();
  }
  for (const step of input.steps as unknown[]) {
    if (!isRecord(step) ||
        typeof step.clauseId !== 'string' || !ids.has(step.clauseId) ||
        typeof step.toolId !== 'string' ||
        typeof step.assumption !== 'string' ||
        (step.reported !== 'success' && step.reported !== 'failure') ||
        typeof step.output !== 'string') return bad();
    if (step.check !== null) {
      if (!isRecord(step.check)) return bad();
      if (step.check.kind === 'RECOMPUTE' || step.check.kind === 'KNOWN_ANSWER') {
        if (typeof step.check.value !== 'string') return bad();
      } else if (step.check.kind === 'STATE') {
        if (typeof step.check.observed !== 'string' ||
            typeof step.check.expected !== 'string') return bad();
      } else return bad();
    }
  }

  const last = new Map<string, Step>();
  for (const step of input.steps) last.set(step.clauseId, step as Step);

  const statusOf = (step: Step | undefined): ClauseStatus => {
    if (!step) return 'MISSING';
    if (step.reported === 'failure') return 'FAILED';
    if (step.check === null) return 'UNVERIFIED';
    if (step.check.kind === 'STATE')
      return step.check.observed === step.check.expected ? 'VERIFIED' : 'MISMATCH';
    return step.output === step.check.value ? 'VERIFIED' : 'MISMATCH';
  };
  const evidenceOf = (status: ClauseStatus): EvidenceLabel => {
    if (status === 'VERIFIED') return 'VERIFIED';
    if (status === 'UNVERIFIED') return 'REPORTED';
    if (status === 'MISMATCH') return 'DISPUTED';
    if (status === 'FAILED') return 'OBSERVED';
    return 'UNKNOWN';
  };

  const statuses = new Map<string, ClauseStatus>();
  for (const clause of input.clauses) statuses.set(clause.id, statusOf(last.get(clause.id)));
  const reports: ClauseReport[] = [];
  for (const clause of input.clauses) {
    const status = statuses.get(clause.id)!;
    if (last.has(clause.id) || clause.required)
      reports.push({ id: clause.id, status, evidence: evidenceOf(status) });
  }

  const required = input.clauses.filter(c => c.required).map(c => statuses.get(c.id)!);
  let overall: VerifyReport['overall'];
  if (required.some(s => s === 'MISMATCH' || s === 'FAILED')) overall = 'FAILED';
  else if (required.some(s => s === 'MISSING')) overall = 'INCOMPLETE';
  else if (required.some(s => s === 'UNVERIFIED')) overall = 'UNCLEAR';
  else overall = 'PASSED';

  let nextAction: VerifyReport['nextAction'];
  if (overall === 'PASSED') nextAction = 'CONTINUE';
  else if (overall === 'INCOMPLETE') nextAction = 'RECOVER';
  else if (overall === 'UNCLEAR') nextAction = 'ABSTAIN';
  else {
    const repeatedAssumption = input.clauses.some(c => {
      const s = statuses.get(c.id);
      if (s !== 'MISMATCH' && s !== 'FAILED') return false;
      const step = last.get(c.id);
      return !!step && input.priorFailedAssumptions.includes(step.assumption);
    });
    nextAction = repeatedAssumption ? 'REDESIGN' : 'RECOVER';
  }
  return { ok: true, value: {
    overall, mayClaimSuccess: overall === 'PASSED', nextAction, clauses: reports
  }};
}
