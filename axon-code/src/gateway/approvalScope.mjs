/** Exact project/workspace binding for a one-use gateway approval. */
export function approvalScopeMatches(approval, request) {
  return approval.scope.projectId === request.scope.projectId &&
    approval.scope.workspaceId === request.scope.workspaceId;
}
