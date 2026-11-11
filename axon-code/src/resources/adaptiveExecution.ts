import type { RuntimeDescriptor, WorkloadRequirements, ExecutionPlan } from '../types.js';
import { chooseExecutionPlan } from '../runtimePlanner.js';
import { AdaptiveResourceGovernor, type AdaptiveResourcePlan, type DeviceSnapshot, type GovernorWorkload } from './resourceGovernor.js';
import type { ResponsivenessState } from './lagProtection.js';

export interface AdaptiveExecutionDecision {
  canStart: boolean;
  execution: ExecutionPlan;
  resources: AdaptiveResourcePlan;
  reasons: string[];
}

/** Composes the original runtime/mode planner with the adaptive device budget.
 * A workload is not admitted merely because its raw RAM estimate fits. */
export function planAdaptiveExecution(
  workload: WorkloadRequirements,
  device: DeviceSnapshot,
  runtimes: readonly RuntimeDescriptor[],
  governorWorkload: GovernorWorkload,
  responsiveness: ResponsivenessState,
  governor = new AdaptiveResourceGovernor()
): AdaptiveExecutionDecision {
  const execution = chooseExecutionPlan(workload, {
    availableRamBytes: device.availableRamBytes,
    availableStorageBytes: device.availableStorageBytes,
    cpuCores: device.logicalCpuCores,
    gpuAvailable: device.gpuAvailable,
    networkAllowed: device.networkAvailable,
    thermalState: device.thermalState,
    batteryPercent: device.batteryPercent
  }, runtimes);
  const resources = governor.plan(device, governorWorkload, responsiveness);
  const reasons = [...execution.reasons, ...resources.reasons];
  if (!execution.canStart) return { canStart: false, execution, resources, reasons };
  if (!resources.canStart) {
    const blocked: ExecutionPlan = {
      ...execution,
      mode: 'WAIT_FOR_RESOURCES',
      canStart: false,
      reasons: [...execution.reasons, 'Adaptive resource governor withheld admission to preserve system headroom or foreground responsiveness.']
    };
    return { canStart: false, execution: blocked, resources, reasons };
  }
  return { canStart: true, execution, resources, reasons };
}
