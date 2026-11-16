// P08 ORCHESTRATOR (pure wrapper). Puts repair, the existing brain, an independent re-check of tool answers, and reflection
// around ANY brain that has `askWithTrace`. It edits no existing file. Modes:
//   off    : plain pass-through.
//   shadow : the reply is exactly the brain's reply for the owner's exact words; the orchestrator only RECORDS what repair and
//            verification would have done (the default, and the safe way to measure it on real traffic).
//   on     : repair is applied (and said out loud), a repair that needs a question asks it, and a tool answer that FAILS its
//            own re-check is held back instead of shown.
import { repairMessage } from '../repair/repair.ts';
import type { RepairResult } from '../repair/repair.ts';
import { verifyOutcome } from '../verify/verify.ts';
import type { VerifyReport } from '../verify/verify.ts';
import { reflect } from '../reflect/reflect.ts';
import type { Reflection, StepRecord } from '../reflect/reflect.ts';
import { verifyToolReply } from '../../../safety/toolVerifiers.ts';

export type OrchestratorMode = 'off' | 'shadow' | 'on';
export type ReplyLike = { readonly content: string; readonly source: string; readonly taskId?: string };
export type BrainLike<T extends ReplyLike = ReplyLike> = {
  askWithTrace(request: { text: string; place: string }): Promise<{ reply: T; trace: unknown }>;
};
export type Orchestration = {
  readonly mode: OrchestratorMode;
  readonly repair: RepairResult | null;
  readonly effectiveText: string;
  readonly verification: { readonly toolId: string; readonly report: VerifyReport; readonly note: string } | null;
  readonly reflection: Reflection | null;
  readonly replyChanged: boolean;
  readonly problems: readonly string[];
};
export type OrchestratorOptions = { readonly mode?: OrchestratorMode; readonly memoryAllowed?: boolean };

const ASSUMPTION = 'an independent recheck of the quoted text agrees with the tool';

export function createOrchestrator<T extends ReplyLike>(brain: BrainLike<T>, options: OrchestratorOptions = {}) {
  const mode: OrchestratorMode = options.mode ?? 'shadow';
  const memoryAllowed = options.memoryAllowed === true;
  let turn = 0;

  async function ask(request: { text: string; place: string }): Promise<{ reply: ReplyLike; trace: unknown; orchestration: Orchestration }> {
    turn++;
    const problems: string[] = [];
    if (mode === 'off') {
      const out = await brain.askWithTrace(request);
      return { reply: out.reply, trace: out.trace, orchestration: { mode, repair: null, effectiveText: request.text, verification: null, reflection: null, replyChanged: false, problems } };
    }
    let repair: RepairResult | null = null;
    try {
      const r = repairMessage({ text: request.text });
      if (r.ok) repair = r.value; else problems.push('repair refused the input: ' + r.error);
    } catch { problems.push('repair failed'); }

    if (mode === 'on' && repair && repair.verdict === 'ASK' && repair.askQuestion) {
      return { reply: { content: repair.askQuestion, source: 'orchestrator:repair' }, trace: null, orchestration: { mode, repair, effectiveText: request.text, verification: null, reflection: null, replyChanged: true, problems } };
    }
    const repaired = mode === 'on' && repair !== null && repair.verdict === 'REPAIRED';
    const effectiveText = repaired && repair ? repair.reading : request.text;
    const out = await brain.askWithTrace({ text: effectiveText, place: request.place });
    let reply: ReplyLike = out.reply;
    let replyChanged = false;

    let verification: Orchestration['verification'] = null;
    const isTool = reply.source.startsWith('runner:');
    const toolId = isTool ? reply.source.slice('runner:'.length) : '';
    if (isTool) {
      try {
        const v = verifyToolReply({ toolId, message: effectiveText, replyContent: reply.content });
        const input = {
          clauses: [{ id: 'c1', required: true }],
          steps: [{ clauseId: 'c1', toolId, assumption: ASSUMPTION, reported: reply.content.includes('COMPLETED') ? ('success' as const) : ('failure' as const), output: v.output, check: v.check }],
          priorFailedAssumptions: [] as string[],
        };
        const r = verifyOutcome(input);
        if (r.ok) verification = { toolId, report: r.value, note: v.note }; else problems.push('verification refused: ' + r.error);
      } catch { problems.push('verification failed'); }
    }
    if (mode === 'on') {
      if (verification && verification.report.overall === 'FAILED' && reply.content.includes('COMPLETED')) {
        reply = { content: 'I ran ' + toolId + ', but my own re-check did not match its answer, so I am not giving you that result. Nothing was changed.', source: 'orchestrator:verify', ...(reply.taskId ? { taskId: reply.taskId } : {}) };
        replyChanged = true;
      } else if (repaired && repair) {
        reply = { ...reply, content: 'I read your message as: ' + repair.reading + '\n\n' + reply.content };
        replyChanged = true;
      }
    }

    let reflection: Reflection | null = null;
    try {
      const verified = verification !== null && verification.report.mayClaimSuccess;
      const steps: StepRecord[] = isTool ? [{ toolId, ok: out.reply.content.includes('COMPLETED'), verified, assumption: ASSUMPTION }] : [];
      const failedCheck = verification !== null && verification.report.overall === 'FAILED';
      const status = out.reply.source === 'foundation' ? 'ABANDONED' : isTool && !out.reply.content.includes('COMPLETED') ? 'FAILED' : 'SUCCESS';
      const r = reflect({ taskId: out.reply.taskId ?? 'turn-' + turn, goal: effectiveText.slice(0, 200) || 'empty request', status, steps, wrongAssumptions: failedCheck ? [ASSUMPTION] : [], ownerCorrections: [], memoryAllowed });
      if (r.ok) reflection = r.value; else problems.push('reflection refused: ' + r.error);
    } catch { problems.push('reflection failed'); }

    return { reply, trace: out.trace, orchestration: { mode, repair, effectiveText, verification, reflection, replyChanged, problems } };
  }
  return { ask, mode };
}
