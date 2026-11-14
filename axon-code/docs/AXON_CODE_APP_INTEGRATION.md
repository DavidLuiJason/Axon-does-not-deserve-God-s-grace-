# AXON Code App Integration Contract

Protocol version: `1`. This is the JSON-only boundary between AXON Brain / AXON Tools and AXON Code. AXON Code imports nothing from the AXON main app. The direct user and AXON Brain are separate callers; every operation carries caller identity, session, project/workspace scope, permission list, a one-use approval reference, request ID and audit ID.

## Approval flow

1. Construct the complete request without `approvalReference`.
2. Ask the user/authority layer to approve that exact request and scope.
3. Call `gateway.approve(requestWithoutApprovalReference, {projectId, workspaceId}, expiresAt)` and attach the returned reference. The implementation stores a SHA-256 hash of the complete request.
4. `call()` checks protocol, caller, scope, operation permission, approval expiry, exact request hash and project/workspace binding. It atomically consumes the approval before executing the operation.
5. A replay, modified payload, changed caller, changed scope, expired approval or concurrent second use is refused and recorded in the audit trail. Approval does not grant broader permissions than the request.

## Operations and example requests

Every example below is an executable request template. `$NODE_EXECUTABLE` and `$WORKSPACE_ROOT` are substituted by the host integration test with the actual Node executable and a temporary workspace. `$jobId` is the ID returned by the preceding `job.submit` example. The approval reference is freshly issued for each exact request. The tests run every example against `AxonCodeJobGateway` and compare the documented result shape.

```json
{
  "examples": [
    {
      "name": "capabilities.read",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-01",
        "auditId": "audit-01",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "capabilities.read"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "capabilities.read",
        "payload": {}
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "capabilities-array"
    },
    {
      "name": "project.inspect",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-02",
        "auditId": "audit-02",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "project.inspect"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "project.inspect",
        "payload": {}
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "provider-blocked-result"
    },
    {
      "name": "job.submit",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-03",
        "auditId": "audit-03",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "job.submit"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "job.submit",
        "payload": {
          "process": {
            "file": "$NODE_EXECUTABLE",
            "args": [
              "-e",
              "while(true){}"
            ],
            "cwd": "$WORKSPACE_ROOT",
            "timeLimitMs": 20000
          }
        }
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "job-id-queued"
    },
    {
      "name": "job.status",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-04",
        "auditId": "audit-04",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "job.status"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "job.status",
        "payload": {
          "jobId": "$jobId"
        }
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "job-record-running"
    },
    {
      "name": "job.pause",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-05",
        "auditId": "audit-05",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "job.pause"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "job.pause",
        "payload": {
          "jobId": "$jobId"
        }
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "job-record-paused"
    },
    {
      "name": "job.resume",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-06",
        "auditId": "audit-06",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "job.resume"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "job.resume",
        "payload": {
          "jobId": "$jobId"
        }
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "job-record-running"
    },
    {
      "name": "job.cancel",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-07",
        "auditId": "audit-07",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "job.cancel"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "job.cancel",
        "payload": {
          "jobId": "$jobId"
        }
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "job-record-cancelled"
    },
    {
      "name": "job.results",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-08",
        "auditId": "audit-08",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "job.results"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "job.results",
        "payload": {
          "jobId": "$jobId"
        }
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "job-results-cancelled"
    },
    {
      "name": "workspace.export",
      "request": {
        "protocolVersion": "1",
        "requestId": "example-09",
        "auditId": "audit-09",
        "callerContext": {
          "callerId": "alice",
          "sessionId": "owner-session",
          "authority": "USER"
        },
        "scope": {
          "projectId": "sample-project",
          "workspaceId": "sample-workspace",
          "permissions": [
            "workspace.export"
          ]
        },
        "approvalReference": "<issued-for-this-exact-request>",
        "operation": "workspace.export",
        "payload": {}
      },
      "expectedOuterStatus": "COMPLETED",
      "expectedResult": "provider-blocked-result"
    }
  ]
}
```

### Operation contract

| Operation | Required permission | Request payload | Success result |
|---|---|---|---|
| `capabilities.read` | `capabilities.read` | `{}` | `{capabilities: string[]}` |
| `project.inspect` | `project.inspect` | `{}` | Project inspection provider result; currently `BLOCKED` when no provider is configured. |
| `job.submit` | `job.submit` | Task payload; optional `process` is accepted only with a configured allowlisted host process provider. | `{jobId, state: queued, origin}` |
| `job.status` | `job.status` | `{jobId}` | Persisted job record. |
| `job.pause` | `job.pause` | `{jobId}` | Persisted `paused` job when the provider actually suspends it; otherwise nested `NOT_SUPPORTED`. |
| `job.resume` | `job.resume` | `{jobId}` | Persisted `running` job when the provider resumes it; otherwise nested `NOT_SUPPORTED`. |
| `job.cancel` | `job.cancel` | `{jobId}` | Persisted `cancelled` job; abort signal is sent to active executor. |
| `job.results` | `job.results` | `{jobId}` | `{state, output, outputBytes}` |
| `workspace.export` | `workspace.export` | `{}` | Export provider result; currently `BLOCKED` when no provider is configured. |

