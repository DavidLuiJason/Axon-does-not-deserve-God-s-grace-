/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure TypeScript media operation helper. No DOM or React.
 */
export interface OpHistory<T> { ops: T[]; redo: T[] }
export function emptyOpHistory<T>(): OpHistory<T> { return { ops: [], redo: [] }; }
export function canUndoOp<T>(h: OpHistory<T>): boolean { return h.ops.length > 0; }
export function canRedoOp<T>(h: OpHistory<T>): boolean { return h.redo.length > 0; }
export function pushOp<T>(h: OpHistory<T>, op: T): OpHistory<T> { return { ops: [...h.ops, op].slice(-200), redo: [] }; }
export function undoOp<T>(h: OpHistory<T>): OpHistory<T> { return h.ops.length ? { ops: h.ops.slice(0,-1), redo: [...h.redo,h.ops[h.ops.length-1]] } : { ops:[...h.ops], redo:[...h.redo] }; }
export function redoOp<T>(h: OpHistory<T>): OpHistory<T> { return h.redo.length ? { ops:[...h.ops,h.redo[h.redo.length-1]],redo:h.redo.slice(0,-1) } : { ops:[...h.ops],redo:[...h.redo] }; }
export function resetOps<T>(_h: OpHistory<T>): OpHistory<T> { return emptyOpHistory<T>(); }
