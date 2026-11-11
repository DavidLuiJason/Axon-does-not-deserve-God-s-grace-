import {
  CheckpointManager,
  PersistentJobManager,
  type JobRecord,
  type RecoveryAssessment
} from './persistentJobs.js';

export interface StartupRecoveryItem {
  job: JobRecord;
  assessment: RecoveryAssessment;
}

/** Reconciles persisted jobs after process/app startup; it never restores arbitrary process memory. */
export class RecoveryCoordinator {
  constructor(private readonly jobs: PersistentJobManager, private readonly checkpoints: CheckpointManager) {}

  async inspectStartup(): Promise<StartupRecoveryItem[]> {
    await this.jobs.markInterruptedOnRecovery();
    const results: StartupRecoveryItem[] = [];
    for (const job of await this.jobs.list()) {
      if (job.state !== 'INTERRUPTED') continue;
      if (!job.checkpointId) {
        results.push({ job, assessment: {
          jobId: job.id, disposition: 'MANUAL_INTERVENTION',
          reason: 'No durable runtime checkpoint is attached. Resume only from a runtime-declared safe stage.'
        } });
        continue;
      }
      const assessment = await this.checkpoints.assess(job.checkpointId, {
        projectFingerprint: job.projectFingerprint, runtimeId: job.runtimeId
      });
      if (assessment.checkpoint && (assessment.checkpoint.jobId !== job.id || assessment.checkpoint.projectId !== job.projectId)) {
        results.push({ job, assessment: {
          jobId: job.id, disposition: 'MANUAL_INTERVENTION',
          reason: 'Checkpoint job/project identity does not match the persisted job.'
        } });
      } else {
        results.push({ job, assessment });
      }
    }
    return results;
  }

  /** Moves only a verified interrupted job to READY; the runtime must still accept the checkpoint. */
  async prepareResume(jobId: string): Promise<{ job: JobRecord; assessment: RecoveryAssessment }> {
    const job = await this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown job '${jobId}'.`);
    if (job.state !== 'INTERRUPTED' || !job.checkpointId) throw new Error('Job is not an interrupted job with a checkpoint.');
    const assessment = await this.checkpoints.assess(job.checkpointId, {
      projectFingerprint: job.projectFingerprint, runtimeId: job.runtimeId
    });
    if (assessment.disposition !== 'RESUME_FROM_CHECKPOINT' || !assessment.checkpoint ||
        assessment.checkpoint.jobId !== job.id || assessment.checkpoint.projectId !== job.projectId) {
      return { job, assessment: { ...assessment, disposition: assessment.disposition === 'RESUME_FROM_CHECKPOINT' ? 'MANUAL_INTERVENTION' : assessment.disposition,
        reason: assessment.disposition === 'RESUME_FROM_CHECKPOINT' ? 'Checkpoint identity did not match the job.' : assessment.reason } };
    }
    const ready = await this.jobs.update(job.id, { state: 'READY', stage: 'RECOVERY_READY', expectedVersion: job.version });
    return { job: ready, assessment };
  }
}
