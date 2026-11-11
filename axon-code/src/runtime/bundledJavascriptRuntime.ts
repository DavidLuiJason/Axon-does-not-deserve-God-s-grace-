import type { ProjectSourceProvider } from './projectBundler.js';
import { BundledProjectEntrySourceProvider, type ProjectBundlePolicy } from './projectBundler.js';
import { JavaScriptWorkerExecutionAdapter, type JavaScriptWorkerPolicy, type SecureWorkerProvider } from './javascriptWorker.js';

/** Wires workspace-local TS/TSX/JSX bundling into the already guarded browser Worker runtime. */
export function createBundledJavaScriptWorkerRuntime(
  projects: ProjectSourceProvider,
  workerProvider: SecureWorkerProvider,
  policy: { bundle?: Partial<ProjectBundlePolicy>; worker?: Partial<JavaScriptWorkerPolicy> } = {}
): JavaScriptWorkerExecutionAdapter {
  const sourceProvider = new BundledProjectEntrySourceProvider(projects, policy.bundle);
  return new JavaScriptWorkerExecutionAdapter(sourceProvider, workerProvider, policy.worker);
}