## Lifecycle and authority

States: `queued`, `running`, `paused`, `completed`, `failed`, `cancelled`, `interrupted`. A running or paused host process cannot be restored after service restart; it is killed where the process host is available and persisted as `interrupted` with an explicit reason. Pyodide/WASM pause remains `NOT_SUPPORTED` unless a provider proves checkpointing. A user may cancel, pause and resume any job in the same workspace, including a job whose `origin` is `AXON`. AXON Brain may act on a user-owned job only when the request includes `job.manage.any`; the request is audited.

## Error codes

| Code | Meaning |
|---|---|
| `INVALID_REQUEST` | Missing or invalid protocol, caller, request ID, audit ID or workspace/project scope. |
| `UNKNOWN_OPERATION` | Operation is not in the gateway allowlist. |
| `APPROVAL_INVALID` | Missing, expired, replayed, concurrently consumed or hash-mismatched approval. |
| `APPROVAL_SCOPE_MISMATCH` | Approval project/workspace differs from request scope. |
| `PERMISSION_DENIED` | The caller scope does not grant the requested operation. |
| `QUOTA_EXCEEDED` | Request payload or per-owner active-job quota is exceeded. |
| `JOB_QUEUE_FULL` | Global background queue capacity is reached. |
| `JOB_NOT_FOUND` | Job does not exist in the requested project. |
| `OWNER_MISMATCH` | Caller cannot access/control the job under workspace and authority rules. |
| `INVALID_STATE` | Requested lifecycle transition is not valid from the current state. |
| `GATEWAY_ERROR` | Provider or internal operation failed; sensitive details are not returned. |
| `NO_EXECUTION_PROVIDER` | No executor is registered for a submitted task. |
| `TIME_LIMIT` | Job wall-clock deadline was reached. |
| `OUTPUT_LIMIT` | Job output exceeded its configured byte cap. |
| `EXECUTABLE_NOT_ALLOWED` | Child-process executable is not in the host allowlist. |
| `PROCESS_CWD_OUTSIDE_WORKSPACE` | Child-process working directory resolves outside the approved workspace. |
| `INVALID_PROCESS_ARGUMENTS` | Child-process arguments are not a bounded string array. |
| `DUPLICATE_PROCESS_JOB` | A process job ID is already active in the host process map. |

`NOT_SUPPORTED` is a nested result status for an unavailable provider action, not a successful pause/resume. Provider results may also be `BLOCKED`; Android and WebView host capabilities remain `NOT RUN` until real host evidence exists.

## AXON capability mapping

| AXON capability ID / app intent | AXON Code operation | State / note |
|---|---|---|
| `axon.code.capabilities.read` | `capabilities.read` | Direct mapping. |
| `axon.code.project.inspect` | `project.inspect` | Provider currently blocked unless configured. |
| `axon.code.job.submit` | `job.submit` | Direct mapping; executor must be host-registered. |
| `axon.code.job.status` | `job.status` | Direct mapping. |
| `axon.code.job.pause` | `job.pause` | Direct mapping; provider-specific, otherwise NOT_SUPPORTED. |
| `axon.code.job.resume` | `job.resume` | Direct mapping; provider-specific, otherwise NOT_SUPPORTED. |
| `axon.code.job.cancel` | `job.cancel` | Direct mapping. |
| `axon.code.job.results` | `job.results` | Direct mapping, owner/scope checked. |
| `axon.code.workspace.export` | `workspace.export` | Provider currently blocked unless configured. |
| AXON Tools screen routing ID | OPEN | Exact main-app capability ID is not available in the AXON Code source; the Tools-to-Brain Director must supply it. |
| AXON background queue orchestration ID | OPEN | Exact AXON-side capability ID and lifecycle dispatcher are outside this workstream. |

## Screen contract

`docs/AXON_CODE_SCREEN_CONTRACT.json` lists every current `ui/index.html` element ID, its command name, capability ID, and the UI state to display for each capability status. `enabled` is permitted only for `TESTED`; `BUILT`, `BLOCKED`, and `NOT RUN` are disabled with an explanation; `NOT IMPLEMENTED` is hidden. The build-time test checks every contract ID against `build/ui/index.html`.
