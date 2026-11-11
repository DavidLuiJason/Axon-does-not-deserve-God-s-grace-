import type { DeviceResources, ExecutionPlan, RuntimeDescriptor, WorkloadRequirements } from './types.js';

export function chooseExecutionPlan(
  workload: WorkloadRequirements,
  device: DeviceResources,
  runtimes: readonly RuntimeDescriptor[]
): ExecutionPlan {
  const reasons: string[] = [];
  const runtime = runtimes.find((item) => item.id === workload.runtimeId && item.available);
  const storageOk = device.availableStorageBytes >= workload.requiredStorageBytes;
  const gpuOk = !workload.gpuRequired || device.gpuAvailable === true;
  const base = {
    runtimeId: workload.runtimeId,
    estimated: true as const,
    requiredStorageBytes: workload.requiredStorageBytes,
    availableStorageBytes: device.availableStorageBytes,
    availableRamBytes: device.availableRamBytes,
    qualityChanges: [] as string[],
    confidence: 'low' as const
  };
  const numericRequirements = [
    device.availableRamBytes, device.availableStorageBytes,
    workload.estimatedPeakRamBytes, workload.requiredStorageBytes,
    workload.streamingWorkingSetBytes, workload.chunkWorkingSetBytes,
    workload.reducedQuality?.estimatedPeakRamBytes
  ].filter((value): value is number => value !== undefined);
  if (numericRequirements.some((value) => !Number.isFinite(value) || value < 0)) {
    return { ...base, mode: 'WAIT_FOR_RESOURCES', canStart: false, requiredRamBytes: workload.estimatedPeakRamBytes, reasons: ['Resource measurements or workload requirements contain a negative or non-finite value; execution is blocked until valid values are supplied.'] };
  }
  if (!runtime) {
    if (workload.remoteRuntimeId && device.networkAllowed && runtimes.some((item) => item.id === workload.remoteRuntimeId && item.available && item.isolation === 'remote')) {
      return { ...base, mode: 'REMOTE_REQUIRED', runtimeId: workload.remoteRuntimeId, canStart: true, requiredRamBytes: 0, reasons: ['The requested local runtime is unavailable; a matching remote runtime is available.'] };
    }
    return { ...base, mode: 'UNSUPPORTED', canStart: false, requiredRamBytes: workload.estimatedPeakRamBytes, reasons: ['No available runtime matches this workload.'] };
  }
  if (!storageOk) return { ...base, mode: 'WAIT_FOR_RESOURCES', canStart: false, requiredRamBytes: workload.estimatedPeakRamBytes, reasons: ['Insufficient available storage for the declared workload.'] };
  if (!gpuOk) reasons.push('The workload requires GPU capability that is not currently available.');
  if (gpuOk && device.availableRamBytes >= workload.estimatedPeakRamBytes) {
    return { ...base, mode: 'FULL_LOCAL', canStart: true, requiredRamBytes: workload.estimatedPeakRamBytes, reasons: ['Estimated peak RAM and storage fit the current reported resources. Runtime measurements are still required.'] };
  }
  if (gpuOk && workload.canStreamAssets && runtime.supportsStreaming && workload.streamingWorkingSetBytes !== undefined && device.availableRamBytes >= workload.streamingWorkingSetBytes) {
    return { ...base, mode: 'STREAMED_LOCAL', canStart: true, requiredRamBytes: workload.streamingWorkingSetBytes, reasons: ['The workload declares streamable assets and the runtime supports streaming. Full-project peak RAM is not required at once.'] };
  }
  if (gpuOk && workload.canChunkIndependentWork && workload.chunkWorkingSetBytes !== undefined && device.availableRamBytes >= workload.chunkWorkingSetBytes) {
    return { ...base, mode: 'CHUNKED_LOCAL', canStart: true, requiredRamBytes: workload.chunkWorkingSetBytes, reasons: ['The workload declares independent chunks with resumable boundaries. Stateful work must not be split without an explicit contract.'] };
  }
  if (gpuOk && workload.reducedQuality && device.availableRamBytes >= workload.reducedQuality.estimatedPeakRamBytes) {
    return { ...base, mode: 'REDUCED_QUALITY_LOCAL', canStart: true, requiredRamBytes: workload.reducedQuality.estimatedPeakRamBytes, qualityChanges: [...workload.reducedQuality.qualityChanges], reasons: [`Reduced-quality profile selected: ${workload.reducedQuality.label}. This does not prove full-quality execution.`] };
  }
  if (workload.remoteRuntimeId && device.networkAllowed && runtimes.some((item) => item.id === workload.remoteRuntimeId && item.available && item.isolation === 'remote')) {
    return { ...base, mode: 'REMOTE_REQUIRED', runtimeId: workload.remoteRuntimeId, canStart: true, requiredRamBytes: 0, reasons: ['Local execution does not fit the available resources; a matching remote runtime is available.'] };
  }
  if (!gpuOk) reasons.push('No permitted alternative runtime or renderer was supplied.');
  else reasons.push('No declared streaming, chunking or reduced-quality strategy fits the current resources.');
  return { ...base, mode: 'WAIT_FOR_RESOURCES', canStart: false, requiredRamBytes: workload.estimatedPeakRamBytes, reasons };
}

export interface ResourceSample {
  timestamp: number;
  resources: DeviceResources;
}

export type ResourceState = 'READY' | 'LOW_MEMORY' | 'LOW_STORAGE' | 'THERMAL_PRESSURE' | 'UNKNOWN';
export function classifyResources(sample: ResourceSample, minimumRamBytes: number, minimumStorageBytes: number): ResourceState {
  const r = sample.resources;
  if (!Number.isFinite(r.availableRamBytes) || !Number.isFinite(r.availableStorageBytes) || r.availableRamBytes < 0 || r.availableStorageBytes < 0 || !Number.isFinite(minimumRamBytes) || !Number.isFinite(minimumStorageBytes) || minimumRamBytes < 0 || minimumStorageBytes < 0) return 'UNKNOWN';
  if (r.thermalState === 'hot' || r.thermalState === 'critical') return 'THERMAL_PRESSURE';
  if (r.availableStorageBytes < minimumStorageBytes) return 'LOW_STORAGE';
  if (r.availableRamBytes < minimumRamBytes) return 'LOW_MEMORY';
  return 'READY';
}
