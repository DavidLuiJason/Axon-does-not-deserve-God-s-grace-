/**
 * AXON brain ↔ AXON Code integration door.
 *
 * This file is a JSON-only boundary contract. It has no dependency on the
 * AXON main application, no host APIs, and no authority to author source code.
 * The caller supplies identity, scope, approval reference and audit ID.
 */

export type AxonCodeJson =
  | null
  | boolean
  | number
  | string
  | AxonCodeJson[]
  | { [key: string]: AxonCodeJson };

export interface AxonCodeCallerContext {
  callerId: string;
  sessionId: string;
  authority: 'AXON_BRAIN' | 'USER';
}

export interface AxonCodeScope {
  projectId: string;
  workspaceId: string;
  permissions: readonly string[];
}

export interface AxonCodeGatewayRequest {
  protocolVersion: '1';
  requestId: string;
  callerContext: AxonCodeCallerContext;
  scope: AxonCodeScope;
  approvalReference: string;
  auditId: string;
  operation:
    | 'capabilities.read'
    | 'project.inspect'
    | 'job.status'
    | 'job.submit'
    | 'workspace.export';
  payload: AxonCodeJson;
}

export interface AxonCodeGatewayResponse {
  protocolVersion: '1';
  requestId: string;
  auditId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'BLOCKED' | 'FAILED';
  result: AxonCodeJson;
  evidenceIds: readonly string[];
  limitations: readonly string[];
}

/** Never throws: a hostile object (for example a throwing getter) is simply refused. Director hardening, Round 14 verification. */
export function validateAxonCodeGatewayRequest(
  value: unknown,
): value is AxonCodeGatewayRequest {
  try { return validateAxonCodeGatewayRequestShape(value); } catch { return false; }
}

function validateAxonCodeGatewayRequestShape(
  value: unknown,
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  if (request['protocolVersion'] !== '1') return false;
  if (typeof request['requestId'] !== 'string' || !request['requestId'].trim()) return false;
  if (typeof request['approvalReference'] !== 'string' || !request['approvalReference'].trim()) return false;
  if (typeof request['auditId'] !== 'string' || !request['auditId'].trim()) return false;
  if (!['capabilities.read', 'project.inspect', 'job.status', 'job.submit', 'workspace.export'].includes(String(request['operation']))) return false;
  const caller = request['callerContext'] as Record<string, unknown> | null;
  if (!caller || typeof caller !== 'object' || Array.isArray(caller)) return false;
  if (typeof caller['callerId'] !== 'string' || !caller['callerId'].trim()) return false;
  if (typeof caller['sessionId'] !== 'string' || !caller['sessionId'].trim()) return false;
  if (caller['authority'] !== 'AXON_BRAIN' && caller['authority'] !== 'USER') return false;
  const scope = request['scope'] as Record<string, unknown> | null;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return false;
  if (typeof scope['projectId'] !== 'string' || !scope['projectId'].trim()) return false;
  if (typeof scope['workspaceId'] !== 'string' || !scope['workspaceId'].trim()) return false;
  if (!Array.isArray(scope['permissions']) || scope['permissions'].some((item) => typeof item !== 'string' || !item.trim())) return false;
  return Object.hasOwn(request, 'payload');
}


export interface AxonCodeCapabilityStatus {
  id: string;
  status: 'BUILT' | 'TESTED' | 'BLOCKED' | 'NOT IMPLEMENTED' | 'NOT RUN';
  evidenceIds: readonly string[];
  resultFiles: readonly string[];
}

export interface AxonCodeCapabilityRegistry {
  schemaVersion: 1;
  capabilities: readonly AxonCodeCapabilityStatus[];
}

/** Return registry-derived statuses; never calculate or promote a capability status here. */
export function readCapabilityRegistry(
  request: AxonCodeGatewayRequest,
  registryValue: unknown,
): AxonCodeGatewayResponse {
  if (!validateAxonCodeGatewayRequest(request) || request.operation !== 'capabilities.read' ||
      !request.scope.permissions.includes('capabilities.read')) {
    throw new Error('Capability registry read requires a valid capabilities.read request and scope.');
  }
  if (!registryValue || typeof registryValue !== 'object' || Array.isArray(registryValue)) {
    throw new Error('Capability registry payload is malformed.');
  }
  const registry = registryValue as Record<string, unknown>;
  if (registry['schemaVersion'] !== 1 || !Array.isArray(registry['capabilities'])) {
    throw new Error('Capability registry schema is not recognised.');
  }
  const capabilities = registry['capabilities'];
  const valid = capabilities.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row['id'] === 'string' &&
      ['BUILT', 'TESTED', 'BLOCKED', 'NOT IMPLEMENTED', 'NOT RUN'].includes(String(row['status'])) &&
      Array.isArray(row['evidenceIds']) && Array.isArray(row['resultFiles']);
  });
  if (!valid) throw new Error('Capability registry contains an invalid status record.');
  return {
    protocolVersion: '1',
    requestId: request.requestId,
    auditId: request.auditId,
    status: 'COMPLETED',
    result: { schemaVersion: 1, capabilities: capabilities as unknown as AxonCodeJson },
    evidenceIds: [],
    limitations: [],
  };
}
