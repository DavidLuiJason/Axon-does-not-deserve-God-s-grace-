import type { KeyValueStore } from '../jobs/persistentJobs.js';
import {
  LagProtectionController,
  type LagProtectionDecision,
  type LagProtectionPolicy,
  type ResponsivenessSample
} from './lagProtection.js';

export type AxonLagMode = 'AUTO' | 'REDUCED' | 'SUSPENDED';

export interface AxonLagControlCommand {
  requestedBy: 'AXON_BRAIN';
  mode: AxonLagMode;
  reason: string;
  /** Required for non-AUTO commands; override automatically expires. */
  durationMs?: number;
}

export interface AxonLagControlStatus {
  mode: AxonLagMode;
  reason: string;
  changedAt: number;
  expiresAt?: number;
}

export interface LagControlStateStore {
  load(): Promise<AxonLagControlStatus | null>;
  save(status: AxonLagControlStatus): Promise<void>;
}

const LAG_CONTROL_STATE_KEY = 'axon-code/lag-control/override';

/** Persistent override storage. Supply IndexedDbKeyValueStore on browser/WebView hosts
 * or an equivalent durable user-data KeyValueStore on native hosts. */
export class KeyValueLagControlStateStore implements LagControlStateStore {
  constructor(private readonly store: KeyValueStore) {}
  async load(): Promise<AxonLagControlStatus | null> {
    return this.store.get<AxonLagControlStatus>(LAG_CONTROL_STATE_KEY);
  }
  async save(status: AxonLagControlStatus): Promise<void> {
    await this.store.put(LAG_CONTROL_STATE_KEY, { ...status });
  }
}

export interface AxonLagDecision extends LagProtectionDecision {
  controlMode: AxonLagMode;
  telemetrySamplingEnabled: boolean;
  telemetryIntervalMultiplier: number;
  hardSafetyControlsEnabled: true;
}

export interface WorkSuspensionReport {
  allManagedWorkSuspended: boolean;
  suspendedTaskIds: string[];
  unpausableTaskIds: string[];
  notes: string[];
}

export interface BackgroundExecutionControl {
  /** Pauses every AXON Code managed job at a safe boundary or reports exactly what could not be paused. */
  suspendAllManagedWork(ownerId: string, reason: string): Promise<WorkSuspensionReport>;
  /** Releases only the suspension owned by ownerId; must preserve user/manual pauses. */
  releaseManagedWorkSuspension(ownerId: string): Promise<void>;
  /** Sets an owner-scoped worker cap without changing user/manual task state. */
  setWorkerCap(ownerId: string, maxWorkers: number): Promise<void>;
  clearWorkerCap(ownerId: string): Promise<void>;
}

export interface ResponsivenessSamplingControl {
  setSamplingEnabled(ownerId: string, enabled: boolean): Promise<void>;
  setSamplingIntervalMultiplier(ownerId: string, multiplier: number): Promise<void>;
}

export interface LagControlAdapters {
  background: BackgroundExecutionControl;
  telemetry: ResponsivenessSamplingControl;
}

export const AXON_LAG_CONTROL_OWNER = 'axon-brain-lag-override';
export const DEFAULT_MAX_OVERRIDE_MS = 60 * 60 * 1000;

/**
 * AXON-controlled wrapper around the automatic lag controller.
 * SUSPENDED means AXON Code yields its managed execution capacity to the host;
 * it does NOT disable security checks, hard resource ceilings or permissions.
 */
