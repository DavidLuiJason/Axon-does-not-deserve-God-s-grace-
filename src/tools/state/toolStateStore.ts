// STATE2: the one keeper of a stateful tool's saved state (STATE1 S1 to S4, S8). Pure over an injected storage; no clock, no random, no regex.
// Key axon.toolstate.v1.<toolId>; value JSON { v: 1, toolId, savedAt, state }. Two gates on read here (S2); the runner is the second gate.
// The write function is for the lane's go-live adapter only (S4): tests/toolStateStore.test.ts is the ratchet.
export const TOOL_STATE_PREFIX = 'axon.toolstate.v1.';
export const TOOL_STATE_MAX_CHARS = 100000;
export const TOOL_STATE_SAVE_FAILED_LINE = 'I could not save this.';
export interface ToolStateStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type UnusableReason = 'unreadable' | 'not-json' | 'bad-shape' | 'wrong-version' | 'wrong-tool' | 'too-large';
export type ToolStateRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'ok'; readonly state: unknown; readonly savedAt: string }
  | { readonly kind: 'unusable'; readonly reason: UnusableReason };
export type ToolStateWriteError = 'bad-input' | 'not-serializable' | 'too-large' | 'storage-failed' | 'verify-failed';
export type ToolStateWrite = { readonly ok: true } | { readonly ok: false; readonly error: ToolStateWriteError };

const OK_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
export function validToolId(toolId: unknown): toolId is string {
  if (typeof toolId !== 'string' || toolId.length === 0 || toolId.length > 64) return false;
  for (const ch of toolId) if (!OK_CHARS.includes(ch)) return false;
  return true;
}
export function toolStateKey(toolId: string): string { return TOOL_STATE_PREFIX + toolId; }

/** The app's storage convention (localStorage behind try/catch); null when it does not exist. Android storage pressure is UNMEASURED. */
export function browserToolStateStorage(): ToolStateStorage | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Read error is "unusable", never "absent" (S3): the reply must say the earlier state could not be read. */
export function readToolState(storage: ToolStateStorage, toolId: string): ToolStateRead {
  if (!validToolId(toolId)) return { kind: 'unusable', reason: 'bad-shape' };
  let text: string | null;
  try { text = storage.getItem(toolStateKey(toolId)); } catch { return { kind: 'unusable', reason: 'unreadable' }; }
  if (text === null) return { kind: 'absent' };
  if (typeof text !== 'string') return { kind: 'unusable', reason: 'bad-shape' };
  if (text.length > TOOL_STATE_MAX_CHARS) return { kind: 'unusable', reason: 'too-large' };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { kind: 'unusable', reason: 'not-json' }; }
  if (!isObject(parsed) || !('state' in parsed) || typeof parsed.savedAt !== 'string') return { kind: 'unusable', reason: 'bad-shape' };
  if (parsed.v !== 1) return { kind: 'unusable', reason: 'wrong-version' };
  if (parsed.toolId !== toolId) return { kind: 'unusable', reason: 'wrong-tool' };
  return { kind: 'ok', state: parsed.state, savedAt: parsed.savedAt };
}

/** Sentence for a state that exists but fails a gate (S3). Never acts as if it were fine. */
export function unusableStateLine(toolName: string): string {
  return `I could not read the earlier ${toolName}, so I treat it as gone.`;
}

/** Write, read back, restore the old text when the read-back differs. The caller passes savedAt (no clock here). */
export function writeToolState(storage: ToolStateStorage, toolId: string, state: unknown, savedAt: string): ToolStateWrite {
  if (!validToolId(toolId) || typeof savedAt !== 'string' || state === undefined) return { ok: false, error: 'bad-input' };
  let text: string;
  try { text = JSON.stringify({ v: 1, toolId, savedAt, state }); } catch { return { ok: false, error: 'not-serializable' }; }
  if (typeof text !== 'string') return { ok: false, error: 'not-serializable' };
  if (text.length > TOOL_STATE_MAX_CHARS) return { ok: false, error: 'too-large' };
  const key = toolStateKey(toolId);
  let previous: string | null;
  try { previous = storage.getItem(key); } catch { return { ok: false, error: 'storage-failed' }; }
  try { storage.setItem(key, text); } catch { return { ok: false, error: 'storage-failed' }; }
  let back: string | null = null;
  try { back = storage.getItem(key); } catch { back = null; }
  if (back !== text) {
    try { if (previous === null) storage.removeItem(key); else storage.setItem(key, previous); } catch { /* reported below */ }
    return { ok: false, error: 'verify-failed' };
  }
  return { ok: true };
}

/** S8: the default for "reset the timer" is to remove the key. A key that is still there afterwards is a failure. */
export function clearToolState(storage: ToolStateStorage, toolId: string): ToolStateWrite {
  if (!validToolId(toolId)) return { ok: false, error: 'bad-input' };
  const key = toolStateKey(toolId);
  try { storage.removeItem(key); } catch { return { ok: false, error: 'storage-failed' }; }
  let left: string | null;
  try { left = storage.getItem(key); } catch { return { ok: false, error: 'verify-failed' }; }
  return left === null ? { ok: true } : { ok: false, error: 'verify-failed' };
}
