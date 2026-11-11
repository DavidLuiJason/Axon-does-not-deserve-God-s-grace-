import type { HostPlatform } from '../runtime/platformCapabilities.js';
export type ExecutionTarget = 'LOCAL' | 'REMOTE' | 'WAIT' | 'BLOCKED';
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
export type TargetPreference = 'LOCAL_ONLY' | 'LOCAL_FIRST' | 'REMOTE_ALLOWED';
export interface ResourceDemand { memoryBytes: number; storageBytes: number; cpuUnits: number; gpuRequired: boolean; estimatedDurationMs: number; }
export interface LocalExecutionCapability {
  platform: HostPlatform;
  runtimeIds: readonly string[];
  available: boolean;
  sandboxAttested: boolean;
  networkBlocked: boolean;
  filesystemIsolated: boolean;
  memoryLimitEnforced: boolean;
  timeLimitEnforced: boolean;
  unprivileged: boolean;
  availableMemoryBytes: number;
  availableStorageBytes: number;
  availableCpuUnits: number;
  gpuAvailable: boolean;
}
export interface RemoteExecutionCapability {
  providerId: string;
  available: boolean;
  runtimeIds: readonly string[];
  sandboxAttested: boolean;
  networkEgressControlled: boolean;
  filesystemIsolated: boolean;
  unprivileged: boolean;
  estimatedCostMinorUnits: number;
  currency: string;
  dataResidency?: string;
}
export interface ExecutionRouteRequest {
  runtimeId: string;
  demand: ResourceDemand;
  preference: TargetPreference;
  classification: DataClassification;
  local: LocalExecutionCapability;
  remote?: RemoteExecutionCapability;
  remoteApproval?: { approved: boolean; approvalReference: string; maxCostMinorUnits: number; allowConfidentialData: boolean };
}
export interface ExecutionRoutePlan {
  target: ExecutionTarget;
  reason: string;
  estimatedCostMinorUnits: number;
  currency?: string;
  providerId?: string;
  requiredUserAction?: string;
  localFeasible: boolean;
  remoteFeasible: boolean;
}

