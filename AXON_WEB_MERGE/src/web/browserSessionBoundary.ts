/**
 * Explicit identity boundary for human-operated and AXON-operated browsing.
 * A different JavaScript session ID alone is not isolation: storage/cookie/credential
 * partitions must be proven distinct by the selected engine host.
 */
export type BrowserSessionOwner = 'OWNER' | 'AXON';
export type BrowserIsolationKind = 'SHARED_WEBVIEW_PROCESS' | 'ANDROID_WEBVIEW_DATA_SUFFIX' | 'ENGINE_PROFILE' | 'SEPARATE_APP_CONTAINER';

export type BrowserSessionIdentity = Readonly<{
  owner: BrowserSessionOwner;
  sessionId: string;
  engineContextId: string;
  cookiePartitionId: string;
  storagePartitionId: string;
  credentialStoreId: string | null;
  isolationKind: BrowserIsolationKind;
  isolationVerified: boolean;
}>;

export type BrowserSessionBoundaryDecision = Readonly<{
  allowed: boolean;
  reason: string;
  mayAccessOwnerCredentials: false;
}>;

export function evaluateBrowserSessionBoundary(
  owner: BrowserSessionIdentity,
  requested: BrowserSessionIdentity,
): BrowserSessionBoundaryDecision {
  if (owner.owner !== 'OWNER' || requested.owner !== 'AXON') {
    return Object.freeze({ allowed: false, reason: 'Session ownership labels are invalid for an AXON-owned browsing request.', mayAccessOwnerCredentials: false });
  }
  if (!requested.isolationVerified || requested.isolationKind === 'SHARED_WEBVIEW_PROCESS') {
    return Object.freeze({ allowed: false, reason: 'The AXON browser context is not proven isolated from the owner WebView data store.', mayAccessOwnerCredentials: false });
  }
  const ownerPartitions = [owner.sessionId, owner.engineContextId, owner.cookiePartitionId, owner.storagePartitionId];
  const requestedPartitions = [requested.sessionId, requested.engineContextId, requested.cookiePartitionId, requested.storagePartitionId];
  if (requestedPartitions.some((value) => !value || ownerPartitions.includes(value))) {
    return Object.freeze({ allowed: false, reason: 'At least one AXON session, engine, cookie, or storage partition is missing or shared with the owner.', mayAccessOwnerCredentials: false });
  }
  if (requested.credentialStoreId !== null) {
    return Object.freeze({ allowed: false, reason: 'AXON sessions must not receive an owner or shared credential-store identifier.', mayAccessOwnerCredentials: false });
  }
  return Object.freeze({ allowed: true, reason: 'The AXON context has distinct verified session, engine, cookie, and storage partitions and no credential store.', mayAccessOwnerCredentials: false });
}

export const AXON_BROWSER_SESSION_ENABLED = false as const;
