/** Contract for the Android Capacitor host. This is an IPC boundary, not proof of a device implementation. */
export interface AndroidHostCapabilities {
  platform: 'android';
  apiLevel: number;
  cpuAbi: string;
  persistedSafGrants: boolean;
  processProvider: boolean;
  pythonProvider: boolean;
  gradleProvider: boolean;
}
export interface AndroidSafEntry { uriToken: string; displayName: string; mimeType: string; sizeBytes?: number; isDirectory: boolean; }
export interface AndroidHostPlugin {
  getCapabilities(): Promise<AndroidHostCapabilities>;
  pickWorkspace(): Promise<{ grantId: string; entries: AndroidSafEntry[] }>;
  readDocument(input: { grantId: string; uriToken: string; maxBytes: number }): Promise<{ bytesBase64: string; sizeBytes: number }>;
  writeDocument(input: { grantId: string; uriToken: string; bytesBase64: string; expectedSizeBytes: number }): Promise<{ writtenBytes: number }>;
  releaseGrant(input: { grantId: string }): Promise<{ released: boolean }>;
}

export type AndroidContractFailure = 'CAPABILITY_MISMATCH' | 'GRANT_REQUIRED' | 'INVALID_SIZE' | 'WRITE_SIZE_MISMATCH';
export function validateAndroidCapabilities(value: AndroidHostCapabilities): void {
  if (!value || value.platform !== 'android' || !Number.isSafeInteger(value.apiLevel) || value.apiLevel < 26 ||
      typeof value.cpuAbi !== 'string' || !value.cpuAbi.trim() || typeof value.persistedSafGrants !== 'boolean' ||
      typeof value.processProvider !== 'boolean' || typeof value.pythonProvider !== 'boolean' || typeof value.gradleProvider !== 'boolean') {
    throw new Error('CAPABILITY_MISMATCH: Android host capability response is malformed or below the declared API floor.');
  }
}
export async function readAndroidDocument(host: AndroidHostPlugin, input: { grantId: string; uriToken: string; maxBytes: number }): Promise<Uint8Array> {
  if (!input.grantId?.trim() || !input.uriToken?.trim()) throw new Error('GRANT_REQUIRED: a persisted SAF grant and URI token are required.');
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1 || input.maxBytes > 16 * 1024 * 1024) throw new Error('INVALID_SIZE: read limit must be between 1 byte and 16 MiB.');
  const result = await host.readDocument(input);
  if (!Number.isSafeInteger(result.sizeBytes) || result.sizeBytes < 0 || result.sizeBytes > input.maxBytes) throw new Error('INVALID_SIZE: Android host reported an invalid document size.');
  const binary = atob(result.bytesBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (bytes.byteLength !== result.sizeBytes) throw new Error('WRITE_SIZE_MISMATCH: decoded document size differs from host metadata.');
  return bytes;
}
export async function writeAndroidDocument(host: AndroidHostPlugin, input: { grantId: string; uriToken: string; bytes: Uint8Array }): Promise<void> {
  if (!input.grantId?.trim() || !input.uriToken?.trim()) throw new Error('GRANT_REQUIRED: a persisted SAF grant and URI token are required.');
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength > 16 * 1024 * 1024) throw new Error('INVALID_SIZE: document payload must be Uint8Array up to 16 MiB.');
  let binary = ''; for (const byte of input.bytes) binary += String.fromCharCode(byte);
  const result = await host.writeDocument({ grantId: input.grantId, uriToken: input.uriToken, bytesBase64: btoa(binary), expectedSizeBytes: input.bytes.byteLength });
  if (result.writtenBytes !== input.bytes.byteLength) throw new Error('WRITE_SIZE_MISMATCH: Android host did not confirm the exact byte count.');
}
