// SI3e glue: read the screen fresh, ask the action gate, and release an action to the native executor only if allowed
// or approved. No UI and no caller yet. `source` is a structure source (structure-source.mjs).
import { proposeAction, confirmProposal } from './action-gate.mjs';

export function createScreenActor({ source, policy = {}, now = () => Date.now() }) {
  const history = [];
  return {
    async propose(request, readOptions = {}) {
      let structure = null;
      if (request?.kind !== 'open-app') {
        structure = await source.readScreen({ blockedPackages: policy.blockedPackages ?? [], ...readOptions });
        if (!structure.ok) return { proposal: { decision: 'refuse', code: 'no-screen', reason: structure.help ?? structure.reason }, structure };
      }
      return { proposal: proposeAction(structure, request, { policy, now: now(), history }), structure };
    },
    async execute(proposal, answer = {}) {
      const released = confirmProposal(proposal, answer, { policy, now: now() });
      if (!released.execute) return { ok: false, executed: false, code: released.reason };
      if (released.payload.kind === 'open-app') return { ok: false, executed: false, code: 'open-app-not-built' };
      const result = await source.performAction(released.payload);
      if (result?.ok) history.push(now());
      return { ok: Boolean(result?.ok), executed: Boolean(result?.ok), code: result?.code ?? 'no-result' };
    },
  };
}
