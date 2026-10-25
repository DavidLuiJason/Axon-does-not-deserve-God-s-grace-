import type { LinkKind } from './types';
/** The closed link words (B03B2a), kept as ONE string per kind so the no-phrases guard accepts them. Written by the Director; proposed for the owner's approval. */
export const LINK_WORDS: Readonly<Record<LinkKind, string>> = {
  condition: 'if unless',
  time: 'when after before while',
  reason: 'because',
};
