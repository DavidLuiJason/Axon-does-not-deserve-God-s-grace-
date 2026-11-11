import type { AutoFixMode, AutoFixResult, CodePatch } from './types.js';

/** Only a final newline is auto-fixable in v0.1. No logic, imports or declarations are rewritten. */
export function proposeSafeFixes(file: string, source: string, mode: AutoFixMode): AutoFixResult {
  if (mode === 'OFF') return { mode, patches: [], applied: false, notes: ['Automatic correction is off; source was not changed.'] };
  const patches: CodePatch[] = [];
  if (source.length > 0 && !source.endsWith('\n') && !source.endsWith('\r')) {
    patches.push({ file, startOffset: source.length, endOffset: source.length, oldText: '', baseText: source, newText: '\n', reason: 'Add the conventional final newline.', safety: 'mechanical' });
  }
  if (mode === 'SUGGEST') return { mode, patches, applied: false, notes: patches.length ? ['Review the proposed mechanical change before applying it.'] : ['No safe mechanical correction was identified.'] };
  return { mode, patches, applied: false, notes: ['SAFE_AUTO_FIX is intentionally non-mutating in this first build. A later workspace layer must apply patches only to a recoverable working copy with undo.'] };
}

export function applyPatch(source: string, patch: CodePatch): string {
  if (patch.baseText !== undefined && source !== patch.baseText) throw new Error('Patch base does not match; refusing to apply a stale patch.');
  if (patch.startOffset < 0 || patch.endOffset < patch.startOffset || patch.endOffset > source.length) throw new Error('Patch range is invalid.');
  if (typeof patch.baseText !== 'string') throw new Error('Patch base does not match: exact source snapshot is missing; refusing to apply it.');
  if (source !== patch.baseText || source.slice(patch.startOffset, patch.endOffset) !== patch.oldText) throw new Error('Patch base does not match; refusing to apply a stale patch.');
  return source.slice(0, patch.startOffset) + patch.newText + source.slice(patch.endOffset);
}
