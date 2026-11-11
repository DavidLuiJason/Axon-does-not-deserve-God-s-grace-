import { FileKvStore } from './fileKvStore.mjs';
import { PersistentJobManager, CheckpointManager, RecoveryCoordinator } from '../../dist/index.js';

const store = new FileKvStore(process.argv[2]);
const jobs = new PersistentJobManager(store);
const checkpoints = new CheckpointManager(store);
const coordinator = new RecoveryCoordinator(jobs, checkpoints);
const results = await coordinator.inspectStartup();
const prepared = results.length ? await coordinator.prepareResume(results[0].job.id) : null;
process.stdout.write(JSON.stringify({
  jobs: results.length,
  state: results[0]?.job.state ?? null,
  disposition: results[0]?.assessment.disposition ?? null,
  recoveredState: prepared?.job.state ?? null,
  completedUnits: prepared?.job.completedUnits ?? []
}));