export class AxonLagControlManager {
  private status: AxonLagControlStatus = { mode: 'AUTO', reason: 'Automatic responsiveness protection.', changedAt: 0 };
  private readonly base: LagProtectionController;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly adapters: LagControlAdapters,
    policy: Partial<LagProtectionPolicy> = {},
    private readonly now: () => number = Date.now,
    private readonly maxOverrideMs = DEFAULT_MAX_OVERRIDE_MS,
    private readonly stateStore?: LagControlStateStore
  ) {
    this.base = new LagProtectionController(policy);
    if (!Number.isFinite(maxOverrideMs) || maxOverrideMs < 1000) throw new Error('Maximum override duration must be at least one second.');
  }

  getStatus(): AxonLagControlStatus { return { ...this.status }; }

  private validateStoredStatus(value: AxonLagControlStatus): AxonLagControlStatus {
    if (!value || !['AUTO', 'REDUCED', 'SUSPENDED'].includes(value.mode) ||
      typeof value.reason !== 'string' || value.reason.trim().length < 3 || value.reason.length > 500 ||
      !Number.isFinite(value.changedAt) || value.changedAt < 0) {
      throw new Error('Persisted AXON lag-control state is invalid; refusing to start managed work.');
    }
    if (value.mode === 'AUTO') {
      if (value.expiresAt !== undefined) throw new Error('Persisted AUTO lag-control state cannot have an expiry.');
      return { mode: 'AUTO', reason: value.reason, changedAt: value.changedAt };
    }
    if (!Number.isFinite(value.expiresAt) || (value.expiresAt ?? 0) <= value.changedAt) {
      throw new Error('Persisted REDUCED/SUSPENDED state must have a valid bounded expiry.');
    }
    const duration = (value.expiresAt as number) - value.changedAt;
    if (duration > this.maxOverrideMs) throw new Error('Persisted AXON lag-control override exceeds the configured maximum duration.');
    return { mode: value.mode, reason: value.reason, changedAt: value.changedAt, expiresAt: value.expiresAt as number };
  }

  /** Call and await before restoring or admitting any managed work after host startup. */
  async initialize(): Promise<AxonLagControlStatus> {
    const saved = await this.stateStore?.load();
    if (saved) this.status = this.validateStoredStatus(saved);
    if (this.status.expiresAt !== undefined && this.now() >= this.status.expiresAt) {
      const automatic: AxonLagControlStatus = { mode: 'AUTO', reason: 'AXON lag-control override expired; automatic protection resumed.', changedAt: this.now() };
      await this.stateStore?.save(automatic);
      this.status = automatic;
    }
    await this.reconcile();
    const remaining = this.status.expiresAt === undefined ? undefined : Math.max(1, this.status.expiresAt - this.now());
    this.scheduleExpiry(remaining);
    return this.getStatus();
  }

  private scheduleExpiry(durationMs: number | undefined): void {
    if (this.expiryTimer !== undefined) clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
    if (durationMs !== undefined) {
      this.expiryTimer = setTimeout(() => { void this.reconcile().catch(() => undefined); }, durationMs);
      // Do not keep Node-based test/build processes alive solely for an expiry lease.
      (this.expiryTimer as unknown as { unref?: () => void }).unref?.();
    }
  }

  private async applyAdapters(mode: AxonLagMode, reason: string): Promise<void> {
    if (mode === 'SUSPENDED') {
      const report = await this.adapters.background.suspendAllManagedWork(AXON_LAG_CONTROL_OWNER, reason);
      if (!report.allManagedWorkSuspended || report.unpausableTaskIds.length > 0) {
        throw new Error(`AXON Code could not safely suspend every managed task: ${report.unpausableTaskIds.join(', ') || 'host did not confirm full suspension'}.`);
      }
      await this.adapters.telemetry.setSamplingEnabled(AXON_LAG_CONTROL_OWNER, false);
      await this.adapters.background.setWorkerCap(AXON_LAG_CONTROL_OWNER, 0);
      return;
    }
    await this.adapters.telemetry.setSamplingEnabled(AXON_LAG_CONTROL_OWNER, true);
    await this.adapters.telemetry.setSamplingIntervalMultiplier(AXON_LAG_CONTROL_OWNER, mode === 'REDUCED' ? 4 : 1);
    if (mode === 'REDUCED') await this.adapters.background.setWorkerCap(AXON_LAG_CONTROL_OWNER, 1);
    else await this.adapters.background.clearWorkerCap(AXON_LAG_CONTROL_OWNER);
    await this.adapters.background.releaseManagedWorkSuspension(AXON_LAG_CONTROL_OWNER);
  }

  async applyCommand(command: AxonLagControlCommand): Promise<AxonLagControlStatus> {
    if (command.requestedBy !== 'AXON_BRAIN') throw new Error('Only AXON Brain may change the lag-control mode.');
    if (!['AUTO', 'REDUCED', 'SUSPENDED'].includes(command.mode)) throw new Error('Unknown lag-control mode.');
    const reason = command.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw new Error('A reason between 3 and 500 characters is required.');
    let expiresAt: number | undefined;
    if (command.mode !== 'AUTO') {
      if (!Number.isFinite(command.durationMs) || (command.durationMs ?? 0) <= 0 || (command.durationMs ?? 0) > this.maxOverrideMs) {
        throw new Error(`REDUCED and SUSPENDED modes require a positive duration no greater than ${this.maxOverrideMs} ms.`);
      }
      expiresAt = this.now() + (command.durationMs as number);
    }

    const previous = this.status;
    const next: AxonLagControlStatus = {
      mode: command.mode,
      reason,
      changedAt: this.now(),
      ...(expiresAt !== undefined ? { expiresAt } : {})
    };
    // Persist desired policy first. If the process dies between persistence and
    // adapter application, initialize() reapplies it before managed work starts.
    await this.stateStore?.save(next);
    try {
      // Fail-safe order: first pause work, then disable optional telemetry.
      // On release, restore measurement/worker policy before releasing AXON's pause.
      await this.applyAdapters(command.mode, reason);
    } catch (error) {
      // Roll back both host controls and persisted intent where possible. If
      // rollback storage fails, the next startup retries the desired safe state.
      await this.applyAdapters(previous.mode, previous.reason).catch(() => undefined);
      await this.stateStore?.save(previous).catch(() => undefined);
      throw error;
    }
    this.status = next;
    this.scheduleExpiry(command.mode === 'AUTO' ? undefined : command.durationMs);
    return this.getStatus();
  }

  /** Reapply the already loaded mode to host adapters. Call initialize() first on startup. */
  async reconcile(): Promise<AxonLagControlStatus> {
    if (this.status.expiresAt !== undefined && this.now() >= this.status.expiresAt) {
      const automatic = { mode: 'AUTO' as const, reason: 'AXON lag-control override expired; automatic protection resumed.', changedAt: this.now() };
      // Persist expiry before releasing controls. On a crash, startup will retry AUTO.
      await this.stateStore?.save(automatic);
      // Do not report AUTO until host-side pause/cap/telemetry controls were actually released.
      await this.applyAdapters('AUTO', automatic.reason);
      this.status = automatic;
      this.scheduleExpiry(undefined);
    } else {
      await this.applyAdapters(this.status.mode, this.status.reason);
    }
    return this.getStatus();
  }

  observe(sample: ResponsivenessSample): AxonLagDecision {
    const status = this.getStatus();
    if (status.mode === 'SUSPENDED') {
      return {
        state: 'AXON_SUSPENDED', maxBackgroundWorkers: 0, pauseBackground: true,
        yieldBeforeNextChunk: true, cooperativeSliceMs: 1,
        reasons: [`AXON suspended managed AXON Code work: ${status.reason}`, 'Security checks and hard resource ceilings remain active.'],
        evidence: 'AXON_CONTROLLED', controlMode: 'SUSPENDED', telemetrySamplingEnabled: false,
        telemetryIntervalMultiplier: 0, hardSafetyControlsEnabled: true
      };
    }
    const decision = this.base.observe(sample);
    const reduced = status.mode === 'REDUCED';
    return {
      ...decision,
      maxBackgroundWorkers: reduced ? Math.min(1, decision.maxBackgroundWorkers) : decision.maxBackgroundWorkers,
      pauseBackground: reduced ? decision.pauseBackground : decision.pauseBackground,
      cooperativeSliceMs: reduced ? Math.min(4, decision.cooperativeSliceMs) : decision.cooperativeSliceMs,
      reasons: reduced ? [...decision.reasons, `AXON requested reduced lag-protection overhead: ${status.reason}`] : decision.reasons,
      controlMode: status.mode,
      telemetrySamplingEnabled: true,
      telemetryIntervalMultiplier: reduced ? 4 : 1,
      hardSafetyControlsEnabled: true
    };
  }
}
