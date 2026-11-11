export type QualityGateState = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
export interface QualityCheck { id: string; state: QualityGateState; required: boolean; evidenceReference?: string; reason: string; }
export interface QualityGateReport { projectId: string; state: 'READY' | 'NOT_READY' | 'INCOMPLETE'; checks: QualityCheck[]; blockers: string[]; warnings: string[]; }

/** Evidence-driven release gate. A planned/interface-only capability cannot satisfy an operational requirement. */
export class ProjectQualityGate {
  evaluate(projectId: string, checks: readonly QualityCheck[]): QualityGateReport {
    if (typeof projectId !== 'string' || !projectId.trim() || !Array.isArray(checks) || checks.length < 1 || checks.length > 10_000) throw new Error('Quality gate requires a project and bounded checks.');
    const ids = new Set<string>();
    for (const check of checks) { if (!check || typeof check.id !== 'string' || !check.id.trim() || ids.has(check.id) || !['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].includes(check.state) || typeof check.required !== 'boolean' || typeof check.reason !== 'string') throw new Error(`Quality check '${check?.id ?? 'unknown'}' is invalid or duplicated.`); ids.add(check.id); if (check.state === 'PASS' && (typeof check.evidenceReference !== 'string' || !check.evidenceReference.trim())) throw new Error(`Passing check '${check.id}' requires an evidence reference.`); }
    const blockers = checks.filter((check) => check.required && (check.state === 'FAIL' || check.state === 'BLOCKED')).map((check) => `${check.id}: ${check.reason}`);
    const incomplete = checks.filter((check) => check.required && check.state === 'NOT_RUN');
    const warnings = checks.filter((check) => !check.required && check.state !== 'PASS').map((check) => `${check.id}: ${check.reason}`);
    return { projectId, state: blockers.length ? 'NOT_READY' : incomplete.length ? 'INCOMPLETE' : 'READY', checks: checks.map((check) => ({ ...check })), blockers, warnings: [...warnings, ...incomplete.map((check) => `${check.id}: required check has not been run.`)] };
  }
}