/** Deterministic target feasibility planner. Brain/user sets preference and privacy approval; Code only assesses execution feasibility. */
export class ExecutionTargetRouter {
  plan(input: ExecutionRouteRequest): ExecutionRoutePlan {
    if (!input || !['LOCAL_ONLY', 'LOCAL_FIRST', 'REMOTE_ALLOWED'].includes(input.preference) || !['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'].includes(input.classification)) throw new Error('Execution route policy is invalid.');
    const d = input.demand;
    if (!d || !input.runtimeId?.trim() || !Number.isSafeInteger(d.memoryBytes) || d.memoryBytes < 0 || !Number.isSafeInteger(d.storageBytes) || d.storageBytes < 0 || !Number.isFinite(d.cpuUnits) || d.cpuUnits < 0 || !Number.isSafeInteger(d.estimatedDurationMs) || d.estimatedDurationMs < 0 || typeof d.gpuRequired !== 'boolean') throw new Error('Execution route request contains invalid resource requirements.');
    const local = input.local;
    if (!local || !['android', 'ios', 'browser', 'windows', 'linux', 'macos', 'server'].includes(local.platform) || !Array.isArray(local.runtimeIds) || !Number.isSafeInteger(local.availableMemoryBytes) || local.availableMemoryBytes < 0 || !Number.isSafeInteger(local.availableStorageBytes) || local.availableStorageBytes < 0 || !Number.isFinite(local.availableCpuUnits) || local.availableCpuUnits < 0) throw new Error('Local host capability snapshot is invalid.');
    const remoteSnapshot = input.remote;
    if (remoteSnapshot && (!remoteSnapshot.providerId.trim() || !Array.isArray(remoteSnapshot.runtimeIds) || !Number.isSafeInteger(remoteSnapshot.estimatedCostMinorUnits) || remoteSnapshot.estimatedCostMinorUnits < 0 || !/^[A-Z]{3}$/.test(remoteSnapshot.currency))) throw new Error('Remote host cost or identity snapshot is invalid.');
    if (input.remoteApproval && (!Number.isSafeInteger(input.remoteApproval.maxCostMinorUnits) || input.remoteApproval.maxCostMinorUnits < 0 || typeof input.remoteApproval.approved !== 'boolean' || typeof input.remoteApproval.allowConfidentialData !== 'boolean' || typeof input.remoteApproval.approvalReference !== 'string')) throw new Error('Remote execution approval is invalid.');
    const localSecurity = local.available && local.runtimeIds.includes(input.runtimeId) && local.sandboxAttested && local.networkBlocked && local.filesystemIsolated && local.memoryLimitEnforced && local.timeLimitEnforced && local.unprivileged;
    const localCapacity = local.availableMemoryBytes >= d.memoryBytes && local.availableStorageBytes >= d.storageBytes && local.availableCpuUnits >= d.cpuUnits && (!d.gpuRequired || local.gpuAvailable);
    const localFeasible = localSecurity && localCapacity;
    if (localFeasible) return { target: 'LOCAL', reason: 'The authorised local host has the runtime, required isolation and sufficient measured resources; local execution avoids unnecessary data transfer and cost.', estimatedCostMinorUnits: 0, localFeasible, remoteFeasible: Boolean(input.remote?.available) };
    if (input.preference === 'LOCAL_ONLY') return { target: localSecurity ? 'WAIT' : 'BLOCKED', reason: localSecurity ? 'Local resources are insufficient and remote execution is not permitted.' : 'Local runtime or required sandbox guarantees are unavailable.', estimatedCostMinorUnits: 0, localFeasible, remoteFeasible: false };
    const remote = input.remote;
    const remoteSecurity = Boolean(remote?.available && remote.runtimeIds.includes(input.runtimeId) && remote.sandboxAttested && remote.networkEgressControlled && remote.filesystemIsolated && remote.unprivileged);
    const remoteFeasible = remoteSecurity;
    if (input.preference === 'LOCAL_FIRST' && localFeasible) return { target: 'LOCAL', reason: 'Local execution is feasible and the Brain-selected policy prefers local execution.', estimatedCostMinorUnits: 0, localFeasible, remoteFeasible };
    if (!remoteFeasible || !remote) return { target: localSecurity ? 'WAIT' : 'BLOCKED', reason: 'Neither an approved local route nor a verified remote provider is currently available.', estimatedCostMinorUnits: 0, localFeasible, remoteFeasible: false };
    if (input.classification === 'SECRET') return { target: 'BLOCKED', reason: 'SECRET-classified project data is not eligible for remote execution under the default policy.', estimatedCostMinorUnits: remote.estimatedCostMinorUnits, currency: remote.currency, providerId: remote.providerId, localFeasible, remoteFeasible };
    const approval = input.remoteApproval;
    if (!approval?.approved || !approval.approvalReference.trim()) return { target: 'BLOCKED', reason: 'Remote execution requires explicit approval from the user/AXON Brain.', estimatedCostMinorUnits: remote.estimatedCostMinorUnits, currency: remote.currency, providerId: remote.providerId, requiredUserAction: 'Approve remote execution and data transfer.', localFeasible, remoteFeasible };
    if (input.classification === 'CONFIDENTIAL' && !approval.allowConfidentialData) return { target: 'BLOCKED', reason: 'CONFIDENTIAL project data requires separate explicit approval.', estimatedCostMinorUnits: remote.estimatedCostMinorUnits, currency: remote.currency, providerId: remote.providerId, localFeasible, remoteFeasible };
    if (!Number.isSafeInteger(approval.maxCostMinorUnits) || approval.maxCostMinorUnits < 0 || remote.estimatedCostMinorUnits > approval.maxCostMinorUnits) return { target: 'BLOCKED', reason: 'Remote execution cost exceeds the approved spending limit.', estimatedCostMinorUnits: remote.estimatedCostMinorUnits, currency: remote.currency, providerId: remote.providerId, localFeasible, remoteFeasible };
    if (input.preference === 'LOCAL_FIRST' && localSecurity && !localCapacity) return { target: 'REMOTE', reason: 'Local resources are insufficient; the Brain-selected policy permits the explicitly approved remote alternative.', estimatedCostMinorUnits: remote.estimatedCostMinorUnits, currency: remote.currency, providerId: remote.providerId, localFeasible, remoteFeasible };
    return { target: 'REMOTE', reason: 'The Brain/user authorised this verified remote provider and its estimated cost is within the approved limit.', estimatedCostMinorUnits: remote.estimatedCostMinorUnits, currency: remote.currency, providerId: remote.providerId, localFeasible, remoteFeasible };
  }
}
