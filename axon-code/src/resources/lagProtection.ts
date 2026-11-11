/**
 * Responsiveness/lag protection policy.
 *
 * This module does not claim that software can prevent every OS/device stall. It
 * converts host-observed responsiveness into conservative scheduling decisions
 * and provides a cooperative chunk runner so adapters can yield to the UI.
 */
export interface ResponsivenessSample {
  sampledAt: number;
  inputToPaintP95Ms: number;
  eventLoopDelayP95Ms: number;
  frameOverrunRatio: number;
  longTaskCount: number;
}

export type ResponsivenessState = 'NORMAL' | 'WATCH' | 'THROTTLE_BACKGROUND' | 'PAUSE_BACKGROUND' | 'UNKNOWN' | 'AXON_SUSPENDED';

export interface ResponsivenessTelemetryProvider {
  readSample(signal?: AbortSignal): Promise<ResponsivenessSample>;
}


export interface LagProtectionPolicy {
  watchInputP95Ms: number;
  throttleInputP95Ms: number;
  criticalInputP95Ms: number;
  watchEventLoopP95Ms: number;
  throttleEventLoopP95Ms: number;
  criticalEventLoopP95Ms: number;
  throttleFrameOverrunRatio: number;
  criticalFrameOverrunRatio: number;
  recoverInputP95Ms: number;
  recoverEventLoopP95Ms: number;
  recoverFrameOverrunRatio: number;
  healthySamplesToRecover: number;
  maxBackgroundWorkersNormal: number;
  maxBackgroundWorkersWatch: number;
  maxBackgroundWorkersThrottled: number;
  cooperativeSliceMs: number;
}

export const DEFAULT_LAG_POLICY: Readonly<LagProtectionPolicy> = Object.freeze({
  watchInputP95Ms: 70,
  throttleInputP95Ms: 110,
  criticalInputP95Ms: 250,
  watchEventLoopP95Ms: 35,
  throttleEventLoopP95Ms: 60,
  criticalEventLoopP95Ms: 150,
  throttleFrameOverrunRatio: 0.2,
  criticalFrameOverrunRatio: 0.6,
  recoverInputP95Ms: 65,
  recoverEventLoopP95Ms: 30,
  recoverFrameOverrunRatio: 0.1,
  healthySamplesToRecover: 3,
  maxBackgroundWorkersNormal: 4,
  maxBackgroundWorkersWatch: 2,
  maxBackgroundWorkersThrottled: 1,
  cooperativeSliceMs: 8
});

export interface LagProtectionDecision {
  state: ResponsivenessState;
  maxBackgroundWorkers: number;
  pauseBackground: boolean;
  yieldBeforeNextChunk: boolean;
  cooperativeSliceMs: number;
  reasons: string[];
  evidence: 'HOST_MEASURED' | 'INVALID_SAMPLE' | 'AXON_CONTROLLED';
}

function validSample(sample: ResponsivenessSample): boolean {
  return Number.isFinite(sample.sampledAt) && sample.sampledAt >= 0 &&
    Number.isFinite(sample.inputToPaintP95Ms) && sample.inputToPaintP95Ms >= 0 &&
    Number.isFinite(sample.eventLoopDelayP95Ms) && sample.eventLoopDelayP95Ms >= 0 &&
    Number.isFinite(sample.frameOverrunRatio) && sample.frameOverrunRatio >= 0 && sample.frameOverrunRatio <= 1 &&
    Number.isInteger(sample.longTaskCount) && sample.longTaskCount >= 0;
}

export class LagProtectionController {
  private state: ResponsivenessState = 'UNKNOWN';
  private healthyStreak = 0;
  private readonly policy: LagProtectionPolicy;

