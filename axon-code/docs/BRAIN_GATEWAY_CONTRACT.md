# AXON Code Brain Gateway Contract (Round 14 Continuation 4)

AXON Code exposes a JSON-only gateway; it imports no AXON application modules. Callers are `USER` or `AXON_BRAIN` and must supply caller identity, session, project/workspace scope, explicit permissions, request ID, audit ID, and a single-use approval.

Supported operations: `capabilities.read`, `project.inspect`, `job.submit`, `job.status`, `job.pause`, `job.resume`, `job.cancel`, `job.results`, and `workspace.export`. An approval is bound to the SHA-256 of the exact operation, payload, project ID, and workspace ID; it expires and is consumed once. Audit records retain caller, operation, project, request hash, and outcome.

Jobs persist owner, `origin` (`user` or `AXON`), project/workspace, state, timestamps, deadline, quota, output cap, and result. States are `queued`, `running`, `paused`, `completed`, `failed`, `cancelled`, and `interrupted`. A restart can inspect persisted state; active jobs require runtime-specific recovery. This implementation uses the supplied persistence adapter; durability across process restart depends on that adapter.

Pause/resume is `NOT_SUPPORTED` unless a real host process-suspension or runtime checkpoint adapter is installed. No such host adapter is claimed here. Android foreground-service background execution is NOT RUN. Workspace export and project inspection are adapters supplied by the host; an absent adapter must report BLOCKED. Project-controlled test execution remains BLOCKED until OS-level confinement exists.
