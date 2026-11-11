import type { ExecutionResult } from '../types.js';
import { ExecutionTargetRouter, type ExecutionRouteRequest, type ExecutionRoutePlan } from './executionRouter.js';
export interface RoutedExecutionProvider {
  id: string;
  execute(input: { projectId: string; workspaceSnapshotToken: string; runtimeId: string; timeoutMs: number; outputLimitBytes: number; networkAllowed: false; approvalReference?: string }, signal?: AbortSignal): Promise<ExecutionResult>;
}
export interface RoutedExecutionOutcome { plan: ExecutionRoutePlan; result?: ExecutionResult; status: 'EXECUTED' | 'WAITING' | 'BLOCKED' | 'FAILED'; providerId?: string; }

/** Applies an already Brain-authorised target preference to concrete local/remote providers. */
export class RoutedExecutionCoordinator {
  constructor(private readonly router: ExecutionTargetRouter, private readonly local: RoutedExecutionProvider, private readonly remote?: RoutedExecutionProvider) {}
  async execute(input: ExecutionRouteRequest & { projectId: string; workspaceSnapshotToken: string; timeoutMs: number; outputLimitBytes: number }, approval: { approved: boolean; approvalReference: string }, signal?: AbortSignal): Promise<RoutedExecutionOutcome> {
    if (!input.projectId.trim() || !input.workspaceSnapshotToken.trim() || !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 24 * 60 * 60 * 1000 || !Number.isSafeInteger(input.outputLimitBytes) || input.outputLimitBytes < 1 || input.outputLimitBytes > 64 * 1024 * 1024) return { plan: { target: 'BLOCKED', reason: 'Execution identity or bounds are invalid.', estimatedCostMinorUnits: 0, localFeasible: false, remoteFeasible: false }, status: 'BLOCKED' };
    const plan = this.router.plan(input);
    if (plan.target === 'BLOCKED') return { plan, status: 'BLOCKED' };
    if (plan.target === 'WAIT') return { plan, status: 'WAITING' };
    const provider = plan.target === 'LOCAL' ? this.local : this.remote;
    if (!provider) return { plan, status: 'BLOCKED' };
    if (plan.target === 'REMOTE' && (!approval?.approved || !approval.approvalReference.trim())) return { plan: { ...plan, target: 'BLOCKED', reason: 'Remote execution requires execution-time approval.' }, status: 'BLOCKED' };
    if (plan.target === 'REMOTE' && provider.id !== plan.providerId) return { plan: { ...plan, target: 'BLOCKED', reason: 'Selected remote provider identity does not match the approved route.' }, status: 'BLOCKED' };
    if (!provider.id.trim()) return { plan: { ...plan, target: 'BLOCKED', reason: 'Execution provider returned an invalid identity.' }, status: 'BLOCKED' };
    try {
      const result = await provider.execute({ projectId: input.projectId, workspaceSnapshotToken: input.workspaceSnapshotToken, runtimeId: input.runtimeId,
        timeoutMs: input.timeoutMs, outputLimitBytes: input.outputLimitBytes, networkAllowed: false, ...(plan.target === 'REMOTE' ? { approvalReference: approval.approvalReference } : {}) }, signal);
      const outputBytes = typeof result.stdout === 'string' && typeof result.stderr === 'string' ? new TextEncoder().encode(result.stdout).byteLength + new TextEncoder().encode(result.stderr).byteLength : Number.POSITIVE_INFINITY;
      if (result.requestId === undefined || !['completed', 'failed', 'timed-out', 'cancelled', 'blocked', 'not-implemented'].includes(result.status) || !Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || outputBytes > input.outputLimitBytes || !Array.isArray(result.artifacts) || !Array.isArray(result.diagnostics) || !Array.isArray(result.notes)) return { plan, status: 'FAILED', providerId: provider.id };
      return { plan, result, status: result.status === 'completed' ? 'EXECUTED' : result.status === 'blocked' ? 'BLOCKED' : 'FAILED', providerId: provider.id };
    } catch { return { plan, status: 'FAILED', providerId: provider.id }; }
  }
}
