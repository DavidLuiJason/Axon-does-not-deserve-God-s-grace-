/** Contract runner for source-only Android background host verification. */
const REQUIRED_METHODS = [
  'createNotificationChannel',
  'startForeground',
  'pauseFromNotification',
  'cancelFromNotification',
  'selectWorkspace',
  'releaseWorkspaceGrant',
];

export async function exerciseAndroidBackgroundHostContract(host) {
  if (!host || typeof host !== 'object') throw new Error('ANDROID_HOST_REQUIRED');
  const missing = REQUIRED_METHODS.filter((method) => typeof host[method] !== 'function');
  if (missing.length) throw new Error(`ANDROID_HOST_METHODS_MISSING:${missing.join(',')}`);
  const channel = await host.createNotificationChannel({ id: 'axon_code_background_jobs', importance: 'low' });
  const started = await host.startForeground({ jobId: 'contract-job', notificationChannelId: 'axon_code_background_jobs' });
  const paused = await host.pauseFromNotification({ jobId: 'contract-job' });
  const cancelled = await host.cancelFromNotification({ jobId: 'contract-job' });
  const grant = await host.selectWorkspace();
  if (!grant || typeof grant.grantId !== 'string' || !grant.grantId.trim() || typeof grant.uriToken !== 'string' || !grant.uriToken.trim()) {
    throw new Error('ANDROID_SAF_GRANT_INVALID');
  }
  const released = await host.releaseWorkspaceGrant({ grantId: grant.grantId });
  return {
    contract: 'PASS',
    evidence: host.hostType === 'FAKE_HOST' ? 'FAKE_HOST_ONLY' : 'HOST_CONTRACT_ONLY',
    providerStatus: 'NOT RUN',
    checks: { channel, started, paused, cancelled, grantSelected: true, released },
  };
}

export function validateAndroidBackgroundSourceCapabilities(capabilities) {
  if (!capabilities || typeof capabilities !== 'object') throw new Error('ANDROID_CAPABILITIES_REQUIRED');
  return {
    foregroundJobs: capabilities.foregroundJobs === true ? 'BUILT' : 'NOT RUN',
    notificationPause: capabilities.notificationPause === true ? 'BUILT' : 'NOT RUN',
    notificationCancel: capabilities.notificationCancel === true ? 'BUILT' : 'NOT RUN',
    storageAccessFramework: capabilities.storageAccessFramework === true ? 'BUILT' : 'NOT RUN',
    deviceVerification: 'NOT RUN',
  };
}
