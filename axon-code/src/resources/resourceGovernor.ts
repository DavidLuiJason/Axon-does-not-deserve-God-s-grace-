import type { ResponsivenessState } from './lagProtection.js';

export interface DeviceSnapshot {
  sampledAt: number;
  totalRamBytes: number;
  availableRamBytes: number;
  availableStorageBytes: number;
  logicalCpuCores: number;
  cpuLoadPercent: number;
  gpuAvailable: boolean;
  thermalState: 'normal' | 'warm' | 'hot' | 'critical' | 'unknown';
  batteryPercent: number;
  charging: boolean;
  powerSaver: boolean;
  networkAvailable: boolean;
}

/** Host adapter contract. Implementations must report live measurements, not estimates. */
export interface DeviceTelemetryProvider {
  readSnapshot(signal?: AbortSignal): Promise<DeviceSnapshot>;
}

export interface GovernorWorkload {
  id: string;
  kind: 'analysis' | 'compile' | 'test' | 'build' | 'render' | 'data' | 'other';
  priority: 'foreground' | 'normal' | 'background';
  estimatedWorkingSetBytes: number;
  perWorkerRamBytes: number;
  supportsParallelism: boolean;
  supportsCooperativeYield: boolean;
  maxParallelism?: number;
  minStorageBytes?: number;
  gpuRequired?: boolean;
}

export type GovernorMode = 'NORMAL' | 'CONSERVE' | 'THROTTLE' | 'PAUSE_BACKGROUND' | 'BLOCKED' | 'UNKNOWN';

export interface AdaptiveResourcePlan {
  mode: GovernorMode;
  canStart: boolean;
  maxWorkers: number;
  backgroundWorkers: number;
  memoryBudgetBytes: number;
  cacheBudgetBytes: number;
  batchSize: number;
  prefetchDepth: number;
  preserveForeground: boolean;
  requireCooperativeYield: boolean;
  executionPlacement: 'LIGHT_COOPERATIVE' | 'WORKER_OR_PROCESS_REQUIRED';
  reduceQuality: boolean;
  reasons: string[];
  evidence: 'DEVICE_SAMPLE_BASED' | 'INVALID_OR_INCOMPLETE_SAMPLE';
}

export interface GovernorPolicy {
  systemRamReserveRatio: number;
  minimumSystemReserveBytes: number;
  maximumMemoryBudgetRatio: number;
  cpuTargetLoadPercent: number;
  maximumWorkers: number;
  lowBatteryPercent: number;
  severeCpuLoadPercent: number;
}

export const DEFAULT_GOVERNOR_POLICY: Readonly<GovernorPolicy> = Object.freeze({
  systemRamReserveRatio: 0.16,
  minimumSystemReserveBytes: 128 * 1024 * 1024,
  maximumMemoryBudgetRatio: 0.68,
  cpuTargetLoadPercent: 70,
  maximumWorkers: 8,
  lowBatteryPercent: 15,
  severeCpuLoadPercent: 88
});

function validDevice(d: DeviceSnapshot): boolean {
  return Number.isFinite(d.sampledAt) && d.sampledAt >= 0 &&
    Number.isFinite(d.totalRamBytes) && d.totalRamBytes > 0 &&
    Number.isFinite(d.availableRamBytes) && d.availableRamBytes >= 0 && d.availableRamBytes <= d.totalRamBytes &&
    Number.isFinite(d.availableStorageBytes) && d.availableStorageBytes >= 0 &&
    Number.isInteger(d.logicalCpuCores) && d.logicalCpuCores >= 1 &&
    Number.isFinite(d.cpuLoadPercent) && d.cpuLoadPercent >= 0 && d.cpuLoadPercent <= 100 &&
    Number.isFinite(d.batteryPercent) && d.batteryPercent >= 0 && d.batteryPercent <= 100;
}

function validWorkload(w: GovernorWorkload): boolean {
  return Boolean(w.id) && Number.isFinite(w.estimatedWorkingSetBytes) && w.estimatedWorkingSetBytes >= 0 &&
    Number.isFinite(w.perWorkerRamBytes) && w.perWorkerRamBytes > 0 &&
    (w.maxParallelism === undefined || (Number.isInteger(w.maxParallelism) && w.maxParallelism >= 1)) &&
    (w.minStorageBytes === undefined || (Number.isFinite(w.minStorageBytes) && w.minStorageBytes >= 0));
}

export class AdaptiveResourceGovernor {
  private readonly policy: GovernorPolicy;

  constructor(policy: Partial<GovernorPolicy> = {}) {
    this.policy = { ...DEFAULT_GOVERNOR_POLICY, ...policy };
    const p = this.policy;
    if (p.systemRamReserveRatio < 0 || p.systemRamReserveRatio >= 1 ||
        p.minimumSystemReserveBytes < 0 || p.maximumMemoryBudgetRatio <= 0 || p.maximumMemoryBudgetRatio > 1 ||
        p.cpuTargetLoadPercent <= 0 || p.cpuTargetLoadPercent > 100 ||
        !Number.isInteger(p.maximumWorkers) || p.maximumWorkers < 1 ||
        p.lowBatteryPercent < 0 || p.lowBatteryPercent > 100 || p.severeCpuLoadPercent < 0 || p.severeCpuLoadPercent > 100) {
      throw new Error('Invalid adaptive governor policy.');
    }
  }

