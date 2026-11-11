/** Pure preflight for direct-user file rename/move operations. Persistence is performed by the workbench transaction. */
export type FileOperation = 'rename' | 'move';
export interface FileOperationPlan { operation: FileOperation; source: string; destination: string; }
function portablePath(path: unknown): path is string {
  if (typeof path !== 'string' || !path.trim() || path.length > 240 || path.includes('\\') || /%(?:2e|2f|5c)/i.test(path) || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  const parts = path.split('/');
  return parts.every(part => Boolean(part) && part !== '.' && part !== '..' && !/[\u0000-\u001f\u007f]/.test(part) && !/[. ]$/.test(part) && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part));
}
export function planFileOperation(operation: FileOperation, source: unknown, destination: unknown, existingPaths: readonly string[]): FileOperationPlan {
  if (operation !== 'rename' && operation !== 'move') throw new Error('Unsupported file operation.');
  if (!portablePath(source) || !portablePath(destination)) throw new Error('File path is unsafe or non-portable.');
  if (source === destination) throw new Error('Source and destination are identical.');
  if (!existingPaths.includes(source)) throw new Error('Source file does not exist.');
  if (existingPaths.includes(destination)) throw new Error('Destination already exists.');
  // Director fix (Round 14 verification): a project must also open on case-insensitive systems, so a name that differs only in letter case from ANOTHER existing file collides.
  const lowerDestination = destination.toLowerCase();
  if (existingPaths.some((path) => path !== source && path.toLowerCase() === lowerDestination)) throw new Error('Destination already exists (names differ only in letter case).');
  const sourceDirectory = source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '';
  const destinationDirectory = destination.includes('/') ? destination.slice(0, destination.lastIndexOf('/')) : '';
  if (operation === 'rename' && sourceDirectory !== destinationDirectory) throw new Error('Rename must remain in the same directory; use move to change directories.');
  if (operation === 'move' && source.split('/').at(-1) !== destination.split('/').at(-1) && source.slice(0, source.lastIndexOf('/') + 1) === destination.slice(0, destination.lastIndexOf('/') + 1)) throw new Error('Use rename to change a filename in the same directory.');
  return Object.freeze({ operation, source, destination });
}
