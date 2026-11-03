/** Safe, bounded extraction of visible screen text. Password values are never returned. */
export type ScreenTreeTextOptions = Readonly<{ maxNodes?: number; maxDepth?: number; maxCharacters?: number }>;
export type ScreenTreeTextError = 'invalid-tree' | 'too-many-nodes' | 'too-deep' | 'too-large';
export type ScreenTreeTextResult =
  | { ok: true; text: string; visitedNodes: number; skippedHiddenNodes: number; redactedPasswordNodes: number; truncated: boolean }
  | { ok: false; error: ScreenTreeTextError; message: string };

export const SCREEN_TREE_TEXT_LIMITS = Object.freeze({ maxNodes: 10_000, maxDepth: 64, maxCharacters: 100_000 });

type WorkItem = { node: unknown; depth: number };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
}

function isPasswordNode(node: Record<string, unknown>): boolean {
  if (node.password === true || node.isPassword === true || node.sensitive === true) return true;
  return [node.type, node.inputType, node.role].some((part) => typeof part === 'string' && part.toLowerCase().includes('password'));
}

/** Accepts one root node or an array of roots. Hidden subtrees are skipped completely. */
export function screenTreeToText(tree: unknown, options: ScreenTreeTextOptions = {}): ScreenTreeTextResult {
  if (tree === null || (typeof tree !== 'object')) return { ok: false, error: 'invalid-tree', message: 'A screen-tree object or array is required.' };
  if (options === null || typeof options !== 'object') return { ok: false, error: 'invalid-tree', message: 'Extraction options must be an object.' };
  const maxNodes = options.maxNodes ?? SCREEN_TREE_TEXT_LIMITS.maxNodes;
  const maxDepth = options.maxDepth ?? SCREEN_TREE_TEXT_LIMITS.maxDepth;
  const maxCharacters = options.maxCharacters ?? SCREEN_TREE_TEXT_LIMITS.maxCharacters;
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > SCREEN_TREE_TEXT_LIMITS.maxNodes
      || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > SCREEN_TREE_TEXT_LIMITS.maxDepth
      || !Number.isInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > SCREEN_TREE_TEXT_LIMITS.maxCharacters) {
    return { ok: false, error: 'invalid-tree', message: 'Limits must be positive integers within the engine ceilings.' };
  }
  const roots = Array.isArray(tree) ? tree : [tree];
  const stack: WorkItem[] = [];
  for (let i = roots.length - 1; i >= 0; i -= 1) stack.push({ node: roots[i], depth: 0 });
  const lines: string[] = [];
  let visitedNodes = 0, skippedHiddenNodes = 0, redactedPasswordNodes = 0, characterCount = 0, truncated = false;
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (!isObject(current.node)) return { ok: false, error: 'invalid-tree', message: 'Every screen-tree node must be an object.' };
    if (current.depth > maxDepth) return { ok: false, error: 'too-deep', message: 'The screen tree exceeds the configured depth limit.' };
    visitedNodes += 1;
    if (visitedNodes > maxNodes) return { ok: false, error: 'too-many-nodes', message: 'The screen tree exceeds the configured node limit.' };
    const node = current.node;
    if (node.visible === false || node.hidden === true || node.displayed === false) {
      skippedHiddenNodes += 1;
      continue;
    }
    if (isPasswordNode(node)) {
      const marker = '[REDACTED]';
      redactedPasswordNodes += 1;
      const separatorLength = lines.length > 0 ? 1 : 0;
      const remaining = maxCharacters - characterCount - separatorLength;
      if (remaining < marker.length) { truncated = true; break; }
      lines.push(marker);
      characterCount += separatorLength + marker.length;
      continue;
    }
    const text = cleanText(node.text ?? node.contentDescription ?? node.label ?? node.value);
    if (text.length > 0) {
      const separatorLength = lines.length > 0 ? 1 : 0;
      const remaining = maxCharacters - characterCount - separatorLength;
      if (remaining <= 0) { truncated = true; break; }
      if (text.length > remaining) {
        lines.push(text.slice(0, remaining));
        characterCount += separatorLength + remaining;
        truncated = true;
        break;
      }
      lines.push(text);
      characterCount += separatorLength + text.length;
    }
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) return { ok: false, error: 'invalid-tree', message: 'A node children field must be an array when present.' };
      if (stack.length + node.children.length + visitedNodes > maxNodes) {
        return { ok: false, error: 'too-many-nodes', message: 'The screen tree exceeds the configured node limit.' };
      }
      for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push({ node: node.children[i], depth: current.depth + 1 });
    }
  }
  return { ok: true, text: lines.join('\n'), visitedNodes, skippedHiddenNodes, redactedPasswordNodes, truncated };
}
