// SI3e glue: read the screen fresh, ask the action gate, and release an action to the native executor only if allowed
// or approved. No UI and no caller yet. `source` is a structure source (structure-source.mjs).
import { proposeAction, confirmProposal } from './action-gate.mjs';

export function createScreenActor({ source, apps = null, policy = {}, now = () => Date.now() }) {
  const history = [];
  return {
    async propose(request, readOptions = {}, preRead = null) {
      let structure = preRead;
      if (request?.kind !== 'open-app' && !structure) {
        structure = await source.readScreen({ blockedPackages: policy.blockedPackages ?? [], ...readOptions });
        if (!structure.ok) return { proposal: { decision: 'refuse', code: 'no-screen', reason: structure.help ?? structure.reason }, structure };
      }
      return { proposal: proposeAction(structure, request, { policy, now: now(), history }), structure };
    },
    async execute(proposal, answer = {}) {
      const released = confirmProposal(proposal, answer, { policy, now: now() });
      if (!released.execute) return { ok: false, executed: false, code: released.reason };
      if (released.payload.kind === 'open-app') {
        if (!apps?.openApp) return { ok: false, executed: false, code: 'open-app-not-built' };
        const opened = await apps.openApp(released.payload.packageName);
        if (opened?.ok) history.push(now());
        return { ok: Boolean(opened?.ok), executed: Boolean(opened?.ok), code: opened?.code ?? 'no-result' };
      }
      const result = await source.performAction(released.payload);
      if (result?.ok) history.push(now());
      return { ok: Boolean(result?.ok), executed: Boolean(result?.ok), code: result?.code ?? 'no-result' };
    },
  };
}
