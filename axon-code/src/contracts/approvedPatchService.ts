import type { CodePatch } from '../types.js';
import type { WorkingCopyManager } from '../workspace/workingCopy.js';
import { BrainRequestGate, type BrainTechnicalRequest } from './brainGateway.js';

/** Applies exact patch bytes supplied by AXON Brain or the user after request authorisation. */
export class ApprovedPatchService {
  constructor(private readonly gate: BrainRequestGate, private readonly workingCopies: WorkingCopyManager) {}
  async apply(request: BrainTechnicalRequest<{ workspaceId: string }>): Promise<{ patchId: string; file: string; applied: true }> {
    // Reject malformed project binding before consuming the one-time request ID.
    if (request.operation !== 'APPLY_APPROVED_PATCH' || !request.suppliedPatch) throw new Error('An explicit patch supplied by AXON Brain/user is required.');
    if (!request.payload || typeof request.payload.workspaceId !== 'string' || !request.payload.workspaceId.trim() || request.payload.workspaceId !== request.projectId) throw new Error('Patch workspace identity must match the authorised project identity.');
    await this.gate.validateAndClaim(request, 'workspace:patch');
    const supplied = request.suppliedPatch;
    const patch: CodePatch = { file: supplied.file, baseText: supplied.baseText, startOffset: supplied.startOffset, endOffset: supplied.endOffset, oldText: supplied.oldText, newText: supplied.newText, reason: supplied.reason, safety: supplied.safety };
    const result = await this.workingCopies.applyPatch(request.payload.workspaceId, patch, { approvedByUser: request.authorisation.authority === 'USER' || request.authorisation.userApproved === true, approvalReference: request.authorisation.approvalReference });
    return { patchId: result.id, file: result.file, applied: true };
  }
}