  constructor(policy: Partial<LagProtectionPolicy> = {}) {
    this.policy = { ...DEFAULT_LAG_POLICY, ...policy };
    for (const [key, value] of Object.entries(this.policy)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid lag policy value: ${key}`);
    }
    if (this.policy.healthySamplesToRecover < 1 || !Number.isInteger(this.policy.healthySamplesToRecover)) {
      throw new Error('healthySamplesToRecover must be a positive integer.');
    }
    if (this.policy.recoverInputP95Ms >= this.policy.throttleInputP95Ms ||
        this.policy.recoverEventLoopP95Ms >= this.policy.throttleEventLoopP95Ms ||
        this.policy.recoverFrameOverrunRatio >= this.policy.throttleFrameOverrunRatio) {
      throw new Error('Recovery thresholds must be lower than throttle thresholds (hysteresis).');
    }
  }

  observe(sample: ResponsivenessSample): LagProtectionDecision {
    if (!validSample(sample)) {
      this.state = 'UNKNOWN';
      this.healthyStreak = 0;
      return {
        state: 'UNKNOWN', maxBackgroundWorkers: 0, pauseBackground: true,
        yieldBeforeNextChunk: true, cooperativeSliceMs: 1,
        reasons: ['Responsiveness telemetry is invalid; background work is paused until valid measurements arrive.'],
        evidence: 'INVALID_SAMPLE'
      };
    }

    const p = this.policy;
    const critical = sample.inputToPaintP95Ms >= p.criticalInputP95Ms ||
      sample.eventLoopDelayP95Ms >= p.criticalEventLoopP95Ms ||
      sample.frameOverrunRatio >= p.criticalFrameOverrunRatio;
    const throttled = sample.inputToPaintP95Ms >= p.throttleInputP95Ms ||
      sample.eventLoopDelayP95Ms >= p.throttleEventLoopP95Ms ||
      sample.frameOverrunRatio >= p.throttleFrameOverrunRatio || sample.longTaskCount >= 4;
    const watch = sample.inputToPaintP95Ms >= p.watchInputP95Ms ||
      sample.eventLoopDelayP95Ms >= p.watchEventLoopP95Ms || sample.longTaskCount > 0;
    const recovered = sample.inputToPaintP95Ms <= p.recoverInputP95Ms &&
      sample.eventLoopDelayP95Ms <= p.recoverEventLoopP95Ms &&
      sample.frameOverrunRatio <= p.recoverFrameOverrunRatio && sample.longTaskCount === 0;

    if (critical) {
      this.state = 'PAUSE_BACKGROUND';
      this.healthyStreak = 0;
    } else if (throttled) {
      this.state = 'THROTTLE_BACKGROUND';
      this.healthyStreak = 0;
    } else if (this.state === 'PAUSE_BACKGROUND' || this.state === 'THROTTLE_BACKGROUND') {
      this.healthyStreak = recovered ? this.healthyStreak + 1 : 0;
      if (this.healthyStreak >= p.healthySamplesToRecover) {
        this.state = watch ? 'WATCH' : 'NORMAL';
        this.healthyStreak = 0;
      }
    } else {
      this.state = watch ? 'WATCH' : 'NORMAL';
    }

    const reasons: string[] = [];
    if (sample.inputToPaintP95Ms >= p.watchInputP95Ms) reasons.push('Foreground input-to-paint latency is elevated.');
    if (sample.eventLoopDelayP95Ms >= p.watchEventLoopP95Ms) reasons.push('Event-loop delay is elevated.');
    if (sample.frameOverrunRatio >= p.throttleFrameOverrunRatio) reasons.push('Frame-budget overruns are elevated.');
    if (sample.longTaskCount > 0) reasons.push('The host reported one or more long tasks.');
    if (this.state === 'PAUSE_BACKGROUND') reasons.push('Background work is paused to protect foreground responsiveness.');
    if (this.state === 'THROTTLE_BACKGROUND') reasons.push('Background concurrency is throttled until responsiveness recovers.');
    if ((this.state === 'PAUSE_BACKGROUND' || this.state === 'THROTTLE_BACKGROUND') && this.healthyStreak > 0) {
      reasons.push(`Recovery requires ${p.healthySamplesToRecover - this.healthyStreak} more healthy samples.`);
    }

    const workers = this.state === 'PAUSE_BACKGROUND' ? 0 :
      this.state === 'THROTTLE_BACKGROUND' ? p.maxBackgroundWorkersThrottled :
      this.state === 'WATCH' ? p.maxBackgroundWorkersWatch : p.maxBackgroundWorkersNormal;
    return {
      state: this.state,
      maxBackgroundWorkers: workers,
      pauseBackground: workers === 0,
      yieldBeforeNextChunk: this.state !== 'NORMAL',
      cooperativeSliceMs: this.state === 'NORMAL' ? p.cooperativeSliceMs : Math.max(1, Math.floor(p.cooperativeSliceMs / 2)),
      reasons,
      evidence: 'HOST_MEASURED'
    };
  }

  currentState(): ResponsivenessState { return this.state; }
}

export interface CooperativeRunOptions {
  chunkSize: number;
  maxSliceMs?: number;
  signal?: AbortSignal;
  shouldYield?: () => boolean;
  onProgress?: (completed: number, total: number) => void;
}

const yieldToHost = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Runs work in bounded chunks and yields between chunks. CPU-heavy individual
 * handlers still need a Worker/process adapter; this helper cannot pre-empt them. */
export async function runCooperatively<T, R>(
  items: readonly T[],
  handler: (item: T, index: number) => R | Promise<R>,
  options: CooperativeRunOptions
): Promise<R[]> {
  if (!Number.isInteger(options.chunkSize) || options.chunkSize < 1) throw new Error('chunkSize must be a positive integer.');
  const maxSliceMs = options.maxSliceMs ?? DEFAULT_LAG_POLICY.cooperativeSliceMs;
  if (!Number.isFinite(maxSliceMs) || maxSliceMs <= 0) throw new Error('maxSliceMs must be positive and finite.');
  const output: R[] = [];
  let cursor = 0;
  while (cursor < items.length) {
    if (options.signal?.aborted) throw new Error('Cooperative task cancelled.');
    const sliceStarted = Date.now();
    let processedThisSlice = 0;
    while (cursor < items.length && processedThisSlice < options.chunkSize) {
      if (options.signal?.aborted) throw new Error('Cooperative task cancelled.');
      output.push(await handler(items[cursor] as T, cursor));
      cursor += 1;
      processedThisSlice += 1;
      if (Date.now() - sliceStarted >= maxSliceMs) break;
    }
    options.onProgress?.(cursor, items.length);
    if (cursor < items.length || options.shouldYield?.()) await yieldToHost();
  }
  return output;
}