  plan(device: DeviceSnapshot, workload: GovernorWorkload, responsiveness: ResponsivenessState = 'UNKNOWN'): AdaptiveResourcePlan {
    const invalid: AdaptiveResourcePlan = {
      mode: 'UNKNOWN', canStart: false, maxWorkers: 0, backgroundWorkers: 0,
      memoryBudgetBytes: 0, cacheBudgetBytes: 0, batchSize: 1, prefetchDepth: 0,
      preserveForeground: true, requireCooperativeYield: true, executionPlacement: 'WORKER_OR_PROCESS_REQUIRED', reduceQuality: false,
      reasons: ['Device or workload measurements are invalid or incomplete; execution is not admitted.'],
      evidence: 'INVALID_OR_INCOMPLETE_SAMPLE'
    };
    if (!validDevice(device) || !validWorkload(workload)) return invalid;

    const reasons: string[] = [];
    const p = this.policy;
    const reserve = Math.max(p.minimumSystemReserveBytes, Math.ceil(device.totalRamBytes * p.systemRamReserveRatio));
    const memoryBudgetBytes = Math.max(0, Math.min(
      Math.floor(device.availableRamBytes * p.maximumMemoryBudgetRatio),
      device.availableRamBytes - reserve
    ));
    const storageOk = device.availableStorageBytes >= (workload.minStorageBytes ?? 0);
    if (!storageOk) reasons.push('Available storage is below the workload minimum.');
    if (workload.gpuRequired && !device.gpuAvailable) reasons.push('The workload requires a GPU that the host has not reported as available.');
    if (device.thermalState === 'critical') reasons.push('Critical thermal state blocks new work.');
    if (workload.priority !== 'foreground' && (responsiveness === 'PAUSE_BACKGROUND' || responsiveness === 'UNKNOWN')) reasons.push(responsiveness === 'UNKNOWN' ? 'No valid responsiveness sample is available; background work is not admitted.' : 'Foreground responsiveness protection has paused background work.');

    const blocked = !storageOk || (workload.gpuRequired && !device.gpuAvailable) ||
      device.thermalState === 'critical' || (workload.priority !== 'foreground' && (responsiveness === 'PAUSE_BACKGROUND' || responsiveness === 'UNKNOWN')) ||
      memoryBudgetBytes < workload.perWorkerRamBytes;
    if (blocked) {
      if (memoryBudgetBytes < workload.perWorkerRamBytes) reasons.push('The safe memory budget cannot accommodate even one worker.');
      return { ...invalid, mode: device.thermalState === 'critical' || responsiveness === 'PAUSE_BACKGROUND' ? 'PAUSE_BACKGROUND' : 'BLOCKED', reasons };
    }

    const availableCpuFraction = Math.max(0, (p.cpuTargetLoadPercent - device.cpuLoadPercent) / 100);
    const cpuWorkers = device.cpuLoadPercent >= p.severeCpuLoadPercent ? 1 :
      Math.max(1, Math.floor(device.logicalCpuCores * Math.max(0.25, availableCpuFraction)));
    const ramWorkers = Math.max(1, Math.floor(memoryBudgetBytes / workload.perWorkerRamBytes));
    let maxWorkers = workload.supportsParallelism ? Math.min(p.maximumWorkers, cpuWorkers, ramWorkers, workload.maxParallelism ?? p.maximumWorkers) : 1;
    let mode: GovernorMode = 'NORMAL';
    if (device.thermalState === 'hot' || device.cpuLoadPercent >= p.severeCpuLoadPercent || responsiveness === 'THROTTLE_BACKGROUND' || responsiveness === 'PAUSE_BACKGROUND') {
      mode = 'THROTTLE';
      maxWorkers = Math.min(maxWorkers, 1);
      reasons.push(responsiveness === 'PAUSE_BACKGROUND' ? 'Background work remains paused; foreground work is limited to one cooperative worker.' : 'Thermal, CPU or responsiveness pressure limits concurrency.');
    } else if (device.thermalState === 'warm' || device.powerSaver || (!device.charging && device.batteryPercent <= p.lowBatteryPercent) || responsiveness === 'WATCH' || responsiveness === 'UNKNOWN') {
      mode = 'CONSERVE';
      maxWorkers = responsiveness === 'UNKNOWN' ? 1 : Math.max(1, Math.min(maxWorkers, Math.ceil(maxWorkers / 2)));
      reasons.push(responsiveness === 'UNKNOWN' ? 'Responsiveness telemetry is unavailable; conservative concurrency is used.' : 'Conservative scheduling is enabled to protect device resources or battery.');
    }
    if (device.cpuLoadPercent > p.cpuTargetLoadPercent) reasons.push('Host CPU load is above the target; background concurrency is constrained.');
    if (responsiveness === 'UNKNOWN') reasons.push('No valid host responsiveness sample is available; cooperative yielding is required.');

    const cacheBudgetBytes = Math.floor(Math.min(memoryBudgetBytes * 0.2, Math.max(0, device.availableRamBytes - reserve) * 0.2));
    const batchSize = Math.max(1, Math.min(256, maxWorkers * (mode === 'NORMAL' ? 8 : 2)));
    const prefetchDepth = mode === 'NORMAL' ? Math.min(8, maxWorkers * 2) : mode === 'CONSERVE' ? 2 : 1;
    const backgroundWorkers = workload.priority === 'foreground' ? Math.max(0, maxWorkers - 1) : maxWorkers;
    return {
      mode, canStart: true, maxWorkers, backgroundWorkers, memoryBudgetBytes, cacheBudgetBytes,
      batchSize, prefetchDepth, preserveForeground: true,
      requireCooperativeYield: workload.supportsCooperativeYield || mode !== 'NORMAL' || responsiveness !== 'NORMAL',
      executionPlacement: ['compile', 'test', 'build', 'render', 'data'].includes(workload.kind) ? 'WORKER_OR_PROCESS_REQUIRED' : 'LIGHT_COOPERATIVE',
      reduceQuality: false, reasons, evidence: 'DEVICE_SAMPLE_BASED'
    };
  }
}
