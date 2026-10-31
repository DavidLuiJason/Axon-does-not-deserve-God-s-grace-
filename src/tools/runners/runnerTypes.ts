/**
 * C2 RUNNER CONTRACT (Director, 2026-10-31). Builders read this file and NEVER change it.
 *
 * WHAT A RUNNER IS: a thin, PURE adapter between typed arguments (already found by the brain, never raw chat text) and ONE existing
 * engine. It runs the engine and returns the engine's own result plus a short plain-words reply. It never decides which tool to run
 * (Resolution does that, FL12), never reads a clock, never uses randomness or storage by itself: everything of that kind arrives in `deps`.
 *
 * ARGUMENTS: `args` is keyed by the SLOT NAMES declared for the tool in `src/brain/mind/schema/actionSchemas.ts`.
 * Value encoding by slot kind (the binder, built later by the Director, produces exactly these):
 *   text      -> string (may be empty; an empty string is a PRESENT value)
 *   number    -> finite number (a whole number too large for a JS number may arrive as a string of digits when the job says so)
 *   yes-no    -> boolean
 *   choice    -> string, one of the choices in the tool's descriptor (`src/tools/engines/legacyDescriptors.ts`)
 *   duration  -> whole number of MILLISECONDS, 0 or more
 *   date      -> string "YYYY-MM-DD"
 *   time      -> whole number, epoch MILLISECONDS (UTC)
 *   quantity  -> { value: number, unit: string }
 *   file      -> never supplied here: a runner that needs a file returns kind 'needs-file'
 * A slot that is absent or `undefined` is NOT supplied. A text slot that stands for structured data (a list, an options record)
 * arrives as JSON text OR as the already-parsed value; the runner accepts both and refuses anything else as 'invalid-input'.
 */
export type RunnerArgs = Readonly<Record<string, unknown>>;

export interface RunnerDeps {
  /** the current time, epoch milliseconds UTC; the only clock a runner may use */
  readonly now: number;
  /** for engines that take `(maxExclusive) => integer in [0, maxExclusive)` */
  readonly randomBelow: (maxExclusive: number) => number;
  /** for engines that take `() => number in [0, 1)` */
  readonly random01: () => number;
  /** the PREVIOUS engine state, for the tools that keep one (timer, stopwatch, tally-counter); opaque to the caller */
  readonly state?: unknown;
}

export type RunnerFailureKind =
  | 'missing-input'   // a needed slot was not supplied; `slot` names it
  | 'invalid-input'   // a slot has the wrong type, an unknown choice, or does not parse; `slot` names it when one slot is to blame
  | 'engine-refused'  // the engine returned its own typed error; put the engine's error code in `message`
  | 'needs-file'      // the request needs a file, which this contract cannot carry
  | 'needs-state';    // the operation needs a previous state and `deps.state` is absent or not a valid state

export interface RunnerFailure {
  readonly ok: false;
  readonly toolId: string;
  readonly kind: RunnerFailureKind;
  readonly slot?: string;
  /** plain words, no developer terms */
  readonly message: string;
}

export interface RunnerSuccess {
  readonly ok: true;
  readonly toolId: string;
  /** the engine's own successful result, UNCHANGED (same fields, same values) */
  readonly result: unknown;
  /** plain words, built ONLY from `result` and the arguments, at most RUNNER_REPLY_LIMIT characters */
  readonly reply: string;
  /** the NEW engine state, for the tools that keep one; must survive JSON.stringify and JSON.parse unchanged */
  readonly state?: unknown;
}

export type RunnerOutcome = RunnerSuccess | RunnerFailure;

export interface ToolRunner {
  /** the exact catalog tool id (src/tools/toolCatalog.ts) */
  readonly toolId: string;
  /** NEVER throws and never rejects: every problem is a RunnerFailure. Never changes `args` or `deps`. Same inputs give the same outcome. */
  run(args: RunnerArgs, deps: RunnerDeps): Promise<RunnerOutcome>;
}

export const RUNNER_REPLY_LIMIT = 2000;

export function runnerFail(toolId: string, kind: RunnerFailureKind, message: string, slot?: string): RunnerFailure {
  return slot === undefined ? { ok: false, toolId, kind, message } : { ok: false, toolId, kind, slot, message };
}

/** Cuts a reply to the limit and says so; returns the text unchanged when it already fits. */
export function shortenReply(text: string, limit: number = RUNNER_REPLY_LIMIT): string {
  if (text.length <= limit) return text;
  const note = ' (shortened; the full result is kept)';
  return text.slice(0, Math.max(0, limit - note.length)) + note;
}
